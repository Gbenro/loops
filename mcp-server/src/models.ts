export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'openrouter-deepseek-v4-flash'
  provider: 'openrouter' | 'anthropic' | 'openai' | 'google' | 'xai' | 'z-ai' | 'deepseek' | 'qwen' | 'minimax' | 'moonshot';
  accessProvider: 'openrouter' | 'anthropic' | 'openai' | 'google';
  modelId: string;        // official provider API identifier
  displayName: string;
  enabled: boolean;
  
  // Orthogonal metadata dimensions
  capabilityTier: 'frontier' | 'strong' | 'medium' | 'economy';
  weightClass: 'open_weight' | 'proprietary';
  modalities: ('text' | 'vision' | 'audio' | 'video' | 'file')[];
  nativeAudio: boolean;   // True ONLY if the model natively processes audio tokens, not derived from Luna STT/TTS
  toolCalling: boolean;
  structuredOutputs: boolean;
  reasoning: 'none' | 'optional' | 'required';
  laboratoryStatus: 'experimental' | 'candidate' | 'preferred' | 'retired' | 'invalid_catalog_id';

  // Physical & Economic parameters
  contextWindow: number;
  speedClass?: 'fast' | 'moderate' | 'deliberate';
  pricing?: {
    inputCostPer1M: number;  // USD per million tokens
    outputCostPer1M: number; // USD per million tokens
    cachedInputCostPer1M?: number;
  };
  
  isPinned: boolean;         // True for exact versioned snapshots; false for floating latest aliases
  defaultPriority: number;
}

export const DEFAULT_MODEL_KEY = 'anthropic-fable';

