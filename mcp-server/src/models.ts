export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'openrouter-llama-3.3-70b'
  provider: 'anthropic' | 'openai' | 'google' | 'openrouter';
  modelId: string;        // official API identifier, e.g., 'meta-llama/llama-3.3-70b-instruct'
  displayName: string;
  enabled: boolean;
  tier: 'frontier' | 'standard' | 'medium' | 'economy' | 'specialist';
  capabilities: {
    tools: boolean;
    reasoning?: boolean;
    multimodal?: boolean;
  };
  contextWindow?: number;
  speedClass?: 'fast' | 'moderate' | 'deliberate';
  pricing?: {
    inputCostPer1M: number;  // USD per million tokens
    outputCostPer1M: number; // USD per million tokens
    cachedInputCostPer1M?: number;
  };
  status?: 'preferred' | 'candidate' | 'experimental';
  defaultPriority: number;
}

export const MODEL_REGISTRY: ModelConfig[] = [
  // ─── Frontier Hybrid Reasoning ─────────────────────────────────────────────
  {
    key: 'anthropic-3.7-sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Claude 3.7 Sonnet (Frontier)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    contextWindow: 200000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    status: 'preferred',
    defaultPriority: 130
  },
  {
    key: 'openrouter-deepseek-r1',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-r1',
    displayName: 'OpenRouter — DeepSeek R1 (Frontier Reasoning)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    contextWindow: 128000,
    speedClass: 'deliberate',
    pricing: { inputCostPer1M: 0.55, outputCostPer1M: 2.19 },
    status: 'candidate',
    defaultPriority: 128
  },
  {
    key: 'gemini-2.5-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Google — Gemini 2.5 Pro (Frontier)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    contextWindow: 1000000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
    status: 'candidate',
    defaultPriority: 125
  },

  // ─── Standard & Strong Open Engines ─────────────────────────────────────────
  {
    key: 'openrouter-llama-3.3-70b',
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.3-70b-instruct',
    displayName: 'OpenRouter — Llama 3.3 70B (Standard Open)',
    enabled: true,
    tier: 'standard',
    capabilities: { tools: true },
    contextWindow: 128000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.12, outputCostPer1M: 0.30 },
    status: 'candidate',
    defaultPriority: 120
  },
  {
    key: 'openrouter-mistral-large',
    provider: 'openrouter',
    modelId: 'mistralai/mistral-large-2411',
    displayName: 'OpenRouter — Mistral Large (Strong Open)',
    enabled: true,
    tier: 'standard',
    capabilities: { tools: true },
    contextWindow: 128000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 2.00, outputCostPer1M: 6.00 },
    status: 'experimental',
    defaultPriority: 115
  },
  {
    key: 'openrouter-qwen-72b',
    provider: 'openrouter',
    modelId: 'qwen/qwen-2.5-72b-instruct',
    displayName: 'OpenRouter — Qwen 2.5 72B (Strong Open)',
    enabled: true,
    tier: 'standard',
    capabilities: { tools: true },
    contextWindow: 128000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.35, outputCostPer1M: 0.40 },
    status: 'experimental',
    defaultPriority: 112
  },

  // ─── Fast / Economy Engines ────────────────────────────────────────────────
  {
    key: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Google — Gemini 2.5 Flash (Fast Agent)',
    enabled: true,
    tier: 'economy',
    capabilities: { tools: true },
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
    status: 'preferred',
    defaultPriority: 110
  },
  {
    key: 'openrouter-gemini-flash',
    provider: 'openrouter',
    modelId: 'google/gemini-2.0-flash-001',
    displayName: 'OpenRouter — Gemini 2.0 Flash (Fast Economy)',
    enabled: true,
    tier: 'economy',
    capabilities: { tools: true },
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.10, outputCostPer1M: 0.40 },
    status: 'candidate',
    defaultPriority: 108
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'OpenAI — GPT-4o Mini',
    enabled: true,
    tier: 'economy',
    capabilities: { tools: true },
    contextWindow: 128000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.15, outputCostPer1M: 0.60 },
    status: 'candidate',
    defaultPriority: 90
  },

  // ─── Direct Commercial Frontier ─────────────────────────────────────────────
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'OpenAI — GPT-4o',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    contextWindow: 128000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
    status: 'candidate',
    defaultPriority: 95
  }
];

const MODEL_ALIASES: Record<string, string> = {
  // OpenRouter Shorthands
  'openrouter-r1': 'openrouter-deepseek-r1',
  'deepseek-r1': 'openrouter-deepseek-r1',
  'llama-3.3': 'openrouter-llama-3.3-70b',
  'llama-70b': 'openrouter-llama-3.3-70b',
  'mistral-large': 'openrouter-mistral-large',
  'qwen-72b': 'openrouter-qwen-72b',
  
  // Google Aliases
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-thinking': 'gemini-2.5-pro',
  'google-frontier': 'gemini-2.5-pro',
  'google-gemini-2.5-pro': 'gemini-2.5-pro',
  'google-gemini-2.5-flash': 'gemini-2.5-flash',
  
  // Anthropic & OpenAI Aliases
  'anthropic-fable': 'anthropic-3.7-sonnet',
  'claude-3.7': 'anthropic-3.7-sonnet',
  'claude-3-7': 'anthropic-3.7-sonnet',
  'claude-3.7-sonnet': 'anthropic-3.7-sonnet',
  'anthropic-3.7': 'anthropic-3.7-sonnet',
  'anthropic-frontier': 'anthropic-3.7-sonnet',
  'anthropic-default': 'anthropic-3.7-sonnet',
  'openai-default': 'openai-frontier',
  'openai-mini': 'openai-balanced',
  'gpt-4o': 'openai-frontier',
  'gpt-4o-mini': 'openai-balanced',
};

/**
 * Entitlement Layer:
 * Resolves which internal model keys a user is authorized to access.
 */
export async function getUserAllowedModels(userId: string): Promise<string[]> {
  return MODEL_REGISTRY.filter(m => m.enabled).map(m => m.key);
}

/**
 * Resolves a selected model key against a user's entitlements with provider-aware fallback.
 */
export async function resolveModel(key: string | undefined, userId: string): Promise<ModelConfig> {
  const allowedKeys = await getUserAllowedModels(userId);
  const allowedModels = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));

  if (allowedModels.length === 0) {
    throw new Error('No models are enabled or allowed for this user.');
  }

  if (key) {
    const canonicalKey = MODEL_ALIASES[key] || key;
    const directMatch = allowedModels.find(m => m.key === canonicalKey);
    if (directMatch) return directMatch;

    // Provider-specific fallback if key contains hints
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('openrouter') || lowerKey.includes('llama') || lowerKey.includes('deepseek') || lowerKey.includes('mistral') || lowerKey.includes('qwen')) {
      const openRouterModel = allowedModels.find(m => m.provider === 'openrouter' && m.tier === 'frontier') ||
                              allowedModels.find(m => m.provider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }

    if (lowerKey.includes('gemini') || lowerKey.includes('google')) {
      const googleModel = allowedModels.find(m => m.provider === 'google' && m.tier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }

    if (lowerKey.includes('openai') || lowerKey.includes('gpt')) {
      const openAiModel = allowedModels.find(m => m.provider === 'openai' && m.tier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'openai');
      if (openAiModel) return openAiModel;
    }

    if (lowerKey.includes('anthropic') || lowerKey.includes('claude')) {
      const anthropicModel = allowedModels.find(m => m.provider === 'anthropic' && m.tier === 'frontier') ||
                             allowedModels.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }
  }

  // Fallback to highest priority allowed model
  return allowedModels.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowedModels[0]);
}
