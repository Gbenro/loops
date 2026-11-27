type Outcome={statusCode:number;body:any};
const requests=new Map<string,Promise<Outcome>>();

// Register before the first database read so overlapping retries share one inference.
export function reserveChatRequest(key:string){
 const pending=requests.get(key);
 if(pending)return {pending};
 let resolve!:(value:Outcome)=>void;
 const promise=new Promise<Outcome>(done=>{resolve=done;});
 requests.set(key,promise);
 let settled=false;
 return {complete:(outcome:Outcome)=>{
  if(settled)return;
  settled=true;resolve(outcome);requests.delete(key);
 }};
}
export function openRouterBudget(configured:string|undefined,fallback=4096,recovery=false){
 const parsed=Number(configured),normal=Number.isInteger(parsed)&&parsed>0?parsed:fallback;
 // Only the existing, tools-disabled recovery call gets extra room for reasoning.
 return recovery?Math.max(normal,4096):normal;
}
export function publicCompletionText(response:any):string{
 const message=response?.choices?.[0]?.message;
 const text=message?.content??response?.choices?.[0]?.text;
 return typeof text==='string'?text:'';
}
export function completionDiagnostic(response:any){
 return {
  finishReason:response?.choices?.[0]?.finish_reason??null,
  completionTokens:response?.usage?.completion_tokens??null,
  reasoningTokens:response?.usage?.completion_tokens_details?.reasoning_tokens??null,
  toolCalls:response?.choices?.[0]?.message?.tool_calls?.length??0
 };
}
