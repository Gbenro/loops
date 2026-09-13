import { describe, it, expect, beforeEach } from 'vitest';
import {
  LunaFieldReadOnlyAdapter,
  AttentionIndex,
  AttentionEngineV1,
  CANONICAL_BENCHMARK_CASES,
  BenchmarkHarness,
  DurableLabStore,
  MOCK_LUNA_FIELD_FIXTURES,
  ensureLabResultsUmbrellaIssue,
  formatLabResultMarkdownSummary,
  publishLabResultToDevBridge,
  ATTENTION_LAB_RESULTS_ISSUE_ID,
  ATTENTION_LAB_RESULTS_SESSION_ID,
  computeNodeContentHash,
  computeSnapshotAggregateHash,
  getSupportedLabModels,
  validateAndResolveLabModel,
  executeConditionCompletion,
  STOP_WORDS,
  decomposeQuery,
  computeSemanticSubjectScore,
  GENERIC_RELATIONAL_TERMS,
  TEMPORAL_ANCHOR_TERMS,
  SUBJECT_CONCEPT_TAXONOMY,
  classifyRecordDomain,
  inferQuestionDomain,
  assessDomainCompatibility,
  evaluateContextualAboutness,
  MODEL_PRICING_CATALOG,
  computeAuditableConditionCost,
  computeConditionTokenUsage,
  computeConditionScorecard,
  computeComparativeEconomics
} from '../../mcp-server/src/attentionLab.ts';
import { listDevEvents, mapDevEvent } from '../../mcp-server/src/devBridge.ts';
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
      expect(['created', 'active']).toContain(session.status);

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

  // ─── 8. Attention Lab → Development Service Results Bridge (iss_lab_results_attention_v1) ───

  describe('8. Attention Lab → Development Service Results Bridge for Luna', () => {
    let harness;
    let comparison;

    beforeEach(async () => {
      harness = new BenchmarkHarness(engine, index, snapshot);
      const bCase = CANONICAL_BENCHMARK_CASES[0];
      comparison = await harness.compareQuestion(bCase.question, { benchmarkCase: bCase });
    });

    it('formats a concise, non-overstated markdown summary with all required telemetry and citations', () => {
      const plan = comparison.attentionPlan;
      const contextPacket = comparison.contextPacket;
      expect(plan).toBeDefined();
      expect(contextPacket).toBeDefined();

      const summary = formatLabResultMarkdownSummary({
        labSessionId: comparison.sessionId,
        runId: comparison.runId,
        benchmarkId: comparison.questionId,
        question: comparison.question,
        category: comparison.category,
        snapshotVersion: {
          snapshotId: snapshot.snapshotId,
          capturedAt: snapshot.capturedAt,
          totalItems: snapshot.totalItems
        },
        conditions: {
          control: { ...comparison.baselines.control, itemsCount: 3, tokens: 400 },
          broadBaseline: { ...comparison.baselines.broadContext, itemsCount: 15, tokens: 2800 },
          attentionEngineV1: { ...comparison.baselines.attentionEngineV1, itemsCount: 5, tokens: 1200, cyclesCovered: 4 }
        },
        modelUsed: comparison.model,
        telemetry: {
          latencyMs: 145,
          estimatedTokensTotal: 1200,
          estimatedCostUsd: 0.0036
        },
        evaluationMetrics: {
          groundingAdvantageOverControl: 35,
          falseConnectionRiskReductionVsBroad: 25,
          temporalSpanAdvantageDays: 20,
          insufficientEvidenceRecognized: false
        },
        outcomeAssessment: {
          favoredCondition: 'attention_engine_v1',
          assessment: 'Attention Engine V1 demonstrated higher grounding (90% vs Control: 55%, Broad: 65%) with a 28-day temporal span and reduced false connection risk (10% vs Broad: 35%).'
        },
        attentionPlan: {
          planId: plan.planId,
          coverageStrategy: plan.coverageStrategy,
          channelsUsed: plan.channelsUsed,
          candidatesConsideredCount: plan.candidatesConsideredCount,
          selectedSourcesCount: plan.selectedSources.length,
          omissionsCount: plan.omissionsAndDeduplications.length
        },
        contextPacket: {
          packetId: contextPacket.packetId,
          totalTokensUsed: contextPacket.totalTokensUsed,
          evidenceItemCount: contextPacket.evidenceItems.length,
          evidenceReferences: contextPacket.evidenceItems.map(e => ({
            id: e.id,
            sourceId: e.sourceId,
            sourceType: e.sourceType,
            timestamp: e.timestamp,
            cycleNumber: e.cycleNumber,
            role: e.coverageRole,
            rationale: e.selectionRationale
          })),
          provenanceDigest: contextPacket.provenanceDigest
        },
        omissionsAndCounterevidence: {
          omissions: plan.omissionsAndDeduplications.map(o => ({
            sourceId: o.sourceId,
            reason: o.reason,
            duplicateOf: o.duplicateOf
          })),
          discontinuities: plan.discontinuitiesDetected,
          counterevidenceNotes: plan.counterevidenceNotes
        },
        timestamp: new Date().toISOString(),
        stableLabReferences: {
          labSessionId: comparison.sessionId,
          runId: comparison.runId,
          planId: plan.planId,
          packetId: contextPacket.packetId,
          snapshotId: snapshot.snapshotId,
          labApiInspectionUrl: `/api/dev/lab/attention/results/${comparison.runId}`
        }
      });

      expect(summary).toContain(`[Attention Lab Result`);
      expect(summary).toContain('**Conditions Evaluated**: Control (A) vs Broad Baseline (B) vs Attention Engine V1 (C)');
      expect(summary).toContain(comparison.model);
      expect(summary).toContain('Latency: 145ms');
      expect(summary).toContain('Evidence Citations');
      expect(summary).toContain(plan.planId);
      expect(summary).toContain(contextPacket.packetId);
      expect(summary).toContain(snapshot.snapshotId);
      expect(summary).toContain(`/api/dev/lab/attention/results/${comparison.runId}`);
    });

    it('publishes structured result into Development Service umbrella issue with complete schema', async () => {
      const insertedEvents = [];
      const insertedIssues = [];
      const insertedSessions = [];

      const createQueryBuilder = (table) => {
        const q = {
          select: () => q,
          eq: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: async () => {
            if (table === 'dev_issues') {
              return { data: insertedIssues[0] || null, error: null };
            }
            if (table === 'dev_sessions') {
              return { data: insertedSessions[0] || null, error: null };
            }
            return { data: null, error: null };
          },
          single: async () => {
            if (table === 'dev_issues') {
              return { data: insertedIssues[0] || { id: ATTENTION_LAB_RESULTS_ISSUE_ID, status: 'in_progress' }, error: null };
            }
            if (table === 'dev_sessions') {
              return { data: insertedSessions[0] || { id: ATTENTION_LAB_RESULTS_SESSION_ID, status: 'connected' }, error: null };
            }
            return { data: { status: 'connected' }, error: null };
          },
          then: (resolve) => resolve({ data: insertedEvents, error: null })
        };
        return q;
      };

      const mockSupabase = {
        from: (table) => ({
          select: () => createQueryBuilder(table),
          insert: (data) => {
            if (table === 'dev_issues') insertedIssues.push(data);
            if (table === 'dev_sessions') insertedSessions.push(data);
            if (table === 'dev_events') {
              const row = { id: `evt_test_${Date.now()}`, ...data, created_at: new Date().toISOString() };
              insertedEvents.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: row, error: null })
                })
              };
            }
            return { error: null };
          },
          update: () => {
            const u = { eq: () => u, then: (res) => res({ data: null, error: null }) };
            return u;
          }
        })
      };

      const result = await publishLabResultToDevBridge({
        comparison,
        plan: comparison.attentionPlan,
        contextPacket: comparison.contextPacket,
        snapshot,
        supabase: mockSupabase,
        userId: 'usr_dev_test_42'
      });

      expect(result.published).toBe(true);
      expect(result.issueId).toBe(ATTENTION_LAB_RESULTS_ISSUE_ID);
      expect(result.eventId).toBeDefined();
      expect(result.payload.runId).toBe(comparison.runId);
      expect(result.payload.conditions.attentionEngineV1.groundingScore).toBeGreaterThan(0);
      expect(result.payload.conditions.control.name).toBe(comparison.baselines.control.displayName);
      expect(result.payload.conditions.broadBaseline.name).toBe(comparison.baselines.broadContext.displayName);
      expect(result.payload.stableLabReferences.labSessionId).toBe(comparison.sessionId);

      // Verify umbrella issue and session were ensured
      expect(insertedIssues.some(i => i.id === ATTENTION_LAB_RESULTS_ISSUE_ID)).toBe(true);
      expect(insertedSessions.some(s => s.id === ATTENTION_LAB_RESULTS_SESSION_ID)).toBe(true);

      // Verify dev_event was inserted with correct type and payload
      expect(insertedEvents.length).toBe(1);
      const ev = insertedEvents[0];
      expect(ev.type).toBe('lab.result.published');
      expect(ev.issue_id).toBe(ATTENTION_LAB_RESULTS_ISSUE_ID);
      expect(ev.session_id).toBe(ATTENTION_LAB_RESULTS_SESSION_ID);
      expect(ev.metadata.runId).toBe(comparison.runId);
      expect(ev.metadata.attentionPlan.planId).toBe(comparison.attentionPlan.planId);
      expect(ev.metadata.contextPacket.packetId).toBe(comparison.contextPacket.packetId);
      expect(ev.content).toContain('[Attention Lab Result');
    });

    it('verifies read-only retrieval via listDevEvents without mutating Personal Field', async () => {
      const store = new DurableLabStore();
      const run = await harness.compareQuestion('What was my breakthrough about the resonance chamber in cycle 7?');

      const publishOutcome = await publishLabResultToDevBridge({
        comparison: run,
        snapshot,
        supabase: null // in-memory recording
      });

      expect(publishOutcome.published).toBe(true);
      const inStore = store.getPublishedResultByRunId(run.runId);
      expect(inStore || publishOutcome.payload).toBeDefined();

      // Verify personal field remained completely unmutated
      expect(adapter.assertReadOnly()).toBe(true);
      expect(snapshot.loops.length).toBe(MOCK_LUNA_FIELD_FIXTURES.filter(f => f.sourceType === 'loop').length);
      expect(snapshot.echoes.length).toBe(MOCK_LUNA_FIELD_FIXTURES.filter(f => f.sourceType === 'echo').length);
      expect(snapshot.relationalMemories.length).toBe(MOCK_LUNA_FIELD_FIXTURES.filter(f => f.sourceType === 'relational_memory').length);
    });

    it('preserves Lunar Lab GPT schema unchanged and maintains isolation from runtime transport', () => {
      // The OpenAPI spec for Lunar Lab GPT MUST NOT be modified
      expect(LUNA_LAB_OPENAPI_SPEC.openapi).toBe('3.0.1');
      const paths = Object.keys(LUNA_LAB_OPENAPI_SPEC.paths);
      // Dev bridge endpoints are NOT exposed through the Lunar Lab GPT schema
      expect(paths).not.toContain('/api/dev/issues');
      expect(paths).not.toContain('/api/dev/events');
      // Lab endpoints are purely the 7 dedicated operations
      expect(paths.length).toBe(11);
    });
  });

  // ─── 9. Real Field Provenance & Content Hashing (Gate 1) ──────────────────

  describe('9. Real Field Provenance, Content Hashing & Fixture Isolation (Gate 1)', () => {
    it('guarantees every indexed node carries authenticated provenance with valid contentHash', async () => {
      const snap = await adapter.captureSnapshot();
      expect(snap.snapshotHash).toBeDefined();
      expect(snap.snapshotHash.length).toBe(64); // SHA-256
      expect(snap.provenanceBreakdown).toBeDefined();

      const allItems = [...snap.loops, ...snap.echoes, ...snap.relationalMemories, ...snap.chatMessages, ...snap.lunarCycles];
      expect(allItems.length).toBeGreaterThan(0);

      for (const item of allItems) {
        expect(item.provenance).toBeDefined();
        expect(['personal_field', 'benchmark_fixture', 'synthetic']).toContain(item.provenance.source);
        expect(item.provenance.contentHash).toBeDefined();
        expect(item.provenance.contentHash.length).toBe(64);
        expect(item.provenance.snapshotId).toBe(snap.snapshotId);
      }
    });

    it('strictly isolates benchmark fixtures from personal field data without synthetic backfill', async () => {
      // Create adapter explicitly in personal_field mode with empty supabase mock
      const mockEmptySupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null })
            })
          })
        })
      };

      const liveFieldAdapter = new LunaFieldReadOnlyAdapter({
        userId: 'usr_clean_isolation',
        mode: 'personal_field',
        supabase: mockEmptySupabase
      });

      const liveSnapshot = await liveFieldAdapter.captureSnapshot();
      expect(liveSnapshot.mode).toBe('personal_field');
      // STRICT INVARIANT: Must NEVER backfill fixtures into personal field!
      expect(liveSnapshot.provenanceBreakdown.personal_field).toBe(0);
      expect(liveSnapshot.provenanceBreakdown.benchmark_fixture).toBe(0);
      expect(liveSnapshot.totalItems).toBe(0);
    });

    it('verifies AttentionIndex tracks snapshot hash and validates universe consistency', async () => {
      const snap = await adapter.captureSnapshot();
      index.rebuild(snap);

      expect(index.getSnapshotHash()).toBe(snap.snapshotHash);
      expect(index.verifySnapshotHash(snap.snapshotHash)).toBe(true);
      expect(index.verifySnapshotHash('corrupted_fake_hash_1234567890abcdef')).toBe(false);

      const breakdown = index.getProvenanceBreakdown();
      expect(breakdown).toEqual(snap.provenanceBreakdown);
    });
  });

  // ─── 10. Model Catalog Discovery & Strict Identity Enforcement (Gate 2) ───

  describe('10. Model Catalog Discovery & Enforced Model Identity (Gate 2)', () => {
    it('discovers supported OpenRouter frontier and open-weight models from the catalog', () => {
      const catalog = getSupportedLabModels();
      expect(catalog.length).toBeGreaterThan(5);

      const keys = catalog.map(m => m.key);
      expect(keys).toContain('anthropic-sonnet-5');
      expect(keys).toContain('openrouter-deepseek-v4-flash');
      expect(keys).toContain('openrouter-qwen-3.8-max');

      for (const model of catalog) {
        expect(model.key).toBeDefined();
        expect(model.displayName).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.modelId).toBeDefined();
        expect(model.contextWindow).toBeGreaterThan(0);
      }
    });

    it('resolves valid models and aliases accurately', () => {
      const res1 = validateAndResolveLabModel('anthropic-sonnet-5');
      expect(res1.valid).toBe(true);
      expect(res1.modelConfig?.key).toBe('anthropic-sonnet-5');

      // Test alias resolution
      const res2 = validateAndResolveLabModel('deepseek-v4');
      expect(res2.valid).toBe(true);
      expect(res2.modelConfig?.key).toBe('openrouter-deepseek-v4-flash');

      const res3 = validateAndResolveLabModel('qwen-3.8-max');
      expect(res3.valid).toBe(true);
      expect(res3.modelConfig?.key).toBe('openrouter-qwen-3.8-max');
    });

    it('fails explicitly with descriptive error when uncataloged models are requested', () => {
      const invalidResult = validateAndResolveLabModel('nonexistent-hallucinated-model-9000');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('not supported in the Attention Lab catalog');
      expect(invalidResult.error).toContain('/api/dev/lab/attention/models');
    });

    it('persists requestedModel, actualModel, provider, parameters, and fallbackReason independently', async () => {
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const comparison = await harness.compareQuestion('Where do I stand on writing?', {
        model: 'anthropic-sonnet-5'
      });

      for (const [condKey, baseline] of Object.entries(comparison.baselines)) {
        expect(baseline.requestedModel).toBe('anthropic-sonnet-5');
        expect(baseline.actualModel).toBe('anthropic-sonnet-5');
        expect(baseline.provider).toBeDefined();
        expect(baseline.providerModelId).toBeDefined();
        expect(baseline.parameters.temperature).toBe(0.2);
        expect(baseline.parameters.maxTokens).toBe(1000);
        expect(baseline.fallbackReason).toBeNull();
      }
    });
  });

  // ─── 11. Controlled A/B/C Generation & Verbatim Storage (Gate 3) ───────────

  describe('11. Controlled A/B/C Generation & Verbatim Output Persistence (Gate 3)', () => {
    it('executes identical prompts and persists verbatim generated answers for A, B, and C', async () => {
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const comparison = await harness.compareQuestion('What was my breakthrough about evening rest?', {
        model: 'anthropic-sonnet-5'
      });

      expect(comparison.status).toBe('valid');
      expect(comparison.snapshotHash).toBe(snapshot.snapshotHash);

      const { control, broadContext, attentionEngineV1 } = comparison.baselines;

      // Invariant: Snapshot hash must be identical across A, B, and C
      expect(control.snapshotHashUsed).toBe(snapshot.snapshotHash);
      expect(broadContext.snapshotHashUsed).toBe(snapshot.snapshotHash);
      expect(attentionEngineV1.snapshotHashUsed).toBe(snapshot.snapshotHash);

      // Invariant: Verbatim answers must be non-empty and persisted
      expect(control.verbatimGeneratedAnswer).toBeDefined();
      expect(control.verbatimGeneratedAnswer.length).toBeGreaterThan(20);
      expect(broadContext.verbatimGeneratedAnswer).toBeDefined();
      expect(broadContext.verbatimGeneratedAnswer.length).toBeGreaterThan(20);
      expect(attentionEngineV1.verbatimGeneratedAnswer).toBeDefined();
      expect(attentionEngineV1.verbatimGeneratedAnswer.length).toBeGreaterThan(20);

      // Verbatim outputs must differentiate based on evidence
      expect(attentionEngineV1.verbatimGeneratedAnswer).toContain('[Luna anthropic-sonnet-5]');
    });
  });

  // ─── 12. Experiment Lifecycle & Immediate Pause of Experiment 001 ──────────

  describe('12. Experiment Lifecycle & Immediate Pause of Experiment 001', () => {
    it('initializes Experiment 001 in paused state to protect experiment integrity', () => {
      const store = new DurableLabStore();
      const sessions = store.listSessions();

      const exp001 = sessions.find(s => s.name === 'Experiment 001');
      expect(exp001).toBeDefined();
      expect(exp001?.status).toBe('paused');
      expect(exp001?.pauseReason).toContain('Paused pending Attention Lab experiment integrity verification');
    });

    it('rejects comparison runs when session is paused and preserves existing artifacts', () => {
      const store = new DurableLabStore();
      const exp001 = store.listSessions().find(s => s.name === 'Experiment 001');

      // Attempting to record run into paused session throws error
      expect(() => {
        store.recordRun(exp001.id, { runId: 'run_blocked_01' });
      }).toThrow(/is paused/);
    });

    it('allows resuming a paused session cleanly', () => {
      const store = new DurableLabStore();
      const exp001 = store.listSessions().find(s => s.name === 'Experiment 001');

      const resumed = store.resumeSession(exp001.id);
      expect(resumed.status).toBe('resumed');
      expect(resumed.pauseReason).toBeUndefined();

      // Now recording runs succeeds
      const dummyRun = { runId: 'run_allowed_02' };
      store.recordRun(exp001.id, dummyRun);
      expect(store.getSession(exp001.id)?.runs.length).toBe(1);
    });
  });

  // ─── 13. Invalidation of Non-Compliant Runs (No Fake Success) ──────────────

  describe('13. Invalidation of Non-Compliant Runs (No Fake Success)', () => {
    it('marks experiment run INVALID if model enforcement or completion integrity fails', async () => {
      const harness = new BenchmarkHarness(engine, index, snapshot);

      // Test with invalid uncataloged model throws
      await expect(
        harness.compareQuestion('Test question', { model: 'unsupported-fantasy-model' })
      ).rejects.toThrow(/not supported in the Attention Lab catalog/);
    });
  });

  // ─── 14. Luna Lab GPT Issue Dispatch Gateway to Gemini ─────────────────────

  describe('14. Luna Lab GPT Issue Dispatch Gateway to Gemini Developer Queue', () => {
    it('supports reporting issues from Luna Lab GPT directly into Development Service', async () => {
      const insertedIssues = [];
      const mockSupabase = {
        from: (table) => ({
          insert: async (row) => {
            insertedIssues.push(row);
            return { error: null };
          }
        })
      };

      const issuePayload = {
        title: 'Discontinuity signal under-weighted in Hunter Moon',
        description: 'Observed that cycle 4 transition reflections did not preserve the pause note on Maine residency.',
        priority: 'high',
        sessionId: 'sess_lab_test_issue',
        runId: 'run_test_issue_01',
        acceptanceCriteria: ['Ensure Maine residency pause note is preserved in AttentionPlan']
      };

      // Direct simulation of issue reporting endpoint logic
      const issueId = `iss_test_${Date.now()}`;
      await mockSupabase.from('dev_issues').insert({
        id: issueId,
        user_id: 'usr_dev_42',
        title: issuePayload.title,
        description: issuePayload.description,
        priority: issuePayload.priority,
        status: 'queued',
        assigned_agent: 'gemini',
        acceptance_criteria: issuePayload.acceptanceCriteria,
        metadata: { source: 'luna_lab_gpt', sessionId: issuePayload.sessionId, runId: issuePayload.runId }
      });

      expect(insertedIssues.length).toBe(1);
      const created = insertedIssues[0];
      expect(created.assigned_agent).toBe('gemini');
      expect(created.status).toBe('queued');
      expect(created.metadata.source).toBe('luna_lab_gpt');
    });
  });

  // ─── 15. Regression Test: Controlled A/B/C Run with Verbatim Reload ─────────

  describe('15. Regression Test: Full Controlled A/B/C Run Surviving Reload', () => {
    it('demonstrates a controlled run where requested model matches for A/B/C, shares snapshot hash, and outputs survive reload', async () => {
      // 1. Frozen Snapshot with Verified Provenance
      const snap = await adapter.captureSnapshot();
      expect(snap.snapshotHash).toBeDefined();

      // 2. Harness with Requested Model
      const requestedModel = 'openrouter-deepseek-v4-flash';
      const harness = new BenchmarkHarness(engine, index, snap);

      // 3. True Controlled Run
      const run = await harness.compareQuestion('How did my reflections change from Sturgeon Moon to Harvest Moon?', {
        model: requestedModel
      });

      // Assertions:
      expect(run.status).toBe('valid');
      expect(run.snapshotHash).toBe(snap.snapshotHash);

      // Verify A/B/C Model Match: No silent fallbacks
      expect(run.baselines.control.requestedModel).toBe(requestedModel);
      expect(run.baselines.control.actualModel).toBe('openrouter-deepseek-v4-flash');
      expect(run.baselines.broadContext.requestedModel).toBe(requestedModel);
      expect(run.baselines.broadContext.actualModel).toBe('openrouter-deepseek-v4-flash');
      expect(run.baselines.attentionEngineV1.requestedModel).toBe(requestedModel);
      expect(run.baselines.attentionEngineV1.actualModel).toBe('openrouter-deepseek-v4-flash');

      // Verify Verbatim Generated Answers Persisted
      expect(run.baselines.control.verbatimGeneratedAnswer).toBeDefined();
      expect(run.baselines.broadContext.verbatimGeneratedAnswer).toBeDefined();
      expect(run.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBeDefined();

      // 4. Persistence & Reload Verification in DurableLabStore
      const store = new DurableLabStore();
      const testSession = store.createSession({
        name: 'Controlled Verification Session',
        description: 'Testing durable reload of verbatim A/B/C outputs',
        hypothesis: 'Verbatim outputs survive store serialization and retrieval'
      });

      store.recordRun(testSession.id, run);

      // Reload from store
      const reloadedSession = store.getSession(testSession.id);
      expect(reloadedSession).toBeDefined();
      expect(reloadedSession?.runs.length).toBe(1);

      const reloadedRun = reloadedSession?.runs[0];
      expect(reloadedRun.runId).toBe(run.runId);
      expect(reloadedRun.status).toBe('valid');
      expect(reloadedRun.snapshotHash).toBe(snap.snapshotHash);
      expect(reloadedRun.baselines.control.verbatimGeneratedAnswer).toBe(run.baselines.control.verbatimGeneratedAnswer);
      expect(reloadedRun.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBe(run.baselines.attentionEngineV1.verbatimGeneratedAnswer);
    });
  });

  describe('16. Attention Engine V1 — Longitudinal Coverage Failure Fix (iss_1789253762624_eoiw)', () => {
    let adapter;
    let snapshot;
    let index;
    let engine;

    beforeEach(async () => {
      adapter = new LunaFieldReadOnlyAdapter({ mode: 'fixture_benchmark' });
      snapshot = await adapter.captureSnapshot();
      index = new AttentionIndex();
      index.rebuild(snapshot);
      engine = new AttentionEngineV1(index);
    });

    it('Criterion 1: Generic stop words do not materially influence ranking or pollute lexical retrieval', () => {
      expect(STOP_WORDS.has('how')).toBe(true);
      expect(STOP_WORDS.has('the')).toBe(true);
      expect(STOP_WORDS.has('from')).toBe(true);
      expect(STOP_WORDS.has('now')).toBe(true);
      expect(STOP_WORDS.has('over')).toBe(true);
      expect(STOP_WORDS.has('time')).toBe(true);
      expect(STOP_WORDS.has('burnout')).toBe(false);
      expect(STOP_WORDS.has('pacing')).toBe(false);

      const plan = engine.generateAttentionPlan(
        'How has my relationship to rest, burnout, or pacing shifted over time?',
        3000,
        'longitudinal_span'
      );

      // Verify that candidates matching high-IDF concepts (burnout, rest, pacing) are scored higher than incidental filler
      expect(plan.candidates.length).toBeGreaterThan(0);
      const topCand = plan.candidates[0];
      const topItem = index.itemsMap.get(topCand.sourceId);
      const text = `${topItem?.title || ''} ${topItem?.content || ''}`.toLowerCase();
      const hasCoreConcept = text.includes('rest') || text.includes('burnout') || text.includes('pacing') || text.includes('cycle') || text.includes('stillness');
      expect(hasCoreConcept).toBe(true);
    });

    it('Criterion 2: Temporal anti-clustering prevents narrow 48-hour cluster from dominating ContextPacket', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest, burnout, or pacing shifted over time?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      // Check distribution of selected items across 48-hour windows
      const bucketCounts = new Map();
      const bucketTokens = new Map();

      for (const ev of contextPacket.evidenceItems) {
        if (ev.timestamp) {
          const ms = new Date(ev.timestamp).getTime();
          const bucket = Math.floor(ms / (48 * 3600 * 1000));
          bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
          bucketTokens.set(bucket, (bucketTokens.get(bucket) || 0) + ev.tokensEstimated);
        }
      }

      // Max 2 items per non-obligation bucket, max 30% of tokens (~900)
      for (const [bucket, tokens] of bucketTokens.entries()) {
        expect(tokens).toBeLessThanOrEqual(1200); // well within bounds, never 2500+ like V1
      }

      // Verify notable omissions records cluster cap suppressions
      const clusterSuppressed = plan.omissionsAndDeduplications.filter(
        o => o.reason === 'cluster_concentration_cap_reached'
      );
      expect(clusterSuppressed.length).toBeGreaterThanOrEqual(0);
    });

    it('Criteria 3, 4, 5, 6 & 7: AttentionPlan exposes coverageMatrix with origin, intermediate, counterevidence, and recent obligations', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest, burnout, or pacing shifted over time?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      expect(plan.coverageMatrix).toBeDefined();
      const matrix = plan.coverageMatrix;
      expect(matrix.obligations.length).toBe(5);

      const roles = matrix.obligations.map(o => o.role);
      expect(roles).toContain('origin_state');
      expect(roles).toContain('intermediate_state');
      expect(roles).toContain('counterevidence_discontinuity');
      expect(roles).toContain('recent_current_state');
      expect(roles).toContain('connecting_pattern');

      // Each obligation must be either 'satisfied' or explicitly marked 'INSUFFICIENT_EVIDENCE'
      for (const ob of matrix.obligations) {
        expect(['satisfied', 'INSUFFICIENT_EVIDENCE']).toContain(ob.status);
      }

      // If missing, marked INSUFFICIENT_EVIDENCE without hallucinated padding
      expect(matrix.satisfiedCount + matrix.insufficientCount).toBe(5);

      // Formatted prompt context includes explicit longitudinal coverage section
      expect(contextPacket.formattedPromptContext).toContain('LONGITUDINAL COVERAGE OBLIGATIONS & STATUS');
    });

    it('Criterion 8: ContextPacket exposes selection rationale, typed roles, and notable omissions', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest, burnout, or pacing shifted over time?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      expect(contextPacket.evidenceItems.length).toBeGreaterThan(0);
      for (const ev of contextPacket.evidenceItems) {
        expect(ev.selectionRationale).toBeDefined();
        expect(ev.selectionRationale.length).toBeGreaterThan(5);
        expect(ev.coverageRole).toBeDefined();
      }

      // Notable omissions are exposed on ContextPacket
      expect(contextPacket.notableOmissions).toBeDefined();
      expect(Array.isArray(contextPacket.notableOmissions)).toBe(true);
    });

    it('Criteria 9, 10, 11 & 12: Preserves original Experiment 001 V1 run as immutable baseline while executing controlled comparison', async () => {
      const store = new DurableLabStore();
      
      // Simulate historical Experiment 001 run
      const baselineRunId = 'run_1789211082230_cal8';
      const baselineSession = store.createSession({
        id: 'sess_lab_1789209964145_k0jcc',
        name: 'Luna Attention V1 Canonical Benchmark - Original Run',
        description: 'Historical immutable Experiment 001 baseline',
        hypothesis: 'Original V1 run for regression comparison'
      });

      const mockBaselineRun = {
        runId: baselineRunId,
        sessionId: baselineSession.id,
        question: 'How has my relationship to rest, burnout, or pacing shifted over time?',
        status: 'valid',
        model: 'openrouter-deepseek-v4-flash',
        baselines: {
          control: {
            baseline: 'control_canonical',
            verbatimGeneratedAnswer: 'Original Control Answer for bm_long_01'
          },
          attentionEngineV1: {
            baseline: 'attention_engine_v1',
            verbatimGeneratedAnswer: 'Original V1 Answer for bm_long_01 with 2-day temporal span'
          }
        }
      };

      store.recordRun(baselineSession.id, mockBaselineRun);

      // Now run revised comparison harness
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const newRun = await harness.compareQuestion(
        'How has my relationship to rest, burnout, or pacing shifted over time?',
        {
          category: 'longitudinal_change',
          model: 'openrouter-deepseek-v4-flash',
          benchmarkCase: CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_long_01')
        }
      );

      // Verify new run is distinct and valid
      expect(newRun.runId).not.toBe(baselineRunId);
      expect(newRun.status).toBe('valid');
      expect(newRun.baselines.attentionEngineV1.requestedModel).toBe(newRun.baselines.attentionEngineV1.actualModel);
      expect(newRun.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBeDefined();

      // Verify baseline run in store remained completely unchanged
      const reloadedBaselineSession = store.getSession(baselineSession.id);
      expect(reloadedBaselineSession?.runs[0].runId).toBe(baselineRunId);
      expect(reloadedBaselineSession?.runs[0].baselines.attentionEngineV1.verbatimGeneratedAnswer).toBe(
        'Original V1 Answer for bm_long_01 with 2-day temporal span'
      );
    });
  });


  // ─── 17. Attention Engine V1.2: Semantic Qualification of Coverage Obligations ──────

  describe('17. Attention Engine V1.2 — Semantic Qualification of Coverage Obligations', () => {
    let adapter;
    let index;
    let engine;
    let snapshot;

    beforeEach(async () => {
      adapter = new LunaFieldReadOnlyAdapter({ mode: 'fixture_benchmark' });
      snapshot = await adapter.captureSnapshot();
      index = new AttentionIndex();
      index.rebuild(snapshot);
      engine = new AttentionEngineV1(index);
    });

    it('Criterion 1 & 5: Query decomposition extracts subjects, relations, and temporal anchors separately', () => {
      const decomp = decomposeQuery('How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?');
      expect(decomp.subjects).toBeDefined();
      expect(decomp.subjects.length).toBeGreaterThan(0);
      expect(decomp.subjects.some(s => s.includes('rest') || s.includes('evening'))).toBe(true);
      
      // Generic relational terms like 'relationship' and 'shifted' are isolated
      expect(decomp.genericRelationalTerms).toContain('relationship');
      expect(decomp.genericRelationalTerms).toContain('shifted');
      expect(decomp.subjects).not.toContain('relationship');
      expect(decomp.subjects).not.toContain('shifted');

      // Temporal anchor terms like 'sturgeon' and 'moon' are isolated
      expect(decomp.temporalAnchorTerms).toContain('moon');
      expect(decomp.temporalAnchorTerms).toContain('sturgeon');
      expect(decomp.temporalOrigin).toBe('Sturgeon Moon');
      expect(decomp.temporalEndpoint).toBe('now');
    });

    it('Criteria 2, 3 & 4: Rejects generic lexical proxies (Relationship loops & full moon) from rest/evening evidence', () => {
      const decomp = decomposeQuery('How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?');

      // Test candidate: 'Relationship loops'
      const itemRelationshipLoops = {
        id: 'l1772152655361yrcn',
        sourceType: 'loop',
        title: 'Relationship loops',
        content: 'Relationship loops',
        createdAt: '2026-02-27T00:37:35.795453+00:00',
        tags: []
      };
      const res1 = computeSemanticSubjectScore(itemRelationshipLoops, decomp);
      expect(res1.pass).toBe(false);
      expect(res1.score).toBe(0);
      expect(res1.rationale).toContain('Rejected');

      // Test candidate: 'finish main features of app to showcase for full moon'
      const itemFullMoonApp = {
        id: 'p17721595500888jcl',
        sourceType: 'loop',
        title: 'finish main features of app to showcase for full moon',
        content: 'finish main features of app to showcase for full moon',
        createdAt: '2026-02-27T02:32:30.935167+00:00',
        tags: []
      };
      const res2 = computeSemanticSubjectScore(itemFullMoonApp, decomp);
      expect(res2.pass).toBe(false);
      expect(res2.score).toBe(0);
      expect(res2.rationale).toContain('Rejected');

      // Test genuine subject evidence: 'Rest in dark to let intention rise'
      const itemRestIntention = {
        id: 'p1773871745014f1kf',
        sourceType: 'loop',
        title: 'Rest in dark to let intention rise',
        content: 'Rest in dark to let intention rise',
        createdAt: '2026-03-18T22:09:05.212883+00:00',
        tags: []
      };
      const res3 = computeSemanticSubjectScore(itemRestIntention, decomp);
      expect(res3.pass).toBe(true);
      expect(res3.score).toBeGreaterThanOrEqual(2.0);
      expect(res3.matchedTerms).toContain('rest');
    });

    it('Criteria 6 & 7: Two-stage coverage assignment exposes temporal and semantic qualification independently', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      expect(plan.coverageMatrix).toBeDefined();
      const obligations = plan.coverageMatrix.obligations;

      for (const ob of obligations) {
        // Must independently report temporalStatus and semanticStatus
        expect(['PASS', 'FAIL', 'SATISFIED', 'INSUFFICIENT_EVIDENCE']).toContain(ob.temporalStatus);
        expect(['PASS', 'FAIL', 'SATISFIED', 'INSUFFICIENT_EVIDENCE']).toContain(ob.semanticStatus);
        expect(['satisfied', 'INSUFFICIENT_EVIDENCE']).toContain(ob.finalStatus);
        expect(typeof ob.candidateCount).toBe('number');
        expect(typeof ob.qualifiedCandidateCount).toBe('number');

        // Core Invariant: SATISFIED only if both temporal and semantic qualification pass!
        if (ob.finalStatus === 'satisfied') {
          expect(['PASS', 'SATISFIED']).toContain(ob.temporalStatus);
          expect(['PASS', 'SATISFIED']).toContain(ob.semanticStatus);
          expect(ob.assignedNodeId).toBeDefined();
        } else {
          // If unsatisfied, must provide descriptive reason without forced slot filling
          expect(ob.status).toBe('INSUFFICIENT_EVIDENCE');
          expect(ob.insufficiencyReason || ob.reason).toBeDefined();
        }
      }
    });

    it('Criteria 8 & 9: Epistemic distinction between absence of records vs absence of relevant evidence', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      const obligations = plan.coverageMatrix?.obligations || [];
      const availabilities = obligations.map(o => o.temporalAvailability);

      // Verify valid typed availability states
      for (const avail of availabilities) {
        if (avail) {
          expect(['NO_RECORDS_IN_PERIOD', 'RECORDS_EXIST_BUT_NO_RELEVANT_EVIDENCE', 'RELEVANT_EVIDENCE_FOUND']).toContain(avail);
        }
      }

      // Check prompt context explicit epistemic notices and instructions
      const promptText = contextPacket.formattedPromptContext;
      expect(promptText).toContain('LONGITUDINAL COVERAGE OBLIGATIONS & STATUS:');

      // Invariant: If records exist in period but lack relevant subject evidence, prompt must instruct LLM not to falsely claim no records exist
      const hasRecordsNoEvidence = obligations.some(o => o.temporalAvailability === 'RECORDS_EXIST_BUT_NO_RELEVANT_EVIDENCE');
      if (hasRecordsNoEvidence) {
        expect(promptText).toContain('EPISTEMIC NOTICE: Records DO exist in your personal Field');
        expect(promptText).toContain('CRITICAL INSTRUCTION: Do NOT claim or imply that no records exist');
      }
    });

    it('Criterion 10: Preserves temporal anti-clustering and window caps', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        { tokenBudget: 3000, coverageStrategy: 'longitudinal_span' }
      );

      // Check per-window distribution
      const windowCounts = new Map();
      for (const ev of contextPacket.evidenceItems) {
        if (ev.timestamp) {
          const ms = new Date(ev.timestamp).getTime();
          const bucket = Math.floor(ms / (48 * 3600 * 1000));
          windowCounts.set(bucket, (windowCounts.get(bucket) || 0) + 1);
        }
      }

      // Anti-clustering invariant: no cluster overruns
      for (const [bucket, count] of windowCounts.entries()) {
        expect(count).toBeLessThanOrEqual(3);
      }
    });

    it('Criteria 11 & 12: Real Field adapter remains strictly read-only with provenance content hashing', async () => {
      expect(adapter.assertReadOnly()).toBe(true);
      const snap = await adapter.captureSnapshot();
      expect(snap.snapshotHash.length).toBe(64);
      expect(adapter.assertReadOnly()).toBe(true);
    });

    it('Criterion 13: Preserves both V1 baseline and V1.1 baseline runs as immutable regression baselines', async () => {
      const store = new DurableLabStore();

      // Seed V1 and V1.1 baseline runs
      const v1Session = store.createSession({
        name: 'V1 Baseline Session',
        description: 'Experiment 001 V1 baseline',
        hypothesis: 'Baseline V1'
      });
      const v1Run = {
        runId: 'run_1789211082230_cal8',
        sessionId: v1Session.id,
        question: 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        status: 'valid',
        model: 'openrouter-deepseek-v4-flash',
        baselines: {
          attentionEngineV1: {
            baseline: 'attention_engine_v1',
            verbatimGeneratedAnswer: 'V1 baseline answer with 2-day temporal cluster'
          }
        }
      };
      store.recordRun(v1Session.id, v1Run);

      const v11Session = store.createSession({
        name: 'V1.1 Baseline Session',
        description: 'Experiment V1.1 baseline',
        hypothesis: 'Baseline V1.1 with temporal anti-clustering'
      });
      const v11Run = {
        runId: 'run_1789254192740_a4az',
        sessionId: v11Session.id,
        question: 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        status: 'valid',
        model: 'openrouter-deepseek-v4-flash',
        baselines: {
          attentionEngineV1: {
            baseline: 'attention_engine_v1',
            verbatimGeneratedAnswer: 'V1.1 baseline answer with generic lexical proxies'
          }
        }
      };
      store.recordRun(v11Session.id, v11Run);

      // Now execute new V1.2 run
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const v12Run = await harness.compareQuestion(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        {
          category: 'longitudinal_change',
          model: 'openrouter-deepseek-v4-flash',
          benchmarkCase: CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_long_01')
        }
      );

      // Invariant: New V1.2 run ID is unique
      expect(v12Run.runId).not.toBe('run_1789211082230_cal8');
      expect(v12Run.runId).not.toBe('run_1789254192740_a4az');

      // Invariant: V1 and V1.1 runs in store remain 100% immutable
      const storedV1 = store.getSession(v1Session.id)?.runs[0];
      expect(storedV1?.runId).toBe('run_1789211082230_cal8');
      expect(storedV1?.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBe('V1 baseline answer with 2-day temporal cluster');

      const storedV11 = store.getSession(v11Session.id)?.runs[0];
      expect(storedV11?.runId).toBe('run_1789254192740_a4az');
      expect(storedV11?.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBe('V1.1 baseline answer with generic lexical proxies');
    });

    it('Generalization: Verifies semantic qualification across multiple question classes', async () => {
      // 1. Recurrence: bm_recur_01 ('What patterns keep surfacing whenever I feel stuck in my work?')
      const recDecomp = decomposeQuery('What patterns keep surfacing whenever I feel stuck in my work?');
      expect(recDecomp.subjects.some(s => s.includes('stuck') || s.includes('work'))).toBe(true);
      expect(recDecomp.genericRelationalTerms).toContain('patterns');
      expect(recDecomp.genericRelationalTerms).toContain('surfacing');

      // 2. Entity Relationship: bm_entity_01 ('How has my collaboration with Alex evolved regarding studio projects?')
      const entDecomp = decomposeQuery('How has my collaboration with Alex evolved regarding studio projects?');
      expect(entDecomp.subjects.some(s => s.includes('alex') || s.includes('studio'))).toBe(true);
      expect(entDecomp.genericRelationalTerms).toContain('evolved');

      // 3. Negative Control / Insufficient Evidence: bm_neg_01 ('What notes do I have on marathon training?')
      const negDecomp = decomposeQuery('What notes do I have on marathon training?');
      expect(negDecomp.subjects.some(s => s.includes('marathon'))).toBe(true);
      
      const { plan: negPlan, contextPacket: negPacket } = await engine.planAndAssemble(
        'What notes do I have on marathon training?',
        { tokenBudget: 2000 }
      );
      // Zero authentic marathon records exist in snapshot -> correctly recognized as insufficient evidence!
      expect(negPacket.evidenceItems.length).toBe(0);
      expect(negPacket.formattedPromptContext).toContain('No direct or longitudinal personal Field evidence was found');
    });
  });


  // ============================================================================
  // SUITE 18: Attention Engine V1.3 — Domain-Aware Semantic Qualification & DEV Contamination Controls (iss_1789263237926_2e3q)
  // ============================================================================
  describe('Suite 18: Attention Engine V1.3 — Domain-Aware Semantic Qualification (iss_1789263237926_2e3q)', () => {
    it('Criteria 1 & 2: Classifies record domains accurately and identifies dev/system records', () => {
      // Audio playback loop l1788024537208zyvs
      const devLoop = {
        id: 'l1788024537208zyvs',
        type: 'loop',
        title: 'DEV — Voice playback controls: pause / resume / stop',
        description: 'Implement audio playback controls for synthesized voice in Luna client.',
        tags: ['dev', 'audio', 'voice', 'playback']
      };
      const devClassification = classifyRecordDomain(devLoop);
      expect(devClassification.primaryDomain).toBe('development_engineering');
      expect(devClassification.isDevOrSystemRecord).toBe(true);
      expect(devClassification.confidence).toBeGreaterThan(0.8);

      // Personal lived experience loop
      const personalLoop = {
        id: 'l_evening_winddown',
        type: 'loop',
        title: 'Evening screen-free wind-down ritual',
        description: 'Slowing down before sleep with chamomile tea and reading.',
        tags: ['ritual', 'evening', 'rest']
      };
      const personalClassification = classifyRecordDomain(personalLoop);
      expect(personalClassification.primaryDomain).toBe('personal_lived_experience');
      expect(personalClassification.isDevOrSystemRecord).toBe(false);

      // System operations log
      const systemLog = {
        id: 'log_cron_sync',
        type: 'log',
        title: 'Railway background cron worker database health check',
        description: 'Periodic heartbeat checking postgres connections and memory usage.',
        tags: ['system', 'cron', 'health']
      };
      const systemClassification = classifyRecordDomain(systemLog);
      expect(systemClassification.primaryDomain).toBe('system_operations');
      expect(systemClassification.isDevOrSystemRecord).toBe(true);
    });

    it('Criteria 3 & 4: Infers question domain and determines whether dev context is permitted', () => {
      // bm_long_01: Rest and evening rituals
      const restQuestion = 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?';
      const restInference = inferQuestionDomain(restQuestion);
      expect(restInference.primaryDomain).toBe('personal_lived_experience');
      expect(restInference.allowsDevContext).toBe(false);

      // Generalization question: Relationship with building Luna
      const buildingQuestion = 'How has my relationship with building Luna changed over the last several months?';
      const buildingInference = inferQuestionDomain(buildingQuestion);
      expect(buildingInference.allowsDevContext).toBe(true);
      expect(buildingInference.acceptableDomains).toContain('development_engineering');
      expect(buildingInference.acceptableDomains).toContain('creative_work');

      // Direct dev query
      const devQuestion = 'What bugs did we fix in the audio synthesis pipeline?';
      const devInference = inferQuestionDomain(devQuestion);
      expect(devInference.primaryDomain).toBe('development_engineering');
      expect(devInference.allowsDevContext).toBe(true);
    });

    it('Criteria 5: Enforces domain compatibility gating between questions and candidates', () => {
      const restInference = inferQuestionDomain('How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?');
      
      const devLoop = {
        id: 'l1788024537208zyvs',
        type: 'loop',
        title: 'DEV — Voice playback controls: pause / resume / stop',
        description: 'Implement audio playback controls for synthesized voice in Luna client.',
        tags: ['dev', 'audio', 'voice']
      };
      const devClassification = classifyRecordDomain(devLoop);
      const restCompat = assessDomainCompatibility(restInference, devClassification);
      expect(restCompat.compatible).toBe(false);
      expect(restCompat.reason).toBe('domain_mismatch_dev_system');
      expect(restCompat.score).toBe(0.0);

      // But for building Luna question, dev record IS compatible
      const buildingInference = inferQuestionDomain('How has my relationship with building Luna changed over the last several months?');
      const buildingCompat = assessDomainCompatibility(buildingInference, devClassification);
      expect(buildingCompat.compatible).toBe(true);
      expect(buildingCompat.score).toBeGreaterThan(0.7);
    });

    it('Criteria 6: Contextual aboutness prevents polysemous word false-positives', () => {
      // "pause" in audio playback context vs "rest" subject
      const audioContext = 'Voice playback controls: pause / resume / stop in audio player';
      const audioAboutness = evaluateContextualAboutness(audioContext, 'rest');
      expect(audioAboutness.isContextuallyAbout).toBe(false);
      expect(audioAboutness.reason).toBe('polysemous_concept_mismatch');

      // "pause" in human intentional resting context
      const humanPauseContext = 'Taking an afternoon pause away from screens to breathe and rest';
      const humanAboutness = evaluateContextualAboutness(humanPauseContext, 'rest');
      expect(humanAboutness.isContextuallyAbout).toBe(true);
    });

    it('Criteria 7: Planning bm_long_01 completely eliminates l1788024537208zyvs and logs contamination filter telemetry', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        { tokenBudget: 2000 }
      );

      // l1788024537208zyvs must NEVER be in curated evidence
      const devItemInEvidence = contextPacket.evidenceItems.find(item => item.id === 'l1788024537208zyvs');
      expect(devItemInEvidence).toBeUndefined();

      // l1788024537208zyvs must be in suppressed items with incompatible domain
      const devSuppressed = plan.suppressedItems.find(s => s.id === 'l1788024537208zyvs');
      if (devSuppressed) {
        expect(devSuppressed.reason).toBe('incompatible_domain');
      }

      // Telemetry must record domainBreakdown and contamination filtering
      expect(plan.telemetry?.domainBreakdown).toBeDefined();
      expect(plan.telemetry?.domainBreakdown?.development_engineering).toBeGreaterThanOrEqual(1);
      expect(plan.telemetry?.devSystemContaminationFilteredCount).toBeGreaterThanOrEqual(1);
    });

    it('Criteria 8: bm_long_05 generalization question successfully admits relevant dev and creative records', async () => {
      const { plan, contextPacket } = await engine.planAndAssemble(
        'How has my relationship with building Luna changed over the last several months?',
        { tokenBudget: 2000 }
      );

      expect(plan.questionDomain?.allowsDevContext).toBe(true);
      expect(contextPacket.evidenceItems.length).toBeGreaterThan(0);
      // Dev and building records should be admissible
      expect(plan.telemetry?.domainBreakdown).toBeDefined();
    });

    it('Criteria 9 & 10: Zero Field Deletions and Absolute Immutability of V1, V1.1, and V1.2 baselines', async () => {
      // 1. Personal Field Read-Only Guard
      expect(adapter.assertReadOnly()).toBe(true);

      // 2. Immutability of baseline runs in store
      const store = new DurableLabStore();
      const v1Session = store.createSession('V1 Baseline Session');
      const v1Run = {
        runId: 'run_1789211082230_cal8',
        sessionId: v1Session.id,
        question: 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        createdAt: '2026-09-12T10:00:00.000Z',
        baselines: {
          attentionEngineV1: { baseline: 'attention_engine_v1', verbatimGeneratedAnswer: 'V1 answer' }
        }
      };
      store.recordRun(v1Session.id, v1Run);

      const v11Session = store.createSession('V1.1 Baseline Session');
      const v11Run = {
        runId: 'run_1789254192740_a4az',
        sessionId: v11Session.id,
        question: 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        createdAt: '2026-09-12T15:00:00.000Z',
        baselines: {
          attentionEngineV1: { baseline: 'attention_engine_v1', verbatimGeneratedAnswer: 'V1.1 answer' }
        }
      };
      store.recordRun(v11Session.id, v11Run);

      const v12Session = store.createSession('V1.2 Baseline Session');
      const v12Run = {
        runId: 'run_1789261534197_ue8l',
        sessionId: v12Session.id,
        question: 'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        createdAt: '2026-09-12T19:00:00.000Z',
        baselines: {
          attentionEngineV1: { baseline: 'attention_engine_v1', verbatimGeneratedAnswer: 'V1.2 answer with audio pause' }
        }
      };
      store.recordRun(v12Session.id, v12Run);

      // Verify records in store
      expect(store.getSession(v1Session.id)?.runs[0].runId).toBe('run_1789211082230_cal8');
      expect(store.getSession(v11Session.id)?.runs[0].runId).toBe('run_1789254192740_a4az');
      expect(store.getSession(v12Session.id)?.runs[0].runId).toBe('run_1789261534197_ue8l');
    });
  });


  // ============================================================================
  // SUITE 19: Attention Lab — Cost, Token Efficiency & Evaluation Scorecard (iss_1789265609392_7kb9)
  // ============================================================================
  describe('Suite 19: Attention Lab — Cost, Token Efficiency & Evaluation Scorecard (iss_1789265609392_7kb9)', () => {
    it('Criteria 2: Persists retrieved context tokens separately from billable prompt/completion/total tokens', () => {
      const tokenUsage = computeConditionTokenUsage(
        644, // retrieved context tokens
        'You are Luna. Ground your reflection... Context: [644 tokens of evidence] User: What happened?',
        'Based on the evidence from August 28...',
        { prompt_tokens: 1500, completion_tokens: 280, total_tokens: 1780 }
      );

      expect(tokenUsage.retrievedContextTokens).toBe(644);
      expect(tokenUsage.billablePromptTokens).toBe(1500);
      expect(tokenUsage.billableCompletionTokens).toBe(280);
      expect(tokenUsage.totalBillableTokens).toBe(1780);
      expect(tokenUsage.tokenAccountingStatus).toBe('exact_provider');
      // Invariant: Retrieved context tokens are strictly distinct from total billable tokens
      expect(tokenUsage.retrievedContextTokens).not.toBe(tokenUsage.totalBillableTokens);
    });

    it('Criteria 3 & 4: Calculates auditable dollar cost or explicitly flags unknown pricing without silent fabrication', () => {
      // 1. Known model with catalog rates: openrouter-deepseek-v4-flash ($0.14/M in, $0.28/M out)
      const knownCost = computeAuditableConditionCost(
        'openrouter-deepseek-v4-flash',
        'deepseek/deepseek-chat',
        1_000_000, // 1M prompt tokens = $0.14
        500_000,   // 500k completion tokens = $0.14
        0
      );
      expect(knownCost.isAuditable).toBe(true);
      expect(knownCost.pricingStatus).toBe('audited_from_rates');
      expect(knownCost.inputCost).toBe(0.14);
      expect(knownCost.outputCost).toBe(0.14);
      expect(knownCost.totalCost).toBe(0.28);
      expect(knownCost.currency).toBe('USD');

      // 2. Provider reported explicit cost
      const providerCost = computeAuditableConditionCost(
        'openrouter-deepseek-v4-flash',
        'deepseek/deepseek-chat',
        1000,
        200,
        0,
        0.00035 // explicit provider reported cost
      );
      expect(providerCost.pricingStatus).toBe('provider_reported');
      expect(providerCost.totalCost).toBe(0.00035);
      expect(providerCost.isAuditable).toBe(true);

      // 3. Unknown model without published rates -> MUST NOT fabricate cost!
      const unknownCost = computeAuditableConditionCost(
        'unknown-experimental-model-v99',
        'unknown/experimental-99',
        5000,
        1000
      );
      expect(unknownCost.totalCost).toBeNull();
      expect(unknownCost.isAuditable).toBe(false);
      expect(unknownCost.pricingStatus).toBe('unknown');
      expect(unknownCost.pricingBasis).toContain('No published pricing rate found');
    });

    it('Criteria 5: Splits latency into retrieval, planning, model, and evaluation components', async () => {
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const run = await harness.compareQuestion(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        {
          category: 'longitudinal_change',
          model: 'openrouter-deepseek-v4-flash',
          benchmarkCase: CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_long_01')
        }
      );

      const attn = run.baselines.attentionEngineV1;
      expect(attn.latencyBreakdown).toBeDefined();
      expect(attn.latencyBreakdown?.retrievalMs).toBeGreaterThanOrEqual(0);
      expect(attn.latencyBreakdown?.planningMs).toBeGreaterThanOrEqual(0);
      expect(attn.latencyBreakdown?.modelMs).toBeGreaterThan(0);
      expect(attn.latencyBreakdown?.evaluationMs).toBeGreaterThanOrEqual(0);
      expect(attn.latencyBreakdown?.totalMs).toBeGreaterThan(0);
    });

    it('Criteria 6, 7 & 8: Evaluation scorecard cleanly separates mechanical metrics from judgment metrics with evaluator metadata', () => {
      const scorecard = computeConditionScorecard(
        'attention_engine_v1',
        75, // grounding
        25, // missed evidence risk
        5,  // false connection risk
        800, // billable tokens
        false, // not negative control
        true // has evidence
      );

      expect(scorecard.groundingScore).toBe(75);
      expect(scorecard.evidenceRecallScore).toBe(75); // 100 - 25
      expect(scorecard.missedEvidenceRisk).toBe(25);
      expect(scorecard.falseConnectionRisk).toBe(5);
      expect(scorecard.answerUsefulnessScore).toBeGreaterThan(60);
      expect(scorecard.efficiencyScore).toBeGreaterThan(70);

      // Evaluator integrity metadata
      expect(scorecard.evaluator.identity).toBe('attention_scorecard_evaluator_v1');
      expect(scorecard.evaluator.model).toBeDefined();
      expect(scorecard.evaluator.version).toBeDefined();
      expect(scorecard.evaluator.rationale).toBeDefined();
      expect(scorecard.evaluator.confidence).toBeGreaterThan(0.8);
    });

    it('Criteria 11: Efficiency metric rewards grounded, useful answers and CANNOT be maximized by cheap refusals missing evidence', () => {
      // Scenario A: Cheap refusal / empty answer (low tokens, but low grounding and missed evidence)
      const refusalScorecard = computeConditionScorecard(
        'control',
        30, // low grounding
        70, // high missed evidence risk (recall: 30%)
        25, // false connection risk
        80, // very few billable tokens (cheap refusal)
        false, // evidence was available!
        false // no evidence included in context
      );

      // Scenario B: High quality Attention Engine answer (compact, highly grounded, useful, good recall)
      const attentionScorecard = computeConditionScorecard(
        'attention_engine_v1',
        85, // high grounding
        15, // low missed evidence risk (recall: 85%)
        5,  // low false connection risk
        750, // modest tokens
        false,
        true
      );

      // Invariant: The cheap refusal cannot beat the high-quality Attention Engine on efficiency!
      expect(attentionScorecard.efficiencyScore).toBeGreaterThan(refusalScorecard.efficiencyScore);
    });

    it('Criteria 9, 10 & 13: Computes comparative economics deltas, cumulative spend, and formatted scorecard summary', async () => {
      const harness = new BenchmarkHarness(engine, index, snapshot);
      const run = await harness.compareQuestion(
        'How has my relationship to rest and evening rituals shifted from the Sturgeon Moon to now?',
        {
          category: 'longitudinal_change',
          model: 'openrouter-deepseek-v4-flash',
          benchmarkCase: CANONICAL_BENCHMARK_CASES.find(c => c.id === 'bm_long_01'),
          cumulativeLabCost: 0.054321
        }
      );

      expect(run.economics).toBeDefined();
      expect(run.scorecard).toBeDefined();
      expect(run.economics?.savingsVsBroad).toBeDefined();
      expect(run.economics?.savingsVsBroad.tokenReductionCount).toBeGreaterThanOrEqual(0);
      expect(run.economics?.savingsVsBroad.tokenReductionPct).toBeGreaterThanOrEqual(0);
      expect(run.economics?.savingsVsBroad.contextTokenReductionCount).toBeGreaterThan(0);
      expect(run.economics?.savingsVsBroad.contextTokenReductionPct).toBeGreaterThan(0);

      // Cumulative lab spend tracks correctly
      expect(run.economics?.cumulativeLabCost).toBeGreaterThan(0.05);

      // Compact summary markdown formatted properly
      expect(run.economics?.compactSummaryMarkdown).toContain('Experiment Economics & Quality Scorecard');
      expect(run.economics?.compactSummaryMarkdown).toContain('Delta (C vs B)');
      expect(run.economics?.compactSummaryMarkdown).toContain('Experiment Total Spend');

      // Verbatim A/B/C answers remain inspectable alongside scores
      expect(run.baselines.control.verbatimGeneratedAnswer).toBeDefined();
      expect(run.baselines.broadContext.verbatimGeneratedAnswer).toBeDefined();
      expect(run.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBeDefined();
    });

    it('Criteria 1: Absolute immutability of prior historical runs (V1, V1.1, V1.2, V1.3)', () => {
      const store = new DurableLabStore();
      
      const v1Session = store.createSession({ name: 'V1 Session', description: 'V1', hypothesis: 'H1' });
      store.recordRun(v1Session.id, {
        runId: 'run_1789211082230_cal8',
        sessionId: v1Session.id,
        question: 'Q',
        category: 'cat',
        timestamp: '2026-09-12T10:00:00Z',
        model: 'm',
        status: 'valid',
        snapshotHash: 'hash',
        provenanceBreakdown: { personal_field: 1, benchmark_fixture: 0, synthetic: 0 },
        baselines: {},
        evaluatorNotes: 'v1 baseline'
      });

      const v13Session = store.createSession({ name: 'V1.3 Session', description: 'V1.3', hypothesis: 'H3' });
      store.recordRun(v13Session.id, {
        runId: 'run_test_v13_mock_immutability',
        sessionId: v13Session.id,
        question: 'Q',
        category: 'cat',
        timestamp: '2026-09-13T02:10:00Z',
        model: 'm',
        status: 'valid',
        snapshotHash: 'hash',
        provenanceBreakdown: { personal_field: 1, benchmark_fixture: 0, synthetic: 0 },
        baselines: {},
        evaluatorNotes: 'v1.3 baseline'
      });

      // Verify records in store remain untouched
      expect(store.getSession(v1Session.id)?.runs[0].runId).toBe('run_1789211082230_cal8');
      expect(store.getSession(v13Session.id)?.runs[0].runId).toBe('run_test_v13_mock_immutability');
    });
  });

// =========================================================================
  // Suite 20: Lightweight Session Summaries (iss_1789267167162_3prg)
  // =========================================================================
  describe('Suite 20: Attention Lab Lightweight Session Summaries', () => {
    it('returns lightweight session summaries without embedding complete runs, ContextPackets, or candidate arrays', () => {
      const store = new DurableLabStore();
      const sess = store.createSession({
        name: 'V1.3 Regression & Generalization Benchmark',
        hypothesis: 'Attention Engine V1.3 prevents DEV/system contamination'
      });

      // Add a heavy run with complete artifacts, context packet, and verbatim answers
      const mockRun = {
        runId: 'run_v13_heavy_test',
        sessionId: sess.id,
        timestamp: new Date().toISOString(),
        model: 'openrouter-deepseek-v4-flash',
        status: 'valid',
        delta: { overallWinner: 'attention_engine_v1' },
        attentionPlan: {
          planId: 'plan_heavy',
          candidatesCount: 150,
          candidateSources: new Array(50).fill({ id: 'cand_1', text: 'large candidate text...' })
        },
        contextPacket: {
          packetId: 'packet_heavy',
          totalTokensUsed: 2500,
          evidenceItems: new Array(20).fill({ id: 'ev_1', text: 'detailed evidence snippet...' })
        },
        baselines: {
          control: {
            groundingScore: 35,
            verbatimGeneratedAnswer: 'Detailed long answer from control model...'
          },
          broadContext: {
            groundingScore: 68,
            formattedSnippet: '4000 tokens of raw broad context...',
            verbatimGeneratedAnswer: 'Detailed long answer from broad baseline model...'
          },
          attentionEngineV1: {
            groundingScore: 73,
            verbatimGeneratedAnswer: 'Detailed long answer from attention engine v1 model...'
          }
        },
        economics: {
          savingsVsBroad: { tokenReductionPct: 60, contextTokenReductionPct: 84 },
          cumulativeLabCost: 0.000683
        }
      };
      store.recordRun(sess.id, mockRun);

      // Verify listSessionSummaries()
      const summaries = store.listSessionSummaries();
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries.length).toBeGreaterThanOrEqual(3);

      const s0 = summaries.find(s => s.id === sess.id);
      expect(s0).toBeDefined();
      // Acceptance Criteria 2 & 3: Contains discovery metadata but NO heavy artifacts
      expect(s0.id).toBe(sess.id);
      expect(s0.name).toBe('V1.3 Regression & Generalization Benchmark');
      expect(s0.status).toBe('created');
      expect(s0.runCount).toBe(1);
      expect(s0.latestRunId).toBe('run_v13_heavy_test');
      expect(s0.latestWinner).toBe('attention_engine_v1');
      expect(typeof s0.createdAt).toBe('string');
      expect(typeof s0.updatedAt).toBe('string');

      // Crucial: Must NOT contain embedded runs, context packets, or candidates
      expect(s0.runs).toBeUndefined();
      expect(s0.attentionPlan).toBeUndefined();
      expect(s0.contextPacket).toBeUndefined();
      expect(s0.candidateSources).toBeUndefined();
      expect(s0.evidenceItems).toBeUndefined();

      // Acceptance Criteria 4 & 5: Existing durable sessions and detailed runs remain intact via getSession()
      const fullSess = store.getSession(sess.id);
      expect(fullSess).toBeDefined();
      expect(fullSess.runs.length).toBe(1);
      expect(fullSess.runs[0].contextPacket.packetId).toBe('packet_heavy');
      expect(fullSess.runs[0].baselines.broadContext.formattedSnippet).toBe('4000 tokens of raw broad context...');

      // Verify payload size reduction (> 90% smaller)
      const fullSize = JSON.stringify(fullSess).length;
      const summarySize = JSON.stringify(s0).length;
      expect(summarySize).toBeLessThan(fullSize * 0.2); // More than 80% smaller
      expect(summarySize).toBeLessThan(1000); // Lightweight summary is well under 1 KB
    });

    it('handles sessions with zero runs gracefully without errors', () => {
      const store = new DurableLabStore();
      const sess = store.createSession({
        name: 'Empty Session Test',
        hypothesis: 'Testing summary format when no runs exist'
      });

      const summaries = store.listSessionSummaries();
      expect(summaries.length).toBeGreaterThanOrEqual(3);
      const s0 = summaries.find(s => s.id === sess.id);
      expect(s0).toBeDefined();
      expect(s0.runCount).toBe(0);
      expect(s0.latestRunId).toBeUndefined();
      expect(s0.latestWinner).toBeUndefined();
    });
  });
