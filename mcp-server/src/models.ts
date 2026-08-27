export interface ModelConfig {
  key: string;            // internal identifier, e.g., 'anthropic-frontier'
  provider: 'anthropic' | 'openai';
  modelId: string;        // official API identifier, e.g., 'claude-3-5-sonnet-20240620'
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
  {
    key: 'anthropic-frontier',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20240620',
    displayName: 'Anthropic — Frontier (Claude 3.5 Sonnet)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    defaultPriority: 100
  },
  {
    key: 'openai-frontier',
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'OpenAI — Frontier (GPT-4o)',
    enabled: true,
    tier: 'frontier',
    capabilities: { tools: true },
    defaultPriority: 90
  },
  {
    key: 'openai-balanced',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'OpenAI — Balanced (GPT-4o-mini)',
    enabled: true,
    tier: 'balanced',
    capabilities: { tools: true },
    defaultPriority: 80
  }
];

/**
 * Entitlement Layer Stub:
 * Resolves which internal model keys a user is authorized to access.
 * Defaults to all models for V1 testing, ready for paid product tiers.
 */
export async function getUserAllowedModels(userId: string): Promise<string[]> {
  // Entitled to all active models for development
  return MODEL_REGISTRY.filter(m => m.enabled).map(m => m.key);
}

/**
 * Resolves a selected model key against a user's entitlements,
 * automatically falling back to the highest priority allowed model.
 */
export async function resolveModel(key: string | undefined, userId: string): Promise<ModelConfig> {
  const allowedKeys = await getUserAllowedModels(userId);
  const allowedModels = MODEL_REGISTRY.filter(m => allowedKeys.includes(m.key));

  if (allowedModels.length === 0) {
    throw new Error('No models are enabled or allowed for this user.');
  }

  // If key requested, check validity and permission
  if (key) {
    const matched = allowedModels.find(m => m.key === key);
    if (matched) return matched;
  }

  // Fallback to highest priority allowed model
  return allowedModels.reduce((highest, current) => 
    current.defaultPriority > highest.defaultPriority ? current : highest
  , allowedModels[0]);
}
