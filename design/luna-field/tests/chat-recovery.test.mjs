import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeChatHistory,replyForTurn} from '../src/chat-recovery.ts';
const person=id=>({id,role:'person',content:id,echoIds:[]});
const reply=(id,replyTo)=>({id,replyTo,role:'luna',content:'Answer',echoIds:[]});
test('history recovery replaces optimistic IDs without losing unsaved messages',()=>{
 const a=person('a'),b=person('b'),answer=reply('r','a');
 assert.deepEqual(mergeChatHistory([a,b],[a,answer]),[a,answer,b]);
});
test('only the reply linked to this turn completes it',()=>{
 assert.equal(replyForTurn([person('a'),person('b'),reply('r','b')],'a'),undefined);
 assert.equal(replyForTurn([person('a'),person('b'),reply('r','a')],'a')?.id,'r');
});
test('legacy recovery only accepts the immediately following assistant',()=>{
 assert.equal(replyForTurn([person('a'),reply('r')],'a')?.id,'r');
 assert.equal(replyForTurn([person('a'),person('b'),reply('r')],'a'),undefined);
});
test('empty replies neither appear in recovered history nor complete a turn',()=>{
 const empty={...reply('r','a'),content:'  '};
 assert.deepEqual(mergeChatHistory([person('a')],[person('a'),empty]),[person('a')]);
 assert.equal(replyForTurn([person('a'),empty],'a'),undefined);
});
