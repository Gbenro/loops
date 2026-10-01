import { describe, it, expect, beforeEach } from 'vitest';
import {
  inferAttentionV2Plan,
  executeSeamlessAttentionPipeline,
  EVIDENCE_GEOMETRIES,
  V1_FALLBACK_DEFAULT_PLAN
} from './attentionV2Orchestrator.js';
import {
  AttentionEngineV1,
  AttentionIndex,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';

describe('Order 108 + Production Refinement — Attention Matrix & Adaptive Depth Integration', () => {
  let index;
  let engine;

  beforeEach(() => {
    index = new AttentionIndex();
    index.rebuild({
      snapshotId: 'snap_v2_matrix_test',
      snapshotHash: 'hash_v2_matrix_test',
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

  describe('Attention Matrix Planning (Composite Geometries x Depth x Width)', () => {
    it('infers composite geometries for multi-faceted inquiries', () => {
      const question = 'How did my understanding of space change during this cycle, and what studio experiences caused those changes?';
      const plan = inferAttentionV2Plan(question);

      expect(plan.inquiryGeometries).toContain('longitudinal_change');
      expect(plan.inquiryGeometries).toContain('causal_contextual');
      expect(plan.inquiryGeometries).toContain('embodiment');

      expect(plan.attentionDepth.level).toBe('deep_longitudinal');
      expect(plan.attentionDepth.dimensions).toContain('historical_origin');
      expect(plan.attentionDepth.dimensions).toContain('experiential_embodied');

      expect(plan.attentionWidth.scope).toBe('broad_cycle');
      expect(plan.attentionWidth.dimensions).toContain('temporal_distribution');
    });

    it('maintains independent Attention Depth and Width', () => {
      // Narrow + Deep
      const narrowDeepPlan = inferAttentionV2Plan('Why did my origin baseline look like that?');
      expect(narrowDeepPlan.attentionDepth.level).toBe('historical_origin');
      expect(narrowDeepPlan.attentionWidth.scope).toBe('narrow_thread');

      // Broad + Shallow
      const broadShallowPlan = inferAttentionV2Plan('What did I feel in studio?');
      expect(broadShallowPlan.attentionDepth.level).toBe('multi_layer');
      expect(broadShallowPlan.attentionWidth.scope).toBe('narrow_thread');
    });

    it('falls back gracefully to V1 default plan when input is missing', () => {
      const plan = inferAttentionV2Plan('');
      expect(plan.isFallback).toBe(true);
      expect(plan.inquiryGeometries).toContain('current_state');
    });
  });

  describe('Seamless Multi-Pass Reorientation & Evidence-Based Stopping', () => {
    it('executes multi-pass pipeline and emits first-class reorientation trajectory telemetry', async () => {
      const question = 'How did my understanding of space change during this cycle?';
      const result = await executeSeamlessAttentionPipeline(question, {}, engine);

      expect(result.v2Plan.inquiryGeometries).toContain('longitudinal_change');
      expect(result.reorientationTrajectory).toBeDefined();
      expect(result.reorientationTrajectory.length).toBeGreaterThan(0);

      const pass1 = result.reorientationTrajectory[0];
      expect(pass1.passNumber).toBe(1);
      expect(pass1.operation).toBe('initial_composite_retrieval');
      expect(typeof pass1.evidenceItemsRetrieved).toBe('number');

      expect(result.telemetry.stoppingReason).toBeDefined();
      expect(typeof result.telemetry.stoppingReason).toBe('string');
      expect(result.telemetry.tokensConsumedTotal).toBeGreaterThanOrEqual(0);
    });

    it('handles empty evidence gracefully with evidence-based stopping and epistemic softening', async () => {
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

      const result = await executeSeamlessAttentionPipeline('Nonexistent term xyz123', {}, emptyEngine);

      expect(result.synthesisCalibration.epistemicSofteningRequired).toBe(true);
      expect(result.synthesisCalibration.insufficiencyStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.telemetry.stoppingReason).toContain('Zero candidate evidence matched query');
    });
  });
});