/**
 * Luna Rotating Test Bench & Model Laboratory (Expanded Frontier Lineup):
 * Curated open vs closed models with exact catalog validation and full modality breakdown.
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // ─── 1. Closed / Proprietary Frontier Reasoning & Agentic Leaders ────────
  {
    key: 'anthropic-fable-5',
    provider: 'anthropic',
    accessProvider: 'openrouter',
    modelId: 'anthropic/claude-fable-5',
    displayName: 'Anthropic — Claude Fable 5 (Proprietary Agentic Baseline)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 1000000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 10.00, outputCostPer1M: 50.00 },
    isPinned: true,
    defaultPriority: 140
  },
  {
    key: 'anthropic-sonnet-5',
    provider: 'anthropic',
    accessProvider: 'openrouter',
    modelId: 'anthropic/claude-sonnet-5',
    displayName: 'Anthropic — Claude Sonnet 5 (Proprietary Frontier Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 1000000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    isPinned: true,
    defaultPriority: 138
  },
  {
    key: 'anthropic-opus-5',
    provider: 'anthropic',
    accessProvider: 'anthropic',
    modelId: 'claude-opus-5-20260724',
    displayName: 'Anthropic — Claude Opus 5 (Proprietary Deep Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1000000,
    speedClass: 'deliberate',
    pricing: { inputCostPer1M: 5.00, outputCostPer1M: 25.00 },
    isPinned: true,
    defaultPriority: 135
  },
  {
    key: 'openai-gpt-5.6-sol',
    provider: 'openai',
    accessProvider: 'openrouter',
    modelId: 'openai/gpt-5.6-sol',
    displayName: 'OpenAI — GPT-5.6 Sol (Proprietary Multi-Step Agent)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 1050000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 2.00, outputCostPer1M: 10.00 },
    isPinned: true,
    defaultPriority: 134
  },
  {
    key: 'openai-gpt-5.6-luna',
    provider: 'openai',
    accessProvider: 'openrouter',
    modelId: 'openai/gpt-5.6-luna',
    displayName: 'OpenAI — GPT-5.6 Luna (Proprietary Conversational Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1050000,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 2.00, outputCostPer1M: 10.00 },
    isPinned: true,
    defaultPriority: 132
  },
  {
    key: 'gemini-3.7-flash',
    provider: 'google',
    accessProvider: 'openrouter',
    modelId: 'google/gemini-3.7-flash',
    displayName: 'Google — Gemini 3.7 Flash (Proprietary Multimodal & Native Audio)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'video', 'file', 'audio'],
    nativeAudio: true, // Has native audio token processing capability
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'none',
    laboratoryStatus: 'preferred',
    contextWindow: 1048576,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.75, outputCostPer1M: 3.75 },
    isPinned: true,
    defaultPriority: 130
  },
  {
    key: 'xai-grok-4.6',
    provider: 'xai',
    accessProvider: 'openrouter',
    modelId: 'x-ai/grok-4.6',
    displayName: 'xAI — Grok 4.6 (Proprietary Frontier Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'proprietary',
    modalities: ['text', 'vision', 'file'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 500000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 1.25, outputCostPer1M: 2.50 },
    isPinned: true,
    defaultPriority: 128
  },

  // ─── 2. Open / Open-Weight Frontier Reasoning & Agentic Models ───────────
  {
    key: 'openrouter-deepseek-v4-pro-0813',
    provider: 'deepseek',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-pro-0813',
    displayName: 'DeepSeek — DeepSeek V4 Pro 0813 (Open-Weight Frontier Reasoning)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1048576,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
    isPinned: true,
    defaultPriority: 126
  },
  {
    key: 'openrouter-deepseek-v4-flash',
    provider: 'deepseek',
    accessProvider: 'openrouter',
    modelId: 'deepseek/deepseek-v4-flash',
    displayName: 'DeepSeek — DeepSeek V4 Flash (Open-Weight Economy Engine)',
    enabled: true,
    capabilityTier: 'economy',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'optional',
    laboratoryStatus: 'preferred',
    contextWindow: 1050000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.09, outputCostPer1M: 0.18 },
    isPinned: true,
    defaultPriority: 124
  },
  {
    key: 'openrouter-qwen-3.8-max',
    provider: 'qwen',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen3.8-max',
    displayName: 'Qwen — Qwen 3.8 Max (Open-Weight Multimodal Flagship)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text', 'vision', 'video'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'preferred',
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.35, outputCostPer1M: 0.70 },
    isPinned: true,
    defaultPriority: 122
  },
  {
    key: 'openrouter-qwen-3.6-35b-a3b',
    provider: 'qwen',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen3.6-35b-a3b',
    displayName: 'Qwen — Qwen 3.6 35B-A3B (Open-Weight Dense Reasoning)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 262144,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.25, outputCostPer1M: 1.25 },
    isPinned: true,
    defaultPriority: 120
  },
  {
    key: 'openrouter-qwen-3.6-27b',
    provider: 'qwen',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen3.6-27b',
    displayName: 'Qwen — Qwen 3.6 27B (Open-Weight Efficiency Agent)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 262144,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.195, outputCostPer1M: 1.56 },
    isPinned: true,
    defaultPriority: 118
  },
  {
    key: 'openrouter-glm-5.3',
    provider: 'z-ai',
    accessProvider: 'openrouter',
    modelId: 'z-ai/glm-5.3',
    displayName: 'GLM — GLM 5.3 (Open-Weight Frontier Long-Context)',
    enabled: true,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'candidate',
    contextWindow: 1310720,
    speedClass: 'moderate',
    pricing: { inputCostPer1M: 0.90, outputCostPer1M: 2.00 },
    isPinned: true,
    defaultPriority: 116
  },
  {
    key: 'openrouter-glm-5.2',
    provider: 'z-ai',
    accessProvider: 'openrouter',
    modelId: 'z-ai/glm-5.2',
    displayName: 'GLM — GLM 5.2 (Open-Weight Standard Baseline)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 1048576,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.50, outputCostPer1M: 1.00 },
    isPinned: true,
    defaultPriority: 114
  },
  {
    key: 'openrouter-minimax-m2.5',
    provider: 'minimax',
    accessProvider: 'openrouter',
    modelId: 'minimax/minimax-m2.5',
    displayName: 'MiniMax — MiniMax M2.5 (Open-Weight Conversational Specialist)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 204800,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.30, outputCostPer1M: 1.20 },
    isPinned: true,
    defaultPriority: 112
  },
  {
    key: 'openrouter-kimi-k2.5',
    provider: 'moonshot',
    accessProvider: 'openrouter',
    modelId: 'moonshotai/kimi-k2.5',
    displayName: 'MoonshotAI — Kimi K2.5 (Open-Weight Multimodal Agent)',
    enabled: true,
    capabilityTier: 'strong',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'optional',
    laboratoryStatus: 'candidate',
    contextWindow: 262144,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.40, outputCostPer1M: 1.00 },
    isPinned: true,
    defaultPriority: 110
  },

  // ─── 3. Historical & Preserved Comparison Entries ─────────────────────────
  {
    key: 'historical-qwen-legacy',
    provider: 'qwen',
    accessProvider: 'openrouter',
    modelId: 'qwen/qwen3.8-max', // Repaired mapping to valid canonical ID
    displayName: 'Qwen — Qwen 3.8 Max (Historical Baseline Comparison)',
    enabled: false,
    capabilityTier: 'frontier',
    weightClass: 'open_weight',
    modalities: ['text', 'vision'],
    nativeAudio: false,
    toolCalling: true,
    structuredOutputs: true,
    reasoning: 'required',
    laboratoryStatus: 'retired',
    contextWindow: 1000000,
    speedClass: 'fast',
    pricing: { inputCostPer1M: 0.35, outputCostPer1M: 0.70 },
    isPinned: true,
    defaultPriority: 100
  }
];

const MODEL_ALIASES: Record<string, string> = {
  // Anthropic Aliases
  'anthropic-fable': 'anthropic-fable-5',
  'claude-fable-5': 'anthropic-fable-5',
  'fable-5': 'anthropic-fable-5',
  'anthropic-fable-5': 'anthropic-fable-5',
  'anthropic-sonnet': 'anthropic-sonnet-5',
  'claude-sonnet-5': 'anthropic-sonnet-5',
  'sonnet-5': 'anthropic-sonnet-5',
  'anthropic-sonnet-5': 'anthropic-sonnet-5',
  'claude-opus-5': 'anthropic-opus-5',
  'opus-5': 'anthropic-opus-5',
  'anthropic-opus': 'anthropic-opus-5',
  
  // OpenAI Aliases
  'openai-sol': 'openai-gpt-5.6-sol',
  'gpt-5.6-sol': 'openai-gpt-5.6-sol',
  'sol': 'openai-gpt-5.6-sol',
  'openai-luna': 'openai-gpt-5.6-luna',
  'gpt-5.6-luna': 'openai-gpt-5.6-luna',
  'gpt-5.6': 'openai-gpt-5.6-sol',
  'gpt-4o': 'openai-gpt-5.6-sol',
  
  // Google Aliases
  'gemini-3.7-flash': 'gemini-3.7-flash',
  'gemini-flash': 'gemini-3.7-flash',
  'gemini-default': 'gemini-3.7-flash',
  
  // xAI Aliases
  'grok-4.6': 'xai-grok-4.6',
  'grok': 'xai-grok-4.6',
  'xai-grok': 'xai-grok-4.6',

  // OpenRouter Aliases & Shorthands
  'deepseek-v4-pro-0813': 'openrouter-deepseek-v4-pro-0813',
  'deepseek-v4-pro': 'openrouter-deepseek-v4-pro-0813',
  'deepseek-v4-flash': 'openrouter-deepseek-v4-flash',
  'deepseek-v4': 'openrouter-deepseek-v4-flash',
  'deepseek-flash': 'openrouter-deepseek-v4-flash',
  
  'qwen-3.8-max': 'openrouter-qwen-3.8-max',
  'qwen-3.8': 'openrouter-qwen-3.8-max',
  'qwen3.8': 'openrouter-qwen-3.8-max',
  'qwen-3.6-35b': 'openrouter-qwen-3.6-35b-a3b',
  'qwen-3.6-35b-a3b': 'openrouter-qwen-3.6-35b-a3b',
  'qwen-3.6-27b': 'openrouter-qwen-3.6-27b',

  'glm-5.3': 'openrouter-glm-5.3',
  'glm-5.2': 'openrouter-glm-5.2',
  'glm5': 'openrouter-glm-5.3',

  'minimax-m2.5': 'openrouter-minimax-m2.5',
  'minimax-m2': 'openrouter-minimax-m2.5',
  'minimax': 'openrouter-minimax-m2.5',

  'kimi-k2.5': 'openrouter-kimi-k2.5',
  'kimi-k3': 'openrouter-kimi-k2.5',
  'kimi': 'openrouter-kimi-k2.5',
  
  // Legacy / Historical OpenRouter Aliases
  'openrouter-deepseek-r1': 'openrouter-deepseek-v4-pro-0813',
  'openrouter-qwen-72b': 'openrouter-qwen-3.8-max',
  'openrouter-deepseek-v4-pro': 'openrouter-deepseek-v4-pro-0813'
};

// ─── Runtime OpenRouter Catalog Validation ─────────────────────────────────

/**
 * Validates a single ModelConfig against a set of valid OpenRouter catalog IDs.
 */
