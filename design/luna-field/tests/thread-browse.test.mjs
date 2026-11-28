import test from 'node:test';
import assert from 'node:assert/strict';
import {makeThreadIndex,sortedThreads,THREAD_PAGE_SIZE} from '../src/thread-browse.ts';
import {createLiveLunaServices} from '../src/live-services.ts';
import {threadsView} from '../src/views.ts';
import {installIDB} from './idb-fixture.mjs';
const data=new Map(),AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token',KEY='cosmic_echoes_v1';
globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
function setup(){data.clear();installIDB();data.set(AUTH,JSON.stringify({access_token:'synthetic',expires_at:Date.now()/1000+3600,user:{id:'owner'}}));return createLiveLunaServices();}
test('Thread index deduplicates links, orders by activity or count, and searches older connections',()=>{
 const rows=[{id:'a',tags:['Many','Many'],created_at:'2020-01-01'},{id:'b',tags:['Many'],created_at:'2021-01-01'},{id:'c',tags:['Newest'],created_at:'2026-11-27'},{id:'d',tags:['Archive / memory'],created_at:'2019-01-01'},{id:'z',tags:null}];
 const threads=makeThreadIndex(rows);assert.equal(threads.length,3);
 assert.deepEqual(sortedThreads(threads).map(t=>t.title),['Newest','Many','Archive / memory']);
 assert.deepEqual(sortedThreads(threads,'','count').map(t=>t.title),['Many','Newest','Archive / memory']);
 assert.equal(threads.find(t=>t.id==='Many').echoIds.length,2);
 assert.equal(sortedThreads(threads,' MEMORY ')[0].id,'Archive / memory');assert.equal(THREAD_PAGE_SIZE,12);
});
test('metadata discovery pages all tagged history without reading or overwriting full Echoes',async()=>{
 const s=setup();const local={id:'local',user_id:'owner',text:'Keep my original',tags:['Local'],syncStatus:'local-only',created_at:'2026-11-27'};data.set(KEY,JSON.stringify([local]));
 const rows=Array.from({length:505},(_,i)=>({id:'e'+String(999-i),tags:['History'],created_at:'2020-01-01T00:00:00Z'}));
 const reads=[];globalThis.fetch=async url=>{const u=new URL(url);reads.push(u);assert.equal(u.searchParams.get('select'),'id,tags,created_at');assert.equal(u.searchParams.get('user_id'),'eq.owner');assert.equal(u.searchParams.get('deleted_at'),'is.null');assert.equal(u.searchParams.get('tags'),'not.eq.[]');const id=(u.searchParams.get('and')||'').match(/id.lt."([^"]+)"/)?.[1];return Response.json(rows.filter(r=>!id||r.id<id).slice(0,501));};
 s.snapshot();assert.equal(reads.length,0);
 data.set('luna_deleted_echo_ids_owner',JSON.stringify(['e999']));
 const threads=await s.threads.list();assert.equal(reads.length,2);assert.equal(threads.find(t=>t.id==='History').echoIds.length,504);assert.equal(threads.find(t=>t.id==='Local').echoIds.length,1);
 assert.deepEqual(JSON.parse(data.get(KEY)),[local]);assert.equal(s.snapshot().echoes.length,1);
 await s.threads.linkEcho('History','local');assert.equal(s.snapshot().threads.find(t=>t.id==='History').echoIds.length,505);
});
test('metadata arriving after an account switch is rejected and never appears in the next account',async()=>{
 const s=setup();let finish,started;const ready=new Promise(r=>started=r);
 globalThis.fetch=()=>{started();return new Promise(r=>finish=r);};
 const pending=s.threads.list();await ready;data.set(AUTH,JSON.stringify({access_token:'other',user:{id:'other'}}));finish(Response.json([{id:'private',tags:['Private connection'],created_at:'2020-01-01'}]));
 await assert.rejects(pending,/Account changed/);assert.equal(s.snapshot().threads.length,0);
});
test('pending local tag changes take precedence over server metadata',async()=>{
 const s=setup();data.set(KEY,JSON.stringify([{id:'edit',user_id:'owner',tags:['New tag'],text:'Private',created_at:'2020-01-01',syncStatus:'local-only'}]));
 globalThis.fetch=async()=>Response.json([{id:'edit',tags:['Old tag'],created_at:'2020-01-01'}]);
 assert.deepEqual((await s.threads.list()).map(t=>t.id),['New tag']);
});

test('Thread detail does not revive a deleted Echo from its earlier page results',()=>{
 const deleted={id:'deleted',title:'Deleted words',threadIds:['History']};
 const db={threads:[{id:'History',title:'History',description:'',echoIds:['deleted'],loopIds:[]}],echoes:[],loops:[],reflections:[]};
 const html=threadsView(db,'History',{echoResults:[deleted]});
 assert.ok(!html.includes('Deleted words'));assert.ok(!html.includes('href="#/echo/deleted"'));
});
