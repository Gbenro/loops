import { describe, it, expect, beforeEach } from 'vitest';
import {
  decomposeQuery,
  computeSemanticSubjectScore,
  classifyRecordDomain,
  classifyQuestionDomain,
  evaluateDomainCompatibility,
  toLightweightComparisonRun,
  AttentionEngineV1,
  AttentionIndex,
  LunaFieldReadOnlyAdapter,
  DurableLabStore,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';
import { getMoonAge } from '../../mcp-server/src/lunar.ts';

describe('Luna Lab Payload Bounding & Temporal Interval Engine (iss_1789299806238_8sah)', () => {
  let adapter;
  let index;
  let engine;

  beforeEach(async () => {
    adapter = new LunaFieldReadOnlyAdapter();
    const snap = await adapter.captureSnapshot();
    index = new AttentionIndex();
    index.rebuild(snap);
    engine = new AttentionEngineV1(index);
  });

  describe('1. Response Bounding & toLightweightComparisonRun Serialization', () => {
    it('drastically bounds run payload size while preserving verbatim answers and scorecards', () => {
      // Construct a mock heavy run with massive raw prompt and candidate lists
      const heavyRun = {
        runId: 'run_test_heavy_123',
        sessionId: 'sess_test_123',
        question: 'What has unfolded in my Field from the beginning of the current New Moon until now?',
        category: 'longitudinal_change',
        timestamp: new Date().toISOString(),
        model: 'anthropic-sonnet-5',
        status: 'valid',
        snapshotHash: 'snap_hash_test',
        provenanceBreakdown: { personal_field: 8, benchmark_fixture: 2, synthetic: 0 },
        baselines: {
          control: {
            baseline: 'control_canonical',
            displayName: 'Control Baseline',
            contextTokenCount: 1500,
            itemsIncludedCount: 6,
            temporalSpanDays: 3,
            cyclesCoveredCount: 1,
            groundingScore: 82,
            falseConnectionRisk: 10,
            missedEvidenceRisk: 15,
            insufficientEvidenceRecognized: false,
            latencyMs: 1200,
            summary: 'Control summary',
            formattedSnippet: 'Very long snippet '.repeat(400), // ~7KB
            rawPromptSent: 'Massive prompt instruction '.repeat(1000), // ~27KB
            verbatimGeneratedAnswer: 'This is the verbatim control answer reflecting recent Field echoes.',
            snapshotHashUsed: 'snap_hash_test',
            provenanceIntegrityValid: true
          },
          broadContext: {
            baseline: 'broad_context_baseline',
            displayName: 'Broad Baseline',
            contextTokenCount: 2500,
            itemsIncludedCount: 10,
            temporalSpanDays: 14,
            cyclesCoveredCount: 2,
            groundingScore: 70,
            falseConnectionRisk: 30,
            missedEvidenceRisk: 10,
            insufficientEvidenceRecognized: false,
            latencyMs: 1500,
            summary: 'Broad summary',
            formattedSnippet: 'Broad context snippet '.repeat(400),
            rawPromptSent: 'Broad raw prompt '.repeat(1000),
            verbatimGeneratedAnswer: 'This is the verbatim broad answer.',
            snapshotHashUsed: 'snap_hash_test',
            provenanceIntegrityValid: true
          },
          attentionEngineV1: {
            baseline: 'attention_engine_v1',
            displayName: 'Attention Engine V1',
            contextTokenCount: 1200,
            itemsIncludedCount: 5,
            temporalSpanDays: 3,
            cyclesCoveredCount: 1,
            groundingScore: 95,
            falseConnectionRisk: 2,
            missedEvidenceRisk: 5,
            insufficientEvidenceRecognized: false,
            latencyMs: 980,
            summary: 'V1 summary',
            formattedSnippet: 'V1 formatted snippet '.repeat(400),
            rawPromptSent: 'V1 raw prompt '.repeat(1000),
            verbatimGeneratedAnswer: 'This is the verbatim V1 answer grounded in current New Moon echoes.',
            snapshotHashUsed: 'snap_hash_test',
            provenanceIntegrityValid: true
          }
        },
        attentionPlan: {
          planId: 'plan_123',
          question: 'What has unfolded in my Field from the beginning of the current New Moon until now?',
          questionClass: 'longitudinal_change',
          tokenBudget: 3000,
          coverageStrategy: 'longitudinal_span',
          channelsUsed: [{ channel: 'temporal', candidateCount: 20, selectedCount: 5 }],
          candidatesConsideredCount: 30,
          candidates: Array.from({ length: 30 }, (_, i) => ({
            sourceId: 'cand_' + i,
            sourceType: 'echo',
            score: 10,
            channels: ['temporal'],
            channelScores: { semantic: 0, lexical: 0, temporal: 5, relational: 0, recurrence: 0, entity: 0 },
            tokenEstimate: 50,
            content: 'Full raw candidate text content '.repeat(20),
            rationale: 'Candidate rationale'
          })),
          selectedSources: [{ sourceId: 'cand_1', sourceType: 'echo', score: 10, channels: ['temporal'], channelScores: { semantic: 0, lexical: 0, temporal: 5, relational: 0, recurrence: 0, entity: 0 }, tokenEstimate: 50, content: 'Text', rationale: 'Rationale' }],
          omissionsAndDeduplications: [],
          discontinuitiesDetected: [],
          counterevidenceNotes: [],
          createdAt: new Date().toISOString()
        },
        contextPacket: {
          packetId: 'pkt_123',
          planId: 'plan_123',
          tokenBudget: 3000,
          totalTokensUsed: 1200,
          formattedPromptContext: 'Massive formatted prompt context '.repeat(500),
          evidenceItems: Array.from({ length: 5 }, (_, i) => ({
            id: 'ev_' + i,
            sourceId: 'cand_' + i,
            sourceType: 'echo',
            contentSnippet: 'Full text snippet '.repeat(30),
            provenance: { source: 'personal_field', sourceTable: 'echoes', originalId: 'cand_' + i, snapshotId: 'snap_1', contentHash: 'hash' },
            selectionRationale: 'Rationale',
            coverageRole: 'direct_answer',
            tokensEstimated: 50
          })),
          coverageMetrics: {
            temporalSpanDays: 3,
            cyclesCovered: [3],
            sourceTypeDistribution: { echo: 5 },
            recurrenceHighlighted: false,
            counterevidenceIncluded: false
          },
          provenanceDigest: 'hash_digest',
          generatedAt: new Date().toISOString()
        },
        delta: {
          groundingDelta: 13,
          falseConnectionReduction: 8,
          contextTokenReduction: 300,
          temporalSpanIncreaseDays: 0,
          overallWinner: 'attention_engine_v1'
        }
      };

      const rawJson = JSON.stringify(heavyRun);
      const rawSizeBytes = Buffer.byteLength(rawJson, 'utf8');

      // Heavy run is over 150KB
      expect(rawSizeBytes).toBeGreaterThan(100000);

      // Lightweight conversion
      const lightweight = toLightweightComparisonRun(heavyRun);
      const lightJson = JSON.stringify(lightweight);
      const lightSizeBytes = Buffer.byteLength(lightJson, 'utf8');

      // Must be under 15KB (typically < 8KB) -> >90% reduction
      expect(lightSizeBytes).toBeLessThan(15000);
      expect(lightSizeBytes / rawSizeBytes).toBeLessThan(0.12);

      // Verbatim generated answers across all conditions MUST be preserved
      expect(lightweight.baselines.control.verbatimGeneratedAnswer).toBe(heavyRun.baselines.control.verbatimGeneratedAnswer);
      expect(lightweight.baselines.broadContext.verbatimGeneratedAnswer).toBe(heavyRun.baselines.broadContext.verbatimGeneratedAnswer);
      expect(lightweight.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBe(heavyRun.baselines.attentionEngineV1.verbatimGeneratedAnswer);

      // Scores, metrics, and delta must be intact
      expect(lightweight.baselines.attentionEngineV1.groundingScore).toBe(95);
      expect(lightweight.delta.overallWinner).toBe('attention_engine_v1');

      // Massive redundant bodies must be stripped or summarized
      expect(lightweight.baselines.control.rawPromptSent).toBeUndefined();
      expect(lightweight.contextPacket.formattedPromptContext).toBeUndefined();
      expect(lightweight.attentionPlan.candidates).toBeUndefined();
      expect(lightweight.attentionPlan.candidatesConsideredCount).toBe(30);
      expect(lightweight.contextPacket.evidenceItemSummaries.length).toBe(5);
    });

    it('DurableLabStore retains full unabridged run records while API returns lightweight by default', () => {
      const store = new DurableLabStore();
      const session = store.createSession({ name: 'Payload Test Session' });

      const testRun = {
        runId: 'run_durable_test_001',
        sessionId: session.id,
        question: 'What has unfolded in my Field from the beginning of the current New Moon until now?',
        category: 'longitudinal_change',
        timestamp: new Date().toISOString(),
        model: 'anthropic-sonnet-5',
        status: 'valid',
        snapshotHash: 'hash',
        provenanceBreakdown: { personal_field: 5, benchmark_fixture: 0, synthetic: 0 },
        baselines: {
          control: {
            baseline: 'control_canonical',
            verbatimGeneratedAnswer: 'Control answer',
            rawPromptSent: 'Full prompt text '.repeat(100),
            formattedSnippet: 'Snippet '.repeat(100)
          },
          broadContext: {
            baseline: 'broad_context_baseline',
            verbatimGeneratedAnswer: 'Broad answer',
            rawPromptSent: 'Full prompt text '.repeat(100),
            formattedSnippet: 'Snippet '.repeat(100)
          },
          attentionEngineV1: {
            baseline: 'attention_engine_v1',
            verbatimGeneratedAnswer: 'V1 answer',
            rawPromptSent: 'Full prompt text '.repeat(100),
            formattedSnippet: 'Snippet '.repeat(100)
          }
        }
      };

      store.recordRun(session.id, testRun);

      // Full durable store preserves 100% of raw fields
      const retrievedFull = store.getRun(testRun.runId);
      expect(retrievedFull.baselines.control.rawPromptSent).toBeDefined();

      // Lightweight transformation strips bloat for default REST inspection
      const lightweight = toLightweightComparisonRun(retrievedFull);
      expect(lightweight.baselines.control.rawPromptSent).toBeUndefined();
      expect(lightweight.baselines.control.verbatimGeneratedAnswer).toBe('Control answer');
    });
  });

  describe('2. Astronomical New Moon Temporal Interval & Query Decomposition', () => {
    it('calculates exact New Moon temporal interval and strips test harness boilerplate', () => {
      const prompt = 'What has unfolded in my Field from the beginning of the current New Moon until now? CONTROL specimen 1/5. Use the frozen Field evidence/context associated with this experiment. Luna normal current behavior. Preserve outputs only in lab artifacts, not Personal Field or relational memory.';
      
      const decomp = decomposeQuery(prompt);

      // Must classify as personal lived experience with dev context disabled
      expect(decomp.domain).toBe('personal_lived_experience');
      expect(decomp.allowsDevContext).toBe(false);
      expect(decomp.primarySubject).toBe('personal_field_reflection');

      // Test boilerplate words must NOT leak into subjects
      expect(decomp.subjects).not.toContain('control');
      expect(decomp.subjects).not.toContain('specimen');
      expect(decomp.subjects).not.toContain('frozen');
      expect(decomp.subjects).not.toContain('artifacts');
      expect(decomp.subjects).not.toContain('outputs');
      expect(decomp.subjects).not.toContain('field');

      // Temporal interval must be calculated
      expect(decomp.temporalInterval).toBeDefined();
      expect(decomp.temporalInterval.type).toBe('lunar_interval');
      expect(decomp.temporalInterval.startMs).toBeLessThanOrEqual(decomp.temporalInterval.endMs);
      
      // Start time must match getMoonAge calculation (~2-3 days ago for mid-cycle)
      const now = new Date();
      const ageDays = getMoonAge(now);
      const expectedStartMs = Math.round(now.getTime() - (ageDays * 86400 * 1000));
      expect(Math.abs(decomp.temporalInterval.startMs - expectedStartMs)).toBeLessThan(10000);
    });

    it('qualifies records inside New Moon interval and disqualifies records outside interval', () => {
      const refDate = new Date('2026-09-13T12:00:00Z');
      const decomp = decomposeQuery(
        'What has unfolded in my Field from the beginning of the current New Moon until now?',
        'longitudinal_change',
        refDate
      );

      expect(decomp.temporalInterval).toBeDefined();
      const interval = decomp.temporalInterval;

      // Specimen inside interval (e.g. Sept 12 user echo)
      const insideEcho = {
        id: 'echo_recent_01',
        sourceType: 'echo',
        content: 'Quiet morning walk, felt renewed sense of clarity after the new moon threshold.',
        createdAt: new Date(interval.startMs + 3600000).toISOString(),
        tags: ['reflection', 'morning']
      };

      const resInside = computeSemanticSubjectScore(insideEcho, decomp);
      expect(resInside.pass).toBe(true);
      expect(resInside.score).toBeGreaterThanOrEqual(10.0);
      expect(resInside.rationale).toContain('Qualified: Personal Field reflection recorded during current New Moon interval');

      // Specimen outside interval (e.g. August 27 chat message)
      const outsideMsg = {
        id: 'msg_old_01',
        sourceType: 'chat_message',
        content: 'I wonder what the new moon will bring in late September.',
        createdAt: '2026-08-27T12:00:00Z',
        tags: []
      };

      const resOutside = computeSemanticSubjectScore(outsideMsg, decomp);
      expect(resOutside.pass).toBe(false);
      expect(resOutside.score).toBe(0);
      expect(resOutside.rationale).toContain('Rejected: Record timestamp outside requested New Moon interval');
    });
  });

  describe('3. Provenance & Dev System Contamination Filtering', () => {
    it('classifies dev loops and rejects them for personal field reflection inquiries', () => {
      const devLoop1 = {
        id: 'l1788575768630jsjr',
        sourceType: 'loop',
        title: 'DEV LAB — Luna Intelligence Lab V1 seed',
        content: 'Seed experiment runner and bounded verification sidecar.',
        createdAt: '2026-09-11T10:00:00Z',
        tags: ['dev', 'lab']
      };

      const devLoop2 = {
        id: 'l1788466229091p6z1',
        sourceType: 'loop',
        title: 'DEV FUTURE — Telemetry-guided chat rollover and Field preservation',
        content: 'Chat rollover telemetry integration.',
        createdAt: '2026-09-11T12:00:00Z',
        tags: ['future', 'architecture']
      };

      const c1 = classifyRecordDomain(devLoop1);
      const c2 = classifyRecordDomain(devLoop2);

      expect(c1.primaryDomain).toBe('development_engineering');
      expect(c2.primaryDomain).toBe('development_engineering');

      // Inquiry does not allow dev context
      const compat1 = evaluateDomainCompatibility(c1.primaryDomain, 'personal_lived_experience', false);
      const compat2 = evaluateDomainCompatibility(c2.primaryDomain, 'personal_lived_experience', false);

      expect(compat1.decision).toBe('INCOMPATIBLE');
      expect(compat1.score).toBe(0.0);
      expect(compat2.decision).toBe('INCOMPATIBLE');
      expect(compat2.score).toBe(0.0);
    });

    it('end-to-end planAndAssemble selects recent user echoes and excludes dev loops for New Moon question', async () => {
      // Add a recent user echo and a recent dev loop into the test index during the New Moon interval
      const nowIso = new Date().toISOString();
      const recentEcho = {
        id: 'echo_live_new_moon',
        sourceType: 'echo',
        title: 'Threshold reflections',
        content: 'Felt deep clarity stepping through the new moon portal, rested and present.',
        createdAt: nowIso,
        cycleNumber: 3,
        tags: ['reflection', 'new-moon']
      };
      const recentDevLoop = {
        id: 'loop_live_dev',
        sourceType: 'loop',
        title: 'DEV LAB — Telemetry test runner',
        content: 'Automated test harness for background telemetry dispatch.',
        createdAt: nowIso,
        cycleNumber: 3,
        tags: ['dev', 'telemetry']
      };

      index.itemsMap.set(recentEcho.id, recentEcho);
      index.itemsMap.set(recentDevLoop.id, recentDevLoop);

      const { plan, contextPacket } = await engine.planAndAssemble(
        'What has unfolded in my Field from the beginning of the current New Moon until now? CONTROL specimen 1/5.',
        { tokenBudget: 3000 }
      );

      expect(plan.questionDomain?.allowsDevContext).toBe(false);
      // Dev loop must be disqualified and tracked in contamination filter
      expect(plan.telemetry?.devSystemContaminationFilteredCount).toBeGreaterThanOrEqual(1);

      // ContextPacket must record temporalRange
      expect(contextPacket.temporalRange).toBeDefined();
      expect(contextPacket.temporalRange?.description).toContain('Current New Moon interval');

      // The recent user echo MUST be selected as evidence
      const selectedEcho = contextPacket.evidenceItems.find(e => e.sourceId === 'echo_live_new_moon');
      expect(selectedEcho).toBeDefined();

      // None of the selected items in contextPacket can be development_engineering
      for (const item of contextPacket.evidenceItems) {
        expect(item.recordDomain).not.toBe('development_engineering');
        expect(item.recordDomain).not.toBe('system_operations');
        expect(item.title || '').not.toMatch(/^DEV\b/i);
      }
    });
  });
});
