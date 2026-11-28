import type {Thread} from './contracts.ts';
export const THREAD_PAGE_SIZE=12;
export function makeThreadIndex(rows:{id:string;tags?:unknown;created_at?:string}[]):Thread[]{
 const map=new Map<string,Thread>();
 for(const row of rows){
  if(!Array.isArray(row.tags))continue;
  for(const tag of new Set(row.tags.filter(t=>typeof t==='string'&&t.trim()))){
   let thread=map.get(tag);
   if(!thread){thread={id:tag,title:tag,description:'Connected in your personal field.',echoIds:[],loopIds:[]};map.set(tag,thread);}
   if(!thread.echoIds.includes(row.id))thread.echoIds.push(row.id);
   const time=Date.parse(row.created_at||'');
   if(Number.isFinite(time)&&time>Date.parse(thread.lastEchoAt||'1970-01-01'))thread.lastEchoAt=row.created_at;
  }
 }
 return [...map.values()];
}
export function sortedThreads(threads:Thread[],search='',order='recent'):Thread[]{
 const term=search.trim().toLocaleLowerCase();
 return threads.filter(t=>!term||(t.title+' '+t.description).toLocaleLowerCase().includes(term)).sort((a,b)=>{
  const recency=(Date.parse(b.lastEchoAt||'')||0)-(Date.parse(a.lastEchoAt||'')||0);
  return (order==='count'?b.echoIds.length-a.echoIds.length:0)||recency||a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
 });
}
