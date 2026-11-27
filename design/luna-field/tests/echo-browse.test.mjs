
import test from 'node:test';
import assert from 'node:assert/strict';
import {echoPageEndpoint,echoTimeQuery,echoPageCursor,echoCycleOptions,matchesEchoQuery} from '../src/echo-browse.ts';
import {createLiveLunaServices} from '../src/live-services.ts';
import {installIDB} from './idb-fixture.mjs';
const data=new Map();
globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token',KEY='cosmic_echoes_v1';
function setup(){
 data.clear();installIDB();
 data.set(AUTH,JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'owner'}}));
 return createLiveLunaServices();
}
test('cycle default has bounds, phase stays within cycle, and day uses local midnights',()=>{
 const cycle=echoTimeQuery(),phase=echoTimeQuery('phase'),day=echoTimeQuery('today','','','2026-11-27');
 assert.ok(cycle.since&&cycle.until);assert.equal(phase.since,cycle.since);assert.ok(phase.phaseId);
 assert.equal(new Date(day.since).getHours(),0);assert.equal(new Date(day.until).getDate(),28);
 assert.equal(echoTimeQuery('all').since,undefined);
 const choices=echoCycleOptions();assert.equal(new Set(choices.map(c=>c.id)).size,24);assert.ok(choices.every(c=>/\d{4}/.test(c.label)));
});
test('server query is bounded, account scoped, and safely quotes search and cursor syntax',()=>{
 const q={search:'hello"),id.neq.x%_*',since:'2026-11-01T00:00:00.000Z',kind:'voice',cursor:echoPageCursor({created_at:'2026-11-26T00:00:00Z',id:'same-time-"id'})};
 const u=new URL(echoPageEndpoint('owner',q),'https://test');
 assert.equal(u.searchParams.get('limit'),'31');assert.equal(u.searchParams.get('user_id'),'eq.owner');assert.equal(u.searchParams.get('offset'),null);
 assert.match(u.searchParams.get('and'),/created_at.lt/);
 assert.ok(u.searchParams.get('and').includes('hello'+String.fromCharCode(92,34)));
 assert.throws(()=>echoPageEndpoint('owner',{cursor:'bad'}));
});
test('startup reads one recent page, retains older cached Echoes, and never rewrites omitted synced records',async()=>{
 const s=setup(),now=new Date().toISOString();
 const rows=Array.from({length:150},(_,i)=>({id:'e'+i,user_id:'owner',text:'record',source:'text',created_at:now,syncStatus:'synced'}));
 data.set(KEY,JSON.stringify(rows));
 const reads=[],writes=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(options.method&&options.method!=='GET'){writes.push(String(url));return Response.json([]);}
  if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='is.null'){
   reads.push(u);return Response.json(rows.slice(0,31));
  }
  return Response.json([]);
 };
 await s.sync();
 assert.equal(reads.length,1);assert.equal(reads[0].searchParams.get('limit'),'31');
 assert.ok(reads[0].searchParams.get('and').includes('created_at.gte'));
 assert.equal(JSON.parse(data.get(KEY)).length,150);
 assert.equal(s.snapshot().echoes.length,30);assert.equal(writes.length,0);
});
test('explicit older search pages preserve originals and reject a late response from another account',async()=>{
 const s=setup();let finish,started;
 const ready=new Promise(resolve=>started=resolve);
 globalThis.fetch=()=>{started();return new Promise(resolve=>finish=resolve);};
 const request=s.echoes.list({search:'older'});await ready;
 data.set(AUTH,JSON.stringify({access_token:'other',user:{id:'other'}}));
 finish(Response.json([{id:'private',user_id:'owner',text:'older',created_at:'2020-01-01T00:00:00Z'}]));
 await assert.rejects(request,/Account changed/);
 assert.ok(!(data.get(KEY)||'').includes('private'));
});
test('equal timestamp pagination advances by ID instead of offset',async()=>{
 const s=setup(),rows=Array.from({length:65},(_,i)=>({id:'e'+String(99-i).padStart(3,'0'),text:'matched',source:'text',user_id:'owner',created_at:'2020-01-01T12:00:00Z'}));
 globalThis.fetch=async url=>{
  const u=new URL(url),and=u.searchParams.get('and')||'',id=and.match(/id.lt."([^"]+)"/)?.[1];
  return Response.json(rows.filter(r=>!id||r.id<id).slice(0,Number(u.searchParams.get('limit'))));
 };
 const first=await s.echoes.list({search:'matched',limit:30});
 const second=await s.echoes.list({search:'matched',limit:30,cursor:first.nextCursor});
 assert.equal(first.items.length,30);assert.equal(second.items.length,30);
 assert.equal(new Set([...first.items,...second.items].map(e=>e.id)).size,60);
 const third=await s.echoes.list({search:'matched',limit:30,cursor:second.nextCursor});
 assert.equal(third.items.length,5);assert.equal(third.nextCursor,undefined);
});

test('day boundaries compare instants across timestamp formats',()=>{
 const echo={id:'midnight',occurredAt:'2026-11-27T00:00:00+00:00',kind:'text',context:{phaseId:'full'},threadIds:[],title:'',body:''};
 assert.equal(matchesEchoQuery(echo,{since:'2026-11-27T00:00:00.000Z',until:'2026-11-28T00:00:00.000Z'}),true);
 assert.equal(matchesEchoQuery({...echo,occurredAt:'2026-11-28T00:00:00+00:00'},{until:'2026-11-28T00:00:00.000Z'}),false);
});
test('another account cache cannot displace this account recent Echoes',()=>{
 const s=setup();
 const others=Array.from({length:40},(_,i)=>({id:'other'+i,user_id:'other',created_at:'2026-11-27T12:00:00Z',syncStatus:'synced',text:'Other'}));
 data.set(KEY,JSON.stringify([...others,{id:'mine',user_id:'owner',created_at:'2026-11-26T12:00:00Z',syncStatus:'synced',text:'Mine'}]));
 assert.deepEqual(s.snapshot().echoes.map(e=>e.id),['mine']);
});

test('browsing never acknowledges a pending local edit or discards its original audio path',async()=>{
 const s=setup(),original={id:'pending',user_id:'owner',text:'My unsynced words',source:'voice',audio_path:'owner/original.webm',audioMetadataPending:true,syncStatus:'local-only',created_at:'2026-11-20T00:00:00Z'};
 data.set(KEY,JSON.stringify([original]));
 globalThis.fetch=async()=>Response.json([{...original,text:'Older server words',audio_path:null,syncStatus:undefined}]);
 await s.echoes.list({search:'words'});
 const stored=JSON.parse(data.get(KEY))[0];
 assert.equal(stored.text,original.text);assert.equal(stored.audio_path,original.audio_path);assert.equal(stored.syncStatus,'local-only');
});

test('a late archive page cannot revive an Echo already deleted during the request',async()=>{
 const s=setup();let finish,started;const ready=new Promise(resolve=>started=resolve);
 globalThis.fetch=()=>{started();return new Promise(resolve=>finish=resolve);};
 const request=s.echoes.list({search:'old'});await ready;
 data.set('luna_deleted_echo_ids_owner',JSON.stringify(['deleted']));
 finish(Response.json([{id:'deleted',user_id:'owner',text:'old',source:'text',created_at:'2020-01-01T00:00:00Z'}]));
 const page=await request;assert.equal(page.items.length,0);assert.ok(!JSON.parse(data.get(KEY)||'[]').some(e=>e.id==='deleted'));
});
