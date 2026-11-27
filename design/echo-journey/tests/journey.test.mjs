import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey, ordered, groups } from '../journey.mjs';
const echo = (id, date, cycle = '2026-09', phase = 'full', availability = 'available') => ({ id, kind:'voice', title:id, occurredAt:date, duration:12, availability, context:{cycleId:cycle,cycleLabel:cycle,phaseId:phase,phaseLabel:phase} });
const items = [echo('a','2026-09-05T23:30:00Z'), echo('b','2026-09-06T00:30:00Z'), echo('missing','2026-09-07T00:00:00Z','2026-09','full','unavailable'), echo('c','2026-10-05T12:00:00Z','2026-10')];
class Media extends EventTarget {
  currentTime=0; duration=12; readyState=1; paused=true; plays=0;
  async play(){ this.plays++; this.paused=false; this.dispatchEvent(new Event('play')); }
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  load(){} removeAttribute(){}
  event(type){if(type==='ended')this.currentTime=this.duration;this.dispatchEvent(new Event(type));}
}
const ready = async () => ({status:'ready',url:'fixture.mp3'});
function setup(resolve=ready) { const media=[];const j=new Journey(items,resolve,()=>{const a=new Media();media.push(a);return a;},()=>{},{order:'oldest'});return {j,media}; }
const flush = () => new Promise(resolve=>setImmediate(resolve));
test('order is chronological, deterministic, deduplicated and voice-only',()=>{
  const source=[...items,items[0],{...items[0],id:'text',kind:'text'},echo('bad','invalid')];
  assert.deepEqual(ordered(source).map(e=>e.id),['a','b','missing','c']);
  assert.deepEqual(ordered(source,'newest').map(e=>e.id),['c','missing','b','a']);
  assert.equal(source.length,7);
});
test('day grouping uses selected timezone; phase identity includes cycle',()=>{
  assert.equal(groups(items.slice(0,2),'day','America/Chicago').length,1);
  assert.equal(groups(items.slice(0,2),'day','UTC').length,2);
  assert.equal(groups(items,'phase','UTC').length,2);
  assert.equal(groups(items,'cycle','UTC').length,2);
  assert.deepEqual(groups(ordered(items,'newest'),'phase','UTC').flatMap(g=>g.items.map(e=>e.id)),['c','missing','b','a']);
});
test('play, pause and resume retain position; metadata clamps saved positions',async()=>{
  const {j,media}=setup();await j.select('a',true,100);media[0].event('loadedmetadata');
  assert.equal(j.time,11.95);j.seek(4);j.pause();assert.equal(j.status,'paused');
  await j.play();assert.equal(media[0].currentTime,4);assert.equal(j.status,'playing');
});
test('next and previous restore visited positions while preserving paused intent',async()=>{
  const {j}=setup();await j.select('a',true);j.seek(5);j.pause();await j.step(1);
  assert.equal(j.id,'b');assert.equal(j.status,'paused');await j.step(-1);assert.equal(j.time,5);
  await j.step(-1);assert.equal(j.id,'a');
});
test('ended advances continuously, skips known unavailable and stops at end',async()=>{
  const {j,media}=setup();await j.select('a',true);media[0].event('ended');await flush();assert.equal(j.id,'b');assert.equal(j.status,'playing');
  media[1].event('ended');await flush();assert.equal(j.id,'c');media[2].event('ended');await flush();
  assert.equal(j.status,'complete');assert.equal(j.desired,false);await j.play();assert.equal(j.time,0);
});
test('changing order does not reset audio; next follows the new direction',async()=>{
  const {j,media}=setup();await j.select('b',true);j.seek(6);j.setOrder('newest');
  assert.equal(j.id,'b');assert.equal(j.time,6);assert.equal(media.length,1);await j.step(1);assert.equal(j.id,'a');
});
test('out of order resolution cannot replace a later user selection',async()=>{
  let finish;const {j,media}=setup(id=>id==='a'?new Promise(r=>finish=r):ready());
  const first=j.select('a',true);await j.select('b',true);finish({status:'ready',url:'old.mp3'});await first;
  assert.equal(j.id,'b');assert.equal(media.length,1);assert.equal(media[0].src,'fixture.mp3');
});
test('pause during source loading prevents late autoplay',async()=>{
  let finish;const {j,media}=setup(()=>new Promise(r=>finish=r));const loading=j.select('a',true);
  j.pause();finish({status:'ready',url:'fixture.mp3'});await loading;assert.equal(media[0].plays,0);assert.equal(j.status,'paused');
});
test('late events from abandoned media have no effect',async()=>{
  const {j,media}=setup();await j.select('a',true);await j.select('b',false);
  media[0].event('ended');media[0].event('error');assert.equal(j.id,'b');assert.equal(j.status,'paused');
});
test('newly unavailable recordings are skipped during continuous playback',async()=>{
  const {j}=setup(id=>id==='a'?Promise.resolve({status:'unavailable'}):ready());await j.select('a',true);
  assert.equal(j.id,'b');assert.equal(j.status,'playing');assert.equal(j.queue.length,2);
});
for(const status of ['authentication-required','forbidden','retryable-error']) test(`${status} stops instead of skipping to another private record`,async()=>{
  const {j,media}=setup(async()=>({status}));await j.select('a',true);
  assert.equal(j.id,'a');assert.equal(j.status,'blocked');assert.equal(j.desired,false);assert.equal(media.length,0);
});
test('browser autoplay rejection is recoverable and never leaves a playing indicator',async()=>{
  const j=new Journey(items,ready,()=>{const a=new Media();a.play=async()=>{throw Error('NotAllowed');};return a;});
  await j.select('a',true);assert.equal(j.status,'paused');assert.equal(j.desired,false);assert.match(j.message,/browser/);
});
test('bookmark restores id, ordering and seconds without autoplay or URLs',async()=>{
  const {j}=setup();await j.select('b',true);j.seek(7);j.setOrder('newest');const place=j.place();
  assert.deepEqual(place,{echoId:'b',seconds:7,order:'newest'});await j.select('c',true);assert.equal(await j.restore(place),true);
  assert.equal(j.time,7);assert.equal(j.id,'b');assert.equal(j.status,'paused');assert.equal(await j.restore({echoId:'deleted'}),false);
});
test('empty/all-unavailable queues and disposal safely stop playback',async()=>{
  const j=new Journey([items[2]],ready,()=>new Media());await j.play();assert.equal(j.queue.length,0);
  const {j:active,media}=setup();await active.select('a',true);active.dispose();media[0].event('ended');assert.equal(active.id,null);assert.equal(media[0].paused,true);assert.equal(active.queue.length,0);assert.equal(active.desired,false);
});
test('network and decode errors stop with a retry message',async()=>{
  const {j}=setup(async()=>{throw Error('offline');});await j.select('a',true);assert.equal(j.status,'blocked');
  const {j:playing,media}=setup();await playing.select('a',true);media[0].event('error');assert.equal(playing.status,'blocked');assert.equal(playing.desired,false);
});
test('pause wins over an unresolved browser play request',async()=>{
  let finish;const audio=new Media();audio.play=()=>new Promise(resolve=>finish=resolve);
  const j=new Journey(items,ready,()=>audio);await j.select('a',false);const playing=j.play();j.pause();finish();await playing;
  assert.equal(j.desired,false);assert.equal(audio.paused,true);assert.equal(j.status,'paused');
});
test('successful retry clears an earlier browser-rejection message',async()=>{
  const audio=new Media();let rejected=false;audio.play=async()=>{if(!rejected){rejected=true;throw Error('NotAllowed');}audio.event('play');};
  const j=new Journey(items,ready,()=>audio);await j.select('a',true);assert.ok(j.message);await j.play();assert.equal(j.status,'playing');assert.equal(j.message,'');
});

