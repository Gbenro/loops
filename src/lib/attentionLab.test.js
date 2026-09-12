import { describe, it, expect, beforeEach } from 'vitest';
import {
  LunaFieldReadOnlyAdapter,
  AttentionIndex,
  AttentionEngineV1,
  CANONICAL_BENCHMARK_CASES,
  BenchmarkHarness,
  DurableLabStore,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';
import { LUNA_LAB_OPENAPI_SPEC } from '../../mcp-server/src/openapi.ts';

describe('Attention Lab V1 Architecture & Lunar Lab GPT Interface (iss_1789200638196_mhry)', () => {
  let adapter;
  let index;
  let engine;
  let snapshot;

  beforeEach(async () => {
    adapter = new LunaFieldReadOnlyAdapter();
    index = new AttentionIndex();
    snapshot = await adapter.captureSnapshot();
    index.rebuild(snapshot);
    engine = new AttentionEngineV1(index);
  });

  // ─── 1. Read-Only Field Adapter & Boundary Isolation ──────────────────────

  describe('1. Read-Only Field Adapter & Personal Field Isolation', () => {
    it('guarantees that adapter exposes strictly read-only capabilities with zero mutation methods', () => {
      expect(adapter.assertReadOnly()).toBe(true);
      expect(typeof adapter.captureSnapshot).toBe('function');

      const proto = Object.getPrototypeOf(adapter);
      const methods = Object.getOwnPropertyNames(proto);
      const mutationKeywords = ['insert', 'update', 'delete', 'upsert', 'write', 'modify', 'drop', 'alter'];

      for (const m of methods) {
        for (const bad of mutationKeywords) {
          expect(m.toLowerCase()).not.toContain(bad);
        }
      }
    });

    it('returns a deeply frozen snapshot where mutations are structurally prevented', () => {
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.loops)).toBe(true);
      expect(Object.isFrozen(snapshot.echoes)).toBe(true);
      expect(Object.isFrozen(snapshot.relationalMemories)).toBe(true);
      expect(Object.isFrozen(snapshot.chatMessages)).toBe(true);
      expect(Object.isFrozen(snapshot.lunarCycles)).toBe(true);

      // Attempting to push or mutate throws in strict mode
      expect(() => {
        snapshot.loops.push({ id: 'illegal_write', sourceType: 'loop', content: 'hack', createdAt: '' });
      }).toThrow();
    });

    it('captures longitudinal multi-cycle Luna Field records across cycles 1 through 4', () => {
      expect(snapshot.totalItems).toBeGreaterThanOrEqual(14);
      expect(snapshot.loops.length).toBeGreaterThanOrEqual(4);
      expect(snapshot.echoes.length).toBeGreaterThanOrEqual(5);
      expect(snapshot.relationalMemories.length).toBeGreaterThanOrEqual(3);

      const cycleNumbers = snapshot.lunarCycles.map(c => c.cycleNumber);
      expect(cycleNumbers).toContain(1);
      expect(cycleNumbers).toContain(2);
      expect(cycleNumbers).toContain(3);
      expect(cycleNumbers).toContain(4);
    });
  });

  // ─── 2. Derived Attention Graph & Multi-Channel Index ─────────────────────

  describe('2. Derived Attention Graph & Multi-Channel Index', () => {
    it('indexes all nodes and generates inverted, cycle, entity, and relational edge indices', () => {
      expect(index.totalIndexedNodes).toBe(snapshot.totalItems);
      expect(index.lastBuiltAt).toBeDefined();

      // Check entity index
      expect(index.entityIndex.has('alex')).toBe(true);
      expect(index.entityIndex.has('studio')).toBe(true);

      // Check cycle index
      expect(index.cycleIndex.has(1)).toBe(true);
      expect(index.cycleIndex.has(2)).toBe(true);
      expect(index.cycleIndex.has(3)).toBe(true);

      // Check structural relational edges (e.g. echo_grounding_01 connected to loop_writing_01)
      const writingEdges = index.edges.get('loop_writing_01');
      expect(writingEdges).toBeDefined();
      expect(writingEdges.has('echo_grounding_01')).toBe(true);
    });

    it('can be cleanly rebuilt on demand from an updated snapshot without persistent pollution', () => {
      const initialNodeCount = index.totalIndexedNodes;
      expect(initialNodeCount).toBeGreaterThan(0);

      // Rebuild
      index.rebuild(snapshot);
      expect(index.totalIndexedNodes).toBe(initialNodeCount);
      expect(index.lastBuiltAt).toBeDefined();
    });
  });

  // ─── 3. Attention Engine V1 Multi-Channel Planning & Context Packets ──────

  describe('3. Attention Engine V1: Planning, Context Assembly & Legibility', () => {
    it('generates an inspectable AttentionPlan with multi-channel candidate retrieval', async () => {
      const question = 'Where do I currently stand on my creative writing intention this cycle?';
      const { plan, contextPacket } = await engine.planAndAssemble(question, { tokenBudget: 2500 });

      expect(plan.planId).toMatch(/^plan_/);
      expect(plan.question).toBe(question);
      expect(plan.questionClass).toBe('current_state');
      expect(plan.candidatesConsideredCount).toBeGreaterThan(0);
      expect(plan.selectedSources.length).toBeGreaterThan(0);
      expect(plan.channelsUsed.length).toBe(6);

      // Verify channel coverage
      const lexicalChannel = plan.channelsUsed.find(c => c.channel === 'lexical');
      const semanticChannel = plan.channelsUsed.find(c => c.channel === 'semantic');
      expect(lexicalChannel.candidateCount).toBeGreaterThan(0);
      expect(semanticChannel.candidateCount).toBeGreaterThan(0);

      // Verify ContextPacket properties
      expect(contextPacket.packetId).toMatch(/^pkt_/);
      expect(contextPacket.planId).toBe(plan.planId);
      expect(contextPacket.evidenceItems.length).toBe(plan.selectedSources.length);
      expect(contextPacket.totalTokensUsed).toBeLessThanOrEqual(2500);
      expect(contextPacket.formattedPromptContext).toContain('### [ATTENTION ENGINE V1 CONTEXT PACKET:');
      expect(contextPacket.formattedPromptContext).toContain('EVIDENCE SOURCES');
    });

    it('suppresses near-duplicates and records suppression reason in omissions', async () => {
      // Intentionally insert a near-duplicate check-in into snapshot to verify deduplication
      const duplicateItem = {
        id: 'echo_duplicate_01',
        sourceType: 'echo',
        title: 'Mid-summer duplicate check-in',
        content: 'Feeling stuck and overwhelmed by open commitments with Alex and Studio deadlines. Working past midnight again.',
        createdAt: '2026-07-27T00:15:00Z',
        cycleNumber: 2
      };

      const customIndex = new AttentionIndex();
      const customSnapshot = {
        ...snapshot,
        echoes: [...snapshot.echoes, duplicateItem],
        totalItems: snapshot.totalItems + 1
      };
      customIndex.rebuild(customSnapshot);
      const customEngine = new AttentionEngineV1(customIndex);

      const question = 'What happened with Alex and Studio deadlines?';
      const { plan } = await customEngine.planAndAssemble(question, { tokenBudget: 3000 });

      const nearDupOmission = plan.omissionsAndDeduplications.find(o => o.reason === 'near_duplicate');
      expect(nearDupOmission).toBeDefined();
      expect(nearDupOmission.duplicateOf).toBeDefined();
    });

    it('detects discontinuities and preserves counterevidence rather than smoothing it away', async () => {
      const question = 'Trace the progression of my evening screen-free wind-down routine from beginning to present.';
      const { plan, contextPacket } = await engine.planAndAssemble(question, { tokenBudget: 3000 });

      expect(plan.discontinuitiesDetected.length).toBeGreaterThan(0);
      expect(plan.counterevidenceNotes.length).toBeGreaterThan(0);
      expect(contextPacket.coverageMetrics.counterevidenceIncluded).toBe(true);
      expect(contextPacket.formattedPromptContext).toContain('DISCONTINUITY / COUNTEREVIDENCE NOTES:');
      expect(contextPacket.formattedPromptContext).toContain('abandon');
    });

    it('enforces token budget limits and marks surplus items as budget_exceeded', async () => {
      const question = 'Summarize everything about my writing and rest routines.';
      // Very tight token budget of 150 tokens
      const { plan, contextPacket } = await engine.planAndAssemble(question, { tokenBudget: 150 });

      expect(contextPacket.totalTokensUsed).toBeLessThanOrEqual(150);
      const budgetExceeded = plan.omissionsAndDeduplications.filter(o => o.reason === 'budget_exceeded');
      expect(budgetExceeded.length).toBeGreaterThan(0);
    });
  });

  // ─── 4. Canonical 25-Question Benchmark Suite ─────────────────────────────

  describe('4. Canonical 25-Question Benchmark Corpus Coverage', () => {
    it('contains exactly 25 representative Luna longitudinal questions across 7 distinct classes', () => {
      expect(CANONICAL_BENCHMARK_CASES.length).toBe(25);

      const categories = new Set(CANONICAL_BENCHMARK_CASES.map(c => c.category));
      expect(categories).toContain('current_state');
      expect(categories).toContain('recurrence');
      expect(categories).toContain('longitudinal_change');
      expect(categories).toContain('entity_relationship');
      expect(categories).toContain('open_loops');
      expect(categories).toContain('cycle_comparison');
      expect(categories).toContain('insufficient_evidence');

      const negativeControls = CANONICAL_BENCHMARK_CASES.filter(c => c.isNegativeControl);
      expect(negativeControls.length).toBe(4);
    });

    it('explicitly flags absence of evidence on negative control questions without hallucinating', async () => {
      const negativeCase = CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_neg_01'); // Moving to Seattle
      expect(negativeCase.isNegativeControl).toBe(true);

      const { plan, contextPacket } = await engine.planAndAssemble(negativeCase.question, { tokenBudget: 3000 });
      expect(contextPacket.evidenceItems.length).toBe(0);
      expect(contextPacket.formattedPromptContext).toContain('No direct or longitudinal personal Field evidence was found');
      expect(contextPacket.formattedPromptContext).toContain('Acknowledge the absence of prior reflections rather than inventing facts');
    });
  });

  // ─── 5. Tri-Baseline Benchmark Comparison Harness ─────────────────────────

  describe('5. Tri-Baseline Comparison Harness: Control vs Broad vs Engine V1', () => {
    let harness;

    beforeEach(() => {
      harness = new BenchmarkHarness(engine, index, snapshot);
    });

    it('evaluates a question across Control, Broad Context, and Attention Engine V1 baselines holding evidence constant', async () => {
      const benchmarkCase = CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_long_01'); // Rest from Sturgeon Moon to now
      const comparison = await harness.compareQuestion(benchmarkCase.question, {
        benchmarkCase,
        model: 'openrouter-anthropic-sonnet-5'
      });

      expect(comparison.runId).toMatch(/^run_/);
      expect(comparison.question).toBe(benchmarkCase.question);
      expect(comparison.baselines.control).toBeDefined();
      expect(comparison.baselines.broadContext).toBeDefined();
      expect(comparison.baselines.attentionEngineV1).toBeDefined();

      const { control, broadContext, attentionEngineV1 } = comparison.baselines;

      // Attention Engine V1 should achieve superior grounding over Control
      expect(attentionEngineV1.groundingScore).toBeGreaterThan(control.groundingScore);
      expect(attentionEngineV1.temporalSpanDays).toBeGreaterThanOrEqual(45);

      // Attention Engine V1 should have lower false connection risk than naive broad dump
      expect(attentionEngineV1.falseConnectionRisk).toBeLessThan(broadContext.falseConnectionRisk);
    });

    it('demonstrates superior handling of insufficient evidence controls in Engine V1 over Control and Broad', async () => {
      const negativeCase = CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_neg_02'); // Electric car
      const comparison = await harness.compareQuestion(negativeCase.question, {
        benchmarkCase: negativeCase
      });

      const { control, broadContext, attentionEngineV1 } = comparison.baselines;
      expect(attentionEngineV1.insufficientEvidenceRecognized).toBe(true);
      expect(attentionEngineV1.groundingScore).toBeGreaterThanOrEqual(90);
      expect(broadContext.falseConnectionRisk).toBeGreaterThan(40);
    });
  });

  // ─── 6. Durable Lab Store & Session Lifecycle ────────────────────────────

  describe('6. Durable Lab Experiment Session Lifecycle', () => {
    let store;

    beforeEach(() => {
      store = new DurableLabStore();
    });

    it('creates, inspects, and lists experiment sessions with stable IDs', () => {
      const session = store.createSession({
        name: 'Sprint 1 — Recurrence vs Cosine Baseline',
        description: 'Testing recurrence channel weighting',
        hypothesis: 'Recurrence weighting reduces false positive drift by 40%'
      });

      expect(session.id).toMatch(/^sess_lab_/);
      expect(session.name).toBe('Sprint 1 — Recurrence vs Cosine Baseline');
      expect(session.status).toBe('active');

      const retrieved = store.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(session.id);

      const allSessions = store.listSessions();
      expect(allSessions.length).toBeGreaterThanOrEqual(2); // seeded default + new
    });

    it('records comparison runs into an active session and maintains chronological history', () => {
      const session = store.createSession({
        name: 'Benchmark Session',
        description: 'Multi-run record',
        hypothesis: 'Test hypothesis'
      });

      const dummyRun = {
        runId: 'run_test_01',
        sessionId: session.id,
        question: 'Test question',
        category: 'current_state',
        timestamp: new Date().toISOString(),
        model: 'test-model',
        baselines: {
          control: { groundingScore: 50 } ,
          broadContext: { groundingScore: 65 } ,
          attentionEngineV1: { groundingScore: 92 } 
        },
        evaluatorNotes: 'Test note'
      };

      store.recordRun(session.id, dummyRun);
      const updated = store.getSession(session.id);
      expect(updated.runs.length).toBe(1);
      expect(updated.runs[0].runId).toBe('run_test_01');
    });
  });

  // ─── 7. Lunar Lab GPT OpenAPI Specification Compliance ───────────────────

  describe('7. Lunar Lab GPT Actions & OpenAPI 3.0.1 Specification', () => {
    it('exports a compliant OpenAPI 3.0.1 specification tailored for Custom GPT Actions', () => {
      expect(LUNA_LAB_OPENAPI_SPEC.openapi).toBe('3.0.1');
      expect(LUNA_LAB_OPENAPI_SPEC.info.title).toContain('Lunar Lab GPT');
      expect(LUNA_LAB_OPENAPI_SPEC.servers[0].url).toBe('https://loops-production-e1d5.up.railway.app');

      const paths = Object.keys(LUNA_LAB_OPENAPI_SPEC.paths);
      expect(paths).toContain('/api/dev/lab/attention/status');
      expect(paths).toContain('/api/dev/lab/attention/plan');
      expect(paths).toContain('/api/dev/lab/attention/sessions');
      expect(paths).toContain('/api/dev/lab/attention/sessions/{id}');
      expect(paths).toContain('/api/dev/lab/attention/sessions/{id}/run');
      expect(paths).toContain('/api/dev/lab/attention/benchmarks');
      expect(paths).toContain('/api/dev/lab/attention/benchmarks/evaluate');
    });

    it('verifies all operations define explicit operationIds and non-empty schema structures', () => {
      for (const [path, methods] of Object.entries(LUNA_LAB_OPENAPI_SPEC.paths)) {
        for (const [method, op] of Object.entries(methods )) {
          expect(op.operationId).toBeDefined();
          expect(typeof op.operationId).toBe('string');
          expect(op.summary).toBeDefined();
          expect(op.responses['200'] || op.responses['201']).toBeDefined();
        }
      }
    });
  });
});
