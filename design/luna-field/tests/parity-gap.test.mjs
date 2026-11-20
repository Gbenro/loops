import test from 'node:test';
import assert from 'node:assert/strict';
import { installIDB } from './idb-fixture.mjs';
import { createAuthStorage } from '../../../src/lib/authStorage.js';
import { createLiveLunaServices } from '../src/live-services.ts';
const AUTH = 'sb-eyxvsbqyzeodsjajfqsj-auth-token';
const LOOPS = 'cosmic_loops_v1';
let storage;
function setup() {
  storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key,value) => storage.set(key,String(value)),
    removeItem: key => storage.delete(key)
  };
  globalThis.fetch = async () => Response.json([]);
  return installIDB();
}
function session(token = 'current') {
  return JSON.stringify({access_token:token,refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'A'}});
}
test('newer synchronous session wins over stale IndexedDB refresh token', async () => {
  const records = setup(); records.set(AUTH,session('old')); storage.set(AUTH,session('new'));
  assert.equal(await createAuthStorage().getItem(AUTH),session('new'));
});
test('Beta recovers an IndexedDB-only login on reopen', async () => {
  const records = setup(); records.set(AUTH,session());
  const api = createLiveLunaServices();
  assert.deepEqual(await api.auth.getSession(),{mode:'authenticated',subject:'A'});
  assert.equal(JSON.parse(storage.get(AUTH)).access_token,'current');
});
test('stalled IndexedDB transaction cannot hang auth restoration', async () => {
  setup();
  globalThis.indexedDB = {open() {
    const req = {};
    queueMicrotask(() => { req.result = {close(){},transaction(){return {objectStore(){return {get(){return {};}};}};}}; req.onsuccess(); });
    return req;
  }};
  assert.equal(await createAuthStorage(20).getItem(AUTH),null);
});
test('signout tombstone prevents revival when IndexedDB deletion was blocked', async () => {
  const records = setup(); records.set(AUTH,session()); storage.set(AUTH,session());
  const actual = globalThis.indexedDB;
  globalThis.indexedDB = {open(){const req={};queueMicrotask(()=>req.onblocked());return req;}};
  await createAuthStorage().removeItem(AUTH);
  globalThis.indexedDB = actual;
  assert.equal(await createAuthStorage().getItem(AUTH),null);
  assert.ok(records.has(AUTH),'test keeps stale durable token');
});
test('slow auth restoration cannot overwrite a newer sign-in', async () => {
  const records = setup(); records.set(AUTH,session('old'));
  const adapter = createAuthStorage();
  const read = adapter.getItem(AUTH);
  const write = adapter.setItem(AUTH,session('new'));
  await Promise.all([read,write]);
  assert.equal(storage.get(AUTH),session('new'));
  assert.equal(await adapter.getItem(AUTH),session('new'));
});
test('Beta keeps each lifecycle state after server round trip with Postgres timestamps', async () => {
  setup(); storage.set(AUTH,session());
  let remote={id:'loop-1',user_id:'A',title:'Intention',status:'active',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'};
  storage.set(LOOPS,JSON.stringify([remote]));
  const api=createLiveLunaServices();
  globalThis.fetch=async (url,options={})=>{
    if(options.method==='PATCH') {remote={...remote,...JSON.parse(options.body)};return Response.json([remote]);}
    if(String(url).includes('/rest/v1/loops?')&&String(url).includes('deleted_at=is.null')) return Response.json([{...remote,updated_at:remote.updated_at.replace('Z','+00:00')}]);
    return Response.json([]);
  };
  for(const state of ['evolving','carried-forward','completed','closed','open']) {
    assert.equal((await api.loops.transition('loop-1',state)).status,state);
    assert.ok(['active','released','closed'].includes(remote.status),'Classic-compatible wire state');
    storage.set(LOOPS,'[]');
    await api.sync();
    assert.equal(api.snapshot().loops[0].status,state);
  }
});
test('Classic changes supersede older Beta lifecycle metadata', async () => {
  setup(); storage.set(AUTH,session());
  storage.set(LOOPS,JSON.stringify([{id:'l',user_id:'A',status:'active',updated_at:'2026-11-02T00:00:00Z',metadata:{luna_beta_lifecycle:{status:'completed',classicStatus:'released',updatedAt:'2026-11-01T00:00:00Z'}}}]));
  assert.equal(createLiveLunaServices().snapshot().loops[0].status,'open');
});
test('a stale remote audio URL does not mask a refreshable durable audio path', async () => {
  setup(); storage.set(AUTH,session()); let signs=0;
  globalThis.fetch=async()=>Response.json({signedURL:'/object/sign/echo-audio/A/voice?token='+ ++signs});
  const api=createLiveLunaServices();
  const echo={id:'voice',user_id:'A',audio_path:'A/voice',audioUrl:'https://example.invalid/expired'};
  const first=await api.audio.resolve(echo);
  assert.match(first,/token=1$/);
  assert.equal(await api.audio.resolve(echo),first);
  assert.match(await api.audio.resolve(echo,{refresh:true}),/token=2$/);
});
test('audio URL cache expires and requests a fresh signature', async () => {
  setup(); storage.set(AUTH,session()); let signs=0;
  globalThis.fetch=async()=>Response.json({signedURL:'/object/sign/echo-audio/A/v?token='+ ++signs});
  const api=createLiveLunaServices(), echo={id:'v',user_id:'A',audio_path:'A/v'};
  const realNow=Date.now;
  try {
    await api.audio.resolve(echo);
    Date.now=()=>realNow()+3001*1000;
    assert.match(await api.audio.resolve(echo),/token=2$/);
  } finally {Date.now=realNow;}
});

test('local-only session is mirrored to durable storage on read', async () => {
  const records=setup(); storage.set(AUTH,session());
  await createAuthStorage().getItem(AUTH);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(records.get(AUTH),session());
});
test('offline Loop reopen retries metadata and clears old closure fields', async () => {
  setup(); storage.set(AUTH,session());
  let remote={id:'offline-loop',user_id:'A',title:'Intention',status:'closed',closed_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',metadata:{serverOnly:'preserve'}};
  storage.set(LOOPS,JSON.stringify([{...remote,metadata:undefined}]));
  const api=createLiveLunaServices();
  globalThis.fetch=async()=>new Response('offline',{status:503});
  await api.loops.transition(remote.id,'evolving');
  globalThis.fetch=async(url,options={})=>{
    if(options.method==='PATCH'){remote={...remote,...JSON.parse(options.body)};return Response.json([remote]);}
    if(String(url).includes('/rest/v1/loops?')&&String(url).includes('deleted_at=is.null'))return Response.json([remote]);
    return Response.json([]);
  };
  await api.sync(); storage.set(LOOPS,'[]'); await api.sync();
  assert.equal(api.snapshot().loops[0].status,'evolving');
  assert.equal(remote.closed_at,null);
  assert.equal(remote.metadata.serverOnly,'preserve');
});
