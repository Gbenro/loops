
import {test,expect} from '@playwright/test';
const phases=['new','waxing-crescent','first-quarter','waxing-gibbous','full','waning-gibbous','last-quarter','waning-crescent'];
async function fixture(page,{pendingMic=false,storageFail=false,route='field'}={}){
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({pendingMic,storageFail})=>{
  if(storageFail){const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(value?.blob)throw new DOMException('Synthetic full device','QuotaExceededError');return put.call(this,value,...args);};}
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'quick-owner'}}));
  window.AudioContext=undefined;window.webkitAudioContext=undefined;
  window.micRequests=0;window.recordStarts=0;window.stoppedTracks=0;window.recorders=[];
  const stream={getTracks:()=>[{stop(){window.stoppedTracks++;}}]};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{window.micRequests++;return pendingMic?new Promise(resolve=>{window.resolveMic=()=>resolve(stream);}):Promise.resolve(stream);}}});
  window.MediaRecorder=class extends EventTarget{
   static isTypeSupported(){return true;}
   constructor(stream,options){super();this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';window.recorders.push(this);}
   start(){this.state='recording';window.recordStarts++;}
   stop(){if(this.state==='inactive')return;this.state='inactive';queueMicrotask(()=>{const e=new Event('dataavailable');e.data=new Blob(['synthetic audio '.repeat(100)],{type:this.mimeType});this.dispatchEvent(e);this.dispatchEvent(new Event('stop'));this.onstop?.();});}
  };
 },{pendingMic,storageFail});
 const rows=phases.map((phase,i)=>({id:'phase-'+i,user_id:'quick-owner',source:'text',text:'Moment '+phase,created_at:new Date(Date.now()-i*60000).toISOString(),phase}));
 const data={rows,voiceRequests:0};
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();
  if(u.pathname.includes('/transcribe'))return r.fulfill({json:{text:'A quick spoken moment.'}});
  if(u.pathname.includes('synthesize-speech')){data.voiceRequests++;return r.fulfill({status:503,json:{error:'Fixture'}});}
  if(u.pathname.endsWith('/chat_sessions'))return r.fulfill({json:[{id:'fixture-chat'}]});
  if(u.pathname.endsWith('/chat_messages'))return r.fulfill({json:[{id:'reply',role:'assistant',content:'A response to listen to.',metadata:{}}]});
  if(u.pathname.endsWith('/echoes')){
   if(r.request().method()==='POST')return r.fulfill({json:[JSON.parse(r.request().postData())]});
   return r.fulfill({json:u.searchParams.get('deleted_at')==='not.is.null'?[]:rows});
  }
  return r.fulfill({json:[]});
 });
 await page.goto('/beta#/'+route);
 return data;
}
async function doubleTap(page,testInfo){
 const button=page.locator('.capture-nav');
 if(testInfo.project.name==='mobile-webkit'){await button.tap();await button.tap();}
 else await button.dblclick({delay:60});
 await expect(page.locator('#modal.capture-compact')).toBeVisible();
}
test('single tap retains full auto-recording; minimizing and expanding keep the same recording',async({page})=>{
 await fixture(page);
 await page.locator('.capture-nav').click();
 await expect(page.locator('[data-action="record-stop"]')).toBeVisible();
 expect(await page.locator('#modal').evaluate(e=>e.matches(':modal'))).toBe(true);
 await page.locator('[data-action="capture-minimize"]').click();
 await expect(page.locator('#modal.capture-compact')).toBeVisible();
 expect(await page.locator('#modal').evaluate(e=>e.matches(':modal'))).toBe(false);
 await page.locator('[data-action="capture-expand"]').click();
 await expect(page.locator('#capture-body')).toBeVisible();
 expect(await page.evaluate(()=>window.recordStarts)).toBe(1);
 expect(await page.evaluate(()=>window.recorders[0].state)).toBe('recording');
 await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('#capture-body')).toHaveValue('A quick spoken moment.');
});
test('double tap records once while browsing and keeps the transcript ready on the same page',async({page},info)=>{
 await fixture(page);
 await doubleTap(page,info);
 await expect(page.locator('[data-action="record-stop"]')).toBeVisible();
 await page.locator('.mobile-nav a[href="#/echoes"]').click();
 await expect(page).toHaveURL(/#\/echoes$/);
 await expect(page.locator('#modal.capture-compact')).toBeVisible();
 expect(await page.evaluate(()=>window.recordStarts)).toBe(1);
 expect(await page.evaluate(()=>window.micRequests)).toBe(1);
 expect(await page.locator('#modal').evaluate(e=>e.matches(':modal'))).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('quick-recording.png')});
 await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('.quick-transcript')).toHaveText('A quick spoken moment.');
 await expect(page.getByRole('button',{name:'Keep Echo',exact:true})).toBeEnabled();
 await expect(page).toHaveURL(/#\/echoes$/);
 expect(await page.evaluate(()=>window.stoppedTracks)).toBeGreaterThan(0);
});
test('closing a pending quick recorder releases late microphone access without starting',async({page},info)=>{
 await fixture(page,{pendingMic:true});
 await doubleTap(page,info);
 await expect.poll(()=>page.evaluate(()=>window.micRequests)).toBe(1);
 await page.locator('#modal [data-action="close-modal"]').click();
 await expect(page.locator('#modal')).not.toBeVisible();
 await page.evaluate(()=>window.resolveMic());
 await expect.poll(()=>page.evaluate(()=>window.stoppedTracks)).toBe(1);
 expect(await page.evaluate(()=>window.recordStarts)).toBe(0);
});
test('quick capture prevents Luna speech and a second microphone session',async({page},info)=>{
 const data=await fixture(page,{route:'chat'});
 await expect(page.locator('[data-action="play-chat-voice"]')).toBeVisible();
 await doubleTap(page,info);
 await expect(page.locator('[data-action="record-stop"]')).toBeVisible();
 await page.locator('[data-action="play-chat-voice"]').click();
 expect(data.voiceRequests).toBe(0);
 await page.locator('[data-action="chat-voice-record"]').click();
 expect(await page.evaluate(()=>window.micRequests)).toBe(1);
});
test('phase shapes are visible beside the correct labels in Echo lists and details',async({page},info)=>{
 await fixture(page,{route:'echoes'});
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(8);
 const moons=page.locator('#echo-results .echo-meta .moon-disc');
 expect(await moons.count()).toBe(8);
 expect(await moons.first().getAttribute('width')).toBe('24');
 const shapes=await moons.evaluateAll(nodes=>nodes.map(n=>n.querySelector('g').innerHTML));
 expect(new Set(shapes).size).toBe(8);
 await page.locator('#echo-results a[href="#/echo/phase-1"]').click();
 await expect(page.locator('.echo-phase-label')).toHaveText('Waxing Crescent');
 await expect(page.locator('.echo-phase-moon .moon-disc')).toHaveAttribute('width','36');
 await page.screenshot({path:info.outputPath('echo-phase.png')});
});
test('navigating away before the single-tap delay never opens a microphone',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
  document.querySelector('.capture-nav').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
  location.hash='/echoes';
 });
 await page.waitForTimeout(400);
 expect(await page.evaluate(()=>window.micRequests)).toBe(0);
 await expect(page.locator('#modal')).not.toBeVisible();
});


