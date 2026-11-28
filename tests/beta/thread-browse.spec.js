import {test,expect} from '@playwright/test';
async function fixture(page,{failMetadata=false}={}){
 await page.setViewportSize({width:390,height:844});
 const rows=[...Array.from({length:26},(_,i)=>({id:'recent-'+String(i).padStart(3,'0'),tags:['Thread '+String(i).padStart(2,'0')],created_at:new Date(Date.now()-i*60000).toISOString()})),...Array.from({length:35},(_,i)=>({id:'old-'+String(i).padStart(3,'0'),tags:['Archive / spaciousness'],created_at:new Date(Date.UTC(2020,0,1,0,i)).toISOString()}))].map(r=>({...r,user_id:'thread-fixture',text:'Echo '+r.id,source:'text'})).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
 const data={queries:[],failMetadata,rows};
 await page.addInitScript(()=>localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'thread-fixture'}})));
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
  if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='is.null'){
   data.queries.push(u);const metadata=u.searchParams.get('select')==='id,tags,created_at';
   if(metadata&&data.failMetadata)return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});
   let result=rows;const and=u.searchParams.get('and')||'';
   const before=and.match(/or\(created_at.lt.([^,)]+)/)?.[1],id=and.match(/id.lt."([^"]*)"/)?.[1];
   if(before)result=result.filter(e=>e.created_at<before||(e.created_at===before&&e.id<id));
   const since=and.match(/created_at.gte.([^,)]+)/)?.[1];if(since)result=result.filter(e=>e.created_at>=since);
   const tags=u.searchParams.get('tags');if(tags?.startsWith('cs.'))result=result.filter(e=>e.tags.includes(JSON.parse(tags.slice(3))[0]));
   result=result.slice(0,Number(u.searchParams.get('limit')));
   return route.fulfill({json:metadata?result.map(({id,tags,created_at})=>({id,tags,created_at})):result});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/beta#/echoes');await expect(page.locator('#echo-results .echo-row')).toHaveCount(26);await expect(page.locator('.echo-page-status')).not.toContainText('Loading');
 expect(data.queries.every(u=>u.searchParams.get('select')!=='id,tags,created_at')).toBe(true);
 await page.evaluate(()=>location.hash='#/threads');
 return data;
}
test('phone Threads start with 12 recent connections, offer compact paging and search all history',async({page},testInfo)=>{
 const data=await fixture(page);await expect(page.locator('.thread-row')).toHaveCount(12);
 await expect(page.locator('.thread-row').first()).toContainText('Thread 00');await expect(page.locator('.thread-count')).toContainText('12 of 27');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('threads-phone.png'),fullPage:true});
 await page.getByRole('button',{name:'Show more',exact:true}).click();await expect(page.locator('.thread-row')).toHaveCount(24);
 await page.getByRole('button',{name:'Show more',exact:true}).click();await expect(page.locator('.thread-row')).toHaveCount(27);await expect(page.getByRole('button',{name:'Show more',exact:true})).toHaveCount(0);
 await page.locator('#thread-sort').selectOption('count');await expect(page.locator('.thread-row')).toHaveCount(12);await expect(page.locator('.thread-row').first()).toContainText('Archive / spaciousness');await expect(page.locator('.thread-row').first()).toContainText('35 Echoes');
 await page.getByRole('searchbox',{name:'Search Threads'}).fill('Spacious');await expect(page.locator('.thread-row')).toHaveCount(1);await expect(page.getByRole('searchbox',{name:'Search Threads'})).toBeFocused();
 expect(data.queries.filter(u=>u.searchParams.get('select')==='id,tags,created_at')).toHaveLength(1);
 await page.locator('.thread-row').click();await expect(page).toHaveURL(/#\/thread\/Archive%20%2F%20spaciousness/);
 await expect(page.locator('.thread-timeline .echo-row')).toHaveCount(30);await expect(page.locator('.thread-timeline .echo-row').first()).toContainText('Echo old-034');
 await page.locator('[data-action="echo-more"]').click();await expect(page.locator('.thread-timeline .echo-row')).toHaveCount(35);
});
test('Threads expose a retry after failed metadata fetch and recover without leaving the page',async({page})=>{
 const data=await fixture(page,{failMetadata:true});await expect(page.getByRole('alert')).toContainText('Could not load all Threads');data.failMetadata=false;
 await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.thread-count')).toContainText('12 of 27');await expect(page.getByRole('alert')).toHaveCount(0);
 await page.locator('#thread-search').fill('No matching thread');await expect(page.locator('.thread-row')).toHaveCount(0);await expect(page.locator('#thread-results')).toContainText('No Threads match');
});
