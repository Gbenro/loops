export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'openrouter-deepseek-v4-flash'
  provider: 'openrouter' | 'anthropic' | 'openai' | 'google';
  accessProvider: 'openrouter' | 'anthropic' | 'openai' | 'google';
  modelId: string;        // official provider API identifier
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
 * Luna Rotating Test Bench & Model Laboratory (August 2026 Frontier Lineup):
 * Curated 10 strategically diverse models across capability tiers, open-weight vs proprietary, and economics.
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // ─── 1. Proprietary Frontier Reasoning & Agentic Leaders ──────────────────
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
    speedClass: 'deliberate',
    pricing: { inputCostPer1M: 5.00, outputCostPer1M: 25.00 },
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
    defaultPriority: 128
  },

  // ─── 2. Proprietary High-Speed & Long-Context Workhorses ───────────────────
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
    defaultPriority: 124
  },

  // ─── 3. Open-Weight Frontier Reasoning & Agentic Models ────────────────────
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.90, outputCostPer1M: 2.00 },
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
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
    defaultPriority: 120
  },

  // ─── 4. Open-Weight High-Efficiency & Price/Performance ────────────────────
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.09, outputCostPer1M: 0.18 },
    defaultPriority: 118
  },

  // ─── 5. Open-Weight Multimodal Flagships ───────────────────────────────────
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.35, outputCostPer1M: 0.70 },
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
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.40, outputCostPer1M: 1.00 },
    defaultPriority: 114
  }
];

const MODEL_ALIASES: Record<string, string> = {
  // Anthropic Aliases
  'claude-opus-5': 'anthropic-opus-5',
  'opus-5': 'anthropic-opus-5',
  'anthropic-opus': 'anthropic-opus-5',
  'claude-fable-5': 'anthropic-fable',
  'anthropic-3.7-sonnet': 'anthropic-fable',
  'anthropic-frontier': 'anthropic-opus-5',
  'anthropic-default': 'anthropic-fable',
  'claude-3.7': 'anthropic-fable',
  
  // OpenAI Aliases
  'gpt-5.6-sol': 'openai-sol',
  'gpt-5.6': 'openai-sol',
  'sol': 'openai-sol',
  'openai-frontier': 'openai-sol',
  'openai-default': 'openai-sol',
  'gpt-4o': 'openai-sol',
  'openai-balanced': 'gemini-3.7-flash',
  
  // Google Aliases
  'gemini-3.7-flash': 'gemini-3.7-flash',
  'gemini-flash': 'gemini-3.7-flash',
  'gemini-default': 'gemini-3.7-flash',
  'gemini-2.5-flash': 'gemini-3.7-flash',
  'gemini-3.1-pro': 'gemini-3.1-pro',
  'gemini-pro': 'gemini-3.1-pro',
  'gemini-2.5-pro': 'gemini-3.1-pro',
  'google-frontier': 'gemini-3.1-pro',

  // OpenRouter Aliases & Shorthands
  'glm-5.3': 'openrouter-glm-5.3',
  'glm5': 'openrouter-glm-5.3',
  'deepseek-v4-pro': 'openrouter-deepseek-v4-pro',
  'deepseek-v4-flash': 'openrouter-deepseek-v4-flash',
  'deepseek-v4': 'openrouter-deepseek-v4-flash',
  'deepseek-flash': 'openrouter-deepseek-v4-flash',
  'qwen-3.8-max': 'openrouter-qwen-3.8-max',
  'qwen-3.8': 'openrouter-qwen-3.8-max',
  'qwen3.8': 'openrouter-qwen-3.8-max',
  'kimi-k3': 'openrouter-kimi-k2.5',
  'kimi-k2.5': 'openrouter-kimi-k2.5',
  'kimi': 'openrouter-kimi-k2.5',
  'minimax-m2.5': 'openrouter-deepseek-v4-flash',
  
  // Historical / Legacy OpenRouter Aliases
  'openrouter-deepseek-r1': 'openrouter-deepseek-v4-pro',
  'openrouter-llama-3.3-70b': 'openrouter-glm-5.3',
  'openrouter-mistral-large': 'openrouter-kimi-k2.5',
  'openrouter-gemini-flash': 'openrouter-deepseek-v4-flash',
  'openrouter-qwen-72b': 'openrouter-qwen-3.8-max',
  'openrouter-qwen3.8-27b': 'openrouter-qwen-3.8-max',
  'deepseek-r1': 'openrouter-deepseek-v4-pro',
  'llama-3.3': 'openrouter-glm-5.3',
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

    if (lowerKey.includes('openai') || lowerKey.includes('gpt') || lowerKey.includes('sol')) {
      const openAiModel = allowedModels.find(m => m.provider === 'openai' && m.capabilityTier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'openai');
      if (openAiModel) return openAiModel;
    }

    if (lowerKey.includes('anthropic') || lowerKey.includes('claude') || lowerKey.includes('opus') || lowerKey.includes('fable')) {
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

export interface TtsModelConfig {
  key: string;
  provider: 'openrouter' | 'openai' | 'elevenlabs' | 'web_speech';
  modelId: string;
  displayName: string;
  defaultVoice: string;
  costPer1MChars: number; // USD
  supportedVoices: string[];
  enabled: boolean;
}

export const TTS_MODEL_REGISTRY: TtsModelConfig[] = [
  {
    key: 'openrouter-tts-1',
    provider: 'openrouter',
    modelId: 'openai/tts-1',
    displayName: 'OpenRouter — OpenAI TTS-1',
    defaultVoice: 'nova',
    costPer1MChars: 15.00,
    supportedVoices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'],
    enabled: true
  },
  {
    key: 'openrouter-tts-1-hd',
    provider: 'openrouter',
    modelId: 'openai/tts-1-hd',
    displayName: 'OpenRouter — OpenAI TTS-1 HD',
    defaultVoice: 'nova',
    costPer1MChars: 30.00,
    supportedVoices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'],
    enabled: true
  },
  {
    key: 'openai-tts-1',
    provider: 'openai',
    modelId: 'tts-1',
    displayName: 'OpenAI Direct — TTS-1',
    defaultVoice: 'nova',
    costPer1MChars: 15.00,
    supportedVoices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'],
    enabled: true
  },
  {
    key: 'browser-web-speech',
    provider: 'web_speech',
    modelId: 'browser-native',
    displayName: 'Browser Native Web Speech',
    defaultVoice: 'default',
    costPer1MChars: 0,
    supportedVoices: ['default'],
    enabled: true
  }
];

export function resolveTtsModel(keyOrModelId?: string): TtsModelConfig {
  if (keyOrModelId) {
    const direct = TTS_MODEL_REGISTRY.find(m => m.key === keyOrModelId || m.modelId === keyOrModelId);
    if (direct) return direct;
  }
  return TTS_MODEL_REGISTRY[0]; // Default to openrouter-tts-1
}