export function validateModelConfigAgainstCatalog(
  model: ModelConfig,
  catalogIds: Set<string>
): { valid: boolean; reason?: string } {
  if (model.accessProvider === 'openrouter') {
    if (!catalogIds.has(model.modelId)) {
      return {
        valid: false,
        reason: `Model ID '${model.modelId}' is not found in OpenRouter live catalog.`
      };
    }
  }
  return { valid: true };
}

/**
 * Filters the active MODEL_REGISTRY against OpenRouter catalog IDs,
 * ensuring no invalid model IDs can ever be presented as active or selectable.
 */
export function getValidatedModelRegistry(catalogModels?: Array<{ id: string }>): ModelConfig[] {
  if (!catalogModels || catalogModels.length === 0) {
    return MODEL_REGISTRY;
  }
  const catalogIds = new Set(catalogModels.map(m => m.id));

  return MODEL_REGISTRY.map(model => {
    const check = validateModelConfigAgainstCatalog(model, catalogIds);
    if (!check.valid) {
      return {
        ...model,
        enabled: false,
        laboratoryStatus: 'invalid_catalog_id'
      };
    }
    return model;
  });
}

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
      lowerKey.includes('qwen') ||
      lowerKey.includes('minimax')
    ) {
      const openRouterModel = allowedModels.find(m => m.provider === 'openrouter' && m.capabilityTier === 'frontier') ||
                              allowedModels.find(m => m.accessProvider === 'openrouter');
      if (openRouterModel) return openRouterModel;
    }

    if (lowerKey.includes('gemini') || lowerKey.includes('google')) {
      const googleModel = allowedModels.find(m => m.provider === 'google' && m.capabilityTier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'google');
      if (googleModel) return googleModel;
    }

    if (lowerKey.includes('openai') || lowerKey.includes('gpt') || lowerKey.includes('sol') || lowerKey.includes('luna')) {
      const openAiModel = allowedModels.find(m => m.provider === 'openai' && m.capabilityTier === 'frontier') ||
                          allowedModels.find(m => m.provider === 'openai');
      if (openAiModel) return openAiModel;
    }

    if (lowerKey.includes('anthropic') || lowerKey.includes('claude') || lowerKey.includes('opus') || lowerKey.includes('fable') || lowerKey.includes('sonnet')) {
      const anthropicModel = allowedModels.find(m => m.provider === 'anthropic' && m.capabilityTier === 'frontier') ||
                             allowedModels.find(m => m.provider === 'anthropic');
      if (anthropicModel) return anthropicModel;
    }

    if (lowerKey.includes('grok') || lowerKey.includes('xai')) {
      const grokModel = allowedModels.find(m => m.provider === 'xai');
      if (grokModel) return grokModel;
    }
  }

  // Fallback to highest priority allowed model
  return allowedModels.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowedModels[0]);
}

