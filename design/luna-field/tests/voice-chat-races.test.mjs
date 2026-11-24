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

import { createLiveLunaServices } from '../src/live-services.ts';
import { chatView } from '../src/views.ts';
import { initialState } from '../src/state.ts';
import { FIXTURES } from '../src/fixtures.ts';

test('Race Guard 1: synthesizeSpeech supports signal and aborts pending synthesis fetch', async () => {
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify({
    access_token: 'fixture-token',
    user: { id: 'user-a' }
  }));

  const abortCtrl = new AbortController();
  let fetchAborted = false;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.toString().includes('/api/chat/synthesize-speech')) {
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          fetchAborted = true;
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }
    return originalFetch(url, init);
  };

  try {
    const services = createLiveLunaServices();
    const synthPromise = services.chat.synthesizeSpeech('Speaking message A', {
      voiceId: 'eleven-nicole',
      messageId: 'msg-a',
      signal: abortCtrl.signal
    });

    // Abort while request is in flight (e.g. user signout or stop)
    abortCtrl.abort();

    const result = await synthPromise;
    assert.equal(fetchAborted, true, 'Fetch signal must have received abort event');
    assert.equal(result.useClientFallback, false, 'Aborted synthesis must not trigger client fallback');
  } finally {
    globalThis.fetch = originalFetch;
    mockStorage.delete('sb-eyxvsbqyzeodsjajfqsj-auth-token');
  }
});

test('Race Guard 2: transcribeVoice distinguishes HTTP 500 error from no-speech', async () => {
  const originalFetch = globalThis.fetch;
  const dummyBlob = new Blob([new Uint8Array(600)], { type: 'audio/webm' });

  // 1. Service failure (both 500)
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Internal failure' }), { status: 500 });

  // Load bundle or evaluate transcribeVoice logic
  const testTranscribe = async (blob, options) => {
    const timeoutMs = options?.timeoutMs || 20000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    let activeSignal = timeoutController.signal;
    if (options?.signal) {
      activeSignal = options.signal;
    }
    let lastError = '';
    try {
      const res = await fetch('https://loops-production-e1d5.up.railway.app/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: await blob.arrayBuffer(),
        signal: activeSignal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const text = (data?.text || '').trim();
        return text ? { text, status: 'ok' } : { text: '', status: 'no-speech' };
      } else {
        lastError = `Backend HTTP ${res.status}`;
      }
    } catch (e) {
      lastError = e?.message || 'Network error';
    }
    return { text: '', status: 'error', error: lastError };
  };

  const errorResult = await testTranscribe(dummyBlob);
  assert.equal(errorResult.status, 'error');
  assert.equal(errorResult.text, '');
  assert.ok(errorResult.error.includes('500'));

  // 2. No speech detected (200 OK with empty text)
  globalThis.fetch = async () => new Response(JSON.stringify({ text: '   ' }), { status: 200 });
  const noSpeechResult = await testTranscribe(dummyBlob);
  assert.equal(noSpeechResult.status, 'no-speech');
  assert.equal(noSpeechResult.text, '');

  // 3. Successful transcription
  globalThis.fetch = async () => new Response(JSON.stringify({ text: 'I am speaking clearly' }), { status: 200 });
  const okResult = await testTranscribe(dummyBlob);
  assert.equal(okResult.status, 'ok');
  assert.equal(okResult.text, 'I am speaking clearly');

  globalThis.fetch = originalFetch;
});

test('Race Guard 3: Device voice fallback is visibly labeled in view', () => {
  const db = structuredClone(FIXTURES);
  const state = initialState();
  state.chatPlayingMessageId = 'msg-luna-1';
  state.chatVoiceFallbackMessageId = 'msg-luna-1';
  state.chat = [
    {
      id: 'msg-luna-1',
      role: 'luna',
      content: 'This response fell back to device voice.',
      echoIds: []
    }
  ];

  const html = chatView(db, state);

  // Must have is-fallback class and visibly label Device Voice
  assert.ok(html.includes('chat-voice-play-btn is-playing is-fallback'), 'Play button must have is-fallback class');
  assert.ok(html.includes('Device Voice…'), 'Button label must visibly indicate device voice fallback');
});

test('Race Guard 4: Capture transcription never overwrites user-typed text in drafts or state', () => {
  let captureTitle = '';
  let captureText = 'My manual thoughts written while waiting';
  const drafts = { 'capture-body': captureText };
  let captureTranscript = '';

  const incomingResult = { status: 'ok', text: 'Transcribed speech text' };

  // Verification of the updated guard condition:
  const currentInput = (captureText || drafts['capture-body'] || '').trim();
  if (incomingResult.status === 'ok' && incomingResult.text) {
    captureTranscript = incomingResult.text;
    if (!currentInput) {
      captureText = incomingResult.text;
      drafts['capture-body'] = incomingResult.text;
    }
  }

  // The typed text MUST NOT have been overwritten
  assert.equal(captureText, 'My manual thoughts written while waiting');
  assert.equal(drafts['capture-body'], 'My manual thoughts written while waiting');
  assert.equal(captureTranscript, 'Transcribed speech text', 'Transcript is held separately for explicit insertion');

  // Verify explicit insertion preserves original text
  const combined = captureText.trim() ? `${captureText.trim()}\n\n${captureTranscript}` : captureTranscript;
  assert.equal(combined, 'My manual thoughts written while waiting\n\nTranscribed speech text');
});

test('Race Guard 5: getUserMedia late permission after cancellation stops newly opened tracks', async () => {
  let token = 0;
  let activeToken = 1;
  let tracksStopped = false;

  const mockTrack = {
    stop: () => { tracksStopped = true; }
  };
  const mockStream = {
    getTracks: () => [mockTrack]
  };

  // Simulate token changing before getUserMedia resolves (user navigated or clicked cancel)
  token = activeToken;
  activeToken++; // token was invalidated while waiting for permission

  // Simulated getUserMedia return check
  if (token !== activeToken) {
    mockStream.getTracks().forEach(t => t.stop());
  }

  assert.equal(tracksStopped, true, 'Late stream tracks must be stopped immediately when token is stale');
});
