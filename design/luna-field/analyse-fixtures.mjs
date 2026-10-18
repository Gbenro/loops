// Optional fixture regeneration; needs FFmpeg. Build and browser review do not.
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {extractEnvelope} from './src/audio-geometry.ts';
const result={};
for(const name of ['water','question']){
  const decoded=spawnSync('ffmpeg',['-v','error','-i',`assets/${name}.mp3`,'-ac','1','-ar','16000','-f','f32le','pipe:1'],{maxBuffer:8*1024*1024});
  if(decoded.status!==0)throw new Error(decoded.stderr.toString());
  const values=new Float32Array(decoded.stdout.length/4);for(let i=0;i<values.length;i++)values[i]=decoded.stdout.readFloatLE(i*4);
  result[name]={waveform:extractEnvelope([values]).map(n=>Number(n.toFixed(5))),duration:values.length/16000,source:'decoded-audio'};
}
await writeFile('src/audio-fixtures.ts',`// Derived from the included synthetic speech MP3 files, not decorative data.\nexport const AUDIO_FIXTURES=${JSON.stringify(result)};\n`);
console.log('Derived 256 amplitude bins from each embedded speech sample.');
