
import type {Echo, EchoQuery} from './contracts.ts';
import {getLiveLunarData} from './lunar-engine.ts';
import {getCurrentLunation,getCycleInfoForLunation} from './journey-service.ts';

export const ECHO_PAGE_SIZE=30;
export function echoCycleOptions(){
 const current=getCurrentLunation();
 return Array.from({length:24},(_,i)=>getCycleInfoForLunation(current-i,current));
}
export function echoTimeQuery(period='cycle',cycleId='',phaseId='',day='',now=new Date()):EchoQuery{
 const current=getCurrentLunation();
 const cycles=echoCycleOptions();
 const legacy=cycles.find(c=>'cycle-'+c.monthName.toLowerCase().replace(/[^a-z0-9]/g,'-')===cycleId);
 const lunation=cycleId.startsWith('lunation-')?Number(cycleId.slice(9)):legacy?.lunation??current;
 const cycle=getCycleInfoForLunation(Number.isFinite(lunation)?lunation:current,current);
 const query:EchoQuery={limit:ECHO_PAGE_SIZE};
 if(period!=='all'||cycleId){query.since=cycle.cycleStart;query.until=cycle.cycleEnd;}
 if(period==='phase')query.phaseId=getLiveLunarData(now).phaseId;
 if(phaseId)query.phaseId=phaseId as any;
 if(period==='today'||day){
  const start=day?new Date(day+'T00:00:00'):new Date(now);
  start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  if(Number.isFinite(start.getTime())){query.since=start.toISOString();query.until=end.toISOString();}
 }
 return query;
}
const pgLiteral=(value:string)=>'"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
export function echoPageEndpoint(userId:string,query:EchoQuery={}){
 const limit=Math.min(100,Math.max(1,query.limit||ECHO_PAGE_SIZE));
 const p=new URLSearchParams({select:'*',user_id:'eq.'+userId,deleted_at:'is.null',order:'created_at.desc,id.desc',limit:String(limit+1)});
 const conditions:string[]=[];
 if(query.since)conditions.push('created_at.gte.'+query.since);
 if(query.until)conditions.push('created_at.lt.'+query.until);
 if(query.phaseId)p.set('phase','eq.'+query.phaseId);
 if(query.kind==='voice')conditions.push('or(source.eq.voice,audio_path.not.is.null)');
 if(query.kind==='text')conditions.push('and(or(source.neq.voice,source.is.null),audio_path.is.null)');
 if(query.threadId)p.set('tags','cs.'+JSON.stringify([query.threadId]));
 if(query.search?.trim()){
  // Quote PostgREST grammar characters and escape LIKE wildcards for literal search.
  const term=query.search.trim().slice(0,200).replace(/[\\%_*]/g,'\\$&');
  conditions.push('text.ilike.'+pgLiteral('%'+term+'%'));
 }
 if(query.cursor){
  let cursor:any;try{cursor=JSON.parse(decodeURIComponent(query.cursor));}catch{throw new Error('This Echo page has expired. Refresh the list.');}
  if(!Array.isArray(cursor)||cursor.length!==2||!Number.isFinite(Date.parse(cursor[0]))||typeof cursor[1]!=='string')throw new Error('Invalid Echo page.');
  conditions.push('or(created_at.lt.'+cursor[0]+',and(created_at.eq.'+cursor[0]+',id.lt.'+pgLiteral(cursor[1])+'))');
 }
 if(conditions.length)p.set('and','('+conditions.join(',')+')');
 return '/rest/v1/echoes?'+p.toString();
}
export function echoPageCursor(row:any){return encodeURIComponent(JSON.stringify([row.created_at||row.occurredAt,row.id]));}
export function matchesEchoQuery(e:Echo,q:EchoQuery){
 return (!q.since||Date.parse(e.occurredAt)>=Date.parse(q.since))&&(!q.until||Date.parse(e.occurredAt)<Date.parse(q.until))&&(!q.phaseId||e.context.phaseId===q.phaseId)&&(!q.kind||e.kind===q.kind)&&(!q.threadId||e.threadIds.includes(q.threadId))&&(!q.search||(e.title+' '+e.body).toLowerCase().includes(q.search.trim().toLowerCase()));
}
