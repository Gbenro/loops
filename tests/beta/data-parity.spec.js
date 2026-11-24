import {test,expect} from '@playwright/test';
import {generateVerifyToken,unlockWithPassphrase,encryptText} from '../../src/lib/encryption.js';
test('mobile Beta unlocks private Echoes and edits Classic checklists without exposing ciphertext',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const verify=await generateVerifyToken('synthetic passphrase','fixture-user');
 const key=await unlockWithPassphrase('synthetic passphrase','fixture-user',verify);
 const cipher=await encryptText('An original private moment',key);
 const echo={id:'private-echo',user_id:'fixture-user',is_encrypted:true,text:cipher,source:'text',created_at:'2026-11-01T12:00:00Z'};
 const loop={id:'fixture-loop',user_id:'fixture-user',title:'A gentle intention',status:'active',subtasks:[{id:'review',text:'Review this phase',done:false,isPhaseCheckpoint:true}],created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-01T12:00:00Z'};
 await page.addInitScript(({echo,loop})=>{
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fixture-user'}}));
  localStorage.setItem('cosmic_echoes_v1',JSON.stringify([echo]));localStorage.setItem('cosmic_loops_v1',JSON.stringify([loop]));
 },{echo,loop});
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname.endsWith('/profiles'))return route.fulfill({json:[{encryption_verify_token:verify}]});
  if(url.searchParams.get('deleted_at')==='not.is.null')return route.fulfill({json:[]});
  if(url.pathname.endsWith('/loops')){
   if(request.method()==='PATCH')Object.assign(loop,request.postDataJSON());
   return route.fulfill({json:[loop]});
  }
  if(url.pathname.endsWith('/echoes'))return route.fulfill({json:[echo]});
  return route.fulfill({json:[]});
 });
 await page.goto('/beta#/echo/private-echo');
 await expect(page.getByRole('heading',{name:'Private Echo',exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText(cipher);
 await page.getByRole('button',{name:'Unlock private Echoes',exact:true}).click();
 await page.locator('[name="passphrase"]').fill('synthetic passphrase');
 await page.getByRole('button',{name:'Unlock this session'}).click();
 await expect(page.locator('.transcript')).toContainText('An original private moment');
 expect(await page.evaluate(()=>localStorage.getItem('cosmic_echoes_v1'))).not.toContain('An original private moment');
 await page.screenshot({path:'test-results/private-echo-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Lock',exact:true}).click();
 await expect(page.locator('.transcript')).not.toContainText('An original private moment');
 await page.evaluate(()=>location.hash='/loops');
 const checkpoint=page.locator('[data-action="step-toggle"]');
 await expect(checkpoint).toContainText('Review this phase');
 await checkpoint.click();await expect(checkpoint).toHaveAttribute('aria-pressed','true');
 await page.getByPlaceholder('A small next step…').fill('Take a walk');
 await page.getByRole('button',{name:'Add step',exact:true}).click();
 await expect(page.locator('.loop-checklist')).toContainText('Take a walk');
 await page.screenshot({path:'test-results/checklist-mobile.png',fullPage:true});
 expect(loop.subtasks[0].isPhaseCheckpoint).toBe(true);expect(loop.subtasks[0].done).toBe(true);
 expect(errors).toEqual([]);
});
