import { describe, it, expect } from 'vitest';

const MODEL_REGISTRY = [
  {
    key: 'anthropic-opus-5',
    provider: 'anthropic',
    accessProvider: 'anthropic',
    modelId: 'claude-opus-5-20260724',
    displayName: 'Anthropic — Claude Opus 5 (Proprietary Frontier Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 200000,
    defaultPriority: 135
  },
  {
    key: 'anthropic-fable',
    provider: 'anthropic',
    accessProvider: 'anthropic',
    modelId: 'claude-fable-5',
    displayName: 'Anthropic — Claude Fable 5 (Proprietary Agentic Baseline)',
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
    key: 'openai-sol',
    provider: 'openai',
    accessProvider: 'openai',
    modelId: 'gpt-5.6-sol',
    displayName: 'OpenAI — GPT-5.6 Sol (Proprietary Multi-Step Agent)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 256000,
    defaultPriority: 128
  },
  {
    key: 'gemini-3.7-flash',
    provider: 'google',
    accessProvider: 'google',
    modelId: 'gemini-3.7-flash',
    displayName: 'Google — Gemini 3.7 Flash (Proprietary Speed Workhorse)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'none',
    laboratoryStatus: 'preferred',
    contextWindow: 1000000,
    defaultPriority: 125
  },
  {
    key: 'gemini-3.1-pro',
    provider: 'google',
    accessProvider: 'google',
    modelId: 'gemini-3.1-pro',
    displayName: 'Google — Gemini 3.1 Pro (Proprietary 2M Long-Context)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 2000000,
    defaultPriority: 124
  },
  {
    key: 'openrouter-glm-5.3',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'z-ai/glm-5.3',
    displayName: 'OpenRouter — GLM 5.3 (Open-Weight Frontier Agent)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 122
  },
  {
    key: 'openrouter-deepseek-v4-pro',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-pro',
    displayName: 'OpenRouter — DeepSeek V4 Pro (Open-Weight Frontier Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 120
  },
  {
    key: 'openrouter-deepseek-v4-flash',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-flash',
    displayName: 'OpenRouter — DeepSeek V4 Flash (Open-Weight Economy Engine)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'optional',
    laboratoryStatus: 'preferred',
    contextWindow: 1050000,
    defaultPriority: 118
  },
  {
    key: 'openrouter-qwen-3.8-max',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen-3.8-max',
    displayName: 'OpenRouter — Qwen 3.8 Max (Open-Weight Multimodal Flagship)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    defaultPriority: 116
  },
  {
    key: 'openrouter-kimi-k2.5',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'moonshot/kimi-k2.5',
    displayName: 'OpenRouter — Kimi K2.5 (Open-Weight Multimodal Agent)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 262000,
    defaultPriority: 114
  }
];

const MODEL_ALIASES = {
  'opus-5': 'anthropic-opus-5',
  'claude-opus-5': 'anthropic-opus-5',
  'claude-fable-5': 'anthropic-fable',
  'anthropic-3.7-sonnet': 'anthropic-fable',
  'gpt-5.6-sol': 'openai-sol',
  'gpt-5.6': 'openai-sol',
  'sol': 'openai-sol',
  'gemini-3.7-flash': 'gemini-3.7-flash',
  'gemini-3.1-pro': 'gemini-3.1-pro',
  'glm-5.3': 'openrouter-glm-5.3',
  'deepseek-v4-flash': 'openrouter-deepseek-v4-flash',
  'deepseek-v4': 'openrouter-deepseek-v4-flash',
  'qwen-3.8': 'openrouter-qwen-3.8-max',
  'kimi-k3': 'openrouter-kimi-k2.5',
  'kimi-k2.5': 'openrouter-kimi-k2.5'
};

function resolveModelMock(key, allowedKeys) {
  const allowed = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));
  if (allowed.length === 0) throw new Error('No models allowed');

  if (key) {
    const canonicalKey = MODEL_ALIASES[key] || key;
    const match = allowed.find(m => m.key === canonicalKey);
    if (match) return match;

    const lower = key.toLowerCase();
    if (lower.includes('openrouter') || lower.includes('glm') || lower.includes('deepseek') || lower.includes('kimi') || lower.includes('qwen')) {
      const openRouterModel = allowed.find(m => m.provider === 'openrouter' && m.capabilityTier === 'frontier') ||
                              allowed.find(m => m.provider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }
    if (lower.includes('gemini') || lower.includes('google')) {
      const googleModel = allowed.find(m => m.provider === 'google' && m.capabilityTier === 'frontier') ||
                          allowed.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }
    if (lower.includes('openai') || lower.includes('gpt') || lower.includes('sol')) {
      const openAiModel = allowed.find(m => m.provider === 'openai' && m.capabilityTier === 'frontier') ||
                          allowed.find(m => m.provider === 'openai');
      if (openAiModel) return openAiModel;
    }
    if (lower.includes('anthropic') || lower.includes('claude') || lower.includes('opus') || lower.includes('fable')) {
      const anthropicModel = allowed.find(m => m.provider === 'anthropic' && m.capabilityTier === 'frontier') ||
                             allowed.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }
  }

  return allowed.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowed[0]);
}

describe('Model Configuration Registry — August 2026 Frontier Lineup', () => {
  it('defines the 10 frontier and open-weight models correctly with orthogonal dimensions', () => {
    const opus = MODEL_REGISTRY.find(m => m.key === 'anthropic-opus-5');
    expect(opus.capabilityTier).toBe('frontier');
    expect(opus.weightClass).toBe('proprietary');
    expect(opus.reasoning).toBe('required');

    const glm = MODEL_REGISTRY.find(m => m.key === 'openrouter-glm-5.3');
    expect(glm.capabilityTier).toBe('frontier');
    expect(glm.weightClass).toBe('open_weight');
    expect(glm.contextWindow).toBe(1000000);

    const dsFlash = MODEL_REGISTRY.find(m => m.key === 'openrouter-deepseek-v4-flash');
    expect(dsFlash.capabilityTier).toBe('economy');
    expect(dsFlash.weightClass).toBe('open_weight');
    expect(dsFlash.contextWindow).toBe(1050000);

    const gemini37 = MODEL_REGISTRY.find(m => m.key === 'gemini-3.7-flash');
    expect(gemini37.contextWindow).toBe(1000000);

    const gemini31 = MODEL_REGISTRY.find(m => m.key === 'gemini-3.1-pro');
    expect(gemini31.contextWindow).toBe(2000000);
  });

  it('resolves explicit August 2026 models and aliases correctly', () => {
    const allKeys = MODEL_REGISTRY.map(m => m.key);
    
    const sol = resolveModelMock('gpt-5.6', allKeys);
    expect(sol.provider).toBe('openai');
    expect(sol.modelId).toBe('gpt-5.6-sol');

    const opus = resolveModelMock('opus-5', allKeys);
    expect(opus.provider).toBe('anthropic');
    expect(opus.modelId).toBe('claude-opus-5-20260724');

    const dsFlash = resolveModelMock('deepseek-v4', allKeys);
    expect(dsFlash.provider).toBe('openrouter');
    expect(dsFlash.modelId).toBe('deepseek/deepseek-v4-flash');

    const qwen = resolveModelMock('qwen-3.8', allKeys);
    expect(qwen.provider).toBe('openrouter');
    expect(qwen.modelId).toBe('qwen/qwen-3.8-max');
  });
});
