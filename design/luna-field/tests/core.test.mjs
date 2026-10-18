import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMockServices, filterEchoes, LOOP_STATUSES } from '../src/mock-services.ts';
import { FIXTURES, DEMO_CONTEXT, PHASES } from '../src/fixtures.ts';
import { escapeHtml, oceanScene, moonDisc } from '../src/visuals.ts';
import { parseRoute } from '../src/state.ts';
import { routeView } from '../src/views.ts';
const defaultState=()=>({route:parseRoute('#/field'),echoKind:'all',search:'',loopFilter:'unfolding',phase:'first-quarter',cycleId:'cycle-10',time:'night',scenario:'ready',chat:[],chatContext:[],chatBusy:false,forceMicDenied:false});

test('fixtures are synthetic, preserve explicit provenance, and contain no live lunar values',()=>{
  assert.ok(FIXTURES.echoes.every(e=>e.provenance==='synthetic'&&e.context.source==='fixture'));
  assert.equal(PHASES.length,8);assert.equal(new Set(PHASES.map(p=>p.id)).size,8);
  assert.ok(FIXTURES.reflections.some(r=>r.author==='person'));assert.ok(FIXTURES.reflections.some(r=>r.author==='ai-assisted'));
});
test('text capture validates, retains literal user words, and does not alter the source fixtures',async()=>{
  const api=createMockServices();await assert.rejects(api.echoes.create({body:'  ',kind:'text',context:DEMO_CONTEXT}));
  const e=await api.echoes.create({title:'<img src=x onerror=alert(1)>',body:'A small observation.',kind:'text',context:DEMO_CONTEXT});
  assert.equal(e.provenance,'local-session');assert.equal(e.body,'A small observation.');
  assert.equal(api.snapshot().echoes.length,FIXTURES.echoes.length+1);
  assert.equal(FIXTURES.echoes.length,6);assert.ok(escapeHtml(e.title).includes('&lt;img'));
});
test('voice capture requires a real local audio reference and never fabricates transcription',async()=>{
  const api=createMockServices({water:'data:audio/mpeg;base64,AAA'});
  await assert.rejects(api.echoes.create({kind:'voice',body:'',context:DEMO_CONTEXT}));
  const e=await api.echoes.create({title:'Recording',body:'',kind:'voice',audioUrl:'blob:test-local',duration:8,context:DEMO_CONTEXT});
  assert.equal(e.body,'');assert.equal(await api.audio.resolve(e),'blob:test-local');
  assert.equal(await api.audio.resolve(FIXTURES.echoes[0]),'data:audio/mpeg;base64,AAA');
});
test('retrieval supports pagination, context filters, and independent snapshots',async()=>{
  const api=createMockServices();const first=await api.echoes.list({limit:2});assert.equal(first.items.length,2);assert.equal(first.nextCursor,'2');
  const second=await api.echoes.list({limit:2,cursor:first.nextCursor});assert.notEqual(second.items[0].id,first.items[0].id);
  assert.equal(filterEchoes(FIXTURES.echoes,{cycleId:'cycle-09',phaseId:'first-quarter'}).length,1);
  assert.equal(filterEchoes(FIXTURES.echoes,{search:'headphones'})[0].id,'echo-water');
  first.items[0].body='tampered';assert.notEqual((await api.echoes.get(first.items[0].id)).body,'tampered');
});
test('Loop transitions retain a history and accept conscious closure and carrying forward',async()=>{
  const api=createMockServices();const l=await api.loops.create('Leave room for a question');
  for(const status of LOOP_STATUSES)await api.loops.transition(l.id,status);
  const last=(await api.loops.list()).find(x=>x.id===l.id);assert.equal(last.status,'closed');assert.equal(last.history.length,5);
  await assert.rejects(api.loops.transition(l.id,'overdue'));await assert.rejects(api.loops.create(' '));
});
test('Thread connections are explicit, bidirectional, and do not duplicate',async()=>{
  const api=createMockServices();await api.threads.linkEcho('thread-making','echo-water');await api.threads.linkEcho('thread-making','echo-water');
  const t=(await api.threads.list()).find(t=>t.id==='thread-making');assert.equal(t.echoIds.filter(id=>id==='echo-water').length,1);
  assert.ok((await api.echoes.get('echo-water')).threadIds.includes('thread-making'));
  await assert.rejects(api.threads.linkEcho('missing','echo-water'));
});
test('reflection author and original content remain separate',async()=>{
  const api=createMockServices();const before=await api.echoes.get('echo-water');const r=await api.reflections.add('echo-water','I see something else today.');
  assert.equal(r.author,'person');assert.equal(r.provenance,'local-session');assert.deepEqual(await api.echoes.get('echo-water'),before);
  await assert.rejects(api.reflections.add('missing','A reflection'));
});
test('scripted chat only references explicitly selected Echo context',async()=>{
  const api=createMockServices();const none=await api.chat.respond('Explore',[]);assert.equal(none.echoIds.length,0);assert.match(none.content,/scripted/);
  const chosen=await api.chat.respond('Explore',['echo-water']);assert.deepEqual(chosen.echoIds,['echo-water']);assert.ok(chosen.content.includes('A little room between things'));assert.ok(!chosen.content.includes('The table by the window'));
  await assert.rejects(api.chat.respond('Explore',['unavailable']));
});
test('reset removes local session data and restores synthetic fixtures',async()=>{
  const api=createMockServices();await api.loops.create('A local intention');await api.echoes.create({body:'An Echo.',kind:'text',context:DEMO_CONTEXT});api.reset();assert.deepEqual(api.snapshot(),FIXTURES);
});
test('hash routes handle context, missing routes, and malformed encoding safely',()=>{
  assert.equal(parseRoute('').name,'field');assert.equal(parseRoute('#/echo/echo-water').id,'echo-water');assert.equal(parseRoute('#/cycles?phase=full').query.get('phase'),'full');assert.doesNotThrow(()=>parseRoute('#/echo/%E0%A4%A'));
});
test('all requested views and graceful scenarios render from fixtures',()=>{
  for(const route of ['field','echoes','echo/echo-water','echo/echo-table','cycles','loops','threads','thread/thread-space','reflections','returns','chat','not-found']){
    const state=defaultState();state.route=parseRoute(`#/${route}`);const html=routeView(structuredClone(FIXTURES),state);assert.ok(html.length>80,route);assert.ok(!html.includes('[object Object]'),route);
  }
  for(const scenario of ['loading','error','denied','offline']){const state=defaultState();state.scenario=scenario;assert.ok(routeView(structuredClone(FIXTURES),state).length>80);}
});
test('world composition depends on phase and time only; all eight phases are distinct',()=>{
  assert.equal(new Set(PHASES.map(p=>moonDisc(p.index))).size,8);
  assert.notEqual(oceanScene(2,'night'),oceanScene(2,'day'));assert.notEqual(oceanScene(2,'night'),oceanScene(4,'night'));
  assert.equal(oceanScene(2,'night'),oceanScene(2,'night'));
});
test('built prototype is self-contained, blocks network connections, and embeds both audio samples',async()=>{
  const html=await readFile(new URL('../dist/Luna-Prototype.html',import.meta.url),'utf8');
  assert.ok(html.includes("connect-src 'none'"));assert.ok(!/<script[^>]+src=/i.test(html));assert.ok(!/<link[^>]+href=.[hH][tT][tT][pP]/.test(html));assert.equal((html.match(/data:audio\/mpeg;base64,/g)||[]).length,2);
  assert.ok(html.includes('prefers-reduced-motion'));assert.ok(html.includes('scripted responses'));assert.ok(html.includes('Existing backend capability — requires verification'));
});
test('desktop/mobile review embeds the exact standalone application without script truncation',async()=>{
  const html=await readFile(new URL('../dist/Luna-Prototype.html',import.meta.url),'utf8');
  const review=await readFile(new URL('../dist/Luna-Review.html',import.meta.url),'utf8');
  const literal=review.match(/const source=(.*);\nconst frame=/)?.[1];assert.ok(literal);
  assert.equal(vm.runInNewContext(literal),html);
  assert.equal((review.match(/<script>/g)||[]).length,1);assert.equal((review.match(/<\/script>/g)||[]).length,1);
});
