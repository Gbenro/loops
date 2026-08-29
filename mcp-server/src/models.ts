export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'openrouter-deepseek-v4-flash'
  provider: 'openrouter' | 'anthropic' | 'openai' | 'google';
  accessProvider: 'openrouter' | 'anthropic' | 'openai' | 'google';
  modelId: string;        // official provider API identifier, e.g., 'deepseek/deepseek-v4-flash'
  displayName: string;
  enabled: boolean;
  
  // Orthogonal metadata dimensions
  capabilityTier: 'frontier' | 'strong' | 'medium' | 'economy';
  weightClass: 'open_weight' | 'proprietary';
  modalities: ('text' | 'vision' | 'audio')[];
  toolCalling: boolean;
  reasoning: 'none' | 'optional' | 'required';
  laboratoryStatus: 'experimental' | 'candidate' | 'preferred' | 'retired';

  // Physical & Economic parameters
  contextWindow: number;
  speedClass?: 'fast' | 'moderate' | 'deliberate';
  pricing?: {
    inputCostPer1M: number;  // USD per million tokens
    outputCostPer1M: number; // USD per million tokens
    cachedInputCostPer1M?: number;
  };
  
  defaultPriority: number;
}

/**
 * Luna Rotating Test Bench & Model Laboratory:
 * Curated ~10 strategically diverse models across capability tiers, open-weight vs proprietary, and economics.
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // ─── 1. Frontier Hybrid Reasoning (Proprietary) ────────────────────────────
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    defaultPriority: 130
  },

  // ─── 2. Open-Weight Frontier Reasoning ──────────────────────────────────────
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.90, outputCostPer1M: 2.00 },
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
    defaultPriority: 126
  },

  // ─── 3. Open-Weight Multimodal & Agent Candidates ───────────────────────────
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.40, outputCostPer1M: 1.00 },
    defaultPriority: 124
  },
  {
    key: 'openrouter-qwen3.8-27b',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen3.8-27b',
    displayName: 'OpenRouter — Qwen 3.8 27B (Open-Weight Vision-Language)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'optional',
    laboratoryStatus: 'experimental',
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.20, outputCostPer1M: 0.40 },
    defaultPriority: 120
  },

  // ─── 4. Open-Weight High-Efficiency / Economy ──────────────────────────────
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.09, outputCostPer1M: 0.18 },
    defaultPriority: 122
  },
  {
    key: 'openrouter-deepseek-v4-flash-vision',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-flash-vision',
    displayName: 'OpenRouter — DeepSeek V4 Flash Vision (Open-Weight Multimodal)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    toolCalling: true,
    reasoning: 'none',
    laboratoryStatus: 'experimental',
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.12, outputCostPer1M: 0.24 },
    defaultPriority: 118
  },
  {
    key: 'openrouter-minimax-m2.5',
    provider: 'openrouter',
    accessProvider: 'openrouter',
    modelId: 'minimax/minimax-m2.5',
    displayName: 'OpenRouter — MiniMax M2.5 (Open-Weight Productivity)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'open_weight',
    modalities: ['text'],
    toolCalling: true,
    reasoning: 'none',
    laboratoryStatus: 'experimental',
    contextWindow: 205000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.15, outputCostPer1M: 0.30 },
    defaultPriority: 116
  },

  // ─── 5. Direct Proprietary Frontier & Economy Reference ────────────────────
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
    defaultPriority: 110
  }
];

const MODEL_ALIASES: Record<string, string> = {
  // OpenRouter Aliases & Shorthands
  'glm-5.3': 'openrouter-glm-5.3',
  'glm5': 'openrouter-glm-5.3',
  'deepseek-v4-pro': 'openrouter-deepseek-v4-pro',
  'deepseek-v4-flash': 'openrouter-deepseek-v4-flash',
  'deepseek-v4': 'openrouter-deepseek-v4-flash',
  'kimi-k2.5': 'openrouter-kimi-k2.5',
  'kimi': 'openrouter-kimi-k2.5',
  'minimax-m2.5': 'openrouter-minimax-m2.5',
  'minimax': 'openrouter-minimax-m2.5',
  'qwen-3.8': 'openrouter-qwen3.8-27b',
  'qwen3.8': 'openrouter-qwen3.8-27b',
  
  // Historical / Legacy OpenRouter Aliases
  'openrouter-deepseek-r1': 'openrouter-deepseek-v4-pro',
  'openrouter-llama-3.3-70b': 'openrouter-glm-5.3',
  'openrouter-mistral-large': 'openrouter-kimi-k2.5',
  'openrouter-gemini-flash': 'openrouter-deepseek-v4-flash',
  'openrouter-qwen-72b': 'openrouter-qwen3.8-27b',
  'deepseek-r1': 'openrouter-deepseek-v4-pro',
  'llama-3.3': 'openrouter-glm-5.3',

  // Google Aliases
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
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
  'openai-default': 'gemini-2.5-pro',
  'openai-frontier': 'gemini-2.5-pro',
  'openai-balanced': 'gemini-2.5-flash',
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
    if (
      lowerKey.includes('openrouter') ||
      lowerKey.includes('glm') ||
      lowerKey.includes('deepseek') ||
      lowerKey.includes('kimi') ||
      lowerKey.includes('minimax') ||
      lowerKey.includes('qwen')
    ) {
      const openRouterModel = allowedModels.find(m => m.provider === 'openrouter' && m.capabilityTier === 'frontier') ||
                              allowedModels.find(m => m.provider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }

    if (lowerKey.includes('gemini') || lowerKey.includes('google')) {
      const googleModel = allowedModels.find(m => m.provider === 'google' && m.capabilityTier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }

    if (lowerKey.includes('anthropic') || lowerKey.includes('claude')) {
      const anthropicModel = allowedModels.find(m => m.provider === 'anthropic' && m.capabilityTier === 'frontier') ||
                             allowedModels.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }
  }

  // Fallback to highest priority allowed model
  return allowedModels.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowedModels[0]);
}