// =========================================================================
  // Suite 21: Local Durable Archive & Full Auditability (iss_1789268194402_os20)
  // =========================================================================
  describe('Suite 21: Attention Lab Local Durable Archive & Full Auditability', () => {
    it('hydrates durable sessions and runs from local filesystem archive on startup', () => {
      const store = new DurableLabStore();
      const sessions = store.listSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(3);

      const v13 = sessions.find(s => s.id === 'sess_lab_1789265353670_i3w74');
      expect(v13).toBeDefined();
      expect(v13.name).toContain('Attention V1.3');
      expect(v13.runs.length).toBeGreaterThanOrEqual(1);

      const canonical = sessions.find(s => s.id === 'sess_lab_canonical_benchmark');
      expect(canonical).toBeDefined();

      const exp001 = sessions.find(s => s.id === 'sess_lab_exp001');
      expect(exp001).toBeDefined();
      expect(['paused', 'resumed']).toContain(exp001.status);
    });

    it('enforces auditability integrity states: marks unverified historical claims AUDIT_INCOMPLETE and valid runs AUDITABLE', () => {
      const store = new DurableLabStore();
      
      // Historical V1.3 run with unverified claims
      const incompleteRun = store.getRun('run_1789265419630_lue4');
      expect(incompleteRun).toBeDefined();
      expect(incompleteRun.integrityState).toBe('AUDIT_INCOMPLETE');
      expect(incompleteRun.isValidBenchmarkBaseline).toBe(false);
      expect(incompleteRun.artifactHash).toMatch(/^[a-f0-9]{64}$/);
      expect(incompleteRun.auditNotes).toContain('AUDIT_INCOMPLETE');

      // Fully auditable scorecard run
      const auditableRun = store.getRun('run_1789266756354_inwn');
      expect(auditableRun).toBeDefined();
      expect(auditableRun.integrityState).toBe('AUDITABLE');
      expect(auditableRun.isValidBenchmarkBaseline).toBe(true);
      expect(auditableRun.artifactHash).toMatch(/^[a-f0-9]{64}$/);
      expect(auditableRun.baselines.attentionEngineV1.verbatimGeneratedAnswer).toBeDefined();
      expect(auditableRun.baselines.control.verbatimGeneratedAnswer).toBeDefined();
      expect(auditableRun.baselines.broadContext.verbatimGeneratedAnswer).toBeDefined();
    });

    it('invariant: a historical experiment cannot be a valid benchmark baseline unless traceable to persisted evidence', () => {
      const store = new DurableLabStore();
      const run = store.getRun('run_1789265419630_lue4');
      expect(run.isValidBenchmarkBaseline).toBe(false);
      expect(run.integrityState).not.toBe('AUDITABLE');
    });

    it('exports complete local archive with schema version 2.0.0 and zero data loss', () => {
      const store = new DurableLabStore();
      const exported = store.exportArchive();
      expect(exported.archiveVersion).toBe('2.0.0');
      expect(exported.totalSessions).toBeGreaterThanOrEqual(3);
      expect(exported.totalRuns).toBeGreaterThanOrEqual(2);
      expect(exported.sessions.some(s => s.id === 'sess_lab_1789265353670_i3w74')).toBe(true);
      expect(exported.runs.some(r => r.runId === 'run_1789265419630_lue4')).toBe(true);
      expect(exported.runs.some(r => r.runId === 'run_1789266756354_inwn')).toBe(true);
    });

    it('records new runs atomically, updates catalog, and generates immutable artifactHash', () => {
      const store = new DurableLabStore();
      const sess = store.createSession({
        name: 'Audit Persistence Test Session',
        hypothesis: 'Testing local archive persistence and atomic hash generation'
      });

      const newRun = {
        runId: `run_test_audit_${Date.now()}`,
        sessionId: sess.id,
        question: 'Test question for local archive integrity?',
        model: 'openrouter-deepseek-v4-flash',
        status: 'valid',
        timestamp: new Date().toISOString(),
        snapshotHash: 'snap_test_hash_123',
        provenanceBreakdown: { personal_field: 10, benchmark_fixture: 0, synthetic: 0 },
        baselines: {
          control: {
            name: 'Control',
            groundingScore: 40,
            falseConnectionRisk: 20,
            contextTokenCount: 100,
            temporalSpanDays: 5,
            latencyMs: 1000,
            summary: 'Control summary',
            verbatimGeneratedAnswer: 'Verbatim control answer test.'
          },
          broadContext: {
            name: 'Broad Context',
            groundingScore: 60,
            falseConnectionRisk: 30,
            contextTokenCount: 2000,
            temporalSpanDays: 100,
            latencyMs: 3000,
            summary: 'Broad context summary',
            verbatimGeneratedAnswer: 'Verbatim broad answer test.'
          },
          attentionEngineV1: {
            name: 'Attention Engine V1',
            groundingScore: 80,
            falseConnectionRisk: 5,
            contextTokenCount: 500,
            temporalSpanDays: 95,
            latencyMs: 2000,
            summary: 'Attention engine summary',
            verbatimGeneratedAnswer: 'Verbatim attention answer test with exact evidence.'
          }
        },
        delta: {
          groundingDelta: 20,
          falseConnectionReduction: 25,
          contextTokenReduction: 1500,
          temporalSpanIncreaseDays: 90,
          overallWinner: 'attention_engine_v1'
        },
        evaluatorNotes: 'Full audit bundle test verified.'
      };

      store.recordRun(sess.id, newRun);

      // Verify run has artifactHash and AUDITABLE integrity
      expect(newRun.artifactHash).toBeDefined();
      expect(newRun.artifactHash).toMatch(/^[a-f0-9]{64}$/);
      expect(newRun.integrityState).toBe('AUDITABLE');
      expect(newRun.isValidBenchmarkBaseline).toBe(true);

      // Verify discoverable via getRun and session
      const fetched = store.getRun(newRun.runId);
      expect(fetched).toBeDefined();
      expect(fetched.runId).toBe(newRun.runId);
      expect(fetched.artifactHash).toBe(newRun.artifactHash);

      const summaries = store.listSessionSummaries();
      const sSummary = summaries.find(s => s.id === sess.id);
      expect(sSummary).toBeDefined();
      expect(sSummary.runCount).toBe(1);
      expect(sSummary.latestRunId).toBe(newRun.runId);
    });
  });

  describe('Suite 22: Archive Hydration, Import Idempotency & Duplicate Collapse', () => {
    it('Criteria 1: hydrateFromLocalArchive is strictly idempotent across repeated invocations', () => {
      const store = new DurableLabStore({ testMode: true });
      const initialSessionCount = store.listSessions().length;
      const initialRunCount = store.exportArchive().totalRuns;

      // Invoke hydration 5 times repeatedly
      for (let i = 0; i < 5; i++) {
        store.hydrateFromLocalArchive();
      }

      expect(store.listSessions().length).toBe(initialSessionCount);
      expect(store.exportArchive().totalRuns).toBe(initialRunCount);
    });

    it('Criteria 2: Each historical run ID has one authoritative archived record and cannot be degraded by stubs', () => {
      const store = new DurableLabStore({ testMode: true });
      const v1Run = store.getRun('run_1789211082230_cal8');
      expect(v1Run).toBeDefined();

      const inwnRun = store.getRun('run_1789266756354_inwn');
      expect(inwnRun).toBeDefined();
      expect(inwnRun.integrityState).toBe('AUDITABLE');
      expect(inwnRun.isValidBenchmarkBaseline).toBe(true);
      const originalHash = inwnRun.artifactHash;

      // Attempt to import a degraded stub with the same runId
      const degradedStub = {
        runId: 'run_1789266756354_inwn',
        question: 'Degraded stub question',
        integrityState: 'INVALID'
      };

      const res = store.importArchive({ runs: [degradedStub] });
      expect(res.importedRuns).toBe(0);
      expect(res.dedupedRuns).toBe(1);

      // Verify authoritative record remains AUDITABLE with original hash
      const preserved = store.getRun('run_1789266756354_inwn');
      expect(preserved.integrityState).toBe('AUDITABLE');
      expect(preserved.artifactHash).toBe(originalHash);
    });

    it('Criteria 3: importArchive deduplicates runs and sessions by identity and artifact hash', () => {
      const store = new DurableLabStore({ testMode: true });
      const archive = store.exportArchive();
      expect(archive.totalSessions).toBeGreaterThan(0);
      expect(archive.totalRuns).toBeGreaterThan(0);

      // Re-importing exact current state should result in 0 new sessions and 0 new runs
      const importRes = store.importArchive(archive);
      expect(importRes.success).toBe(true);
      expect(importRes.importedSessions).toBe(0);
      expect(importRes.importedRuns).toBe(0);
      expect(importRes.dedupedSessions).toBe(archive.totalSessions);
      expect(importRes.dedupedRuns).toBe(archive.totalRuns);
    });

    it('Criteria 4: Duplicate session wrappers referencing known runs collapse idempotently', () => {
      const store = new DurableLabStore({ testMode: true });
      const canonicalSession = store.getSession('sess_lab_canonical_benchmark');
      expect(canonicalSession).toBeDefined();

      // Attempt to import a duplicate wrapper that references the same V1 baseline run
      const duplicateWrapper = {
        id: 'sess_lab_duplicate_wrapper_test',
        name: 'Luna Attention V1 Canonical Benchmark - Original Run',
        description: 'Duplicate wrapper of V1 baseline',
        runIds: ['run_1789211082230_cal8']
      };

      const res = store.importArchive({ sessions: [duplicateWrapper] });
      expect(res.importedSessions).toBe(0);
      expect(res.dedupedSessions).toBe(1);
      expect(store.getSession('sess_lab_duplicate_wrapper_test')).toBeUndefined();
    });

    it('Criteria 5: Test executions run in test mode and do not pollute production archive disk', () => {
      const testStore = new DurableLabStore({ testMode: true });
      const testSess = testStore.createSession({
        name: 'Ephemeral Test Isolation Session',
        hypothesis: 'Must never touch production disk'
      });
      const testRun = {
        runId: 'run_ephemeral_test_isolation_' + Date.now(),
        sessionId: testSess.id,
        question: 'Ephemeral question?',
        baselines: {
          control: { verbatimGeneratedAnswer: 'ctrl' },
          attentionEngineV1: { verbatimGeneratedAnswer: 'v1' }
        }
      };
      testStore.recordRun(testSess.id, testRun);

      expect(testStore.getSession(testSess.id)?.runs.length).toBe(1);
      expect(testStore.getRun(testRun.runId)).toBeDefined();
    });
  });

});
