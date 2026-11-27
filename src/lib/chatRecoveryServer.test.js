import {describe,it,expect} from 'vitest';
import {reserveChatRequest,openRouterBudget,publicCompletionText,completionDiagnostic} from '../../mcp-server/src/chatRecovery.ts';
describe('chat request recovery',()=>{
 it('shares an in-flight result and permits retry after failure',async()=>{
  const first=reserveChatRequest('account:session:turn');
  const second=reserveChatRequest('account:session:turn');
  expect(first.complete).toBeTypeOf('function');expect(second.pending).toBeInstanceOf(Promise);
  const outcome={statusCode:500,body:{error:'empty'}};
  first.complete(outcome);expect(await second.pending).toEqual(outcome);
  const retry=reserveChatRequest('account:session:turn');
  expect(retry.complete).toBeTypeOf('function');
  // A stale completion must not release the newer request.
  first.complete({statusCode:200,body:{}});
  expect(reserveChatRequest('account:session:turn').pending).toBeInstanceOf(Promise);
  retry.complete({statusCode:200,body:{reply:'answer'}});
 });
 it('keeps different accounts and turns independent',()=>{
  const a=reserveChatRequest('a:s:t'),b=reserveChatRequest('b:s:t'),c=reserveChatRequest('a:s:other');
  for(const entry of [a,b,c]){expect(entry.complete).toBeTypeOf('function');entry.complete({statusCode:200,body:{}});}
 });
 it('gives the existing final recovery call a bounded minimum output budget',()=>{
  expect(openRouterBudget('1024')).toBe(1024);
  expect(openRouterBudget('1024',4096,true)).toBe(4096);
  expect(openRouterBudget('8192',4096,true)).toBe(8192);
  for(const value of [undefined,'bad','0','-1'])expect(openRouterBudget(value)).toBe(4096);
 });
 it('never substitutes private reasoning for the public answer or logs its text',()=>{
  const raw={choices:[{finish_reason:'length',message:{content:'',reasoning_content:'PRIVATE'}}],usage:{completion_tokens:1024,completion_tokens_details:{reasoning_tokens:1024}}};
  expect(publicCompletionText(raw)).toBe('');
  expect(completionDiagnostic(raw)).toEqual({finishReason:'length',completionTokens:1024,reasoningTokens:1024,toolCalls:0});
  expect(JSON.stringify(completionDiagnostic(raw))).not.toContain('PRIVATE');
  expect(publicCompletionText({choices:[{message:{content:'A reply'}}]})).toBe('A reply');
 });
});