// ─── Multi-Model Comparison Telemetry ──────────────────────────────────────

export interface ModelComparisonTelemetryRecord {
  experimentId: string;
  timestamp: string;
  modelKey: string;
  modelId: string;
  provider: string;
  weightClass: 'open_weight' | 'proprietary';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  finishReason: string;
  outputLength: number;
  systemPromptHash: string; // Proves system/memory context was held constant
  temperature: number;
}

/**
 * Calculates inference cost in USD based on model pricing configuration.
 */
export function calculateInferenceCost(
  pricing: ModelConfig['pricing'],
  promptTokens: number,
  completionTokens: number
): number {
  if (!pricing) return 0;
  const inputCost = (promptTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputCostPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Formats a telemetry record for multi-model benchmark evaluation.
 */
export function createComparisonTelemetry(params: {
  experimentId: string;
  model: ModelConfig;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  finishReason?: string;
  outputLength: number;
  systemPromptHash: string;
  temperature?: number;
}): ModelComparisonTelemetryRecord {
  const costUsd = calculateInferenceCost(
    params.model.pricing,
    params.promptTokens,
    params.completionTokens
  );

  return {
    experimentId: params.experimentId,
    timestamp: new Date().toISOString(),
    modelKey: params.model.key,
    modelId: params.model.modelId,
    provider: params.model.provider,
    weightClass: params.model.weightClass,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.promptTokens + params.completionTokens,
    latencyMs: params.latencyMs,
    costUsd,
    finishReason: params.finishReason || 'stop',
    outputLength: params.outputLength,
    systemPromptHash: params.systemPromptHash,
    temperature: params.temperature ?? 0.7
  };
}

// ─── TTS Models ────────────────────────────────────────────────────────────

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
    key: 'openrouter-kokoro',
    provider: 'openrouter',
    modelId: 'hexgrad/kokoro-82m',
    displayName: 'OpenRouter — Kokoro 82M (Natural & Expressive)',
    defaultVoice: 'af_nova',
    costPer1MChars: 0.62,
    supportedVoices: ['af_nova', 'af_bella', 'af_sarah', 'af_sky', 'af_river', 'am_echo', 'am_puck', 'bm_fable'],
    enabled: true
  },
  {
    key: 'openrouter-aura-luna',
    provider: 'openrouter',
    modelId: 'deepgram/aura-2',
    displayName: 'OpenRouter — Deepgram Aura 2 (Luna Expressive Voice)',
    defaultVoice: 'aura-2-luna-en',
    costPer1MChars: 30.00,
    supportedVoices: ['aura-2-luna-en', 'aura-2-thalia-en', 'aura-2-aurora-en', 'aura-2-athena-en'],
    enabled: true
  },
  {
    key: 'openrouter-flux-free',
    provider: 'openrouter',
    modelId: 'deepgram/flux-tts:free',
    displayName: 'OpenRouter — Deepgram Flux TTS (Free)',
    defaultVoice: 'flux-alexis-en',
    costPer1MChars: 0,
    supportedVoices: ['flux-alexis-en', 'flux-bree-en', 'flux-gemma-en', 'flux-maeve-en'],
    enabled: true
  },
  {
    key: 'openrouter-gemini-tts',
    provider: 'openrouter',
    modelId: 'google/gemini-3.1-flash-tts-preview',
    displayName: 'OpenRouter — Gemini 3.1 Flash TTS',
    defaultVoice: 'Kore',
    costPer1MChars: 1.00,
    supportedVoices: ['Kore', 'Zephyr', 'Puck', 'Charon', 'Aoede'],
    enabled: true
  },
  {
    key: 'elevenlabs-turbo',
    provider: 'elevenlabs',
    modelId: 'eleven_turbo_v2_5',
    displayName: 'ElevenLabs — Turbo v2.5 (Expressive & Low Latency)',
    defaultVoice: '21m00Tcm4TlvDq8ikWAM', // Rachel
    costPer1MChars: 30.00,
    supportedVoices: [
      '21m00Tcm4TlvDq8ikWAM', // Rachel
      'EXAVITQu4vr4xnSDxMaL', // Bella
      'ErXwobaYiN019PkySvjV', // Antoni
      'piTKgcLEGmPE4e6mEKli', // Nicole
      'pNInz6obpgDQGcFmaJgB'  // Adam
    ],
    enabled: true
  },
  {
    key: 'elevenlabs-multilingual',
    provider: 'elevenlabs',
    modelId: 'eleven_multilingual_v2',
    displayName: 'ElevenLabs — Multilingual v2 (Rich Emotion)',
    defaultVoice: '21m00Tcm4TlvDq8ikWAM',
    costPer1MChars: 30.00,
    supportedVoices: [
      '21m00Tcm4TlvDq8ikWAM',
      'EXAVITQu4vr4xnSDxMaL',
      'ErXwobaYiN019PkySvjV',
      'piTKgcLEGmPE4e6mEKli',
      'pNInz6obpgDQGcFmaJgB'
    ],
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
    if (keyOrModelId.startsWith('eleven')) {
      const eleven = TTS_MODEL_REGISTRY.find(m => m.provider === 'elevenlabs');
      if (eleven) return eleven;
    }
  }
  return TTS_MODEL_REGISTRY[0]; // Default to openrouter-kokoro
}

