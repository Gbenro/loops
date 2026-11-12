import './idb-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
import { formatTranscriptHtml, formatChatMessageContent, echoDetailView, chatView } from '../src/views.ts';
import { voicePlayer } from '../src/components.ts';
import { createLiveLunaServices } from '../src/live-services.ts';
import { initialState } from '../src/state.ts';
import { FIXTURES } from '../src/fixtures.ts';

test('Priority 1: formatTranscriptHtml preserves paragraphs and line breaks without truncation', () => {
  const input = 'First paragraph.\nWith a soft break.\n\nSecond paragraph.\nStill intact.';
  const html = formatTranscriptHtml(input);
  assert.ok(html.includes('<p class="transcript-p">First paragraph.<br>With a soft break.</p>'));
  assert.ok(html.includes('<p class="transcript-p">Second paragraph.<br>Still intact.</p>'));
});

test('Priority 1: echoDetailView renders collapsed container and toggle for long transcript', () => {
  const db = structuredClone(FIXTURES);
  const echo = db.echoes[0];
  echo.body = 'Line 1 of spoken words.\n\nLine 2 of more reflection.\n\nLine 3 of deeper thoughts.\n\nLine 4 continuing onward with detail.\n\nLine 5 wrapping up this long voice recording session.';
  const html = echoDetailView(db, echo.id);
  assert.ok(html.includes('class="transcript-container collapsed"'), 'Should have collapsed class');
  assert.ok(html.includes('data-action="toggle-transcript"'), 'Should render toggle button');
  assert.ok(html.includes('aria-expanded="false"'), 'Should have aria-expanded false');
  assert.ok(html.includes('Show more'), 'Should have Show more label');
});

test('Priority 1: echoDetailView does not render toggle for short transcript', () => {
  const db = structuredClone(FIXTURES);
  const echo = db.echoes[0];
  echo.body = 'Just a brief thought.';
  const html = echoDetailView(db, echo.id);
  assert.ok(!html.includes('class="transcript-container collapsed"'));
  assert.ok(!html.includes('data-action="toggle-transcript"'));
});

test('Priority 2: voicePlayer renders real waveform when amplitude data exists', () => {
  const echo = {
    id: 'echo-wave',
    title: 'Wave Echo',
    body: 'Spoken',
    occurredAt: new Date().toISOString(),
    kind: 'voice',
    duration: 12.5,
    waveform: [0.1, 0.4, 0.8, 0.5, 0.2],
    waveformSource: 'decoded-audio',
    context: FIXTURES.current,
    threadIds: [],
    provenance: 'local-session'
  };
  const html = voicePlayer(echo);
  assert.ok(html.includes('data-seek-surface="waveform"'));
  assert.ok(html.includes('playback-wave'));
  assert.ok(html.includes('data-wave-progress'));
  assert.ok(html.includes('Waveform derived from this audio'));
});

test('Priority 2: voicePlayer renders honest slider when waveform is missing or all zeros', () => {
  const echo = {
    id: 'echo-slider',
    title: 'Slider Echo',
    body: 'Spoken without envelope',
    occurredAt: new Date().toISOString(),
    kind: 'voice',
    duration: 20,
    waveform: [],
    context: FIXTURES.current,
    threadIds: [],
    provenance: 'local-session'
  };
  const html = voicePlayer(echo);
  assert.ok(html.includes('data-seek-surface="slider"'));
  assert.ok(html.includes('honest-progress-track'));
  assert.ok(html.includes('data-honest-fill'));
  assert.ok(html.includes('data-honest-thumb'));
  assert.ok(!html.includes('playback-wave'));
});

test('Priority 3: formatChatMessageContent handles single and multi-paragraph messages', () => {
  const multi = 'Hello Luna.\n\nHere is what I am noticing today.\nWith two lines.';
  const formatted = formatChatMessageContent(multi);
  assert.ok(formatted.includes('<p>Hello Luna.</p>'));
  assert.ok(formatted.includes('<p>Here is what I am noticing today.<br>With two lines.</p>'));
});

test('Priority 3: chatView renders thinking indicator and error banner when state flags set', () => {
  const db = structuredClone(FIXTURES);
  const state = initialState();
  state.chatBusy = true;
  state.chatError = 'Upstream provider out of credits.';
  const html = chatView(db, state);
  assert.ok(html.includes('is-thinking'), 'Should render thinking pulse');
  assert.ok(html.includes('chat-error-banner'), 'Should render error banner');
  assert.ok(html.includes('data-action="retry-chat"'), 'Should render retry button');
  assert.ok(html.includes('Upstream provider out of credits.'), 'Should surface error message');
});

test('Priority 3: live chat adapter requires message text and authentication', async () => {
  const services = createLiveLunaServices({});
  await assert.rejects(
    async () => services.chat.respond('', []),
    /Write a message first/
  );
  await assert.rejects(
    async () => services.chat.respond('Hello', []),
    /Sign in to converse with Luna/
  );
});
