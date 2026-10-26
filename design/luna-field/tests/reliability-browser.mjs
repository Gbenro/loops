import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const html=fs.readFileSync(new URL('../../..//../public/beta/index.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--mute-audio']});
const context=await browser.newContext({permissions:['microphone'],viewport:{width:390,height:844}});
await context.route('**/*',route=>route.request().url().startsWith('https://luna-review.test/')?route.fulfill({body:html,contentType:'text/html'}):route.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const MR=MediaRecorder;window.__recorders=[];window.MediaRecorder=class extends MR{constructor(...args){super(...args);window.__recorders.push(this);}};
 const A=Audio;window.__audio=[];window.Audio=function(...args){const a=new A(...args);window.__audio.push(a);return a;};
 window.__releases=0;Object.defineProperty(navigator,'wakeLock',{value:{request(){return new Promise(resolve=>window.__resolveLock=()=>resolve({release:async()=>window.__releases++,addEventListener(){}}));}},configurable:true});
});
const readDrafts=()=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('luna_draft_audio_db',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('draft_recordings').objectStore('draft_recordings').getAll();q.onsuccess=()=>{resolve(q.result.map(v=>({id:v.id,bytes:v.blob.size,status:v.status})));db.close();};};}));
const result={};
try{
 await page.goto('https://luna-review.test/#/field');await page.waitForSelector('[data-action=capture-voice]');result.booted=true;
 for(const route of ['sky','echoes','cycles','field']){await page.goto('https://luna-review.test/#/'+route);await page.waitForTimeout(80);assert.ok(await page.locator('#app').innerText());}result.navigation=true;
 await page.locator('[data-action=capture-voice]').first().click();await page.waitForFunction(()=>window.__recorders[0]?.state==='recording');
 console.log('Repaired Beta booted; real synthetic-microphone capture running for 126 seconds.');
 await page.waitForTimeout(126000);result.recordingAfter126=await page.evaluate(()=>window.__recorders[0].state);assert.equal(result.recordingAfter126,'recording');
 await page.locator('[data-action=record-stop]').click();await page.waitForSelector('#recording-preview');await page.waitForFunction(()=>!document.querySelector('[data-form=capture] button[type=submit]').disabled);
 await page.evaluate(()=>window.__resolveLock());await page.waitForTimeout(30);result.lateLockReleased=await page.evaluate(()=>window.__releases>0);
 await page.locator('[data-form=capture] button[type=submit]').click();await page.waitForFunction(()=>location.hash.startsWith('#/echo/'));
 result.savedDuration=await page.evaluate(()=>JSON.parse(localStorage.getItem('cosmic_echoes_v1'))[0].duration);assert.ok(result.savedDuration>120);
 await page.reload();await page.locator('[data-action=play]').click();await page.waitForFunction(()=>window.__audio.some(a=>a.currentTime>.1));result.playableAfterReload=true;
 await page.goto('https://luna-review.test/#/field');await page.locator('[data-action=capture-voice]').first().click();await page.waitForFunction(()=>window.__recorders.at(-1)?.state==='recording');await page.waitForTimeout(800);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await page.waitForTimeout(150);result.interruptedDrafts=await readDrafts();
 await page.reload();result.recoveryOffered=/recover.*recording|recover.*draft/i.test(await page.locator('body').innerText());
 assert.ok(result.recoveryOffered, 'Recovery button must be visible');
 await page.locator('[data-action=recover-list]').click();await page.locator('[data-action=recover-draft]').first().click();
 await page.locator('[data-action=preview-toggle]').click();await page.waitForFunction(()=>document.querySelector('#recording-preview')?.currentTime>.1);result.recoveredAudioPlayable=true;
 await page.locator('[data-form=capture] button[type=submit]').click();await page.waitForFunction(()=>location.hash.startsWith('#/echo/'));result.recoveredEchoKept=true;
 // A real IDB failure must leave the capture open with an error and export link.
 await page.goto('https://luna-review.test/#/field');
 await page.evaluate(()=>{indexedDB.open=()=>{const r={};queueMicrotask(()=>r.onerror?.());return r;};});
 await page.locator('[data-action=capture-voice]').first().click();await page.waitForFunction(()=>window.__recorders.at(-1)?.state==='recording');await page.waitForTimeout(800);await page.locator('[data-action=record-stop]').click();await page.waitForSelector('#recording-preview');
 await page.locator('[data-form=capture] button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#capture-error')?.textContent.includes('could not be saved'));assert.ok(await page.locator('a[download]').isVisible());result.storageFailureVisible=true;
 result.pageErrors=errors;assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
}catch(e){result.testError=e.message;result.pageErrors=errors;console.log(JSON.stringify(result,null,2));process.exitCode=1;}
finally{fs.writeFileSync(new URL('../dist/reliability-browser-evidence.json',import.meta.url),JSON.stringify(result,null,2));await browser.close();}