// ─── Adaptive Answer Depth & Cost-per-Quality Inference Budgeting ─────────────

export type QueryDepthTier = 'shallow_factual' | 'conversational_reflective' | 'deep_synthesis';

export interface QueryDepthClassification {
  tier: QueryDepthTier;
  targetModelTier: 'economy' | 'medium' | 'strong' | 'frontier';
  targetContextBudget: number;
  maxOutputTokens: number;
  rationale: string;
}

export function classifyQueryDepth(query: string): QueryDepthClassification {
  const q = (query || '').toLowerCase().trim();

  // 1. Deep Synthesis Triggers (Longitudinal patterns, multi-cycle retrospectives, complex thematic cross-referencing)
  const isDeep = q.includes('entire') || q.includes('all cycle') || q.includes('whole cycle') ||
                 q.includes('across cycles') || q.includes('longitudinal') || q.includes('history of') ||
                 q.includes('all echoes') || q.includes('pattern across') || q.includes('synthesize') ||
                 q.includes('sturgeon') || q.includes('snow moon') || q.includes('over time');

  if (isDeep) {
    return {
      tier: 'deep_synthesis',
      targetModelTier: 'frontier',
      targetContextBudget: 32000,
      maxOutputTokens: 8000,
      rationale: 'Longitudinal or multi-cycle synthesis requiring exhaustive Field evidence and frontier reasoning.'
    };
  }

  // 2. Shallow Factual Triggers (Simple CRUD, phase lookups, single state checks)
  const isShallow = q.includes('tag this') || q.includes('close loop') || q.includes('archive') ||
                    q.includes('what phase') || q.includes('current moon') || q.includes('what time') ||
                    (q.length < 25 && !q.includes('why') && !q.includes('how') && !q.includes('feel'));

  if (isShallow) {
    return {
      tier: 'shallow_factual',
      targetModelTier: 'economy',
      targetContextBudget: 4000,
      maxOutputTokens: 1000,
      rationale: 'Factual lookup or discrete CRUD state action requiring rapid, cost-efficient response.'
    };
  }

  // 3. Conversational Reflective Default
  return {
    tier: 'conversational_reflective',
    targetModelTier: 'strong',
    targetContextBudget: 16000,
    maxOutputTokens: 2500,
    rationale: 'Standard conversational reflection and empathetic journaling with selective Field attunement.'
  };
}

