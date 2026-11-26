import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceRecorder,voiceCaptureConstraints} from '../src/audio-capture.ts';

test('voice preferences allow device negotiation without requiring a particular microphone',()=>{
 const audio=voiceCaptureConstraints().audio;
 assert.equal(audio.channelCount.ideal,1);
 assert.equal(audio.sampleRate.ideal,48000);
 for(const key of ['echoCancellation','noiseSuppression','autoGainControl'])assert.equal(audio[key].ideal,true);
 assert.ok(Object.values(audio).every(v=>!('exact' in v)));
});
test('unsupported bitrate retries the same codec before browser defaults',()=>{
 const attempts=[];
 class Recorder{
  static isTypeSupported(t){return t==='audio/mp4';}
  constructor(stream,options){attempts.push(options);if(options.audioBitsPerSecond)throw new DOMException('bitrate','NotSupportedError');this.mimeType=options.mimeType;}
 }
 const recorder=createVoiceRecorder({},Recorder);
 assert.equal(recorder.mimeType,'audio/mp4');
 assert.deepEqual(attempts,[{mimeType:'audio/mp4',audioBitsPerSecond:192000},{mimeType:'audio/mp4'}]);
});
test('unsupported chosen encoder falls back to browser-negotiated format',()=>{
 class Recorder{
  static isTypeSupported(){return true;}
  constructor(stream,options){if(options.mimeType)throw new DOMException('encoder','NotSupportedError');this.mimeType='audio/mp4';}
 }
 assert.equal(createVoiceRecorder({},Recorder).mimeType,'audio/mp4');
});
test('recorder security failures are surfaced without retrying',()=>{
 let attempts=0;
 class Recorder{
  static isTypeSupported(){return true;}
  constructor(){attempts++;throw new DOMException('blocked','SecurityError');}
 }
 assert.throws(()=>createVoiceRecorder({},Recorder),{name:'SecurityError'});
 assert.equal(attempts,1);
});
