
import {test,expect} from '@playwright/test';
import {echoCycleOptions} from '../../design/luna-field/src/echo-browse.ts';
const cycles=echoCycleOptions();
async function fixture(page,{slowSearch=false}={}){
 const now=Date.now(),old=new Date(cycles[1].cycleStart).getTime()+7*86400000;
 const rows=[
  ...Array.from({length:50},(_,i)=>({id:'recent-'+String(i).padStart(3,'0'),user_id:'recent-fixture',source:'text',text:'Recent thought '+i,phase:'waning-gibbous',created_at:new Date(now-i*60000).toISOString()})),
  ...Array.from({length:500},(_,i)=>({id:'older-'+i,user_id:'recent-fixture',source:'voice',audio_path:'fixture/'+i+'.webm',text:i===0?'needle from an older cycle':'Older thought '+i,phase:'full',created_at:new Date(old-i*60000).toISOString()}))
 ].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
 const data={queries:[],slow:null,rows,deleted:new Set()};
 await page.addInitScript(()=>{
  localStorage.setItem('sb-eyxvsbqyzeodsjajfqsj-auth-token',JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'recent-fixture'}}));
 });
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
  if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='not.is.null')return route.fulfill({json:[...data.deleted].map(id=>({id}))});
  if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='is.null'){
   data.queries.push(u);const and=u.searchParams.get('and')||'';
   const search=and.match(/text.ilike."%([^"]*)%"/)?.[1];
   if(slowSearch&&search==='slow'){data.slow=route;return;}
   let result=rows.filter(e=>!data.deleted.has(e.id));
   const since=and.match(/created_at.gte.([^,)]+)/)?.[1],until=and.match(/created_at.lt.([^,)]+)/)?.[1];
   if(since)result=result.filter(e=>e.created_at>=since);
   if(until)result=result.filter(e=>e.created_at<until);
   const before=and.match(/or\(created_at.lt.([^,)]+)/)?.[1],id=and.match(/id.lt."([^"]*)"/)?.[1];
   if(before)result=result.filter(e=>e.created_at<before||(e.created_at===before&&e.id<id));
   if(search)result=result.filter(e=>e.text.toLowerCase().includes(search.toLowerCase()));
   if(u.searchParams.has('phase'))result=result.filter(e=>e.phase===u.searchParams.get('phase').slice(3));
   if(and.includes('source.eq.voice'))result=result.filter(e=>e.source==='voice');
   if(and.includes('source.neq.voice'))result=result.filter(e=>e.source!=='voice');
   return route.fulfill({json:result.slice(0,Number(u.searchParams.get('limit')||30))});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/beta#/echoes');
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(30);
 await expect(page.locator('.echo-page-status')).not.toContainText('Loading');
 return data;
}
test('mobile first cycle page stays bounded and more is explicit',async({page},testInfo)=>{
 const data=await fixture(page);
 await expect(page.locator('[data-action="echo-period"][data-value="cycle"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#echo-results')).not.toContainText('Older thought');
 expect(data.queries.every(u=>u.searchParams.get('limit')==='31'&&!u.searchParams.has('offset'))).toBe(true);
 expect(data.queries.every(u=>u.searchParams.get('and').includes('created_at.gte.'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('recent-echoes.png')});
 await page.locator('[data-action="echo-more"]').click();
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(50);
 await expect(page.locator('[data-action="echo-more"]')).toHaveCount(0);
 const ids=await page.locator('#echo-results .echo-row').evaluateAll(rows=>rows.map(r=>r.getAttribute('href')));
 expect(new Set(ids).size).toBe(50);
});
test('search reaches older history and cycle, day, and phase filters are server queries',async({page})=>{
 const data=await fixture(page);
 await page.locator('#echo-search').fill('needle');
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(1);
 await expect(page.locator('#echo-results')).toContainText('needle from an older cycle');
 expect(data.queries.at(-1).searchParams.get('and')).not.toContain('created_at.gte');
 await page.locator('#echo-search').fill('');
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(30);
 await page.locator('#echo-filters summary').click();
 await page.locator('#echo-cycle-select').selectOption(cycles[1].id);
 await expect(page.locator('#echo-results')).toContainText('Older thought');
 await page.locator('#echo-phase-select').selectOption('full');
 await expect.poll(()=>data.queries.at(-1).searchParams.get('phase')).toBe('eq.full');
 await page.locator('#echo-day-filter').fill('2020-01-02');
 await page.locator('#echo-day-filter').press('Tab');
 await expect.poll(()=>data.queries.at(-1).searchParams.get('and')).toContain('2020-01-02');
 await expect(page.locator('#echo-results .echo-row')).toHaveCount(0);
});
test('a slow search cannot overwrite a newer search',async({page})=>{
 const data=await fixture(page,{slowSearch:true});
 await page.locator('#echo-search').fill('slow');
 await expect.poll(()=>Boolean(data.slow)).toBe(true);
 await page.locator('#echo-search').fill('needle');
 await expect(page.locator('#echo-results')).toContainText('needle from an older cycle');
 await data.slow.fulfill({json:[{...data.rows[0],id:'stale',text:'Stale search result'}]});
 await expect(page.locator('#echo-results')).not.toContainText('Stale search result');
 await expect(page.locator('#echo-search')).toHaveValue('needle');
});
test('Listen loads an earlier cycle only when selected',async({page})=>{
 const data=await fixture(page);
 await page.goto('/beta#/listen');
 await expect(page.locator('#cycle-select')).toBeVisible();
 await expect(page.locator('.echo-page-status')).not.toContainText('Loading');
 const before=data.queries.length;
 await page.locator('#prev-cycle').click();
 await expect.poll(()=>data.queries.length).toBeGreaterThan(before);
 await expect(page.locator('#groups')).toContainText('Older thought');
 await expect(page.locator('#journey-more')).toBeVisible();
 expect(data.queries.at(-1).searchParams.get('and')).toContain(cycles[1].cycleStart);
});

test('synchronization removes deleted Echoes from the visible page without loading history',async({page})=>{
 const data=await fixture(page);
 data.deleted.add('recent-000');
 await page.evaluate(()=>{document.activeElement?.blur();window.dispatchEvent(new Event('focus'));});
 await expect(page.locator('#echo-results a[href="#/echo/recent-000"]')).toHaveCount(0);
 expect(data.queries.every(u=>u.searchParams.get('limit')==='31')).toBe(true);
});