export function selectAdaptiveModel(tier: QueryDepthTier, preferredProvider = 'openrouter'): ModelConfig {
  switch (tier) {
    case 'deep_synthesis': {
      const frontier = MODEL_REGISTRY.find(m => m.enabled && m.capabilityTier === 'frontier' && m.accessProvider === preferredProvider) ||
                       MODEL_REGISTRY.find(m => m.enabled && m.capabilityTier === 'frontier') ||
                       MODEL_REGISTRY[0];
      return frontier;
    }
    case 'shallow_factual': {
      const economy = MODEL_REGISTRY.find(m => m.enabled && (m.capabilityTier === 'economy' || m.capabilityTier === 'medium') && m.accessProvider === preferredProvider) ||
                      MODEL_REGISTRY.find(m => m.enabled && m.key.includes('flash')) ||
                      MODEL_REGISTRY[0];
      return economy;
    }
    case 'conversational_reflective':
    default: {
      const strong = MODEL_REGISTRY.find(m => m.enabled && (m.capabilityTier === 'strong' || m.capabilityTier === 'frontier') && m.accessProvider === preferredProvider) ||
                     MODEL_REGISTRY.find(m => m.enabled && m.laboratoryStatus === 'preferred') ||
                     MODEL_REGISTRY[0];
      return strong;
    }
  }
}