test('remote media error renews a signed URL once and then exposes a retry state',async()=>{
 let calls=[];const {j,media}=setup(async(id,signal,options)=>{calls.push(options);return {status:'ready',url:'https://synthetic.invalid/audio'};});await j.select('a',true);media[0].event('error');await flush();assert.equal(calls.length,2);assert.equal(calls[1].refresh,true);media[1].event('error');assert.equal(j.status,'blocked');assert.equal(calls.length,2);
});
test('durationless WebM is measured without saving the end-probe as a listening position',async()=>{
 const a=new Media();a.duration=Infinity;const j=new Journey([{...items[0],duration:undefined}],ready,()=>a);await j.select('a',false,2);a.event('loadedmetadata');a.event('timeupdate');assert.equal(j.time,2);a.duration=150;a.event('durationchange');assert.equal(j.duration,150);assert.equal(a.currentTime,2);j.seek(130);assert.equal(a.currentTime,130);
});
test('filtering away the playing Echo cancels its media and pending resolver',async()=>{
 const {j,media}=setup();await j.select('a',true);j.setItems([items[3]]);assert.equal(media[0].paused,true);assert.equal(j.id,'c');assert.equal(j.status,'idle');
});

test('new journeys select the latest recording first',()=>{
 const j=new Journey(items,ready,()=>new Media());
 assert.equal(j.order,'newest');assert.equal(j.id,'c');
});
test('metadata end probing cannot advance even after durationchange',async()=>{
 const media=new Media();media.duration=Infinity;
 const j=new Journey(items.map(e=>({...e,duration:undefined})),ready,()=>media);
 await j.select('a',true,2);media.event('loadedmetadata');
 media.duration=150;media.event('durationchange');media.event('ended');await flush();
 assert.equal(j.id,'a');assert.equal(j.time,2);
 media.currentTime=2;media.event('seeked');await flush();
 assert.equal(j.status,'playing');assert.equal(j.id,'a');
});
test('pause cancels a pending transition and a late page cannot autoplay',async()=>{
 let finish;const media=[];
 const j=new Journey(items,ready,()=>{const a=new Media();media.push(a);return a;},()=>{},
 {between:()=>new Promise(r=>finish=r)});
 await j.play();media[0].event('ended');await flush();assert.equal(j.status,'transition');
 j.pause();finish();await flush();assert.equal(j.id,'c');assert.equal(j.desired,false);
});
test('continuous playback loads the next page once and respects cancellation',async()=>{
 let finish,calls=0;const media=[];
 const j=new Journey([items[3]],ready,()=>{const a=new Media();media.push(a);return a;},()=>{},
 {loadMore:async()=>{calls++;await new Promise(r=>finish=r);j.setItems([items[3],items[1]]);}});
 await j.play();media[0].event('ended');media[0].event('ended');await flush();
 assert.equal(calls,1);finish();await flush();assert.equal(j.id,'b');assert.equal(j.status,'playing');
});
test('page failure retains current Echo and can be retried with Next',async()=>{
 let fail=true;const media=[];
 const j=new Journey([items[3]],ready,()=>{const a=new Media();media.push(a);return a;},()=>{},
 {loadMore:async()=>{if(fail)throw Error('offline');j.setItems([items[3],items[1]]);}});
 await j.play();media[0].event('ended');await flush();assert.match(j.message,/Next to retry/);assert.equal(j.id,'c');
 fail=false;await j.step(1);assert.equal(j.id,'b');
});
test('routine refreshed metadata preserves media and current playback position',async()=>{
 const {j,media}=setup();await j.select('b',true);j.seek(6);j.setItems(items.map(e=>({...e})));
 assert.equal(media.length,1);assert.equal(j.time,6);assert.equal(j.status,'playing');
});

