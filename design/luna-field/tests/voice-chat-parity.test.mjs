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

import { getModelDisplayName, getVoiceDisplayName, chatView } from '../src/views.ts';
import { createLiveLunaServices } from '../src/live-services.ts';
import { initialState } from '../src/state.ts';
import { FIXTURES } from '../src/fixtures.ts';

test('Voice & Chat Parity: getModelDisplayName maps backend model IDs accurately', () => {
  assert.equal(getModelDisplayName('anthropic-fable-5'), 'Claude Fable 5');
  assert.equal(getModelDisplayName('anthropic-sonnet-5'), 'Claude Sonnet 5');
  assert.equal(getModelDisplayName('anthropic-opus-5'), 'Claude Opus 5');
  assert.equal(getModelDisplayName('openai-gpt-5.6-sol'), 'GPT-5.6 Sol');
  assert.equal(getModelDisplayName('openai-gpt-5.6-luna'), 'GPT-5.6 Luna');
  assert.equal(getModelDisplayName('gemini-3.7-flash'), 'Gemini 3.7 Flash');
  assert.equal(getModelDisplayName('xai-grok-4.6'), 'Grok 4.6');
  assert.equal(getModelDisplayName('openrouter-deepseek-v4-pro-0813'), 'DeepSeek V4 Pro');
  assert.equal(getModelDisplayName('openrouter-deepseek-v4-flash'), 'DeepSeek V4 Flash');
  assert.equal(getModelDisplayName('openrouter-qwen-3.8-max'), 'Qwen 3.8 Max');
  assert.equal(getModelDisplayName('unknown-model-xyz'), 'unknown-model-xyz');
});

test('Voice & Chat Parity: getVoiceDisplayName maps known voices accurately', () => {
  assert.equal(getVoiceDisplayName('eleven-nicole'), 'Nicole (Poet)');
  assert.equal(getVoiceDisplayName('eleven-rachel'), 'Rachel (Calm)');
  assert.equal(getVoiceDisplayName('eleven-bella'), 'Bella (Warm)');
  assert.equal(getVoiceDisplayName('eleven-antoni'), 'Antoni (Modulated)');
  assert.equal(getVoiceDisplayName('eleven-adam'), 'Adam (Resonant)');
  assert.equal(getVoiceDisplayName('browser-web-speech'), 'Web Speech');
  assert.equal(getVoiceDisplayName('custom-voice'), 'custom-voice');
});

test('Voice & Chat Parity: initialState loads model and voice preferences from localStorage', () => {
  mockStorage.set('luna_model_key', 'openai-gpt-5.6-sol');
  mockStorage.set('luna_voice_key', 'eleven-rachel');
  mockStorage.set('luna_voice_model_key', 'eleven_turbo_v2_5');

  const s = initialState();
  assert.equal(s.chatModel, 'openai-gpt-5.6-sol');
  assert.equal(s.chatVoice, 'eleven-rachel');
  assert.equal(s.chatVoiceModel, 'eleven_turbo_v2_5');
  assert.equal(s.chatControlsOpen, false);
  assert.equal(s.chatPlayingMessageId, null);
  assert.equal(s.chatVoiceRecording, false);
  assert.equal(s.chatTranscribing, false);

  mockStorage.clear();
  const defState = initialState();
  assert.equal(defState.chatModel, 'anthropic-fable-5');
  assert.equal(defState.chatVoice, 'eleven-nicole');
  assert.equal(defState.chatVoiceModel, 'eleven_flash_v2_5');
});

