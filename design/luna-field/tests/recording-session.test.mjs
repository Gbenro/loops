import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordingSession } from '../src/recording-session.ts';
class Recorder extends EventTarget {
  state='recording';mimeType='audio/webm';tracksStopped=false;
  stream={getTracks:()=>[{stop:()=>{this.tracksStopped=true;}}]};
  chunk(text){const e=new Event('dataavailable');e.data=new Blob([text]);this.dispatchEvent(e);}
  stop(){this.state='inactive';queueMicrotask(()=>{this.chunk('-final');this.dispatchEvent(new Event('stop'));});}
}
test('teardown retains final chunks, original owner and draft until durable stop completes',async()=>{
  const recorder=new Recorder(), writes=[];
  const s=new RecordingSession(recorder,'draft_original','account-A',async(id,blob,meta,owner)=>{await new Promise(r=>setTimeout(r,5));writes.push({id,body:await blob.text(),meta,owner});},()=>{});
  recorder.chunk('first');const done=s.stop(true);
  assert.equal(recorder.tracksStopped,false);await done;
  assert.equal(writes.at(-1).body,'first-final');assert.equal(writes.at(-1).meta.status,'interrupted');assert.equal(writes.at(-1).owner,'account-A');assert.equal(writes.at(-1).id,'draft_original');assert.equal(s.durable,true);assert.equal(recorder.tracksStopped,true);
});
test('failed checkpoints retain final in-memory audio and report non-durable state',async()=>{
  const recorder=new Recorder();const s=new RecordingSession(recorder,'draft_fail',null,async()=>{throw Error('quota');},()=>{});
  recorder.chunk('audio');await s.stop();assert.equal(s.durable,false);assert.match(s.error,/Keep this page open/);assert.equal(await s.blob.text(),'audio-final');
});
