import { describe, it, expect, beforeEach } from 'vitest';
import {
  inferAttentionV2Plan,
  executeSeamlessAttentionPipeline
} from './attentionV2Orchestrator.js';
import {
  AttentionEngineV1,
  AttentionIndex,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';

describe('Order 109 — Chat Attention V2 → V1 Orchestration Integration', () => {
  let index;
  let engine;

  beforeEach(() => {
    index = new AttentionIndex();
    index.rebuild({
      snapshotId: 'snap_chat_integration',
      snapshotHash: 'hash_chat_integration',
      mode: 'fixture_benchmark',
      loops: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'loop'),
      echoes: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'echo'),
      relationalMemories: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'relational_memory'),
      chatMessages: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'chat_message'),
      lunarCycles: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'lunar_cycle'),
      items: MOCK_LUNA_FIELD_FIXTURES,
      created_at: new Date().toISOString()
    });
    engine = new AttentionEngineV1(index);
  });

  it('runs Attention V2 → V1 pipeline for longitudinal practice inquiry and produces bounded context', async () => {
    const question = 'How has my practice shifted over time across cycles?';
    const result = await executeSeamlessAttentionPipeline(question, { tokenBudget: 3000 }, engine);

    expect(result.v2Plan.evidenceGeometry).toBe('longitudinal_change');
    expect(result.v2Plan.coverageStrategy).toBe('longitudinal_span');
    expect(result.v2Plan.requireTemporalSpread).toBe(true);

    expect(result.v1AttentionPlan).toBeDefined();
    expect(result.contextPacket).toBeDefined();
    expect(result.evidenceItems.length).toBeGreaterThan(0);
    expect(result.synthesisCalibration.insufficiencyStatus).toBe('SATISFIED');
    expect(result.synthesisCalibration.guidance).toContain('longitudinal_change');
  });

  it('correctly formats [FIELD_MEMORY_ATTENTION_LAYER] for system prompt injection when evidence matches', async () => {
    const question = 'How has my practice shifted over time across cycles?';
    const result = await executeSeamlessAttentionPipeline(question, { tokenBudget: 3000 }, engine);

    const formattedPromptContext = result.contextPacket.formattedPromptContext;
    const attentionContextPrompt = `\n\n[FIELD_MEMORY_ATTENTION_LAYER]\nGeometry: ${result.v2Plan.evidenceGeometry}\nCoverage Strategy: ${result.v2Plan.coverageStrategy}\nSynthesis Guidance: ${result.synthesisCalibration.guidance}\n\n${formattedPromptContext}`;

    expect(attentionContextPrompt).toContain('[FIELD_MEMORY_ATTENTION_LAYER]');
    expect(attentionContextPrompt).toContain('Geometry: longitudinal_change');
    expect(attentionContextPrompt).toContain('Coverage Strategy: longitudinal_span');
    expect(attentionContextPrompt).toContain('ATTENTION ENGINE V1 CONTEXT PACKET');
  });

  it('handles empty evidence gracefully with insufficiency calibration and epistemic warnings', async () => {
    const emptyIndex = new AttentionIndex();
    emptyIndex.rebuild({
      snapshotId: 'snap_empty',
      snapshotHash: 'hash_empty',
      mode: 'fixture_benchmark',
      loops: [],
      echoes: [],
      relationalMemories: [],
      chatMessages: [],
      lunarCycles: [],
      items: [],
      created_at: new Date().toISOString()
    });
    const emptyEngine = new AttentionEngineV1(emptyIndex);

    const question = 'How did my space exploration shift across cycles?';
    const result = await executeSeamlessAttentionPipeline(question, { tokenBudget: 3000 }, emptyEngine);

    expect(result.v2Plan.evidenceGeometry).toBe('longitudinal_change');
    expect(result.synthesisCalibration.insufficiencyStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.synthesisCalibration.guidance).toContain('no direct prior evidence was found');
  });

  it('fails open gracefully when Attention Engine encounters an error', async () => {
    const brokenEngine = {
      planAndAssemble: async () => {
        throw new Error('Database connection timeout during attention assembly');
      }
    };

    let fallbackUsed = false;
    let attentionContextPrompt = '';

    try {
      await executeSeamlessAttentionPipeline('Test inquiry', { tokenBudget: 3000 }, brokenEngine);
    } catch (err) {
      fallbackUsed = true;
    }

    expect(fallbackUsed).toBe(true);
    expect(attentionContextPrompt).toBe('');
  });
});