test('Voice & Chat Parity: chatView renders controls drawer, selects, and fallback badges', () => {
  const db = structuredClone(FIXTURES);
  const state = initialState();
  state.chatControlsOpen = true;
  state.chat = [
    {
      id: 'msg-1',
      role: 'person',
      content: 'Hello Luna',
      echoIds: []
    },
    {
      id: 'msg-2',
      role: 'luna',
      content: 'I am here with you.',
      echoIds: [],
      servingModel: 'anthropic-fable-5',
      fallbackUsed: false
    },
    {
      id: 'msg-3',
      role: 'luna',
      content: 'Contemplating further.',
      echoIds: [],
      servingModel: 'openrouter-deepseek-v4-flash',
      fallbackUsed: true,
      fallbackNotice: 'Primary provider failed; using economy fallback'
    }
  ];

  const html = chatView(db, state);

  assert.ok(html.includes('data-action="toggle-chat-controls"'), 'Should render toggle button');
  assert.ok(html.includes('id="chat-model-select"'), 'Should render model selector');
  assert.ok(html.includes('value="anthropic-fable-5"'), 'Should include anthropic-fable-5');
  assert.ok(html.includes('value="openai-gpt-5.6-sol"'), 'Should include openai-gpt-5.6-sol');
  assert.ok(html.includes('value="openrouter-deepseek-v4-pro-0813"'), 'Should include deepseek-v4-pro');
  assert.ok(html.includes('id="chat-voice-select"'), 'Should render voice selector');
  assert.ok(html.includes('value="eleven-nicole"'), 'Should include eleven-nicole');
  assert.ok(html.includes('value="browser-web-speech"'), 'Should include browser-web-speech');
  assert.ok(html.includes('id="chat-voice-tier-select"'), 'Should render TTS tier selector');

  assert.ok(html.includes('data-action="play-chat-voice" data-id="msg-2"'), 'Should have listen button for msg-2');
  assert.ok(html.includes('data-action="play-chat-voice" data-id="msg-3"'), 'Should have listen button for msg-3');

  assert.ok(html.includes('Claude Fable 5'), 'Should display Claude Fable 5 badge');
  assert.ok(html.includes('chat-model-badge fallback'), 'Should mark fallback badge on msg-3');
  assert.ok(html.includes('Primary provider failed; using economy fallback'), 'Should include fallback notice');

  assert.ok(html.includes('data-action="chat-voice-record"'), 'Should render dictation button');
});

test('Voice & Chat Parity: chat.respond sends chosen modelKey and returns model disclosure', async () => {
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify({
    access_token: 'fixture-token',
    user: { id: 'user-test-123' }
  }));

  let capturedBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.toString().includes('/api/chat')) {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        message: 'The moon is in Waxing Crescent.',
        echoIds: [],
        clientTurnId: capturedBody.clientTurnId,
        servingModel: 'openai-gpt-5.6-sol',
        fallbackUsed: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  try {
    const services = createLiveLunaServices();
    const resp = await services.chat.respond('What phase is it?', [], {
      sessionId: 'sess-test',
      clientTurnId: 'turn-123',
      modelKey: 'openai-gpt-5.6-sol'
    });

    assert.equal(capturedBody.modelKey, 'openai-gpt-5.6-sol');
    assert.equal(capturedBody.clientTurnId, 'turn-123');
    assert.equal(resp.role, 'luna');
    assert.equal(resp.content, 'The moon is in Waxing Crescent.');
    assert.equal(resp.servingModel, 'openai-gpt-5.6-sol');
    assert.equal(resp.fallbackUsed, false);
  } finally {
    globalThis.fetch = originalFetch;
    mockStorage.delete('sb-eyxvsbqyzeodsjajfqsj-auth-token');
  }
});

test('Voice & Chat Parity: chat.synthesizeSpeech calls synthesis endpoint with correct voice and model tier', async () => {
  let capturedBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.toString().includes('/api/chat/synthesize-speech')) {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        audioUrl: 'data:audio/mp3;base64,//uQxAAAAANIAAAAA',
        voiceId: capturedBody.voiceId,
        cached: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  try {
    const services = createLiveLunaServices();
    const result = await services.chat.synthesizeSpeech('Speaking soft words of reflection', {
      voiceId: 'eleven-rachel',
      model: 'eleven_turbo_v2_5',
      messageId: 'msg-99'
    });

    assert.equal(capturedBody.text, 'Speaking soft words of reflection');
    assert.equal(capturedBody.voiceId, 'eleven-rachel');
    assert.equal(capturedBody.model, 'eleven_turbo_v2_5');
    assert.equal(capturedBody.messageId, 'msg-99');
    assert.ok(result.audioUrl.startsWith('data:audio/mp3'));
    assert.equal(result.useClientFallback, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Voice & Chat Parity: chat.synthesizeSpeech signals client fallback on backend failure or browser speech', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.toString().includes('/api/chat/synthesize-speech')) {
      return new Response(JSON.stringify({ error: 'TTS service temporary rate limit' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  try {
    const services = createLiveLunaServices();
    const failedResult = await services.chat.synthesizeSpeech('Hello', {
      voiceId: 'eleven-nicole',
      model: 'eleven_flash_v2_5'
    });
    assert.equal(failedResult.useClientFallback, true);

    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; throw new Error('Should not fetch'); };
    const browserResult = await services.chat.synthesizeSpeech('Hello', {
      voiceId: 'browser-web-speech'
    });
    assert.equal(fetchCalled, false);
    assert.equal(browserResult.useClientFallback, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
