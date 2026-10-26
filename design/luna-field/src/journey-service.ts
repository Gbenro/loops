import type { LunaServices, Echo } from './contracts.ts';
import type { JourneyEcho, JourneyPlace } from '../../echo-journey/contract.ts';
import { getLiveLunarData, SYNODIC, KNOWN_NEW_MOON } from './lunar-engine.ts';

/** Read-only projection. Original Echo timestamps/metadata are never written back. */
export function journeyEcho(echo: Echo): JourneyEcho {
  const lunar = getLiveLunarData(new Date(echo.occurredAt));
  // A month name repeats every year (and sometimes within a year). Identify the
  // actual lunation using the existing engine's cycle estimate and constants.
  const lunation = Math.round((lunar.cycleStart.getTime()/86400000 + 2440587.5 - KNOWN_NEW_MOON)/SYNODIC);
  return { id:echo.id,title:echo.title,kind:'voice',occurredAt:echo.occurredAt,
    duration:echo.duration,waveform:echo.waveform,availability:'unknown',
    context:{cycleId:`lunation-${lunation}`,cycleLabel:`${echo.context.cycleLabel || lunar.cycleName} · ${lunar.cycleStart.getUTCFullYear()}`,
      phaseId:echo.context.phaseId || lunar.phaseId,phaseLabel:echo.context.label || lunar.phaseName} };
}

export function createJourneyService(services:LunaServices) {
  const owner=services.auth.getUser()?.id;
  const valid=()=>Boolean(owner && services.auth.getUser()?.id===owner && !services.isSampleMode?.());
  const storageKey=`luna.echo-journey.place.v1.${owner || 'signed-out'}`;
  return {
    owner, valid,
    items():JourneyEcho[]{return valid()?services.snapshot().echoes.filter(e=>e.kind==='voice'&&e.user_id===owner&&e.provenance!=='synthetic'&&Number.isFinite(Date.parse(e.occurredAt))).map(journeyEcho):[];},
    async resolve(id:string,signal:AbortSignal,options:{refresh?:boolean}={}) {
      if(!valid())return {status:'authentication-required'};
      let echo:Echo;
      try{echo=await services.echoes.get(id);}catch{return {status:'unavailable'};}
      if(!valid()||signal.aborted)return {status:'authentication-required'};
      if(echo.user_id!==owner||echo.provenance==='synthetic')return {status:'forbidden'};
      const url=await services.audio.resolve(echo,{signal,refresh:options.refresh});
      if(!valid()||signal.aborted){if(url?.startsWith('blob:'))URL.revokeObjectURL(url);return {status:'authentication-required'};}
      if(url)return {status:'ready',url};
      return {status:echo.audio_path?'retryable-error':'unavailable'};
    },
    loadPlace(resume=false):JourneyPlace|null {if(!valid())return null;try{const p=JSON.parse(localStorage.getItem(storageKey+(resume?'.resume':'.bookmark'))||'null');return p&&typeof p.echoId==='string'&&Number.isFinite(p.seconds)&&p.seconds>=0&&['oldest','newest'].includes(p.order)?p:null;}catch{return null;}},
    savePlace(place:JourneyPlace,resume=false):boolean {if(!valid()||!place.echoId)return false;try{localStorage.setItem(storageKey+(resume?'.resume':'.bookmark'),JSON.stringify({echoId:place.echoId,seconds:place.seconds,order:place.order}));return true;}catch{return false;}},
    clearPlace(){if(valid()){localStorage.removeItem(storageKey+'.bookmark');localStorage.removeItem(storageKey+'.resume');}}
  };
}
