import { describe, it, expect } from 'vitest';

const MODEL_REGISTRY = [
  {
    key: 'anthropic-3.7-sonnet',
    provider: 'anthropic',
    accessProvider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Claude 3.7 Sonnet (Proprietary Frontier)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 200000,
    defaultPriority: 130
  },
  {
    key: 'openrouter-glm-5.3',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'z-ai/glm-5.3',
    displayName: 'OpenRouter — GLM 5.3 (Open-Weight Frontier)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 128
  },
  {
    key: 'openrouter-deepseek-v4-pro',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-pro',
    displayName: 'OpenRouter — DeepSeek V4 Pro (Open-Weight Frontier)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 126
  },
  {
    key: 'openrouter-kimi-k2.5',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'moonshot/kimi-k2.5',
    displayName: 'OpenRouter — Kimi K2.5 (Open-Weight Multimodal)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 262000,
    defaultPriority: 124
  },
  {
    key: 'openrouter-deepseek-v4-flash',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-flash',
    displayName: 'OpenRouter — DeepSeek V4 Flash (Open-Weight Economy)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 1050000,
    defaultPriority: 122
  },
  {
    key: 'gemini-2.5-pro',
    provider: 'google',
    accessProvider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Google — Gemini 2.5 Pro (Proprietary Frontier)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 112
  },
  {
    key: 'gemini-2.5-flash',
    provider: 'google',
    accessProvider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Google — Gemini 2.5 Flash (Proprietary Fast Agent)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'none',
    laboratoryStatus: 'preferred',
    contextWindow: 1000000,
    defaultPriority: 110
  }
];

const MODEL_ALIASES = {
  'glm-5.3': 'openrouter-glm-5.3',
  'deepseek-v4-flash': 'openrouter-deepseek-v4-flash',
  'deepseek-v4': 'openrouter-deepseek-v4-flash',
  'kimi-k2.5': 'openrouter-kimi-k2.5',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'anthropic-fable': 'anthropic-3.7-sonnet',
  'anthropic-frontier': 'anthropic-3.7-sonnet',
};

function resolveModelMock(key, allowedKeys) {
  const allowed = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));
  if (allowed.length === 0) throw new Error('No models allowed');

  if (key) {
    const canonicalKey = MODEL_ALIASES[key] || key;
    const match = allowed.find(m => m.key === canonicalKey);
    if (match) return match;

    const lower = key.toLowerCase();
    if (lower.includes('openrouter') || lower.includes('glm') || lower.includes('deepseek') || lower.includes('kimi')) {
      const openRouterModel = allowed.find(m => m.provider === 'openrouter' && m.capabilityTier === 'frontier') ||
                              allowed.find(m => m.provider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }
    if (lower.includes('gemini') || lower.includes('google')) {
      const googleModel = allowed.find(m => m.provider === 'google' && m.capabilityTier === 'frontier') ||
                          allowed.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }
    if (lower.includes('anthropic') || lower.includes('claude')) {
      const anthropicModel = allowed.find(m => m.provider === 'anthropic' && m.capabilityTier === 'frontier') ||
                             allowed.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }
  }

  return allowed.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowed[0]);
}

describe('Model Configuration Registry & Decoupled Dimensions', () => {
  it('defines orthogonal dimensions correctly (capabilityTier, weightClass, modalities, reasoning)', () => {
    const glm = MODEL_REGISTRY.find(m => m.key === 'openrouter-glm-5.3');
    expect(glm.capabilityTier).toBe('frontier');
    expect(glm.weightClass).toBe('open_weight');
    expect(glm.toolCalling).toBe(true);
    expect(glm.contextWindow).toBe(1000000);

    const kimi = MODEL_REGISTRY.find(m => m.key === 'openrouter-kimi-k2.5');
    expect(kimi.capabilityTier).toBe('strong');
    expect(kimi.weightClass).toBe('open_weight');
    expect(kimi.modalities).toContain('vision');

    const flash = MODEL_REGISTRY.find(m => m.key === 'openrouter-deepseek-v4-flash');
    expect(flash.capabilityTier).toBe('economy');
    expect(flash.weightClass).toBe('open_weight');
    expect(flash.contextWindow).toBe(1050000);
  });

  it('resolves explicit OpenRouter 2026 models correctly', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    
    const glm = resolveModelMock('glm-5.3', allKeys);
    expect(glm.provider).toBe('openrouter');
    expect(glm.modelId).toBe('z-ai/glm-5.3');

    const dsFlash = resolveModelMock('deepseek-v4', allKeys);
    expect(dsFlash.provider).toBe('openrouter');
    expect(dsFlash.modelId).toBe('deepseek/deepseek-v4-flash');

    const kimi = resolveModelMock('kimi-k2.5', allKeys);
    expect(kimi.provider).toBe('openrouter');
    expect(kimi.modelId).toBe('moonshot/kimi-k2.5');
  });

  it('resolves proprietary frontier references to Claude 3.7 Sonnet', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    const fable = resolveModelMock('anthropic-fable', allKeys);
    expect(fable.provider).toBe('anthropic');
    expect(fable.modelId).toBe('claude-3-7-sonnet-20250219');
    expect(fable.weightClass).toBe('proprietary');
  });
});
