import test from 'node:test';
import { installIDB } from './idb-fixture.mjs';
import assert from 'node:assert/strict';
import { createLiveLunaServices, saveDraftAudio, getDraftAudio, listDraftRecordings, refreshAuthSession, getAuthSession } from '../src/live-services.ts';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token', ECHOES='cosmic_echoes_v1', nativeFetch=globalThis.fetch;
const auth=(id='A')=>store.set(AUTH,JSON.stringify({access_token:'fixture-token-'+id,refresh_token:'fixture-refresh-'+id,expires_at:Math.floor(Date.now()/1000)+3600,user:{id}}));
const record=(id,extra={})=>({id,text:'Synthetic review fixture',source:'text',user_id:'A',created_at:'2026-10-01T12:00:00Z',syncStatus:'local-only',...extra});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
function start(){store.clear();installIDB();globalThis.fetch=async()=>Response.json([]);return createLiveLunaServices();}
const probe=test;
// Original probe cases, with assertions for corrected behavior. All remote calls mocked.
await probe('original: failed upload is not marked synced and is retried',async()=>{
 const api=start();auth();let uploads=0,remote;
 globalThis.fetch=async(url,o={})=>{
  if(String(url).includes('/storage/v1/object/')){uploads++;return new Response('synthetic storage failure',{status:503});}
  if(o.method==='POST'&&String(url).includes('/rest/v1/echoes')){remote=JSON.parse(o.body);return Response.json([remote]);}
  if(String(url).includes('/rest/v1/echoes?')&&String(url).includes('deleted_at=is.null'))return Response.json(remote?[remote]:[]);
  return Response.json([]);
 };
 const e=await api.echoes.create({kind:'voice',body:'fixture',audioBlob:new Blob(['fixture']),duration:185});
 assert.notEqual(e.syncStatus,'synced');assert.ok(!e.audio_path);await api.sync();assert.equal(uploads,2);
});
await probe('original: sync preserves intervening offline Echo creation',async()=>{
 const api=start();auth();store.set(ECHOES,JSON.stringify([record('pending')]));const waiting=deferred(),release=deferred();
 globalThis.fetch=async(url,o={})=>{if(o.method==='POST'&&String(url).includes('/rest/v1/echoes')){const b=JSON.parse(o.body);if(b.id==='pending'){waiting.resolve();await release.promise;return Response.json([b]);}return new Response('offline',{status:503});}return Response.json([]);};
 const sync=api.sync();await waiting.promise;const created=await api.echoes.create({kind:'text',body:'fixture-created-during-sync'});release.resolve();await sync;
 assert.ok(JSON.parse(store.get(ECHOES)).some(e=>e.id===created.id));
});
await probe('original: late refresh cannot restore signed-out account',async()=>{
 const api=start();auth();const waiting=deferred(),release=deferred();globalThis.fetch=async()=>{waiting.resolve();await release.promise;return Response.json({access_token:'fixture-new',user:{id:'A'}});};
 const r=refreshAuthSession();await waiting.promise;await api.auth.signOut();release.resolve();await r;assert.equal(getAuthSession().userId,null);
});
await probe('original: tombstones override active server rows',async()=>{
 const api=start();auth();store.set(ECHOES,JSON.stringify([record('deleted')]));globalThis.fetch=async url=>String(url).includes('/rest/v1/echoes?')?Response.json(String(url).includes('deleted_at=not.is.null')?[{id:'deleted'}]:[record('deleted')]):Response.json([]);
 await api.sync();assert.ok(!JSON.parse(store.get(ECHOES)).some(e=>e.id==='deleted'));
});
await probe('original: durable blob beats revoked audioUrl',async()=>{
 const api=start();const blob=new Blob(['fixture-original']);const stale=URL.createObjectURL(blob);URL.revokeObjectURL(stale);await saveDraftAudio('stale',blob);
 const url=await api.audio.resolve({id:'stale',audioUrl:stale});assert.notEqual(url,stale);assert.equal(await (await nativeFetch(url)).text(),'fixture-original');URL.revokeObjectURL(url);
});
await probe('original: B cannot resolve A-owned audio',async()=>{
 const api=start();auth();await saveDraftAudio('private-a',new Blob(['fixture']),{userId:'A'});await api.auth.signOut();auth('B');assert.equal(await api.audio.resolve({id:'private-a',user_id:'A'}),null);
});
await probe('original: ownerless Echo is not automatically uploaded as B',async()=>{
 const api=start();store.set(ECHOES,JSON.stringify([record('unassigned',{user_id:undefined})]));auth('B');let posts=0;globalThis.fetch=async(url,o={})=>{if(o.method==='POST')posts++;return Response.json([]);};await api.sync();assert.equal(posts,0);
});
await probe('original: draft save reports IndexedDB failure',async()=>{
 start();globalThis.indexedDB={open(){const req={};queueMicrotask(()=>req.onerror?.());return req;}};
 await assert.rejects(()=>saveDraftAudio('idb-failed',new Blob(['fixture'])));delete globalThis.indexedDB;
});
await probe('repair: failed metadata PATCH must retry before marking synced',async()=>{
 const api=start();auth();store.set(ECHOES,JSON.stringify([record('repair',{source:'voice',syncStatus:'failed'})]));await saveDraftAudio('repair',new Blob(['fixture']),{userId:'A'});let patches=0;
 globalThis.fetch=async(url,o={})=>{if(o.method==='PATCH'){patches++;return new Response('patch failed',{status:503});}if(String(url).includes('/rest/v1/echoes?')&&String(url).includes('deleted_at=is.null'))return Response.json([record('repair',{source:'voice',audio_path:null})]);return Response.json([]);};
 await api.sync();assert.equal(JSON.parse(store.get(ECHOES))[0].syncStatus,'failed');await api.sync();
 const e=JSON.parse(store.get(ECHOES))[0];assert.ok(e.syncStatus!=='synced'&&patches>=2,`status=${e.syncStatus}, PATCH attempts=${patches}, remote audio_path still null`);
});
await probe('repair: missing local audio cannot become synced',async()=>{
 const api=start();auth();store.set(ECHOES,JSON.stringify([record('missing-audio',{source:'voice',syncStatus:'failed'})]));globalThis.fetch=async url=>String(url).includes('/rest/v1/echoes?')&&String(url).includes('deleted_at=is.null')?Response.json([record('missing-audio',{source:'voice',audio_path:null})]):Response.json([]);
 await api.sync();assert.notEqual(JSON.parse(store.get(ECHOES))[0].syncStatus,'synced');
});
await probe('tombstones: paginate beyond 500 without silently stopping',async()=>{
 const api=start();auth();const deleted=Array.from({length:601},(_,i)=>({id:'deleted-'+i}));store.set(ECHOES,JSON.stringify([record('deleted-600',{syncStatus:'synced'})]));let maxOffset=0;
 globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='not.is.null'){const offset=Number(u.searchParams.get('offset'));maxOffset=Math.max(offset,maxOffset);return Response.json(deleted.slice(offset,offset+100));}return Response.json([]);};
 await api.sync();assert.ok(!JSON.parse(store.get(ECHOES)).some(e=>e.id==='deleted-600'),`deleted record remains; largest offset fetched=${maxOffset}`);
});
await probe('caller: Echo creation must report durable audio save failure',async()=>{
 const api=start();globalThis.indexedDB={open(){const req={};queueMicrotask(()=>req.onerror?.());return req;}};
 await assert.rejects(()=>api.echoes.create({kind:'voice',body:'fixture',audioBlob:new Blob(['not-persisted']),duration:5}),/./);delete globalThis.indexedDB;
});
await probe('account: sign-out must hide owner-scoped IndexedDB audio',async()=>{
 const api=start();auth();const privateRecord={blob:new Blob(['fixture-A-audio']),userId:'A',id:'private-idb',status:'captured'};
 globalThis.indexedDB={open(){const open={};queueMicrotask(()=>{open.result={objectStoreNames:{contains:()=>false},transaction:()=>({objectStore:()=>({get(){const r={};queueMicrotask(()=>{r.result=privateRecord;r.onsuccess?.();});return r;}})})};open.onsuccess?.({target:open});});return open;}};
 await api.auth.signOut();const url=await api.audio.resolve({id:'private-idb',user_id:'A'});if(url)URL.revokeObjectURL(url);assert.equal(url,null);
});
await probe('account: cross-tab switch during refresh JSON decode must not restore A',async()=>{
 start();auth();const waiting=deferred(),release=deferred();globalThis.fetch=async()=>({ok:true,json:async()=>{waiting.resolve();await release.promise;return {access_token:'fixture-A-new',user:{id:'A'}};}});
 const r=refreshAuthSession();await waiting.promise;auth('B');release.resolve();await r;assert.equal(getAuthSession().userId,'B');
});

