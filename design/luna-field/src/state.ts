import type { Scenario, ChatMessage, PhaseId } from './contracts.ts';
export interface Route { name:string; id?:string; query:URLSearchParams; }
export interface UIState { route:Route; echoKind:'all'|'voice'|'text'; search:string; loopFilter:'unfolding'|'all'|'settled'; phase:PhaseId; cycleId:string; time:string; scenario:Scenario; chat:ChatMessage[]; chatContext:string[]; chatBusy:boolean; forceMicDenied:boolean; }
export function parseRoute(hash:string):Route {
  const raw=hash.replace(/^#\/?/,'')||'field';const [path,query]=raw.split('?');const [name,id]=path.split('/');let decoded:string|undefined=id;try{decoded=id?decodeURIComponent(id):undefined;}catch{}return {name,id:decoded,query:new URLSearchParams(query||'')};
}
export const initialState=():UIState=>({route:parseRoute(globalThis.location?.hash||''),echoKind:'all',search:'',loopFilter:'unfolding',phase:'first-quarter',cycleId:'cycle-10',time:'night',scenario:'ready',chat:[],chatContext:[],chatBusy:false,forceMicDenied:false});
