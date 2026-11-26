import {test,expect} from '@playwright/test';

for(const tags of [[],['A new connection']]){
 test('quiet Echo and menu reveal with '+tags.length+' threads',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  const echo={id:'simple-echo',user_id:'fixture-user',text:'A moment to keep in my own words.',source:'text',tags,created_at:'2026-11-25T12:00:00Z'};
  await page.addInitScript(({echo})=>{
   localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fixture-user',email:'fixture@example.test'}}));
   localStorage.setItem('cosmic_echoes_v1',JSON.stringify([echo]));
  },{echo});
  await page.routeWebSocket('**/*',ws=>ws.close());
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.pathname.endsWith('/echoes')&&url.searchParams.get('deleted_at')!=='not.is.null')return route.fulfill({json:[echo]});
   return route.fulfill({json:[]});
  });
  await page.goto('/beta#/echo/simple-echo');
  await expect(page.locator('.transcript')).toContainText(echo.text);
  const more=page.locator('.echo-more');
  await expect(more).not.toHaveAttribute('open','');
  await expect(page.locator('.detail-reflections')).not.toBeVisible();
  await more.locator('summary').press('Enter');
  await expect(page.locator('.detail-reflections')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('No Threads connected yet.');
  await expect(page.getByRole('heading',{name:'Nearby in your field'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Threads through this moment'})).toHaveCount(tags.length?1:0);
  await more.locator('summary').click();
  await page.screenshot({path:testInfo.outputPath('echo-simple.png'),fullPage:true});

  // Seed recovery metadata: this test checks menu discovery, not audio persistence.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
   const req=indexedDB.open('luna_draft_audio_db',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('draft_recordings',{keyPath:'id'});
   req.onerror=()=>reject(req.error);
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('draft_recordings','readwrite');
    for(let i=0;i<2;i++)tx.objectStore('draft_recordings').put({id:'draft_ui_'+i,userId:'fixture-user',status:'captured',duration:1,startedAt:new Date().toISOString()});
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
   };
  }));
  await page.goto('/beta#/sky');
  await expect(page.locator('.topbar')).not.toContainText(/Classic Luna|fixture|Luna Beta|Sign in/);
  await expect(page.locator('main #draft-recovery')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('sky-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await expect(page.locator('#sidebar [data-action="open-auth"]')).toBeVisible();
  await expect(page.locator('#sidebar a[href="/"]')).toBeVisible();
  const threads=page.locator('#sidebar a[href="#/threads"]');
  if(!tags.length){await expect(threads).not.toBeVisible();await page.locator('#menu-more summary').click();}
  await expect(threads).toBeVisible();
  await expect(page.locator('#menu-recovery')).toContainText('Recover recording (2)');
  await page.locator('#draft-recovery').click();
  await expect(page.getByRole('heading',{name:'Recover a recording',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Listen and recover'})).toHaveCount(2);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('menu-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Close navigation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open navigation',exact:true})).toHaveAttribute('aria-expanded','false');
  await page.setViewportSize({width:1440,height:1000});
  await expect(page.locator('#sidebar [data-action="open-auth"]')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('sky-desktop.png'),fullPage:true});
 });
}
