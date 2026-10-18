import { rootMeanSquare, liveProjection, signalPath, extractEnvelope, resampleLevels, clamp01 } from './audio-geometry.ts';
import type { WaveAnalysis } from './audio-geometry.ts';

/** Local Web Audio analysis. Microphone audio is never connected to a speaker or a server. */
export class VoiceEngine {
  context:AudioContext|null=null;
  analyser:AnalyserNode|null=null;
  source:MediaStreamAudioSourceNode|null=null;
  buffer=new Float32Array(2048);
  frame=0;
  lastFrame=0;
  lastLevel=0;
  previous:number[]=[];
  levels:{at:number;value:number}[]=[];
  startedAt=0;
  level=0;
  target:HTMLElement|null=null;
  paths:SVGPathElement[]=[];
  meter:HTMLElement|null=null;
  reduced=false;
  active=false;
  async prepare(){
    const Ctor=globalThis.AudioContext||(globalThis as any).webkitAudioContext;
    if(!Ctor)return false;
    try{if(!this.context||this.context.state==='closed')this.context=new Ctor();await this.context!.resume();return this.context!.state==='running';}catch{return false;}
  }
  start(stream:MediaStream,target:HTMLElement){
    this.stop(false);this.levels=[];this.previous=[];this.level=0;this.lastFrame=0;this.lastLevel=0;this.startedAt=performance.now();
    if(!this.context||this.context.state!=='running')return false;
    try{this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.source=this.context.createMediaStreamSource(stream);this.source.connect(this.analyser);this.target=target;this.paths=Array.from(target.querySelectorAll<SVGPathElement>('[data-live-curve]'));this.meter=target.querySelector('[data-voice-level]');this.active=true;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.tick(performance.now());return true;}catch{this.stop(false);return false;}
  }
  tick=(now:number)=>{
    if(!this.active||!this.analyser)return;
    this.frame=requestAnimationFrame(this.tick);
    // At most 30 Hz. Avoid painting a hidden document; timestamps preserve any sampling gaps.
    if(now-this.lastFrame<33)return;this.lastFrame=now;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const rms=rootMeanSquare(this.buffer);this.levels.push({at:(now-this.startedAt)/1000,value:rms});
    this.level+=(clamp01(rms*7)-this.level)*(rms>.002?.4:.16);
    if(document.hidden)return;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!this.reduced){
      this.previous=liveProjection(this.buffer,this.previous);
      this.paths.forEach((path,i)=>path.setAttribute('d',signalPath(this.previous,240,100,i===0?1:i===1?.58:.3)));
      this.target?.style.setProperty('--voice-energy',String(this.level));
    }else{this.paths.forEach(path=>path.setAttribute('d','M0 50L240 50'));this.target?.style.setProperty('--voice-energy','0');}
    if(now-this.lastLevel>350){this.lastLevel=now;if(this.meter){const db=rms>.00001?Math.round(20*Math.log10(rms)):-100;this.meter.textContent=`${this.reduced?'Reduced motion · ':''}${db< -55?'Quiet':`Input ${db} dBFS`}`;}}
  };
  stop(suspend=true){cancelAnimationFrame(this.frame);this.active=false;try{this.source?.disconnect();this.analyser?.disconnect();}catch{}this.source=null;this.analyser=null;this.target?.style.setProperty('--voice-energy','0');this.target=null;this.paths=[];this.meter=null;if(suspend&&this.context?.state==='running')void this.context.suspend().catch(()=>{});}
  capturedEnvelope(duration:number){
    if(!this.levels.length||duration<=0)return [];
    // Timestamp bins preserve real gaps instead of stretching sparse frame samples.
    const bins=Array.from({length:256},()=>({sum:0,count:0}));
    for(const item of this.levels){const bin=bins[Math.min(255,Math.floor(item.at/duration*256))];bin.sum+=item.value;bin.count++;}
    return resampleLevels(bins.map(b=>b.count?b.sum/b.count:0),256);
  }
  async analyse(blob:Blob,duration:number):Promise<WaveAnalysis>{
    const fallback=this.capturedEnvelope(duration);
    if(this.context){try{const buffer=await this.context.decodeAudioData(await blob.arrayBuffer());const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));return {waveform:extractEnvelope(channels),source:'decoded-audio',duration:buffer.duration};}catch{/* Some browsers cannot decode their own MediaRecorder container. */}}
    return {waveform:fallback,source:fallback.length?'capture-levels':'unavailable',duration};
  }
  dispose(){this.stop();if(this.context)void this.context.close().catch(()=>{});this.context=null;this.levels=[];}
}
