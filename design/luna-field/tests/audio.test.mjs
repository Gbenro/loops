import test from 'node:test';
import assert from 'node:assert/strict';
import {rootMeanSquare, extractEnvelope, liveProjection, envelopePaths, sampleEnvelope, resampleLevels, signalPath} from '../src/audio-geometry.ts';
import {AUDIO_FIXTURES} from '../src/audio-fixtures.ts';
import {VoiceEngine} from '../src/voice-engine.ts';
import {createMockServices} from '../src/mock-services.ts';
import {DEMO_CONTEXT} from '../src/fixtures.ts';
import {playbackWave, waveform} from '../src/visuals.ts';

test('digital silence stays flat in both stored and live waveforms',()=>{
  const silence=new Float32Array(2048);assert.equal(rootMeanSquare(silence),0);
  assert.ok(extractEnvelope([silence],32).every(n=>n===0));assert.ok(liveProjection(silence).every(n=>n===0));
  const geometry=envelopePaths(Array(8).fill(0));assert.ok(!geometry.top.includes('NaN'));assert.ok(!geometry.top.includes('Infinity'));
});
test('microphone projection responds to actual input and settles after a pause',()=>{
  const speechLike=Float32Array.from({length:2048},(_,i)=>.2*Math.sin(i*.08)+.1*Math.sin(i*.027));
  const active=liveProjection(speechLike);assert.ok(Math.max(...active.map(Math.abs))>.02);
  let settled=active;for(let i=0;i<45;i++)settled=liveProjection(new Float32Array(2048),settled);
  assert.ok(Math.max(...settled.map(Math.abs))<.00001);
  assert.deepEqual(liveProjection(speechLike),liveProjection(speechLike));
});
test('stored envelope preserves quiet regions and the timing of a known pulse',()=>{
  const signal=new Float32Array(4096);for(let i=2048;i<3072;i++)signal[i]=.5*Math.sin(i*.2);
  const envelope=extractEnvelope([signal],16);assert.ok(envelope.slice(0,8).every(n=>n===0));assert.ok(envelope.slice(8,12).every(n=>n>.8));assert.ok(envelope.slice(12).every(n=>n===0));
});
test('opposite stereo phase does not cancel measured audio energy',()=>{
  const a=Float32Array.from({length:1024},(_,i)=>Math.sin(i*.1)*.3);const b=Float32Array.from(a,v=>-v);
  assert.ok(extractEnvelope([a,b],32).some(v=>v>.9));
});
test('progress samples the recorded envelope with bounded interpolation',()=>{
  assert.equal(sampleEnvelope([0,1,0],0),0);assert.equal(sampleEnvelope([0,1,0],.5),1);assert.equal(sampleEnvelope([0,1,0],.25),.5);assert.equal(sampleEnvelope([0,1,0],1),0);assert.equal(sampleEnvelope([],0),0);assert.equal(sampleEnvelope([.2,.7],2),.7);
});
test('embedded narration has measured, nonconstant envelopes; waveform contains curves rather than bars',()=>{
  for(const asset of Object.values(AUDIO_FIXTURES)){assert.equal(asset.source,'decoded-audio');assert.equal(asset.waveform.length,256);assert.ok(asset.duration>5);assert.ok(new Set(asset.waveform).size>100);assert.ok(asset.waveform.every(n=>n>=0&&n<=1));}
  const html=waveform(AUDIO_FIXTURES.water.waveform);assert.ok(html.includes('<path'));assert.ok(!html.includes('<rect'));assert.ok(html.includes('C'));
  const playback=playbackWave(AUDIO_FIXTURES.water.waveform);assert.ok(playback.includes('data-wave-progress'));assert.ok(playback.includes('clipPath'));
});
test('recorded waveform provenance passes through the mock adapter without modifying original text',async()=>{
  const api=createMockServices();const data=[0,.2,.6,.1,0];const e=await api.echoes.create({title:'A recording',body:'My own words.',kind:'voice',audioUrl:'blob:local',duration:4,waveform:data,waveformSource:'capture-levels',context:DEMO_CONTEXT});
  data[2]=0;assert.equal(e.waveform[2],.6);assert.equal(e.waveformSource,'capture-levels');assert.equal((await api.echoes.get(e.id)).body,'My own words.');
});
test('capture fallback uses elapsed time and leaves missing measurement gaps empty',()=>{
  const engine=new VoiceEngine();engine.levels=[{at:.1,value:.1},{at:1,value:.4},{at:3.9,value:.2}];const envelope=engine.capturedEnvelope(4);
  assert.equal(envelope.length,256);assert.ok(envelope.slice(80,200).every(v=>v===0));assert.ok(envelope[64]>.9);assert.deepEqual(resampleLevels([],256),[]);
});
test('microphone analysis stops and disconnects nodes without stopping an unrelated audio element',()=>{
  const oldCancel=globalThis.cancelAnimationFrame;let cancelled=0;let sourceDisconnected=0;let analyserDisconnected=0;let suspended=0;
  globalThis.cancelAnimationFrame=()=>cancelled++;
  try{const engine=new VoiceEngine();engine.active=true;engine.frame=9;engine.source={disconnect(){sourceDisconnected++;}};engine.analyser={disconnect(){analyserDisconnected++;}};engine.context={state:'running',suspend(){suspended++;return Promise.resolve();}};engine.stop();assert.equal(engine.active,false);assert.equal(sourceDisconnected,1);assert.equal(analyserDisconnected,1);assert.equal(suspended,1);assert.equal(cancelled,1);assert.equal(engine.target,null);}finally{globalThis.cancelAnimationFrame=oldCancel;}
});
test('decode failures are explicitly labeled as capture-level approximations or unavailable',async()=>{
  const engine=new VoiceEngine();engine.context={decodeAudioData:async()=>{throw new Error('unsupported container');}};engine.levels=[{at:0,value:.1},{at:1,value:.2}];const result=await engine.analyse(new Blob(['audio']),2);assert.equal(result.source,'capture-levels');assert.equal(result.waveform.length,256);
  engine.levels=[];const unavailable=await engine.analyse(new Blob(['audio']),2);assert.equal(unavailable.source,'unavailable');assert.equal(unavailable.waveform.length,0);
});
test('reduced-motion microphone mode stays still while retaining measured input levels',()=>{
  const original={raf:globalThis.requestAnimationFrame,media:globalThis.matchMedia,document:globalThis.document};
  let styleValue='';const paths=[];let meter='';
  globalThis.requestAnimationFrame=()=>1;globalThis.matchMedia=()=>({matches:true});globalThis.document={hidden:false};
  try{
    const engine=new VoiceEngine();engine.active=true;engine.startedAt=0;engine.analyser={getFloatTimeDomainData(buffer){buffer.fill(.1);}};engine.target={style:{setProperty(_name,value){styleValue=value;}}};engine.paths=[{setAttribute(_name,value){paths.push(value);}}];engine.meter={set textContent(value){meter=value;}};engine.tick(1000);
    assert.equal(styleValue,'0');assert.deepEqual(paths,['M0 50L240 50']);assert.equal(engine.levels.length,1);assert.match(meter,/Reduced motion/);
  }finally{globalThis.requestAnimationFrame=original.raf;globalThis.matchMedia=original.media;globalThis.document=original.document;}
});
