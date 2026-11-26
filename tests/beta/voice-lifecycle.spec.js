import {test,expect} from '@playwright/test';
async function fixture(page,{pendingMic=false}={}){
 await page.addInitScript(({pendingMic})=>{
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'voice-fixture'}}));
  window.__played=0;window.__recordStarts=0;window.__stoppedTracks=0;
  HTMLMediaElement.prototype.play=async function(){window.__played++;};
  if(window.speechSynthesis)window.speechSynthesis.speak=()=>{window.__played++;};
  const stream={getTracks:()=>[{stop:()=>{window.__stoppedTracks++;}}]};
  const media={getUserMedia:()=>pendingMic?new Promise(resolve=>{window.__resolveMic=()=>resolve(stream);}):Promise.resolve(stream)};
  Object.defineProperty(navigator,'mediaDevices',{value:media,configurable:true});
  window.MediaRecorder=class{
   static isTypeSupported(){return true;}
   constructor(){this.state='inactive';}
   start(){this.state='recording';window.__recordStarts++;}
   stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['x'.repeat(1000)],{type:'audio/webm'})});this.onstop?.();});}
  };
 },{pendingMic});
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname.endsWith('/chat_sessions'))return route.fulfill({json:[{id:'fixture-chat'}]});
  if(url.pathname.endsWith('/chat_messages'))return route.fulfill({json:[{id:'fixture-reply',role:'assistant',content:'Synthetic assistant reply',metadata:{}}]});
  return route.fulfill({json:[]});
 });
 await page.goto('/beta#/chat');
 await expect(page.locator('[data-action="play-chat-voice"]')).toBeVisible();
}
test('pending synthesized voice cannot play after signing out',async({page})=>{
 await fixture(page);let pending;
 await page.route('**/api/chat/synthesize-speech',route=>{pending=route;});
 await page.locator('[data-action="play-chat-voice"]').click();
 await expect.poll(()=>Boolean(pending)).toBe(true);
 if(await page.locator('[data-action="menu"]').isVisible())await page.locator('[data-action="menu"]').click();
 await page.locator('[data-action="open-auth"]:visible').first().click();
 await page.locator('[data-action="auth-signout"]').click();
 await pending.fulfill({json:{audioBase64:'c3ludGhldGlj',contentType:'audio/wav'}}).catch(()=>{});
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>window.__played)).toBe(0);
 await expect(page.locator('#chat-messages')).not.toContainText('Synthetic assistant reply');
});
test('late microphone permission after leaving chat stops tracks without recording',async({page})=>{
 await fixture(page,{pendingMic:true});
 await page.locator('[data-action="chat-voice-record"]').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__resolveMic)).toBe('function');
 await page.evaluate(()=>location.hash='/loops');
 await expect(page.getByRole('heading',{name:'Still unfolding.'})).toBeVisible();
 await page.evaluate(()=>window.__resolveMic());
 await expect.poll(()=>page.evaluate(()=>window.__stoppedTracks)).toBe(1);
 expect(await page.evaluate(()=>window.__recordStarts)).toBe(0);
});
test('late transcription after leaving chat does not populate the next draft',async({page})=>{
 await fixture(page);let pending;
 await page.route('**/api/voice/transcribe',route=>{pending=route;});
 await page.locator('[data-action="chat-voice-record"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__recordStarts)).toBe(1);
 await page.locator('[data-action="chat-voice-record"]').click();
 await expect.poll(()=>Boolean(pending)).toBe(true);
 await page.evaluate(()=>location.hash='/loops');
 await expect(page.getByRole('heading',{name:'Still unfolding.'})).toBeVisible();
 await pending.fulfill({json:{text:'Late private transcript'}}).catch(()=>{});
 await page.evaluate(()=>location.hash='/chat');
 await expect(page.locator('#chat-input')).toHaveValue('');
 expect(await page.evaluate(()=>window.__stoppedTracks)).toBeGreaterThan(0);
});

test('starting dictation prevents pending Luna playback from entering the microphone',async({page})=>{
 await fixture(page);let pending;
 await page.route('**/api/chat/synthesize-speech',route=>{pending=route;});
 await page.locator('[data-action="play-chat-voice"]').click();
 await expect.poll(()=>Boolean(pending)).toBe(true);
 await page.locator('[data-action="chat-voice-record"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__recordStarts)).toBe(1);
 await pending.fulfill({json:{audioBase64:'c3ludGhldGlj',contentType:'audio/wav'}}).catch(()=>{});
 await page.locator('[data-action="play-chat-voice"]').click();
 await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.__played)).toBe(0);
});
