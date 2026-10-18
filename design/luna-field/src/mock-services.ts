import type { LunaServices, FieldSnapshot, EchoQuery, CaptureInput, LoopStatus, Echo } from './contracts.ts';
import { FIXTURES } from './fixtures.ts';

export const LOOP_STATUSES: LoopStatus[] = ['open','evolving','carried-forward','completed','closed'];
export const cleanText = (value:unknown,max=6000) => String(value ?? '').trim().slice(0,max);
export const makeId = (prefix:string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
export function filterEchoes(echoes:Echo[],query:EchoQuery={}) {
  const q=cleanText(query.search).toLowerCase();
  return echoes.filter(e=>(!query.cycleId||e.context.cycleId===query.cycleId)&&(!query.phaseId||e.context.phaseId===query.phaseId)&&(!query.threadId||e.threadIds.includes(query.threadId))&&(!q||`${e.title} ${e.body}`.toLowerCase().includes(q))).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
}
export function createMockServices(audioAssets:Record<string,string>={}):LunaServices {
  let db:FieldSnapshot=structuredClone(FIXTURES);
  const requireEcho=(id:string)=>{const e=db.echoes.find(x=>x.id===id);if(!e)throw new Error('This Echo is no longer available.');return e;};
  return {
    auth:{async getSession(){return {mode:'demo'};}},
    echoes:{
      async list(query={}){const all=filterEchoes(db.echoes,query);const offset=Math.max(0,Number(query.cursor)||0);const limit=Math.min(100,Math.max(1,query.limit||30));return {items:structuredClone(all.slice(offset,offset+limit)),nextCursor:offset+limit<all.length?String(offset+limit):undefined};},
      async get(id){return structuredClone(requireEcho(id));},
      async create(input:CaptureInput){const body=cleanText(input.body);if(input.kind==='text'&&!body)throw new Error('Add a few words before keeping this Echo.');if(input.kind==='voice'&&!input.audioUrl)throw new Error('Record a little audio before keeping this Echo.');const e:Echo={id:makeId('echo'),title:cleanText(input.title,120)||(body?body.split(/[.!?\n]/)[0].slice(0,60):'A spoken moment'),body,occurredAt:new Date().toISOString(),kind:input.kind,audioUrl:input.audioUrl,duration:input.duration,waveform:input.waveform?structuredClone(input.waveform):undefined,waveformSource:input.waveformSource,context:structuredClone(input.context),threadIds:[],provenance:'local-session'};db.echoes.unshift(e);return structuredClone(e);}
    },
    loops:{async list(){return structuredClone(db.loops);},async create(title,note=''){const t=cleanText(title,120);if(!t)throw new Error('Give this intention a few words.');const loop={id:makeId('loop'),title:t,note:cleanText(note,600),status:'open' as const,history:[],provenance:'local-session' as const};db.loops.unshift(loop);return structuredClone(loop);},async transition(id,status:LoopStatus){if(!LOOP_STATUSES.includes(status))throw new Error('Choose a recognized intention state.');const loop=db.loops.find(x=>x.id===id);if(!loop)throw new Error('This Loop is no longer available.');loop.history.push({status:loop.status,at:new Date().toISOString()});loop.status=status;return structuredClone(loop);}},
    cycles:{async list(){return structuredClone(db.cycles);},async current(){return structuredClone(db.current);}},
    threads:{async list(){return structuredClone(db.threads);},async linkEcho(threadId,echoId){const thread=db.threads.find(t=>t.id===threadId);if(!thread)throw new Error('This Thread is no longer available.');const e=requireEcho(echoId);if(!thread.echoIds.includes(echoId))thread.echoIds.push(echoId);if(!e.threadIds.includes(threadId))e.threadIds.push(threadId);return structuredClone(thread);}},
    reflections:{async list(echoId){return structuredClone(db.reflections.filter(r=>!echoId||r.echoId===echoId));},async add(echoId,body){requireEcho(echoId);const text=cleanText(body);if(!text)throw new Error('Add your reflection first.');const r={id:makeId('reflection'),echoId,body:text,author:'person' as const,createdAt:new Date().toISOString(),provenance:'local-session' as const};db.reflections.push(r);return structuredClone(r);}},
    chat:{async respond(message,echoIds){if(!cleanText(message))throw new Error('Write a message first.');const selected=echoIds.map(requireEcho);return {id:makeId('chat'),role:'luna',echoIds:selected.map(e=>e.id),content:selected.length?`You have brought ${selected.map(e=>`“${e.title}”`).join(' and ')} into this conversation. What feels the same when you return to ${selected.length===1?'this moment':'these moments'}, and what feels different? This is a scripted demonstration prompt; no model has read or interpreted your message.`:'What would you like to look at together? You can bring an Echo into this conversation using the context picker. This is a scripted demonstration; I do not have a connection to your real Personal Field.'};}},
    audio:{async resolve(echo){return echo.audioUrl||(echo.audioKey?audioAssets[echo.audioKey]:null)||null;}},
    snapshot(){return structuredClone(db);},
    reset(){db=structuredClone(FIXTURES);}
  };
}
