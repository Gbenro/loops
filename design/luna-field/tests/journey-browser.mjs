import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../../../public/beta/index.html',import.meta.url),'utf8');
const wav=Buffer.alloc(44+16000*2*6);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=44;i<wav.length;i+=2)wav.writeInt16LE(Math.round(Math.sin(i/2*2*Math.PI*220/16000)*1800),i);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--mute-audio']});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token';let signs=0,holdSign=false,releaseSign,signStarted;
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='luna-review.test')return route.fulfill({body:html,contentType:'text/html'});
 if(u.hostname.endsWith('.supabase.co')){
  if(u.pathname.includes('/storage/v1/object/sign/echo-audio/')){
   if(route.request().method()==='POST'){signs++;if(holdSign){signStarted?.();await new Promise(r=>releaseSign=r);}return route.fulfill({json:{signedURL:'/object/sign/echo-audio/A/remote.wav?fixture='+signs}});}
   return route.fulfill({status:u.searchParams.get('fixture')==='1'?403:200,body:wav,contentType:'audio/wav'});
  }
  return route.fulfill({json:[]});
 }
 return route.abort();
});
await context.addInitScript(()=>{const A=Audio;window.__audios=[];window.Audio=function(...args){const a=new A(...args);window.__audios.push(a);return a;};});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const result={};
const out=new URL('../dist/',import.meta.url);
try{
 await page.goto('https://luna-review.test/#/field');
 await page.evaluate(async({key,bytes})=>{
  localStorage.setItem(key,JSON.stringify({access_token:'synthetic-A',user:{id:'A',email:'fixture@example.invalid'}}));
  const rows=[['one','2025-09-01T12:00:00Z'],['two','2026-09-02T12:00:00Z'],['missing','2026-09-03T12:00:00Z'],['remote','2026-10-02T12:00:00Z']].map(([id,at])=>({id,title:'Test moment '+id,text:'Synthetic browser fixture',source:'voice',created_at:at,user_id:'A',duration:6,phase:'full',phase_name:'Full Moon',audio_path:id==='remote'?'A/remote.wav':null,syncStatus:'synced'}));
  rows.push({...rows[0],id:'other-account',user_id:'B',title:'Hidden B moment'});localStorage.setItem('cosmic_echoes_v1',JSON.stringify(rows));
  await new Promise((resolve,reject)=>{const r=indexedDB.open('luna_draft_audio_db',1);r.onupgradeneeded=()=>r.result.createObjectStore('draft_recordings',{keyPath:'id'});r.onsuccess=()=>{const db=r.result;const t=db.transaction('draft_recordings','readwrite');for(const id of ['one','two'])t.objectStore('draft_recordings').put({id,userId:'A',blob:new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),duration:6,status:'saved'});t.oncomplete=()=>{db.close();resolve();};t.onerror=reject;};});
 },{key:AUTH,bytes:[...wav]});
 await page.goto('https://luna-review.test/#/listen');await page.waitForSelector('[data-echo=one]');assert.equal(await page.locator('[data-echo]').count(),4);assert.equal(await page.locator('[data-echo=other-account]').count(),0);result.authenticatedQueue=true;
 await page.locator('#play').click();await page.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.currentTime>.1));
 await page.locator('#seek').fill('3');await page.locator('#play').click();await page.locator('#save').click();assert.match(await page.locator('#save-note').innerText(),/saved for this account/);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#seek')?.value>2.5);assert.ok(await page.evaluate(()=>window.__audios.every(a=>a.paused)));result.scopedResumePaused=true;
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('[data-echo=two]')?.getAttribute('aria-current')==='true');result.continuousAcrossCycles=true;
 await page.locator('#play').click();await page.locator('#order').selectOption('newest');await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('[data-echo=one]')?.getAttribute('aria-current')==='true');result.reverseOrder=true;
 for(const by of ['phase','cycle','day']){await page.locator('[data-group='+by+']').click();const value=await page.locator('#group-filter option').nth(1).getAttribute('value');await page.locator('#group-filter').selectOption(value);assert.equal(await page.locator('[data-echo]').count(),1);await page.locator('#group-filter').selectOption('');}result.filters=true;
 await page.locator('[data-echo=remote]').click();await page.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.src.includes('fixture=2')));assert.equal(signs,2);result.expiredSignedURLRecovery=true;await page.locator('#play').click();
 await page.locator('[data-echo=missing]').click();await page.waitForFunction(()=>document.querySelector('[data-echo=missing]')?.disabled);result.honestMissingAudio=true;
 await page.screenshot({path:new URL('journey-desktop.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action=theme]').click();await page.locator('#groups').scrollIntoViewIfNeeded();await page.waitForSelector('#mobile-dock:not([hidden])');assert.ok(await page.locator('#dock-play').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));result.mobileLightControls=true;
 await page.screenshot({path:new URL('journey-mobile.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
 // Offline local playback does not request a signed URL.
 await context.setOffline(true);await page.locator('[data-echo=one]').click();await page.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.src.startsWith('blob:')&&a.currentTime>.1));result.offlineLocalPlayback=true;await context.setOffline(false);
 // Another tab changes shared auth while a renewed signed URL request is pending.
 const other=await context.newPage();await other.goto('https://luna-review.test/#/field');
 holdSign=true;const waiting=new Promise(r=>signStarted=r);
 // New page forces a fresh URL cache, then select a remote item.
 await page.reload();await page.locator('[data-echo=remote]').click();await waiting;
 await other.evaluate(key=>localStorage.setItem(key,JSON.stringify({access_token:'synthetic-B',user:{id:'B'}})),AUTH);
 await page.waitForFunction(()=>!document.querySelector('[data-echo=one]'));releaseSign();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.__audios.every(a=>a.paused)));assert.equal(await page.locator('[data-echo=remote]').count(),0);result.crossTabCancellation=true;
 await other.evaluate(key=>localStorage.removeItem(key),AUTH);await page.waitForFunction(()=>!document.querySelector('.echo-journey'));assert.ok(await page.evaluate(()=>window.__audios.every(a=>a.paused)));result.signOutStopsPlayback=true;
 for(const route of ['sky','field','echoes','cycles','loops','threads','reflections']){await page.goto('https://luna-review.test/#/'+route);assert.ok(await page.locator('#main').innerText());}result.navigation=true;
 assert.deepEqual(errors,[]);result.pageErrors=errors;console.log(JSON.stringify(result,null,2));
}catch(e){result.error=e.stack;result.pageErrors=errors;console.log(JSON.stringify(result,null,2));process.exitCode=1;}
finally{fs.writeFileSync(new URL('journey-browser-evidence.json',out),JSON.stringify(result,null,2));await browser.close();}
