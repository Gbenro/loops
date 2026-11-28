import {test,expect} from '@playwright/test';
async function fixture(page,onPost){
 await page.clock.install();
 await page.addInitScript(()=>{
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+86400,user:{id:'chat-fixture'}}));
 });
 const data={history:[],posts:[],reads:0};
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname.endsWith('/chat_sessions'))return route.fulfill({json:[{id:'chat-session'}]});
  if(url.pathname.endsWith('/chat_messages')){data.reads++;return route.fulfill({json:data.history});}
  if(url.pathname==='/api/chat'){
   const body=route.request().postDataJSON();data.posts.push(body);
   if(!data.history.some(m=>m.id===body.clientTurnId))data.history.push({id:body.clientTurnId,role:'user',content:body.message,metadata:{}});
   return onPost(route,data);
  }
  return route.fulfill({json:[]});
 });
 // A request being received is earlier than history being applied. Wait for
 // its response and the next frame so initialization cannot erase the test draft.
 const historyReady=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/chat_messages'));
 await page.goto('/beta#/chat');
 // These scenarios start after opening the app; let its queued startup syncs
 // settle before filling a draft or requesting a separate focus refresh.
 await page.waitForLoadState('networkidle');
 await (await historyReady).finished();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
 await expect.poll(()=>data.reads).toBeGreaterThan(0);
 return data;
}
async function send(page){
 await page.locator('#chat-input').fill('A synthetic reflection');
 await page.locator('form[data-form="chat"] button[type="submit"]').click();
}
function saveReply(data){
 data.history.push({id:'saved-reply',role:'assistant',content:'The delayed reply arrived.',metadata:{reply_to_user_message_id:data.posts[0].clientTurnId}});
}
test('a response beyond the old timeout arrives without refresh or duplicate turns',async({page})=>{
 let pending;const data=await fixture(page,route=>{pending=route;});
 await send(page);await expect.poll(()=>data.posts.length).toBe(1);
 await page.clock.fastForward(95000);
 await expect(page.locator('.is-thinking')).toContainText('Still waiting');
 saveReply(data);await page.clock.fastForward(5001);
 await expect(page.locator('#chat-messages')).toContainText('The delayed reply arrived.');
 await expect(page.locator('.is-thinking')).toHaveCount(0);
 await expect(page.locator('#chat-messages .chat-message.person')).toHaveCount(1);
 expect(data.posts).toHaveLength(1);
 await pending.fulfill({json:{reply:'The delayed reply arrived.',assistantMessageId:'saved-reply'}}).catch(()=>{});
});
test('empty response retry reuses the same message and rejects double submission',async({page})=>{
 let pending;const data=await fixture(page,(route,data)=>data.posts.length===1?route.fulfill({status:500,json:{error:'Model produced an empty response'}}):(pending=route,undefined));
 await send(page);
 await expect(page.locator('[data-action="retry-chat"]')).toBeVisible();
 await page.locator('[data-action="retry-chat"]').click();
 await expect.poll(()=>data.posts.length).toBe(2);
 expect(data.posts[0].clientTurnId).toBe(data.posts[1].clientTurnId);
 await expect(page.locator('#chat-input')).toBeDisabled();
 await expect(page.locator('#chat-messages .chat-message.person')).toHaveCount(1);
 saveReply(data);await page.clock.fastForward(5001);
 await expect(page.locator('#chat-messages')).toContainText('The delayed reply arrived.');
 await expect(page.locator('[data-action="retry-chat"]')).toHaveCount(0);
 await pending.fulfill({json:{reply:'The delayed reply arrived.',assistantMessageId:'saved-reply'}}).catch(()=>{});
});
test('a saved reply clears a connection error while preserving the next draft',async({page})=>{
 const data=await fixture(page,route=>route.abort('failed'));
 await send(page);await expect(page.locator('[data-action="retry-chat"]')).toBeVisible();
 await page.locator('#chat-input').fill('My next thought');
 saveReply(data);await page.clock.fastForward(5001);
 await expect(page.locator('#chat-messages')).toContainText('The delayed reply arrived.');
 await expect(page.locator('[data-action="retry-chat"]')).toHaveCount(0);
 await expect(page.locator('#chat-input')).toHaveValue('My next thought');
 await expect(page.locator('#chat-input')).toBeFocused();
});
test('late reply after sign-out cannot restore the previous account conversation',async({page})=>{
 let pending;const data=await fixture(page,route=>{pending=route;});
 await send(page);await expect.poll(()=>data.posts.length).toBe(1);
 if(await page.locator('[data-action="menu"]').isVisible())await page.locator('[data-action="menu"]').click();
 await page.locator('[data-action="open-auth"]:visible').first().click();
 await page.locator('[data-action="auth-signout"]').click();
 saveReply(data);
 await pending.fulfill({json:{reply:'Private delayed reply',assistantMessageId:'private-reply'}}).catch(()=>{});
 await page.clock.fastForward(30001);
 await expect(page.locator('#chat-messages')).not.toContainText('Private delayed reply');
 await expect(page.locator('#chat-messages')).not.toContainText('A synthetic reflection');
});

test('reopening an unanswered chat can retry the original saved turn',async({page})=>{
 const data=await fixture(page,(route,data)=>data.posts.length===1?route.fulfill({status:500,json:{error:'Model produced an empty response'}}):route.fulfill({json:{reply:'Recovered after reopening.',assistantMessageId:'reopened-reply'}}));
 await send(page);
 await expect(page.locator('[data-action="retry-chat"]')).toBeVisible();
 const originalId=data.posts[0].clientTurnId;
 await page.reload();
 await expect(page.locator('[data-action="retry-chat"]')).toBeVisible();
 await page.locator('[data-action="retry-chat"]').click();
 await expect(page.locator('#chat-messages')).toContainText('Recovered after reopening.');
 expect(data.posts).toHaveLength(2);
 expect(data.posts[1].clientTurnId).toBe(originalId);
 await expect(page.locator('#chat-messages .chat-message.person')).toHaveCount(1);
});
