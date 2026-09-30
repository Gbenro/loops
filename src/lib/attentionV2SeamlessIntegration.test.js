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

describe('Order 108 — Attention V1 ↔ V2 Seamless Integration Contract', () => {
  let index;
  let engine;

  beforeEach(() => {
    index = new AttentionIndex();
    index.rebuild({
      snapshotId: 'snap_v2_test',
      snapshotHash: 'hash_v2_test',
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

  describe('V2 Evidence Geometry Planning', () => {
    it('infers longitudinal_change for shift over time inquiries', () => {
      const plan = inferAttentionV2Plan('How has my relationship to rest shifted across cycles?');
      expect(plan.evidenceGeometry).toBe('longitudinal_change');
      expect(plan.coverageStrategy).toBe('longitudinal_span');
      expect(plan.requireTemporalSpread).toBe(true);
    });

    it('infers recurrence for repeating pattern inquiries', () => {
      const plan = inferAttentionV2Plan('What recurring patterns keep surfacing in my studio work?');
      expect(plan.evidenceGeometry).toBe('recurrence');
      expect(plan.coverageStrategy).toBe('recurrence_deepening');
    });

    it('infers relationship for entity-focused queries', () => {
      const plan = inferAttentionV2Plan('What have I reflected on regarding Alex and studio?');
      expect(plan.evidenceGeometry).toBe('relationship');
      expect(plan.coverageStrategy).toBe('entity_cluster');
    });

    it('falls back gracefully to V1 default plan when input is missing or simple', () => {
      const plan = inferAttentionV2Plan('');
      expect(plan.isFallback).toBe(true);
      expect(plan.evidenceGeometry).toBe('current_state');
    });
  });

  describe('Seamless Pipeline Execution & Synthesis Calibration', () => {
    it('executes V1 ↔ V2 pipeline and returns calibrated evidence bundle', async () => {
      const result = await executeSeamlessAttentionPipeline(
        'How has my practice shifted over time?',
        { tokenBudget: 3000 },
        engine
      );

      expect(result.v2Plan.evidenceGeometry).toBe('longitudinal_change');
      expect(result.v1AttentionPlan).toBeDefined();
      expect(result.contextPacket).toBeDefined();
      expect(result.synthesisCalibration).toBeDefined();
      expect(result.synthesisCalibration.insufficiencyStatus).toBe('SATISFIED');
    });

    it('provides clear insufficiency status when zero evidence items match', async () => {
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

      const result = await executeSeamlessAttentionPipeline(
        'Nonexistent inquiry term xyz123',
        { tokenBudget: 3000 },
        emptyEngine
      );

      expect(result.synthesisCalibration.epistemicSofteningRequired).toBe(true);
      expect(result.synthesisCalibration.insufficiencyStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.synthesisCalibration.guidance).toContain('no direct prior evidence was found');
    });
  });
});