await probe('metadata recovery confirms remote path without reuploading original audio',async()=>{
 const api=start();auth();store.set(ECHOES,JSON.stringify([record('repair-ok',{source:'voice',syncStatus:'failed'})]));await saveDraftAudio('repair-ok',new Blob(['fixture']),{userId:'A'});let patches=0,uploads=0,remote=record('repair-ok',{source:'voice',audio_path:null});
 globalThis.fetch=async(url,o={})=>{if(o.method==='PATCH'){patches++;if(patches===1)return new Response('offline',{status:503});remote={...remote,...JSON.parse(o.body)};return Response.json([remote]);}if(String(url).includes('/storage/')){uploads++;return Response.json({});}if(String(url).includes('/rest/v1/echoes?')&&String(url).includes('deleted_at=is.null'))return Response.json([remote]);return Response.json([]);};
 await api.sync();assert.equal(JSON.parse(store.get(ECHOES))[0].audioMetadataPending,true);await api.sync();const e=JSON.parse(store.get(ECHOES))[0];assert.equal(e.syncStatus,'synced');assert.equal(e.audioMetadataPending,false);assert.equal(remote.audio_path,e.audio_path);assert.equal(uploads,1);assert.equal(patches,2);
});
await probe('failed tombstone page aborts reconciliation and never uploads potentially deleted local data',async()=>{
 const api=start();auth();const before=JSON.stringify([record('potentially-deleted')]);store.set(ECHOES,before);let writes=0;
 globalThis.fetch=async(url,o={})=>{if(o.method)writes++;const u=new URL(url);if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='not.is.null'){if(Number(u.searchParams.get('offset'))===100)return new Response('offline',{status:503});return Response.json(Array.from({length:100},(_,i)=>({id:'d'+i})));}return Response.json([]);};
 await assert.rejects(()=>api.sync());assert.equal(writes,0);assert.equal(store.get(ECHOES),before);
});
