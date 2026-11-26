import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChatSpeech} from '../src/speech-text.ts';

test('screenshot-style Echo citations are silent while meaningful numbers stay',()=>{
 const raw='**369 Finance**. Progressive Map (e1795627866553q3lf), Story 001 (e1795635529957a0v7), Lessons 38 through 41 (e1795636300648d2k9, e1795638086945ul0h). SVB 2023 and TARP 2008.';
 assert.equal(prepareChatSpeech(raw),'369 Finance. Progressive Map, Story 001, Lessons 38 through 41. SVB 2023 and TARP 2008.');
 assert.ok(raw.includes('e1795627866553q3lf'));
});
test('loaded and message-linked record IDs are removed literally, not as regex',()=>{
 assert.equal(prepareChatSpeech('My note (echo-special.v1) and its sequel echo-special.v10.', ['echo-special.v1']), 'My note and its sequel echo-special.v10.');
});
test('UUID citations and citation-only messages leave no spoken residue',()=>{
 assert.equal(prepareChatSpeech('(echo-123e4567-e89b-12d3-a456-426614174000)'), '');
 assert.equal(prepareChatSpeech('[Ref: e1795627866553q3lf] [Field: Echo] [2]'), '');
});
test('dates, amounts, percentages, decimals and named titles remain meaningful',()=>{
 assert.equal(prepareChatSpeech('369 Finance costs $1,250.50, up 12%. Story 001 on 2026-11-25 uses 1.44 MB.'),'369 Finance costs $1,250.50, up 12%. Story 001 on 2026-11-25 uses 1.44 MB.');
});
test('list numbering and markdown are omitted from narration',()=>{
 assert.equal(prepareChatSpeech('## Return\n1. **First thought**\n2. [Second thought](https://example.test)\n- Another thought'), 'Return\nFirst thought\nSecond thought\nAnother thought');
});
