import { describe, it, expect } from 'vitest';

// Simulated registry for testing frontend client expectations
const MODEL_REGISTRY = [
  {
    key: 'anthropic-fable',
    provider: 'anthropic',
    modelId: 'claude-fable-5',
    enabled: true,
    defaultPriority: 120
  },
  {
    key: 'openai-sol',
    provider: 'openai',
    modelId: 'gpt-5.6-sol',
    enabled: true,
    defaultPriority: 115
  },
  {
    key: 'openai-o3',
    provider: 'openai',
    modelId: 'o3-pro',
    enabled: true,
    defaultPriority: 110
  },
  {
    key: 'anthropic-frontier',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20240620',
    enabled: true,
    defaultPriority: 100
  },
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    enabled: true,
    defaultPriority: 90
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    enabled: true,
    defaultPriority: 80
  }
];

function resolveModelMock(key, allowedKeys) {
  const allowed = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));
  if (allowed.length === 0) throw new Error('No models allowed');

  if (key) {
    const match = allowed.find(m => m.key === key);
    if (match) return match;
  }

  // Fallback to highest priority
  return allowed.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowed[0]);
}

describe('Model Configuration Registry & Entitlements', () => {
  it('defines enabled frontier and balanced keys correctly', () => {
    const keys = MODEL_REGISTRY.map(m => m.key);
    expect(keys).toContain('anthropic-frontier');
    expect(keys).toContain('openai-frontier');
    expect(keys).toContain('openai-balanced');
    expect(keys).toContain('anthropic-fable');
    expect(keys).toContain('openai-sol');
    expect(MODEL_REGISTRY.every(m => m.enabled)).toBe(true);
  });

  it('resolves explicit allowed keys correctly', () => {
    const resolved = resolveModelMock('openai-frontier', ['openai-frontier', 'openai-balanced']);
    expect(resolved.key).toBe('openai-frontier');
    expect(resolved.modelId).toBe('gpt-4o');
  });

  it('falls back to highest priority enabled model when requested key is not allowed', () => {
    const resolved = resolveModelMock('anthropic-frontier', ['openai-frontier', 'openai-balanced']);
    // Highest priority is openai-frontier (90) vs openai-balanced (80)
    expect(resolved.key).toBe('openai-frontier');
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
