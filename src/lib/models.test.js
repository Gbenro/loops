import { describe, it, expect } from 'vitest';

const MODEL_REGISTRY = [
  {
    key: 'anthropic-3.7-sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Claude 3.7 Sonnet (Frontier)',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 130
  },
  {
    key: 'openrouter-deepseek-r1',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-r1',
    displayName: 'OpenRouter — DeepSeek R1 (Frontier Reasoning)',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 128
  },
  {
    key: 'gemini-2.5-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Google — Gemini 2.5 Pro (Frontier)',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 125
  },
  {
    key: 'openrouter-llama-3.3-70b',
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.3-70b-instruct',
    displayName: 'OpenRouter — Llama 3.3 70B (Standard Open)',
    enabled: true,
    tier: 'standard',
    defaultPriority: 120
  },
  {
    key: 'openrouter-mistral-large',
    provider: 'openrouter',
    modelId: 'mistralai/mistral-large-2411',
    displayName: 'OpenRouter — Mistral Large (Strong Open)',
    enabled: true,
    tier: 'standard',
    defaultPriority: 115
  },
  {
    key: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Google — Gemini 2.5 Flash (Fast Agent)',
    enabled: true,
    tier: 'economy',
    defaultPriority: 110
  },
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    enabled: true,
    tier: 'frontier',
    defaultPriority: 95
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    enabled: true,
    tier: 'economy',
    defaultPriority: 90
  }
];

const MODEL_ALIASES = {
  'deepseek-r1': 'openrouter-deepseek-r1',
  'llama-3.3': 'openrouter-llama-3.3-70b',
  'mistral-large': 'openrouter-mistral-large',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'anthropic-fable': 'anthropic-3.7-sonnet',
  'anthropic-frontier': 'anthropic-3.7-sonnet',
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
    if (lower.includes('openrouter') || lower.includes('llama') || lower.includes('deepseek')) {
      const openRouterModel = allowed.find(m => m.provider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }
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
  it('defines enabled OpenRouter, Claude 3.7, and Gemini models correctly', () => {
    const keys = MODEL_REGISTRY.map(m => m.key);
    expect(keys).toContain('anthropic-3.7-sonnet');
    expect(keys).toContain('openrouter-deepseek-r1');
    expect(keys).toContain('openrouter-llama-3.3-70b');
    expect(keys).toContain('gemini-2.5-pro');
    expect(MODEL_REGISTRY.every(m => m.enabled)).toBe(true);
  });

  it('resolves explicit OpenRouter models correctly', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    const r1 = resolveModelMock('openrouter-deepseek-r1', allKeys);
    expect(r1.provider).toBe('openrouter');
    expect(r1.modelId).toBe('deepseek/deepseek-r1');

    const llama = resolveModelMock('llama-3.3', allKeys);
    expect(llama.provider).toBe('openrouter');
    expect(llama.modelId).toBe('meta-llama/llama-3.3-70b-instruct');
  });

  it('resolves legacy Fable and frontier keys to Claude 3.7 Sonnet', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    const fable = resolveModelMock('anthropic-fable', allKeys);
    expect(fable.provider).toBe('anthropic');
    expect(fable.modelId).toBe('claude-3-7-sonnet-20250219');
  });
});
