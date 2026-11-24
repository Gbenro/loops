import type { Scenario, ChatMessage, PhaseId } from './contracts.ts';
import { getLiveLunarData } from './lunar-engine.ts';
export interface Route { name:string; id?:string; query:URLSearchParams; }
export interface UIState { route:Route; echoKind:'all'|'voice'|'text'; search:string; loopFilter:'unfolding'|'all'|'settled'; phase:PhaseId; cycleId:string; time:string; scenario:Scenario; chat:ChatMessage[]; chatContext:string[]; chatBusy:boolean; chatError?:string|null; chatSessionId?:string|null; chatInitialized?:boolean; forceMicDenied:boolean; deepSheetOpen?: boolean; deepSheetTab?: 'phase' | 'moon' | 'sign' | 'season' | 'weave'; chatModel:string; chatVoice:string; chatVoiceModel:string; chatControlsOpen:boolean; chatPlayingMessageId:string|null; chatVoiceFallbackMessageId?:string|null; chatVoiceFallbackLabel?:string|null; chatVoiceRecording:boolean; chatVoiceDuration:number; chatTranscribing:boolean; }
export function parseRoute(hash:string):Route {
  const raw=hash.replace(/^#\/?/,'')||'field';const [path,query]=raw.split('?');const [name,id]=path.split('/');let decoded:string|undefined=id;try{decoded=id?decodeURIComponent(id):undefined;}catch{}return {name,id:decoded,query:new URLSearchParams(query||'')};
}
export const initialState=():UIState=>{
  let phase:PhaseId='first-quarter';let cycleId='cycle-10';
  try{const live=getLiveLunarData();phase=live.phaseId;cycleId=live.cycleId;}catch{}
  const model=(typeof localStorage!=='undefined'?localStorage.getItem('luna_model_key'):null)||'anthropic-fable-5';
  const voice=(typeof localStorage!=='undefined'?localStorage.getItem('luna_voice_key'):null)||'eleven-nicole';
  const voiceModel=(typeof localStorage!=='undefined'?localStorage.getItem('luna_voice_model_key'):null)||'eleven_flash_v2_5';
  return {route:parseRoute(globalThis.location?.hash||''),echoKind:'all',search:'',loopFilter:'unfolding',phase,cycleId,time:'night',scenario:'ready',chat:[],chatContext:[],chatBusy:false,chatError:null,chatSessionId:null,chatInitialized:false,forceMicDenied:false,deepSheetOpen:false,deepSheetTab:'phase',chatModel:model,chatVoice:voice,chatVoiceModel:voiceModel,chatControlsOpen:false,chatPlayingMessageId:null,chatVoiceFallbackMessageId:null,chatVoiceFallbackLabel:null,chatVoiceRecording:false,chatVoiceDuration:0,chatTranscribing:false};
};
