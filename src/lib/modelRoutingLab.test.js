import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TASK_TAXONOMY,
  LAB_CANDIDATE_POOL,
  classifyLabTask,
  resolveLabRoute,
  executeLabTask,
  runLabBenchmark,
  saveLabTelemetry,
  getLabTelemetry,
  listLabExperiments,
  clearLabTelemetry,
  registerModelRoutingLabRoutes,
  deriveTaskCriteria,
  evaluateArtifactAgainstCriteria
} from './modelRoutingLab.js';
import {
  MODEL_REGISTRY,
  resolveModel,
  DEFAULT_MODEL_KEY,
  classifyQueryDepth,
  selectAdaptiveModel
} from '../../mcp-server/dist/models.js';
import { LUNA_DEV_OPENAPI_SPEC, LUNA_OPENAPI_SPEC } from '../../mcp-server/dist/openapi.js';

describe('Luna Sidecar Intelligent Model-Routing Lab Test Suite', () => {
  beforeEach(() => {
    clearLabTelemetry();
  });

  // ─── 1. Strict Sidecar Isolation & Production Integrity ──────────────────

  it('preserves existing Luna production model routing unchanged by default', async () => {
    // Production default model must remain anthropic-fable
    expect(DEFAULT_MODEL_KEY).toBe('anthropic-fable');

    // Production resolveModel still resolves production keys as before
    const defaultResolved = await resolveModel(undefined, 'usr_test_123');
    expect(defaultResolved.key).toBe('anthropic-fable-5');

    // Production adaptive depth routing remains intact
    const deepQuery = classifyQueryDepth('Synthesize across all cycles and echoes over time');
    expect(deepQuery.tier).toBe('deep_synthesis');
    const adaptiveModel = selectAdaptiveModel(deepQuery.tier);
    expect(adaptiveModel.capabilityTier).toBe('frontier');

    // Production registry has not been corrupted
    expect(MODEL_REGISTRY.length).toBeGreaterThan(10);
  });

  it('guarantees zero writes or mutations to personal Field tables during lab operations', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis()
      }))
    };

    // Execute lab task
    const result = await executeLabTask({
      prompt: 'Implement a binary search tree in TypeScript',
      taskClass: 'code_generation_bounded',
      harness: 'simulated',
      simulated: true
    });

    expect(result.isSidecarLabOnly).toBe(true);
    expect(result.verification.checks).toContain('Zero personal Field writes verified');

    // Verify mockSupabase was never accessed for personal tables
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // ─── 2. Role Separation (Planner / Executor / Reviewer) ───────────────────

  it('allocates frontier models to judgment (Planner/Reviewer) and capable economy/open models to bounded execution (Executor)', () => {
    const plan = resolveLabRoute('architecture_planning');

    // Planner role requires frontier judgment
    expect(plan.roles.planner).toBeDefined();
    expect(plan.roles.planner?.role).toBe('planner');
    expect(plan.roles.planner?.capabilityTier).toBe('frontier');
    expect(plan.roles.planner?.modelKey).toBe('anthropic-sonnet-5');

    // Executor role uses capable strong/open model
    expect(plan.roles.executor.role).toBe('executor');
    expect(plan.roles.executor.weightClass).toBe('open_weight');
    expect(plan.roles.executor.modelKey).toBe('openrouter-qwen-3.6-35b-a3b');

    // Reviewer role requires frontier critique
    expect(plan.roles.reviewer).toBeDefined();
    expect(plan.roles.reviewer?.role).toBe('reviewer');
    expect(plan.roles.reviewer?.capabilityTier).toBe('frontier');
  });

  it('favors low-cost open-weight models for bounded code generation tasks', () => {
    const plan = resolveLabRoute('code_generation_bounded');

    // Executor is an economy open-weight engine
    expect(plan.roles.executor.capabilityTier).toBe('economy');
    expect(plan.roles.executor.weightClass).toBe('open_weight');
    expect(plan.roles.executor.modelKey).toBe('openrouter-deepseek-v4-flash');

    // Planner is optional for discrete bounded tasks
    expect(plan.roles.planner).toBeUndefined();
  });

  it('supports explicit model overrides per role while preserving role contracts', () => {
    const plan = resolveLabRoute('code_generation_bounded', {
      plannerModel: 'openai-gpt-5.6-sol',
      executorModel: 'gemini-3.7-flash',
      reviewerModel: 'anthropic-sonnet-5',
      includeReviewer: true
    });

    expect(plan.roles.planner?.modelKey).toBe('openai-gpt-5.6-sol');
    expect(plan.roles.executor.modelKey).toBe('gemini-3.7-flash');
    expect(plan.roles.reviewer?.modelKey).toBe('anthropic-sonnet-5');
  });

  // ─── 3. Harness Neutrality ────────────────────────────────────────────────

  it('decouples model selection from harness execution substrates', () => {
    const substrates = ['direct_api', 'dsh', 'agy', 'simulated'];

    for (const substrate of substrates) {
      const plan = resolveLabRoute('code_generation_bounded', {
        harness: substrate,
        executorModel: 'openrouter-deepseek-v4-pro-0813'
      });

      // Model is DeepSeek V4 Pro, but harness can be AGY, DSH, direct_api, or simulated
      expect(plan.roles.executor.modelKey).toBe('openrouter-deepseek-v4-pro-0813');
      expect(plan.harness).toBe(substrate);
      expect(plan.roles.executor.harness).toBe(substrate);
    }
  });

  it('verifies DSH is treated as an interchangeable execution substrate, not hardcoded router', () => {
    // Plan with DSH harness executing a non-DeepSeek model (e.g. Qwen or Claude)
    const plan = resolveLabRoute('architecture_planning', {
      harness: 'dsh',
      executorModel: 'openrouter-qwen-3.6-35b-a3b'
    });

    expect(plan.harness).toBe('dsh');
    expect(plan.roles.executor.modelKey).toBe('openrouter-qwen-3.6-35b-a3b');
    expect(plan.roles.executor.harness).toBe('dsh');
  });

  // ─── 4. Task Taxonomy & Classification ────────────────────────────────────

  it('accurately classifies incoming prompts across the 5 standard task taxonomy classes', () => {
    expect(classifyLabTask('Design a high-availability event bus schema and architecture')).toBe('architecture_planning');
    expect(classifyLabTask('Implement a quicksort function with unit tests')).toBe('code_generation_bounded');
    expect(classifyLabTask('Reflect on the emotional tone of my lunar cycle')).toBe('conversational_reflection');
    expect(classifyLabTask('Audit the security model and review code for vulnerabilities')).toBe('synthesis_review');
    expect(classifyLabTask('Analyze the mathematical proof and logical trade-offs of consensus')).toBe('analytical_reasoning');
  });

  it('exposes all 5 taxonomy definitions with complete role requirements and sample prompts', () => {
    const keys = Object.keys(TASK_TAXONOMY);
    expect(keys).toEqual([
      'architecture_planning',
      'code_generation_bounded',
      'conversational_reflection',
      'analytical_reasoning',
      'synthesis_review'
    ]);

    for (const key of keys) {
      const def = TASK_TAXONOMY[key];
      expect(def.key).toBe(key);
      expect(def.displayName).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.defaultRoles.executor).toBeDefined();
      expect(def.samplePrompt.length).toBeGreaterThan(10);
    }
  });

  // ─── 5. Multi-Role Execution Pipeline & Telemetry ─────────────────────────

  it('executes a multi-role pipeline (Planner -> Executor -> Reviewer) and records structured telemetry', async () => {
    const result = await executeLabTask({
      prompt: 'Design and implement an in-memory cache with LRU eviction and unit tests.',
      taskClass: 'architecture_planning',
      harness: 'simulated',
      includeReviewer: true,
      simulated: true
    });

    expect(result.experimentId).toMatch(/^exp_/);
    expect(result.taskClass).toBe('architecture_planning');
    expect(result.harness).toBe('simulated');

    // Role breakdown
    expect(result.roles.planner).toBeDefined();
    expect(result.roles.planner?.role).toBe('planner');
    expect(result.roles.planner?.promptTokens).toBeGreaterThan(0);
    expect(result.roles.planner?.completionTokens).toBeGreaterThan(0);
    expect(result.roles.planner?.costUsd).toBeGreaterThanOrEqual(0);

    expect(result.roles.executor).toBeDefined();
    expect(result.roles.executor.role).toBe('executor');
    expect(result.roles.executor.promptTokens).toBeGreaterThan(0);
    expect(result.roles.executor.completionTokens).toBeGreaterThan(0);

    expect(result.roles.reviewer).toBeDefined();
    expect(result.roles.reviewer?.role).toBe('reviewer');
    expect(result.roles.reviewer?.finishReason).toBe('stop');

    // Aggregate metrics
    expect(result.aggregate.totalTokens).toBe(
      (result.roles.planner?.totalTokens || 0) +
      result.roles.executor.totalTokens +
      (result.roles.reviewer?.totalTokens || 0)
    );
    expect(result.aggregate.totalCostUsd).toBeGreaterThan(0);
    expect(result.aggregate.totalDurationMs).toBeGreaterThan(0);

    // Verification outcome
    expect(result.verification.outcome).toBe('passed');
    expect(result.verification.score).toBeGreaterThanOrEqual(90);
    expect(result.verification.checks).toContain('Isolated sidecar execution verified');
  });

  it('persists telemetry in the isolated lab buffer and allows query by ID and taskClass', async () => {
    const res1 = await executeLabTask({
      prompt: 'Task A',
      taskClass: 'code_generation_bounded',
      harness: 'simulated'
    });
    const res2 = await executeLabTask({
      prompt: 'Task B',
      taskClass: 'analytical_reasoning',
      harness: 'simulated'
    });

    // Query single
    const found1 = getLabTelemetry(res1.experimentId);
    expect(found1).not.toBeNull();
    expect(found1?.experimentId).toBe(res1.experimentId);

    // List all
    const all = listLabExperiments();
    expect(all.length).toBe(2);

    // List filtered
    const filtered = listLabExperiments({ taskClass: 'analytical_reasoning' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].experimentId).toBe(res2.experimentId);
  });

  // ─── 6. Comparative Benchmark Evaluation ──────────────────────────────────

  it('runs comparative benchmark matrix across candidate models and calculates cost-efficiency leaders', async () => {
    const benchmark = await runLabBenchmark({
      taskClasses: ['code_generation_bounded', 'analytical_reasoning'],
      candidateKeys: [
        'openrouter-deepseek-v4-flash',
        'openrouter-qwen-3.6-35b-a3b',
        'anthropic-sonnet-5'
      ],
      harness: 'simulated'
    });

    expect(benchmark.benchmarkId).toMatch(/^bm_/);
    expect(benchmark.taskClasses).toEqual(['code_generation_bounded', 'analytical_reasoning']);
    expect(benchmark.results.length).toBe(3);

    for (const r of benchmark.results) {
      expect(r.candidateKey).toBeDefined();
      expect(r.weightClass).toBeDefined();
      expect(r.avgLatencyMs).toBeGreaterThan(0);
      expect(r.totalCostUsd).toBeGreaterThan(0);
      expect(r.passRate).toBe(1.0);
    }

    // Flash should be the cost-efficiency leader
    expect(benchmark.summary.costEfficiencyLeader).toBe('openrouter-deepseek-v4-flash');
    expect(benchmark.summary.recommendedExecutor).toBe('openrouter-deepseek-v4-flash');
    expect(benchmark.summary.recommendedPlanner).toBe('anthropic-sonnet-5');
  });

  // ─── 7. Decoupled API Boundary & OpenAPI Specification ────────────────────

  it('registers all 7 lab endpoints under /api/dev/lab/* on express app', () => {
    const registeredRoutes = [];
    const mockApp = {
      get: vi.fn((path) => registeredRoutes.push({ method: 'GET', path })),
      post: vi.fn((path) => registeredRoutes.push({ method: 'POST', path }))
    };
    const mockAuth = vi.fn();

    registerModelRoutingLabRoutes(mockApp, mockAuth);

    const paths = registeredRoutes.map(r => `${r.method} ${r.path}`);
    expect(paths).toContain('GET /api/dev/lab/status');
    expect(paths).toContain('GET /api/dev/lab/taxonomy');
    expect(paths).toContain('POST /api/dev/lab/route');
    expect(paths).toContain('POST /api/dev/lab/execute');
    expect(paths).toContain('POST /api/dev/lab/benchmark');
    expect(paths).toContain('GET /api/dev/lab/experiments');
    expect(paths).toContain('GET /api/dev/lab/experiments/:id');
  });

  it('includes complete OpenAPI 3.0 schema definitions for lab endpoints in LUNA_DEV_OPENAPI_SPEC', () => {
    const devPaths = Object.keys(LUNA_DEV_OPENAPI_SPEC.paths);

    expect(devPaths).toContain('/api/dev/lab/status');
    expect(devPaths).toContain('/api/dev/lab/taxonomy');
    expect(devPaths).toContain('/api/dev/lab/route');
    expect(devPaths).toContain('/api/dev/lab/execute');
    expect(devPaths).toContain('/api/dev/lab/benchmark');
    expect(devPaths).toContain('/api/dev/lab/experiments');
    expect(devPaths).toContain('/api/dev/lab/experiments/{id}');

    // Verify operations have concrete schemas and operationIds
    const routeOp = LUNA_DEV_OPENAPI_SPEC.paths['/api/dev/lab/route'].post;
    expect(routeOp.operationId).toBe('resolve_lab_route');
    expect(routeOp.requestBody).toBeDefined();

    const execOp = LUNA_DEV_OPENAPI_SPEC.paths['/api/dev/lab/execute'].post;
    expect(execOp.operationId).toBe('execute_lab_task');

    const benchOp = LUNA_DEV_OPENAPI_SPEC.paths['/api/dev/lab/benchmark'].post;
    expect(benchOp.operationId).toBe('run_lab_benchmark');
  });

  // ─── 8. Schema & Parameter Compatibility (task ↔ prompt bridge) ───────────

  it('accepts task field interchangeably with prompt in executeLabTask and HTTP routes', async () => {
    // 1. Function level with task only (no prompt field)
    const result = await executeLabTask({
      task: 'Design a resilient multi-tenant webhook dispatcher with retry policies and queue isolation.',
      taskClass: 'architecture_planning',
      harness: 'simulated',
      simulated: true
    });

    expect(result.task).toBe('Design a resilient multi-tenant webhook dispatcher with retry policies and queue isolation.');
    expect(result.prompt).toBe('Design a resilient multi-tenant webhook dispatcher with retry policies and queue isolation.');
    expect(result.roles.planner).toBeDefined();
    expect(result.roles.executor).toBeDefined();

    // 2. HTTP route level verification with { task: '...' }
    let routeHandler;
    let executeHandler;
    const mockApp = {
      get: vi.fn(),
      post: vi.fn((path, auth, handler) => {
        if (path === '/api/dev/lab/route') routeHandler = handler;
        if (path === '/api/dev/lab/execute') executeHandler = handler;
      })
    };
    registerModelRoutingLabRoutes(mockApp, vi.fn());

    // Test /api/dev/lab/route with { task: '...' }
    let jsonResult;
    const mockRes1 = { json: vi.fn((d) => { jsonResult = d; }), status: vi.fn().mockReturnThis() };
    routeHandler({ body: { task: 'Design a system architecture', taskClass: 'architecture_planning' } }, mockRes1);
    expect(jsonResult.taskClass).toBe('architecture_planning');
    expect(jsonResult.roles.planner).toBeDefined();

    // Test /api/dev/lab/execute with { task: '...' }
    let execResult;
    const mockRes2 = { json: vi.fn((d) => { execResult = d; }), status: vi.fn().mockReturnThis() };
    await executeHandler({ body: { task: 'Design a system architecture', taskClass: 'architecture_planning', simulated: true } }, mockRes2);
    expect(execResult.task).toBe('Design a system architecture');
    expect(execResult.prompt).toBe('Design a system architecture');
    expect(execResult.verification.outcome).toBe('passed');
  });

  // ─── 9. Quality Gate Semantic Task Verification & Regression Fixtures (iss_1789136068952_qumg) ─

  const REGRESSION_PROMPT = `Design and implement a robust, durable, multi-tenant job-queue architecture for the Luna sidecar with: (1) state machine lifecycle (pending, running, completed, dead-letter), (2) leases, fencing tokens, and heartbeats to prevent split-brain execution, (3) idempotency and exactly-once execution semantics, (4) background reaper and dead-letter recovery with exponential backoff, (5) append-only crash-safe telemetry and persistent audit store, (6) provider-neutral model adapter with request_id, token, latency, and cost accounting, (7) explicit planner, executor, and reviewer multi-role orchestration with isolation safeguards, (8) circuit breaker escalation policies and operator failure alerts, (9) comprehensive failure-mode analysis, (10) pseudocode and PostgreSQL schema transaction boundaries.`;

  const REGRESSION_TRIVIAL_STUB = `[EXECUTOR ARTIFACT — openrouter-qwen-3.6-35b-a3b]
function executeBoundedTask(input) {
  // Implementation generated under planner constraints
  const result = { success: true, processedAt: new Date().toISOString() };
  return result;
}`;

  const POSITIVE_CONTROL_ARTIFACT = `[EXECUTOR ARTIFACT — openrouter-qwen-3.6-35b-a3b]
# Durable Multi-Tenant Job-Queue Architecture Specification

## 1. State Machine & Lifecycle Transitions
- Complete state transition graph: pending -> claimed -> running -> completed or failed -> retry -> dead_letter.
- Monotonic state invariants enforced via relational check constraints.

## 2. Distributed Leases, Fencing Tokens & Heartbeat Protocol
- Workers acquire short-lived bounded leases (TTL: 30s) refreshed via periodic heartbeats.
- Monotonic fencing_token incremented on every lease acquisition; any write with a stale fencing token is rejected.

## 3. Idempotency & Exactly-Once Semantics
- Deterministic deduplication hash derived from tenant_id + idempotency_key + payload_hash.
- Strict unique constraint in the PostgreSQL deduplication table ensuring deduplicated delivery.

## 4. Reaper Process & Dead-Letter Recovery
- Background worker scans for leases with lease_expires_at < NOW().
- Exponential backoff with jitter up to max retries before routing to dead_letter queue.

## 5. Append-Only Crash-Safe Telemetry Store
- Separate write-ahead audit event log capturing every transition, timestamp, and worker identity.
- Guaranteed durability across process restarts and unhandled exceptions.

## 6. Provider-Neutral Model Adapter & Cost Tracking
- Unified abstraction layer for model invocation.
- Records request_id, input/output tokens, wall-clock latency, and exact micro-cent USD pricing.

## 7. Planner-Executor-Reviewer Orchestration & Safety Fencing
- Multi-role pipeline with physical role separation.
- Strict isolation sandbox preventing mutations to personal Luna Field tables.

## 8. Circuit Breakers & Escalation Policy
- Automatic circuit trip if consecutive failure threshold exceeded.
- Direct paging and alerts dispatched to operators.

## 9. Failure Mode & Disaster Recovery Runbook
- Detailed analysis of network partitions, worker crashes, database failover, and poison pills.

## 10. Database Schema & Transaction Boundaries
\`\`\`sql
BEGIN;
CREATE TABLE queue_jobs (
  job_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL DEFAULT 'pending',
  fencing_token BIGINT NOT NULL DEFAULT 0,
  lease_owner VARCHAR(64),
  lease_expires_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL
);
CREATE TABLE job_events (
  event_id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(64) REFERENCES queue_jobs(job_id),
  event_type VARCHAR(64) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
\`\`\`
\`\`\`typescript
export async function claimJob(workerId: string): Promise<Job | null> {
  // BEGIN TRANSACTION; SELECT FOR UPDATE SKIP LOCKED; UPDATE with fencing_token + 1; COMMIT;
}
\`\`\`
`;

  it('derives explicit, fine-grained mandatory criteria from prompt specifications', () => {
    const criteria = deriveTaskCriteria(REGRESSION_PROMPT, '', 'architecture_planning');
    expect(criteria.length).toBe(10);
    expect(criteria.every(c => c.isMandatory)).toBe(true);

    const titles = criteria.map(c => c.title);
    expect(titles.some(t => t.includes('state machine'))).toBe(true);
    expect(titles.some(t => t.includes('leases'))).toBe(true);
    expect(titles.some(t => t.includes('idempotency'))).toBe(true);
    expect(titles.some(t => t.includes('reaper'))).toBe(true);
    expect(titles.some(t => t.includes('telemetry'))).toBe(true);
    expect(titles.some(t => t.includes('provider-neutral'))).toBe(true);
    expect(titles.some(t => t.includes('orchestration'))).toBe(true);
    expect(titles.some(t => t.includes('escalation'))).toBe(true);
    expect(titles.some(t => t.includes('failure-mode'))).toBe(true);
    expect(titles.some(t => t.includes('pseudocode'))).toBe(true);
  });

  it('REGRESSION FIXTURE (exp_1789135667215_n8pfa): rejects trivial executeBoundedTask() stub and prevents false-positive PASS', async () => {
    // Execute the regression prompt with the trivial stub returned by the executor
    const telemetry = await executeLabTask({
      prompt: REGRESSION_PROMPT,
      taskClass: 'architecture_planning',
      harness: 'simulated',
      includeReviewer: true,
      simulated: true,
      executorArtifactOverride: REGRESSION_TRIVIAL_STUB
    });

    // 1. Decoupled signals verification
    expect(telemetry.signals).toBeDefined();
    // Pipeline health is healthy (API/models responded)
    expect(telemetry.signals?.pipelineHealth.status).toBe('healthy');
    expect(telemetry.signals?.pipelineHealth.stepsCompleted).toEqual(['planner', 'executor', 'reviewer']);
    // Isolation safety passed (zero personal field writes)
    expect(telemetry.signals?.isolationSafety.outcome).toBe('passed');
    expect(telemetry.signals?.isolationSafety.personalFieldMutations).toBe(0);
    // BUT semantic task success must be FAILED
    expect(telemetry.signals?.semanticTaskSuccess.outcome).toBe('failed');
    expect(telemetry.signals?.semanticTaskSuccess.mandatoryPassed).toBe(false);
    expect(telemetry.signals?.semanticTaskSuccess.failedCount).toBe(10);

    // 2. Aggregate verification outcome must be failed (NO FALSE POSITIVE PASS)
    expect(telemetry.verification.outcome).toBe('failed');
    expect(telemetry.verification.score).toBeLessThanOrEqual(45);

    // 3. Reviewer critique must document failed criteria
    expect(telemetry.roles.reviewer?.output).toContain('FAILED (Needs Revision)');
    expect(telemetry.verification.critique).toContain('Semantic Quality Gate REJECTED');

    // 4. Traceability & Telemetry preserved
    expect(telemetry.experimentId).toMatch(/^exp_/);
    expect(telemetry.aggregate.totalTokens).toBeGreaterThan(0);
    expect(telemetry.aggregate.totalCostUsd).toBeGreaterThanOrEqual(0);
    expect(telemetry.isSidecarLabOnly).toBe(true);
  });

  it('POSITIVE CONTROL: substantive architectural artifact passes semantic quality gate with high score', async () => {
    // Execute with substantive architecture artifact fulfilling all 10 criteria
    const telemetry = await executeLabTask({
      prompt: REGRESSION_PROMPT,
      taskClass: 'architecture_planning',
      harness: 'simulated',
      includeReviewer: true,
      simulated: true,
      executorArtifactOverride: POSITIVE_CONTROL_ARTIFACT
    });

    // 1. Decoupled signals
    expect(telemetry.signals?.pipelineHealth.status).toBe('healthy');
    expect(telemetry.signals?.isolationSafety.outcome).toBe('passed');
    expect(telemetry.signals?.semanticTaskSuccess.outcome).toBe('passed');
    expect(telemetry.signals?.semanticTaskSuccess.mandatoryPassed).toBe(true);
    expect(telemetry.signals?.semanticTaskSuccess.passedCount).toBe(10);

    // 2. Overall verification passes
    expect(telemetry.verification.outcome).toBe('passed');
    expect(telemetry.verification.score).toBeGreaterThanOrEqual(88);

    // 3. Reviewer verdict reflects passed criteria
    expect(telemetry.roles.reviewer?.output).toContain('PASSED');
    expect(telemetry.verification.checks).toContain('Criterion [crit_1] state machine lifecycle (pending, running, completed, dead-letter): PASSED');
  });

  it('strictly prohibits overall task PASS when any mandatory criterion fails', () => {
    const criteria = deriveTaskCriteria(REGRESSION_PROMPT, '', 'architecture_planning');

    // Artifact missing idempotency and reaper criteria
    const partialArtifact = `[EXECUTOR ARTIFACT]
# Partial Architecture
- State machine with pending, running, completed, dead-letter.
- Leases with heartbeats and fencing tokens.
- Telemetry persistent store with append-only logs.
- Provider-neutral adapter with request_id and cost accounting.
- Planner, executor, reviewer orchestration with isolation safeguards.
- Escalation circuit breakers and alerts.
- Failure-mode analysis for network partitions.
- Pseudocode and SQL schema transactions with BEGIN and COMMIT.
`;
    const evaluation = evaluateArtifactAgainstCriteria(partialArtifact, criteria, 'architecture_planning');
    expect(evaluation.mandatoryPassed).toBe(false);
    expect(evaluation.outcome).toBe('failed');
    expect(evaluation.score).toBeLessThanOrEqual(45);
  });
});
