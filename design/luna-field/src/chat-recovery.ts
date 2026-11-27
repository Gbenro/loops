import type {ChatMessage} from './contracts.ts';
export function mergeChatHistory(local:ChatMessage[],saved:ChatMessage[]):ChatMessage[]{
 const meaningful=saved.filter(m=>m.content.trim()),ids=new Set(meaningful.map(m=>m.id));
 return [...meaningful,...local.filter(m=>!ids.has(m.id))];
}
export function replyForTurn(messages:ChatMessage[],turnId:string):ChatMessage|undefined{
 const linked=messages.find(m=>m.role==='luna'&&m.replyTo===turnId&&m.content.trim());
 if(linked)return linked;
 const index=messages.findIndex(m=>m.id===turnId&&m.role==='person');
 if(index<0)return;
 const next=messages[index+1];
 if(next?.role==='luna'&&!next.replyTo&&next.content.trim())return next;
}
