
import {test,expect} from '@playwright/test';
async function setup(page){
 const now=Date.now(),rows=Array.from({length:65},(_,i)=>({id:'voice-'+String(i).padStart(3,'0'),user_id:'listen-fixture',source:'voice',text:'Recording '+i,phase:'waning-gibbous',audio_path:'listen-fixture/'+i+'.webm',created_at:new Date(now-i*60000).toISOString()}));
 const queries=[];
 await page.addInitScript(()=>{
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'listen-fixture'}}));
  window.testMedia=[];window.chimes=0;
  window.Audio=class extends EventTarget{
   currentTime=0;duration=12;readyState=1;paused=true;seeking=false;
   constructor(){super();window.testMedia.push(this);}
   async play(){this.paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));}
   pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
   load(){} removeAttribute(){}
   finish(){this.currentTime=12;this.dispatchEvent(new Event('ended'));}
  };
  // Windows Playwright WebKit omits Web Audio. Exercise the scheduling contract
  // there with a minimal context; Chrome exercises the native AudioContext.
  if(!window.AudioContext&&!window.webkitAudioContext){
   window.AudioContext=class {
    state='running';currentTime=0;destination={};
    async resume(){} async close(){this.state='closed';}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}
   };
  }
  const Context=window.AudioContext||window.webkitAudioContext;
  if(Context){const resume=Context.prototype.resume;Context.prototype.resume=function(){window.testAudioContext=this;return resume.call(this);};const original=Context.prototype.createOscillator;Context.prototype.createOscillator=function(){const o=original.call(this),start=o.start.bind(o);o.start=(...args)=>{window.chimes++;return start(...args);};return o;};}
 });
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
  if(u.pathname.includes('/storage/v1/object/sign/'))return route.fulfill({json:{signedURL:'/object/sign/echo-audio/fixture.webm?token=synthetic'}});
  if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='is.null'){
   queries.push(u);const and=u.searchParams.get('and')||'',ascending=u.searchParams.get('order')?.includes('.asc');
   let result=[...rows];
   const since=and.match(/created_at.gte.([^,)]+)/)?.[1],until=and.match(/created_at.lt.([^,)]+)/)?.[1];
   if(since)result=result.filter(e=>e.created_at>=since);if(until)result=result.filter(e=>e.created_at<until);
   const after=and.match(/or\(created_at.(gt|lt).([^,)]+)/);
   if(after)result=result.filter(e=>after[1]==='gt'?e.created_at>after[2]:e.created_at<after[2]);
   if(u.searchParams.has('phase'))result=result.filter(e=>e.phase===u.searchParams.get('phase').slice(3));
   if(ascending)result.reverse();
   return route.fulfill({json:result.slice(0,Number(u.searchParams.get('limit')||30))});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/beta#/listen');
 await expect(page.locator('#groups [data-echo]')).toHaveCount(30);
 await expect(page.locator('.echo-page-status')).not.toContainText('Loading');
 return {rows,queries};
}
test('latest first, visible transport, and chronological paging through the full selection',async({page},info)=>{
 const {queries}=await setup(page);
 await expect(page.locator('#order')).toHaveValue('newest');
 await expect(page.locator('#groups [data-echo]').first()).toHaveAttribute('data-echo','voice-000');
 await expect(page.locator('#voice-title')).toHaveText('Recording 0');
 await page.locator('#transport-play').click();await expect(page.locator('#transport-play')).toContainText('Pause');
 await page.locator('#transport-play').click();await expect(page.locator('#transport-play')).toContainText('Play');
 await page.locator('#order').selectOption('oldest');
 await expect(page.locator('#groups [data-echo]').first()).toHaveAttribute('data-echo','voice-064');
 await expect(page.locator('#voice-title')).toHaveText('Recording 64');
 await page.locator('#transition-sound').uncheck();
 await page.locator('#groups [data-echo]').last().click();
 await expect(page.locator('#voice-title')).toHaveText('Recording 35');
 await expect(page.locator('#player-status')).toHaveText('Listening · continues automatically');
 await expect.poll(()=>page.evaluate(()=>window.testAudioContext?.state||'disabled')).not.toBe('suspended');
 await page.evaluate(()=>window.testMedia.at(-1).finish());
 await expect(page.locator('#voice-title')).toHaveText('Recording 34');
 await expect(page.locator('#groups [data-echo]')).toHaveCount(60);
 expect(queries.some(u=>u.searchParams.get('and')?.includes('or(created_at.gt.'))).toBe(true);
 await page.locator('#next').click();await expect(page.locator('#voice-title')).toHaveText('Recording 33');
 await page.locator('#previous').click();await expect(page.locator('#voice-title')).toHaveText('Recording 34');
 await page.locator('#transport-play').scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await page.locator('#transport-play').boundingBox()).height).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:info.outputPath('listening-mobile.png')});
});
test('transition sound separates recordings, pause cancels transition, preference persists',async({page})=>{
 await setup(page);
 await page.locator('#transport-play').click();
 await expect(page.locator('#player-status')).toHaveText('Listening · continues automatically');
 await expect.poll(()=>page.evaluate(()=>window.testAudioContext?.state||'disabled')).not.toBe('suspended');
 await page.evaluate(()=>window.testMedia.at(-1).finish());
 await expect(page.locator('#player-status')).toHaveText('Next recording…');
 await page.locator('#transport-play').click();
 await page.waitForTimeout(800);
 await expect(page.locator('#voice-title')).toHaveText('Recording 0');
 expect(await page.evaluate(()=>window.chimes)).toBe(1);
 await page.locator('#transition-sound').uncheck();
 await page.locator('#next').click();
 await page.locator('#transport-play').click();
 await expect(page.locator('#player-status')).toHaveText('Listening · continues automatically');
 await expect.poll(()=>page.evaluate(()=>window.testAudioContext?.state||'disabled')).not.toBe('suspended');
 await page.evaluate(()=>window.testMedia.at(-1).finish());
 await expect(page.locator('#voice-title')).toHaveText('Recording 2');
 expect(await page.evaluate(()=>window.chimes)).toBe(1);
 await page.reload();await expect(page.locator('#transition-sound')).not.toBeChecked();
});
test('date and phase filter query the chosen selection and stop the old recording',async({page})=>{
 const {queries}=await setup(page);
 await page.locator('#transport-play').click();
 const today=await page.evaluate(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
 await page.locator('#day-filter').fill(today);await page.locator('#day-filter').press('Tab');
 await expect.poll(()=>queries.at(-1).searchParams.get('and')).toContain(today);
 await expect(page.locator('#transport-play')).toContainText('Play');
 await page.locator('#phase-filter').selectOption('new');
 await expect(page.locator('#groups [data-echo]')).toHaveCount(0);
 await expect(page.locator('#transport-play')).toBeDisabled();
 expect(await page.evaluate(()=>window.testMedia.every(a=>a.paused))).toBe(true);
});


test('missing Web Audio still leaves a gap and continues playback',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
 await page.locator('#transport-play').click();
 await expect(page.locator('#player-status')).toHaveText('Listening · continues automatically');
 await page.evaluate(()=>window.testMedia.at(-1).finish());
 await expect(page.locator('#player-status')).toHaveText('Next recording…');
 await expect(page.locator('#voice-title')).toHaveText('Recording 1');
});
