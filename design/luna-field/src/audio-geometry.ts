/** Pure audio-to-geometry functions. No animation clock, randomness, or sentiment input. */
export interface WaveAnalysis { waveform:number[]; source:'decoded-audio'|'capture-levels'|'unavailable'; duration:number; }
export const clamp01=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export function rootMeanSquare(samples:ArrayLike<number>){let sum=0;for(let i=0;i<samples.length;i++)sum+=samples[i]*samples[i];return samples.length?Math.sqrt(sum/samples.length):0;}
export function resampleLevels(values:ArrayLike<number>,count=192):number[]{
  if(!values.length)return [];
  const result:number[]=[];
  for(let i=0;i<count;i++){const from=Math.floor(i*values.length/count);const to=Math.max(from+1,Math.floor((i+1)*values.length/count));let peak=0,sum=0,n=0;for(let j=from;j<Math.min(to,values.length);j++){const v=Math.abs(values[j]);peak=Math.max(peak,v);sum+=v*v;n++;}result.push(n?peak*.3+Math.sqrt(sum/n)*.7:0);}
  const ceiling=Math.max(...result,0.000001);
  // Relative amplitude view: a quiet region stays quiet, and silence stays flat.
  return result.map(v=>clamp01(v/ceiling));
}
export function extractEnvelope(channels:ArrayLike<number>[],count=256):number[]{
  if(!channels.length||!channels[0].length)return [];
  const length=channels[0].length;const levels:number[]=[];
  for(let i=0;i<count;i++){const start=Math.floor(i*length/count),end=Math.max(start+1,Math.floor((i+1)*length/count));let sum=0,peak=0,n=0;for(let j=start;j<Math.min(length,end);j++){let power=0;for(const ch of channels){const sample=ch[j]||0;power+=sample*sample;peak=Math.max(peak,Math.abs(sample));}sum+=power/channels.length;n++;}levels.push(n?Math.sqrt(sum/n)*.75+peak*.25:0);}
  const ceiling=Math.max(...levels,0.000001);return levels.map(v=>clamp01(v/ceiling));
}
export function smoothPath(points:{x:number;y:number}[],move=true){
  if(!points.length)return '';let d=`${move?'M':'L'}${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  // Monotonic-x cubic interpolation, preserving each measured amplitude sample.
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],m=(a.x+b.x)/2;d+=`C${m.toFixed(2)} ${a.y.toFixed(2)} ${m.toFixed(2)} ${b.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;}return d;
}
export function envelopePaths(levels:readonly number[],width=720,height=100){
  const values=levels.length?levels:Array(48).fill(0);const maxHeight=height*.43;const mid=height/2;
  const smooth=values.map((v,i)=>clamp01(((values[Math.max(0,i-1)]||0)+2*v+(values[Math.min(values.length-1,i+1)]||0))/4));
  const upper=smooth.map((v,i)=>({x:i*width/Math.max(1,smooth.length-1),y:mid-v*maxHeight}));
  const lower=smooth.map((v,i)=>({x:i*width/Math.max(1,smooth.length-1),y:mid+v*maxHeight}));
  const top=smoothPath(upper),bottom=smoothPath(lower);return {top,bottom,area:top+smoothPath([...lower].reverse(),false)+'Z'};
}
export function liveProjection(samples:Float32Array,previous:number[]=[],count=56):number[]{
  if(!samples.length)return Array(count).fill(0);
  const level=rootMeanSquare(samples);const next:number[]=[];
  for(let i=0;i<count;i++){
    const start=Math.floor(i*samples.length/count),end=Math.floor((i+1)*samples.length/count);let sum=0;for(let j=start;j<end;j++)sum+=samples[j];
    const signed=Math.tanh(sum/Math.max(1,end-start)*6);
    const target=level<.002?0:signed;
    // Fast attack, gentle decay. This smooths microphone data, it does not invent a wave.
    const old=previous[i]||0;next.push(old+(target-old)*(level<.002?.22:.5));
  }
  return next.map((v,i)=>(next[Math.max(0,i-1)]+2*v+next[Math.min(count-1,i+1)])/4);
}
export function signalPath(values:readonly number[],width=240,height=100,scale=1){return smoothPath(values.map((v,i)=>({x:i*width/Math.max(1,values.length-1),y:height/2-Math.max(-1,Math.min(1,v))*height*.44*scale})));}
export function sampleEnvelope(levels:readonly number[],progress:number){if(!levels.length)return 0;const x=clamp01(progress)*(levels.length-1);const i=Math.floor(x);return levels[i]+((levels[Math.min(i+1,levels.length-1)]||0)-levels[i])*(x-i);}
