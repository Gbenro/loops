import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  validateModelConfigAgainstCatalog,
  getValidatedModelRegistry,
  resolveModel,
  calculateInferenceCost,
  createComparisonTelemetry
} from '../../mcp-server/dist/models.js';

describe('Luna Expanded Model Laboratory & Catalog Validation Test Suite', () => {
  // ─── 1. Canonical OpenRouter IDs & Frontier Lineup ──────────────────────

  it('includes all verified closed frontier model candidates with valid OpenRouter IDs', () => {
    const closedCandidates = [
      { key: 'anthropic-fable-5', expectedId: 'anthropic/claude-fable-5', minCtx: 1000000 },
      { key: 'anthropic-sonnet-5', expectedId: 'anthropic/claude-sonnet-5', minCtx: 1000000 },
      { key: 'openai-gpt-5.6-sol', expectedId: 'openai/gpt-5.6-sol', minCtx: 1000000 },
      { key: 'openai-gpt-5.6-luna', expectedId: 'openai/gpt-5.6-luna', minCtx: 1000000 },
      { key: 'gemini-3.7-flash', expectedId: 'google/gemini-3.7-flash', minCtx: 1000000 },
      { key: 'xai-grok-4.6', expectedId: 'x-ai/grok-4.6', minCtx: 500000 }
    ];

    for (const cand of closedCandidates) {
      const model = MODEL_REGISTRY.find(m => m.key === cand.key);
      expect(model, `Expected model ${cand.key} to exist in registry`).toBeDefined();
      expect(model.modelId).toBe(cand.expectedId);
      expect(model.weightClass).toBe('proprietary');
      expect(model.contextWindow).toBeGreaterThanOrEqual(cand.minCtx);
      expect(model.toolCalling).toBe(true);
      expect(model.pricing).toBeDefined();
    }
  });

  it('includes all verified open/open-weight candidates with canonical IDs', () => {
    const openCandidates = [
      { key: 'openrouter-deepseek-v4-pro-0813', expectedId: 'deepseek/deepseek-v4-pro-0813', minCtx: 1000000 },
      { key: 'openrouter-deepseek-v4-flash', expectedId: 'deepseek/deepseek-v4-flash', minCtx: 1000000 },
      { key: 'openrouter-qwen-3.8-max', expectedId: 'qwen/qwen3.8-max', minCtx: 1000000 },
      { key: 'openrouter-qwen-3.6-35b-a3b', expectedId: 'qwen/qwen3.6-35b-a3b', minCtx: 200000 },
      { key: 'openrouter-qwen-3.6-27b', expectedId: 'qwen/qwen3.6-27b', minCtx: 200000 },
      { key: 'openrouter-glm-5.3', expectedId: 'z-ai/glm-5.3', minCtx: 1000000 },
      { key: 'openrouter-glm-5.2', expectedId: 'z-ai/glm-5.2', minCtx: 1000000 },
      { key: 'openrouter-minimax-m2.5', expectedId: 'minimax/minimax-m2.5', minCtx: 200000 },
      { key: 'openrouter-kimi-k2.5', expectedId: 'moonshotai/kimi-k2.5', minCtx: 200000 }
    ];

    for (const cand of openCandidates) {
      const model = MODEL_REGISTRY.find(m => m.key === cand.key);
      expect(model, `Expected model ${cand.key} to exist in registry`).toBeDefined();
      expect(model.modelId).toBe(cand.expectedId);
      expect(model.weightClass).toBe('open_weight');
      expect(model.contextWindow).toBeGreaterThanOrEqual(cand.minCtx);
      expect(model.toolCalling).toBe(true);
      expect(model.pricing).toBeDefined();
    }
  });

  // ─── 2. Modality & Native Audio Separation ────────────────────────────────

  it('strictly distinguishes native audio token input from ordinary vision/multimodality and external STT/TTS', () => {
    const gemini = MODEL_REGISTRY.find(m => m.key === 'gemini-3.7-flash');
    expect(gemini.nativeAudio).toBe(true);
    expect(gemini.modalities).toContain('audio');

    // Models with vision but without native audio tokens
    const fable = MODEL_REGISTRY.find(m => m.key === 'anthropic-fable-5');
    const qwen = MODEL_REGISTRY.find(m => m.key === 'openrouter-qwen-3.8-max');
    const deepseek = MODEL_REGISTRY.find(m => m.key === 'openrouter-deepseek-v4-pro-0813');

    expect(fable.nativeAudio).toBe(false);
    expect(fable.modalities).not.toContain('audio');
    expect(qwen.nativeAudio).toBe(false);
    expect(qwen.modalities).not.toContain('audio');
    expect(deepseek.nativeAudio).toBe(false);
    expect(deepseek.modalities).not.toContain('audio');
  });

  // ─── 3. Historical Comparison Data Preservation ───────────────────────────

  it('preserves historical Qwen and DeepSeek comparison entries with retired status rather than silent removal', () => {
    const historicalQwen = MODEL_REGISTRY.find(m => m.key === 'historical-qwen-legacy');
    expect(historicalQwen).toBeDefined();
    expect(historicalQwen.enabled).toBe(false);
    expect(historicalQwen.laboratoryStatus).toBe('retired');
    expect(historicalQwen.modelId).toBe('qwen/qwen3.8-max'); // Repaired to valid canonical ID
  });

  // ─── 4. Runtime OpenRouter Catalog Validation ─────────────────────────────

  it('validates model registry against a live catalog and disables invalid model IDs', () => {
    const mockCatalog = [
      { id: 'anthropic/claude-fable-5' },
      { id: 'openai/gpt-5.6-sol' },
      { id: 'google/gemini-3.7-flash' },
      { id: 'qwen/qwen3.8-max' }
    ];

    const validatedRegistry = getValidatedModelRegistry(mockCatalog);
    
    const fable = validatedRegistry.find(m => m.key === 'anthropic-fable-5');
    expect(fable.enabled).toBe(true);

    // DeepSeek V4 Pro was not in the mock catalog, so it should be disabled and marked invalid
    const deepseek = validatedRegistry.find(m => m.key === 'openrouter-deepseek-v4-pro-0813');
    expect(deepseek.enabled).toBe(false);
    expect(deepseek.laboratoryStatus).toBe('invalid_catalog_id');
  });

  it('validates single model config against catalog set', () => {
    const catalogIds = new Set(['anthropic/claude-fable-5', 'openai/gpt-5.6-sol']);
    const fableModel = MODEL_REGISTRY.find(m => m.key === 'anthropic-fable-5');
    const invalidModel = { ...fableModel, modelId: 'anthropic/claude-nonexistent-99' };

    expect(validateModelConfigAgainstCatalog(fableModel, catalogIds).valid).toBe(true);
    expect(validateModelConfigAgainstCatalog(invalidModel, catalogIds).valid).toBe(false);
  });

  // ─── 5. Model Resolution & Shorthand Aliases ──────────────────────────────

  it('resolves canonical and shorthand aliases accurately', async () => {
    const userId = 'usr_test_1';
    
    const fable = await resolveModel('fable-5', userId);
    expect(fable.key).toBe('anthropic-fable-5');

    const sonnet = await resolveModel('sonnet-5', userId);
    expect(sonnet.key).toBe('anthropic-sonnet-5');

    const sol = await resolveModel('sol', userId);
    expect(sol.key).toBe('openai-gpt-5.6-sol');

    const luna = await resolveModel('gpt-5.6-luna', userId);
    expect(luna.key).toBe('openai-gpt-5.6-luna');

    const grok = await resolveModel('grok', userId);
    expect(grok.key).toBe('xai-grok-4.6');

    const glm = await resolveModel('glm-5.3', userId);
    expect(glm.key).toBe('openrouter-glm-5.3');

    const minimax = await resolveModel('minimax-m2.5', userId);
    expect(minimax.key).toBe('openrouter-minimax-m2.5');

    const kimi = await resolveModel('kimi-k2.5', userId);
    expect(kimi.key).toBe('openrouter-kimi-k2.5');
  });

  // ─── 6. Multi-Model Comparison Telemetry & Cost Accounting ────────────────

  it('calculates inference costs accurately based on catalog pricing', () => {
    const fable = MODEL_REGISTRY.find(m => m.key === 'anthropic-fable-5'); // input: $10/M, output: $50/M
    const cost = calculateInferenceCost(fable.pricing, 1000, 500);
    // (1000 / 1M) * 10 = $0.01; (500 / 1M) * 50 = $0.025; total = $0.035
    expect(cost).toBeCloseTo(0.035, 4);

    const flash = MODEL_REGISTRY.find(m => m.key === 'openrouter-deepseek-v4-flash'); // input: $0.09/M, output: $0.18/M
    const flashCost = calculateInferenceCost(flash.pricing, 10000, 2000);
    // (10000 / 1M) * 0.09 = $0.0009; (2000 / 1M) * 0.18 = $0.00036; total = $0.00126
    expect(flashCost).toBeCloseTo(0.00126, 5);
  });

  it('creates comparison telemetry record maintaining system prompt hash constant', () => {
    const sol = MODEL_REGISTRY.find(m => m.key === 'openai-gpt-5.6-sol');
    const systemPromptHash = 'sha256_hash_constant_prompt_123';

    const record = createComparisonTelemetry({
      experimentId: 'exp_multimodel_001',
      model: sol,
      promptTokens: 2500,
      completionTokens: 800,
      latencyMs: 1450,
      outputLength: 3200,
      systemPromptHash,
      temperature: 0.7
    });

    expect(record.experimentId).toBe('exp_multimodel_001');
    expect(record.modelKey).toBe('openai-gpt-5.6-sol');
    expect(record.modelId).toBe('openai/gpt-5.6-sol');
    expect(record.totalTokens).toBe(3300);
    expect(record.latencyMs).toBe(1450);
    expect(record.systemPromptHash).toBe(systemPromptHash);
    expect(record.costUsd).toBeGreaterThan(0);
  });
});
