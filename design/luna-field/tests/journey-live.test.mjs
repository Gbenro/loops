import test from 'node:test';
import assert from 'node:assert/strict';
import { installIDB } from './idb-fixture.mjs';
import { createLiveLunaServices, saveDraftAudio } from '../src/live-services.ts';
import { createJourneyService, journeyEcho } from '../src/journey-service.ts';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token',ECHOES='cosmic_echoes_v1';
const login=id=>store.set(AUTH,JSON.stringify({access_token:'fixture-'+id,user:{id}}));
function setup(){store.clear();installIDB();globalThis.fetch=async()=>Response.json([]);return createLiveLunaServices();}
const raw=(id,extra={})=>({id,title:'Synthetic '+id,source:'voice',created_at:'2026-09-10T12:00:00Z',user_id:'A',...extra});
test('authenticated Journey excludes guests, other accounts, samples and text',()=>{
 const s=setup();login('A');store.set(ECHOES,JSON.stringify([raw('a'),raw('b',{user_id:'B'}),raw('g',{user_id:null}),raw('sample',{provenance:'synthetic'}),raw('text',{source:'text'})]));
 assert.deepEqual(createJourneyService(s).items().map(e=>e.id),['a']);
});
test('listening position is account scoped and never stores audio URLs or content',()=>{
 const s=setup();login('A');const a=createJourneyService(s);assert.equal(a.savePlace({echoId:'a',seconds:4,order:'newest',url:'private'}),true);
 login('B');assert.equal(a.loadPlace(),null);assert.equal(a.savePlace({echoId:'a',seconds:99,order:'oldest'}),false);assert.equal(createJourneyService(s).loadPlace(),null);
 login('A');assert.deepEqual(createJourneyService(s).loadPlace(),{echoId:'a',seconds:4,order:'newest'});
});
test('local-first offline Journey audio and honest missing recording',async()=>{
 const s=setup();login('A');store.set(ECHOES,JSON.stringify([raw('local'),raw('missing')]));await saveDraftAudio('local',new Blob(['synthetic']),{},'A');
 globalThis.fetch=async()=>{throw Error('network must not be used');};const a=createJourneyService(s),signal=new AbortController().signal;
 const r=await a.resolve('local',signal);assert.equal(r.status,'ready');assert.ok(r.url.startsWith('blob:'));URL.revokeObjectURL(r.url);assert.equal((await a.resolve('missing',signal)).status,'unavailable');
});
test('signed URL cache can be renewed; cancelled or switched account cannot receive late audio',async()=>{
 const s=setup();login('A');store.set(ECHOES,JSON.stringify([raw('remote',{audio_path:'A/remote.webm'})]));const a=createJourneyService(s);let signs=0;
 globalThis.fetch=async()=>Response.json({signedURL:'/object/sign/echo-audio/A/remote.webm?fixture='+ ++signs});
 const signal=new AbortController().signal;const first=await a.resolve('remote',signal);await a.resolve('remote',signal);assert.equal(signs,1);const fresh=await a.resolve('remote',signal,{refresh:true});assert.notEqual(first.url,fresh.url);assert.equal(signs,2);
 let finish,started;const waiting=new Promise(r=>started=r);globalThis.fetch=()=>{started();return new Promise(r=>finish=r);};const control=new AbortController();const pending=a.resolve('remote',control.signal,{refresh:true});await waiting;login('B');control.abort();finish(Response.json({signedURL:'/private-A'}));assert.equal((await pending).status,'authentication-required');
});
test('complete active history is paginated; same named lunar months across years stay separate',async()=>{
 const s=setup();login('A');const rows=Array.from({length:205},(_,i)=>raw('historical-'+i,{created_at:(i%2?'2025':'2026')+'-09-10T12:00:00Z',phase:'full',phase_name:'Original full',lunar_month:'Harvest',audio_path:'A/'+i+'.webm'}));let max=0;
 globalThis.fetch=async(url)=>{const u=new URL(url);if(u.pathname.endsWith('/echoes')&&u.searchParams.get('deleted_at')==='is.null'){const n=Number(u.searchParams.get('offset'));max=Math.max(max,n);return Response.json(rows.slice(n,n+100));}return Response.json([]);};await s.sync();const items=createJourneyService(s).items();assert.equal(items.length,205);assert.equal(max,200);assert.equal(new Set(items.map(e=>e.context.cycleId)).size,2);assert.ok(items.every(e=>e.context.phaseLabel==='Original full'));
});
test('historical projection derives missing context without changing source Echo',()=>{
 const e={id:'a',title:'Original',kind:'voice',occurredAt:'2025-05-02T12:00:00Z',context:{},provenance:'local-session'};const before=structuredClone(e);const view=journeyEcho(e);assert.ok(view.context.phaseId);assert.match(view.context.cycleId,/lunation/);assert.deepEqual(e,before);
});
