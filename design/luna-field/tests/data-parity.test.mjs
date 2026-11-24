import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveLunaServices} from '../src/live-services.ts';
import {generateVerifyToken,unlockWithPassphrase,encryptText,decryptText} from '../../../src/lib/encryption.js';
import {installIDB} from './idb-fixture.mjs';
const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token',ECHOES='cosmic_echoes_v1',LOOPS='cosmic_loops_v1';
let stored,remoteLoops,remoteEchoes,verify,writes,offline;
function setup(){
  stored=new Map();remoteLoops=[];remoteEchoes=[];writes=[];verify=null;offline=false;installIDB();
  globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)};
  signIn('A');
  globalThis.fetch=async(url,options={})=>{
    if(offline) return new Response('Offline',{status:503});
    const u=new URL(url);
    if(u.pathname.endsWith('/profiles'))return Response.json([{encryption_verify_token:verify}]);
    const rows=u.pathname.endsWith('/loops')?remoteLoops:remoteEchoes;
    if(['POST','PATCH'].includes(options.method)){
      const body=JSON.parse(options.body);writes.push({url,body});
      if(options.method==='POST')rows.push(body);
      else{const row=rows.find(r=>r.id===u.searchParams.get('id')?.slice(3));if(row)Object.assign(row,body);}
      return Response.json(rows);
    }
    if(u.searchParams.get('deleted_at')==='not.is.null')return Response.json([]);
    return Response.json(u.pathname.endsWith('/echo_reflections')?[]:rows);
  };
}
function signIn(id){stored.set(AUTH,JSON.stringify({access_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,user:{id}}));}
async function privateEcho(){
  verify=await generateVerifyToken('test passphrase','A');
  const key=await unlockWithPassphrase('test passphrase','A',verify);
  const cipher=await encryptText('Private original words',key);
  const row={id:'private',user_id:'A',text:cipher,title:'must not display',is_encrypted:true,source:'text',created_at:'2026-11-01T00:00:00Z'};
  remoteEchoes.push(row);stored.set(ECHOES,JSON.stringify([row]));return {key,cipher};
}
test('Classic ciphertext unlocks only in memory; wrong passphrase and relock hide it',async()=>{
 setup();const {cipher}=await privateEcho();const api=createLiveLunaServices();
 assert.equal(api.snapshot().echoes[0].locked,true);assert.equal(api.snapshot().echoes[0].title,'Private Echo');
 await assert.rejects(api.privacy.unlock('wrong'),/passphrase/);
 await api.privacy.unlock('test passphrase');
 assert.equal(api.snapshot().echoes[0].body,'Private original words');
 assert.equal(api.snapshot().echoes[0].locked,false);
 assert.equal(JSON.parse(stored.get(ECHOES))[0].text,cipher);
 assert.ok(![...stored.values()].join('').includes('Private original words'));
 api.privacy.lock();assert.equal(api.snapshot().echoes[0].locked,true);
});
test('new unlocked Echo encrypts before local and server writes and Classic can decrypt it',async()=>{
 setup();const {key}=await privateEcho();const api=createLiveLunaServices();await api.privacy.unlock('test passphrase');
 const result=await api.echoes.create({kind:'text',body:'Another private moment',title:'Secret title',context:api.snapshot().current});
 assert.equal(result.body,'Another private moment');
 const raw=JSON.parse(stored.get(ECHOES)).find(e=>e.id===result.id);
 assert.equal(raw.is_encrypted,true);assert.equal(await decryptText(raw.text,key),'Another private moment');
 assert.equal(raw.title,'Private Echo');assert.ok(![...stored.values()].join('').includes('Secret title'));
 assert.equal(writes.at(-1).body.is_encrypted,true);assert.equal(writes.at(-1).body.text,raw.text);
});
test('encrypted offline Echo retries as ciphertext with its encryption flag after restart',async()=>{
 setup();const {key}=await privateEcho();const api=createLiveLunaServices();await api.privacy.unlock('test passphrase');offline=true;
 const result=await api.echoes.create({kind:'text',body:'Offline secret',context:api.snapshot().current});
 offline=false;const reopened=createLiveLunaServices();await reopened.sync();
 const sent=writes.find(w=>w.body.id===result.id).body;
 assert.equal(sent.is_encrypted,true);assert.equal(await decryptText(sent.text,key),'Offline secret');
 assert.equal(reopened.snapshot().echoes.find(e=>e.id===result.id).locked,true);
});
test('account switch and signout forget the private key; corrupt ciphertext stays locked',async()=>{
 setup();await privateEcho();const api=createLiveLunaServices();await api.privacy.unlock('test passphrase');
 signIn('B');assert.equal(api.snapshot().echoes.length,0);assert.equal(api.privacy.unlocked(),false);
 signIn('A');assert.equal(api.snapshot().echoes[0].locked,true);
 const rows=JSON.parse(stored.get(ECHOES));rows[0].text='broken';stored.set(ECHOES,JSON.stringify(rows));
 await api.privacy.unlock('test passphrase');assert.equal(api.snapshot().echoes[0].locked,true);
 await api.auth.signOut();assert.equal(api.privacy.unlocked(),false);
});
function loop(){
 const l={id:'loop',user_id:'A',title:'Intention',status:'active',updated_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',metadata:{custom:'keep'},subtasks:[{id:'phase',text:'Full moon review',done:false,isPhaseCheckpoint:true,phase:'full'},{id:'step',text:'Ordinary step',done:false}]};
 remoteLoops.push(structuredClone(l));stored.set(LOOPS,JSON.stringify([l]));return l;
}
test('checklists round trip Classic text/done and phase checkpoint metadata',async()=>{
 setup();loop();const api=createLiveLunaServices();
 await api.loops.checklist('loop','toggle','phase');
 await api.loops.checklist('loop','up','step');
 await api.loops.checklist('loop','add','','New step');
 stored.set(LOOPS,'[]');await api.sync();
 const steps=api.snapshot().loops[0].subtasks;
 assert.equal(steps[0].text,'Ordinary step');assert.equal(steps[1].done,true);
 assert.equal(steps[1].isPhaseCheckpoint,true);assert.equal(steps[1].phase,'full');assert.equal(steps[2].text,'New step');
 assert.equal(remoteLoops[0].metadata.custom,'keep');
 await api.loops.checklist('loop','remove',steps[2].id);assert.equal(api.snapshot().loops[0].subtasks.length,2);
});
test('failed offline checklist changes survive reopen and sync without losing metadata',async()=>{
 setup();loop();const api=createLiveLunaServices();offline=true;
 const changed=await api.loops.checklist('loop','toggle','step');assert.equal(changed.syncStatus,'failed');
 remoteLoops[0].metadata.fromClassic='keep too';offline=false;
 await createLiveLunaServices().sync();
 assert.equal(remoteLoops[0].subtasks[1].done,true);assert.equal(remoteLoops[0].metadata.fromClassic,'keep too');
});
test('checklist never mutates another account record or accepts missing confirmation',async()=>{
 setup();loop();signIn('B');const api=createLiveLunaServices();
 await assert.rejects(api.loops.checklist('loop','toggle','step'),/account/);assert.equal(writes.length,0);
 signIn('A');remoteLoops=[];
 const changed=await api.loops.checklist('loop','toggle','step');assert.equal(changed.syncStatus,'failed');
});
test('late checklist acknowledgement cannot erase a newer local checklist edit',async()=>{
 setup();loop();const api=createLiveLunaServices();const original=fetch;let release;
 globalThis.fetch=(url,opts)=>opts?.method==='PATCH'&&!release?new Promise(resolve=>{release=()=>resolve(Response.json([{id:'loop'}]));}):original(url,opts);
 const first=api.loops.checklist('loop','toggle','phase');
 await new Promise(r=>setTimeout(r,0));
 await api.loops.checklist('loop','toggle','step');release();await first;
 const steps=api.snapshot().loops[0].subtasks;assert.ok(steps.every(s=>s.done));
});