test('duration probing may abort the initial play promise without cancelling user intent',async()=>{
 const media=new Media();media.duration=Infinity;let rejectPlay;
 media.play=()=>new Promise((resolve,reject)=>{rejectPlay=reject;});
 media.pause=()=>{media.paused=true;rejectPlay?.(new DOMException('Internal pause','AbortError'));media.event('pause');};
 const j=new Journey([{...items[0],duration:undefined}],ready,()=>media);
 const starting=j.select('a',true);await flush();media.event('loadedmetadata');await starting;
 assert.equal(j.desired,true);media.duration=150;media.event('durationchange');
 media.play=async()=>{media.paused=false;media.event('play');};
 media.event('seeked');await flush();assert.equal(j.status,'playing');assert.equal(j.id,'a');
});
test('resuming after a paused transition continues to the next Echo',async()=>{
 let finish;const media=[];
 const j=new Journey(items,ready,()=>{const a=new Media();media.push(a);return a;},()=>{},
 {between:()=>new Promise(r=>finish=r)});
 await j.play();media[0].event('ended');await flush();j.pause();finish();await flush();
 const next=j.play();await flush();finish();await next;assert.equal(j.id,'b');assert.equal(j.status,'playing');
});

test('pause during page loading remains resumable when the page arrives',async()=>{
 let finish;const media=[];
 const j=new Journey([items[3]],ready,()=>{const a=new Media();media.push(a);return a;},()=>{},
 {loadMore:async()=>{await new Promise(r=>finish=r);j.setItems([items[3],items[1]]);}});
 await j.play();media[0].event('ended');await flush();j.pause();finish();await flush();
 assert.equal(j.desired,false);assert.equal(j.status,'paused');assert.equal(j.id,'c');
 await j.play();assert.equal(j.id,'b');assert.equal(j.status,'playing');
});
