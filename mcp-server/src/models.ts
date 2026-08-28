export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'gemini-2.5-pro'
  provider: 'anthropic' | 'openai' | 'google';
  modelId: string;        // official API identifier
  displayName: string;
  enabled: boolean;
  tier: 'economy' | 'balanced' | 'frontier';
  capabilities: {
    tools: boolean;
    reasoning?: boolean;
  };
  defaultPriority: number;
}

export const MODEL_REGISTRY: ModelConfig[] = [
  // ─── Google Gemini Frontier & Advanced Models ──────────────────────────────
  {
    key: 'gemini-2.5-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Google — Gemini 2.5 Pro (Frontier Reasoning)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    defaultPriority: 125
  },
  {
    key: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Google — Gemini 2.5 Flash (Fast Agent)',
    enabled: true,
    tier: 'balanced',
    capabilities: { tools: true },
    defaultPriority: 120
  },
  {
    key: 'gemini-2.0-flash-thinking',
    provider: 'google',
    modelId: 'gemini-2.0-flash-thinking-exp-01-21',
    displayName: 'Google — Gemini 2.0 Flash Thinking (Deep Analysis)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    defaultPriority: 118
  },
  {
    key: 'gemini-1.5-pro',
    provider: 'google',
    modelId: 'gemini-1.5-pro',
    displayName: 'Google — Gemini 1.5 Pro',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    defaultPriority: 95
  },
  {
    key: 'gemini-1.5-flash',
    provider: 'google',
    modelId: 'gemini-1.5-flash',
    displayName: 'Google — Gemini 1.5 Flash',
    enabled: true,
    tier: 'economy',
    capabilities: { tools: true },
    defaultPriority: 85
  },

  // ─── Anthropic Claude Models ────────────────────────────────────────────────
  {
    key: 'anthropic-3.7-sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Claude 3.7 Sonnet (Frontier Reasoning)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    defaultPriority: 130
  },
  {
    key: 'anthropic-fable',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Fable (Frontier Agent)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    defaultPriority: 128
  },
  {
    key: 'anthropic-frontier',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Anthropic — Claude 3.7 Sonnet',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true, reasoning: true },
    defaultPriority: 125
  },
  {
    key: 'anthropic-3.5-sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Anthropic — Claude 3.5 Sonnet',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    defaultPriority: 100
  },

  // ─── OpenAI Models ──────────────────────────────────────────────────────────
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'OpenAI — GPT-4o',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    defaultPriority: 90
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'OpenAI — GPT-4o-mini',
    enabled: true,
    tier: 'balanced',
    capabilities: { tools: true },
    defaultPriority: 80
  }
];

const MODEL_ALIASES: Record<string, string> = {
  // Legacy & Shorthand Google Aliases
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-default': 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-thinking': 'gemini-2.0-flash-thinking',
  'google-frontier': 'gemini-2.5-pro',
  'google-gemini-2.5-pro': 'gemini-2.5-pro',
  'google-gemini-2.5-flash': 'gemini-2.5-flash',
  'google-gemini-pro': 'gemini-2.5-pro',
  
  // Anthropic & OpenAI Aliases
  'claude-3.7': 'anthropic-3.7-sonnet',
  'claude-3-7': 'anthropic-3.7-sonnet',
  'claude-3.7-sonnet': 'anthropic-3.7-sonnet',
  'anthropic-3.7': 'anthropic-3.7-sonnet',
  'anthropic-default': 'anthropic-3.7-sonnet',
  'claude-3-5-sonnet': 'anthropic-3.5-sonnet',
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
