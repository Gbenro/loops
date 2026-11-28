import {test,expect} from '@playwright/test';
async function setup(page,route='field'){
  await page.addInitScript(()=>{
    localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'transcription-fixture'}}));
    window.AudioContext=undefined;window.webkitAudioContext=undefined;
    const stream={getTracks:()=>[{stop(){}}]};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>stream}});
    window.MediaRecorder=class extends EventTarget{
      static isTypeSupported(){return true;}
      constructor(stream,options){super();this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';}
      start(){this.state='recording';}
      stop(){this.state='inactive';queueMicrotask(()=>{
        const event=new Event('dataavailable');event.data=new Blob(['synthetic '.repeat(100)],{type:this.mimeType});
        this.dispatchEvent(event);this.ondataavailable?.(event);
        this.dispatchEvent(new Event('stop'));this.onstop?.();
      });}
    };
  });
  await page.routeWebSocket('**/*',ws=>ws.close());
  await page.route('**/*',r=>{
    const url=new URL(r.request().url());
    if(url.hostname==='127.0.0.1')return r.continue();
    if(url.pathname.endsWith('/chat_sessions'))return r.fulfill({json:[{id:'fixture-chat'}]});
    return r.fulfill({json:[]});
  });
  await page.goto('/beta#/'+route);
}
async function recordEcho(page){
  await page.locator('[data-action="capture-voice"]:visible').first().click();
  await page.locator('[data-action="record-stop"]').click();
}
async function edgeReply(route,text){
  const body=route.request().postDataBuffer().toString();
  expect(body).toContain('name="audio"');
  expect(body).not.toContain('name="file"');
  expect(route.request().headers().authorization).toBeUndefined();
  await route.fulfill({json:{text}});
}
test('Echo waits for transcription and uses the Classic fallback upload contract',async({page})=>{
  await setup(page);let primary;
  await page.route('**/api/voice/transcribe',r=>{primary=r;});
  await page.route('**/functions/v1/transcribe-audio',r=>edgeReply(r,'The recorded words.'));
  await recordEcho(page);
  await expect.poll(()=>Boolean(primary)).toBe(true);
  await expect(page.locator('[data-form="capture"] button[type="submit"]')).toBeDisabled();
  await expect(page.locator('.capture-transcription-status')).toBeVisible();
  await primary.fulfill({status:502,json:{error:'Synthetic primary outage'}});
  await expect(page.locator('#capture-body')).toHaveValue('The recorded words.');
  await expect(page.locator('[data-form="capture"] button[type="submit"]')).toBeEnabled();
});
test('Echo failures are visible and retry preserves a typed note and the original audio',async({page})=>{
  await setup(page);let retry=false;
  await page.route('**/api/voice/transcribe',r=>r.fulfill(retry?{json:{text:'Recovered spoken words.'}}:{status:502,json:{error:'Synthetic outage'}}));
  await page.route('**/functions/v1/transcribe-audio',r=>r.fulfill({status:503,json:{error:'Synthetic outage'}}));
  await recordEcho(page);
  await expect(page.locator('#capture-error')).toContainText('retry');
  await expect(page.locator('[data-action="download-capture"]')).toBeVisible();
  await expect(page.locator('[data-form="capture"] button[type="submit"]')).toBeEnabled();
  await page.locator('#capture-body').fill('My own note.');
  retry=true;await page.locator('[data-action="retry-capture-transcription"]').click();
  await expect(page.locator('[data-action="insert-capture-transcript"]')).toBeVisible();
  await expect(page.locator('#capture-body')).toHaveValue('My own note.');
  await page.locator('[data-action="insert-capture-transcript"]').click();
  await expect(page.locator('#capture-body')).toHaveValue('My own note.\n\nRecovered spoken words.');
  await expect(page.locator('#capture-error')).not.toContainText('503');
  await expect(page.locator('#capture-error')).not.toContainText('Transcription could not finish');
  await expect(page.locator('[data-action="retry-capture-transcription"]')).toHaveCount(0);
});
test('chat microphone also transcribes through the Classic fallback contract',async({page})=>{
  await setup(page,'chat');
  await page.route('**/api/voice/transcribe',r=>r.fulfill({status:502,json:{error:'Synthetic outage'}}));
  await page.route('**/functions/v1/transcribe-audio',r=>edgeReply(r,'A dictated chat message.'));
  await page.locator('[data-action="chat-voice-record"]').click();
  await expect(page.locator('[data-action="chat-voice-record"]')).toHaveAttribute('aria-label','Stop dictation');
  await page.locator('[data-action="chat-voice-record"]').click();
  await expect(page.locator('#chat-input')).toHaveValue('A dictated chat message.');
});


test('a pasted Write Echo never carries into later recording transcripts',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page);await page.waitForLoadState('networkidle');
 let saveRequest;await page.route('**/rest/v1/echoes*',r=>{if(r.request().method()==='POST'){saveRequest=r;return;}return r.fallback();});
 let transcript=0;await page.route('**/api/voice/transcribe',r=>r.fulfill({json:{text:'Fresh recording '+(++transcript)}}));
 await page.locator('[data-action="capture-voice"]:visible').first().click();
 await expect(page.locator('[data-action="record-stop"]')).toBeVisible();
 await page.locator('[data-action="capture-mode"][data-value="text"]').click();
 await page.locator('#capture-body').fill('Pasted words for the written Echo only.');
 await page.locator('#capture-title').fill('Written Echo');
 await page.locator('[data-form="capture"] button[type="submit"]').click();
 await expect(page.locator('[data-form="capture"] button[type="submit"]')).toHaveText('Saving…');
 await expect.poll(()=>Boolean(saveRequest)).toBe(true);await saveRequest.fulfill({json:[]});
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 await expect(page.getByText('Echo saved.',{exact:true})).toBeVisible();
 await expect(page.locator('main')).toContainText('Pasted words for the written Echo only.');
 for(let i=1;i<=2;i++){
  await recordEcho(page);
  await expect(page.locator('#capture-title')).toHaveValue('');
  await expect(page.locator('#capture-body')).toHaveValue('Fresh recording '+i);
  // A normal app render during capture must not restore an earlier transcript.
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#capture-body')).toHaveValue('Fresh recording '+i);
  await page.locator('dialog[open] [data-action="close-modal"]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
 }
});

test('Record again replaces the previous automatic transcript while preserving an edited note',async({page})=>{
 await setup(page);await page.waitForLoadState('networkidle');let transcript=0;
 await page.route('**/api/voice/transcribe',r=>r.fulfill({json:{text:'Spoken take '+(++transcript)}}));
 await recordEcho(page);await expect(page.locator('#capture-body')).toHaveValue('Spoken take 1');
 await page.locator('[data-action="record-again"]').click();
 await page.locator('[data-action="record-start"]').click();await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('#capture-body')).toHaveValue('Spoken take 2');
 await page.locator('#capture-body').fill('My deliberate note.');
 await page.locator('[data-action="record-again"]').click();
 await page.locator('[data-action="record-start"]').click();await page.locator('[data-action="record-stop"]').click();
 await expect(page.locator('[data-action="insert-capture-transcript"]')).toBeVisible();
 await expect(page.locator('#capture-body')).toHaveValue('My deliberate note.');
});