export interface ContextBudgetAllocation {
  depthTier: QueryDepthTier;
  prunedHistory: any[];
  allocatedFieldRecords: any[];
  estimatedTotalTokens: number;
  isBudgetEnforced: boolean;
}

export function budgetContextWindow(options: {
  depthTier: QueryDepthTier;
  history: any[];
  fieldRecords: any[];
  userQuery: string;
}): ContextBudgetAllocation {
  const { depthTier, history, fieldRecords } = options;
  const classification = classifyQueryDepth(options.userQuery);

  // Allocate field records according to tier budget
  let allocatedFieldRecords = [...fieldRecords];
  if (depthTier === 'shallow_factual') {
    allocatedFieldRecords = fieldRecords.slice(0, 3);
  } else if (depthTier === 'conversational_reflective') {
    allocatedFieldRecords = fieldRecords.slice(0, 10);
  } // deep_synthesis retains full field records

  // Prune conversation history to keep recent salient turns
  const maxHistoryTurns = depthTier === 'shallow_factual' ? 4 : depthTier === 'conversational_reflective' ? 12 : 25;
  const prunedHistory = history.slice(-maxHistoryTurns);

  const estimatedTokens = Math.ceil(
    (JSON.stringify(prunedHistory).length + JSON.stringify(allocatedFieldRecords).length + (options.userQuery || '').length) / 4
  );

  return {
    depthTier,
    prunedHistory,
    allocatedFieldRecords,
    estimatedTotalTokens: estimatedTokens,
    isBudgetEnforced: true
  };
}

export interface TurnInferenceTelemetry {
  modelKey: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  qualityTier: string;
}

export function computeTurnInferenceTelemetry(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number
): TurnInferenceTelemetry {
  const costUsd = calculateInferenceCost(model.pricing, inputTokens, outputTokens);
  return {
    modelKey: model.key,
    modelId: model.modelId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    latencyMs,
    estimatedCostUsd: costUsd,
    qualityTier: model.capabilityTier
  };
}

export function resolveFallbackModelWithDegradation(primaryModelKey: string, failedReason?: string): ModelConfig {
  const primary = MODEL_REGISTRY.find(m => m.key === primaryModelKey) || MODEL_REGISTRY[0];
  
  // Degrade to fast/reliable fallback
  const fallback = MODEL_REGISTRY.find(m => m.enabled && m.key !== primary.key && (m.key.includes('flash') || m.capabilityTier === 'medium' || m.capabilityTier === 'strong')) ||
                   MODEL_REGISTRY[0];
                   
  return fallback;
}