test('keeping a quick Echo saves both voice and transcript without leaving the page',async({page},info)=>{
 await fixture(page);
 // Some Playwright WebKit ports cannot persist Blob/File data. Probe that
 // exact capability; any other storage error must still fail this test.
 const storageError=await page.evaluate(()=>new Promise(resolve=>{
  const request=indexedDB.open('quick-capture-blob-capability',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('probe');
  request.onerror=()=>resolve(request.error?.message||'Database open failed');
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('probe','readwrite');
   tx.oncomplete=()=>{db.close();resolve('');};
   tx.onerror=()=>{const error=tx.error?.message;db.close();resolve(error||'Transaction failed');};
   try{const put=tx.objectStore('probe').put(new Blob(['fixture']), 'audio');put.onerror=()=>resolve(put.error?.message||'Blob write failed');}
   catch(error){db.close();resolve(error.message);}
  };
 }));
 test.skip(info.project.name==='mobile-webkit'&&String(storageError).includes('Error preparing Blob/File data'),'This Playwright WebKit runtime cannot persist Blob/File data. Durable saving runs in Chrome; storage failure/recovery still runs in both browsers.');
 expect(storageError).toBe('');
 await doubleTap(page,info);await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('.quick-transcript')).toHaveText('A quick spoken moment.');
 await page.getByRole('button',{name:'Keep Echo',exact:true}).click();
 await expect(page.locator('#modal')).not.toBeVisible();await expect(page).toHaveURL(/#\/field$/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cosmic_echoes_v1')).find(e=>e.text==='A quick spoken moment.'));
 expect(saved.audio_path).toContain('quick-owner/');expect(saved.source).toBe('voice');
});
test('storage failure keeps audio and transcript available for review and download',async({page},info)=>{
 await fixture(page,{storageFail:true});
 await doubleTap(page,info);await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('.quick-transcript')).toHaveText('A quick spoken moment.');
 await page.getByRole('button',{name:'Keep Echo',exact:true}).click();
 await expect(page.locator('#capture-error')).toContainText('Audio could not be saved');
 await expect(page.locator('#recording-preview')).toHaveAttribute('src',/^blob:/);
 await page.locator('[data-action="capture-expand"]').click();
 await expect(page.locator('#capture-body')).toHaveValue('A quick spoken moment.');
 await expect(page.locator('[data-action="download-capture"]')).toBeVisible();
});
