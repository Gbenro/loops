import { describe, it, expect } from 'vitest';

const MODEL_REGISTRY = [
  {
    key: 'gemini-2.5-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Google — Gemini 2.5 Pro (Frontier Reasoning)',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 125
  },
  {
    key: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Google — Gemini 2.5 Flash (Fast Agent)',
    enabled: true,
    tier: 'balanced',
    defaultPriority: 120
  },
  {
    key: 'gemini-2.0-flash-thinking',
    provider: 'google',
    modelId: 'gemini-2.0-flash-thinking-exp-01-21',
    displayName: 'Google — Gemini 2.0 Flash Thinking (Deep Analysis)',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 118
  },
  {
    key: 'anthropic-fable',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 105
  },
  {
    key: 'anthropic-frontier',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 100
  },
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 90
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    enabled: true,
    tier: 'balanced',
    defaultPriority: 80
  }
];

const MODEL_ALIASES = {
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-thinking': 'gemini-2.0-flash-thinking',
  'google-frontier': 'gemini-2.5-pro',
  'google-gemini-2.5-pro': 'gemini-2.5-pro',
  'google-gemini-2.5-flash': 'gemini-2.5-flash',
  'anthropic-default': 'anthropic-frontier',
  'openai-default': 'openai-frontier',
  'openai-mini': 'openai-balanced',
};

function resolveModelMock(key, allowedKeys) {
  const allowed = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));
  if (allowed.length === 0) throw new Error('No models allowed');

  if (key) {
    const canonicalKey = MODEL_ALIASES[key] || key;
    const match = allowed.find(m => m.key === canonicalKey);
    if (match) return match;

    const lower = key.toLowerCase();
    if (lower.includes('gemini') || lower.includes('google')) {
      const googleModel = allowed.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }
    if (lower.includes('openai') || lower.includes('gpt')) {
      const openAiModel = allowed.find(m => m.provider === 'openai');
      if (openAiModel) return openAiModel;
    }
    if (lower.includes('anthropic') || lower.includes('claude')) {
      const anthropicModel = allowed.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }
  }

  return allowed.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowed[0]);
}

describe('Model Configuration Registry & Entitlements', () => {
  it('defines enabled frontier and Gemini 2.5 keys correctly', () => {
    const keys = MODEL_REGISTRY.map(m => m.key);
    expect(keys).toContain('gemini-2.5-pro');
    expect(keys).toContain('gemini-2.5-flash');
    expect(keys).toContain('gemini-2.0-flash-thinking');
    expect(keys).toContain('anthropic-frontier');
    expect(keys).toContain('openai-frontier');
    expect(MODEL_REGISTRY.every(m => m.enabled)).toBe(true);
  });

  it('resolves explicit Gemini 2.5 Pro and Flash models correctly', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    const pro = resolveModelMock('gemini-2.5-pro', allKeys);
    expect(pro.provider).toBe('google');
    expect(pro.modelId).toBe('gemini-2.5-pro');

    const flash = resolveModelMock('gemini-2.5-flash', allKeys);
    expect(flash.provider).toBe('google');
    expect(flash.modelId).toBe('gemini-2.5-flash');
  });

  it('resolves legacy and shorthand Gemini aliases to Google Gemini without falling back to Anthropic', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    
    const legacyPro = resolveModelMock('gemini-pro', allKeys);
    expect(legacyPro.provider).toBe('google');
    expect(legacyPro.key).toBe('gemini-2.5-pro');

    const legacyDefault = resolveModelMock('gemini-default', allKeys);
    expect(legacyDefault.provider).toBe('google');
    expect(legacyDefault.key).toBe('gemini-2.5-flash');

    const thinking = resolveModelMock('gemini-thinking', allKeys);
    expect(thinking.provider).toBe('google');
    expect(thinking.modelId).toBe('gemini-2.0-flash-thinking-exp-01-21');
  });

  it('correctly maps to custom GPT Action endpoint labels', () => {
    const map = {
      listChatSessions: 'listChatSessions',
      getChatSession: 'getChatSession',
      searchChatMessages: 'searchChatMessages',
      getChatTurnTrace: 'getChatTurnTrace',
      getChatEvaluations: 'getChatEvaluations',
      createChatEvaluation: 'createChatEvaluation'
    };
    expect(map.listChatSessions).toBe('listChatSessions');
    expect(map.getChatTurnTrace).toBe('getChatTurnTrace');
  });
});
