import {test,expect} from '@playwright/test';
for(const deviceVoice of [false,true]){
 test('read-aloud omits record IDs without changing chat text: '+(deviceVoice?'device':'cloud and fallback'),async({page})=>{
  const original='**369 Finance** (e1795627866553q3lf): lessons 38 through 41, in 2023. [1]';
  const expected='369 Finance: lessons 38 through 41, in 2023.';
  await page.addInitScript(({deviceVoice})=>{
   localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'speech-fixture'}}));
   if(deviceVoice)localStorage.setItem('luna_voice_key','browser-web-speech');
   window.__spoken=[];
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices(){return [];},speak(utter){window.__spoken.push(utter.text);}}});
  },{deviceVoice});
  let requestText;
  await page.routeWebSocket('**/*',ws=>ws.close());
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.pathname.endsWith('/chat_sessions'))return route.fulfill({json:[{id:'speech-session'}]});
   if(url.pathname.endsWith('/chat_messages'))return route.fulfill({json:[{id:'speech-reply',role:'assistant',content:original,metadata:{}}]});
   if(url.pathname.endsWith('/synthesize-speech')){requestText=route.request().postDataJSON().text;return route.fulfill({json:{useClientFallback:true}});}
   return route.fulfill({json:[]});
  });
  await page.goto('/beta#/chat');
  await page.locator('[data-action="play-chat-voice"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__spoken)).toEqual([expected]);
  if(deviceVoice)expect(requestText).toBeUndefined();else expect(requestText).toBe(expected);
  await expect(page.locator('#chat-messages')).toContainText('e1795627866553q3lf');
  await expect(page.locator('#chat-messages')).toContainText('lessons 38 through 41');
 });
}
