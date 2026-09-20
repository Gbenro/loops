import { describe, it, expect, beforeEach } from 'vitest';
import {
  activeWorkersRegistry,
  recordWorkerHeartbeat,
  getActiveWorkersCount,
  claimNextExecution,
  renewExecutionLease,
  appendExecutionEvents,
  finalizeExecution,
  cancelExecution,
  reconcileCloudExpiredLeases
} from '../../mcp-server/dist/devBridge.js';

describe('Luna Execution Engine: Leases, Fencing & Single-Owner Protocols', () => {
  let mockSessions = [];
  let mockIssues = [];
  let mockEvents = [];

  const userId = 'usr_test_supervisor_123';

  // In-memory Supabase Mock with filtering and update chaining
  const createMockSupabase = () => ({
    from: (table) => {
      let currentData = [];
      if (table === 'dev_sessions') currentData = mockSessions;
      else if (table === 'dev_issues') currentData = mockIssues;
      else if (table === 'dev_events') currentData = mockEvents;

      let filterPredicates = [];
      let orderByField = null;
      let orderAscending = true;

      const builder = {
        select: (_fields) => builder,
        eq: (field, val) => {
          filterPredicates.push((row) => row[field] === val);
          return builder;
        },
        in: (field, list) => {
          filterPredicates.push((row) => list.includes(row[field]));
          return builder;
        },
        order: (field, opts = { ascending: true }) => {
          orderByField = field;
          orderAscending = opts.ascending !== false;
          return builder;
        },
        limit: (_n) => builder,
        single: async () => {
          let rows = currentData.filter((r) => filterPredicates.every((p) => p(r)));
          if (rows.length === 0) return { data: null, error: new Error('Not found') };
          return { data: { ...rows[0] }, error: null };
        },
        insert: (row) => {
          const inserted = Array.isArray(row) ? row.map(r => ({ ...r })) : [{ ...row }];
          currentData.push(...inserted);
          return {
            select: () => ({
              single: async () => ({ data: { ...inserted[0] }, error: null })
            })
          };
        },
        update: (updates) => {
          const apply = () => {
            for (const row of currentData) {
              if (filterPredicates.every((p) => p(row))) {
                Object.assign(row, updates);
              }
            }
            return { data: updates, error: null };
          };
          const chain = {
            eq: (field, val) => {
              filterPredicates.push((row) => row[field] === val);
              apply();
              return chain;
            },
            then: (resolve) => resolve(apply())
          };
          return chain;
        }
      };

      // Allow direct promise resolution (like await supabase.from(...).select(...))
      builder.then = (resolve) => {
        let rows = currentData.filter((r) => filterPredicates.every((p) => p(r)));
        if (orderByField) {
          rows.sort((a, b) => {
            if (a[orderByField] < b[orderByField]) return orderAscending ? -1 : 1;
            if (a[orderByField] > b[orderByField]) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        resolve({ data: rows.map(r => ({ ...r })), error: null });
      };

      return builder;
    }
  });

  beforeEach(() => {
    activeWorkersRegistry.clear();
    mockSessions = [];
    mockEvents = [];
    mockIssues = [
      {
        id: 'iss_test_task_01',
        user_id: userId,
        title: 'BUG — Fix Loop Audio Persistence',
        description: 'Ensure recordings are saved to storage.',
        acceptance_criteria: ['Audio saves cleanly', 'Tests pass'],
        status: 'ready',
        priority: 'high',
        assigned_agent: 'gemini',
        related_references: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'iss_test_task_02',
        user_id: userId,
        title: 'FEAT — Connect Conscious Rides AI Studio',
        description: 'Integrate MCP tool interface.',
        acceptance_criteria: ['Tools load', 'Tests pass'],
        status: 'ready',
        priority: 'medium',
        assigned_agent: 'gemini',
        related_references: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  });

  it('1. records worker heartbeats and computes truthful live active watcher counts', () => {
    expect(getActiveWorkersCount()).toBe(0);

    recordWorkerHeartbeat({
      workerId: 'wrk_ben_pc',
      workerInstanceId: 'inst_001',
      runtimeProfiles: ['agy-headless'],
      availableCapacity: 1
    });

    expect(getActiveWorkersCount()).toBe(1);

    // Stale worker older than 60s is excluded from live active counts
    const staleWorker = {
      workerId: 'wrk_stale',
      workerInstanceId: 'inst_old',
      runtimeProfiles: ['agy-headless'],
      availableCapacity: 1,
      lastHeartbeatAt: Date.now() - 65 * 1000
    };
    activeWorkersRegistry.set('wrk_stale', staleWorker);

    expect(getActiveWorkersCount()).toBe(1); // wrk_stale is ignored
  });

  it('2. atomically claims eligible task and grants 120-second lease with monotonic fencing token', async () => {
    const supabase = createMockSupabase();

    const result = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_ben_pc',
      workerInstanceId: 'inst_001',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });

    expect(result.status).toBe('claimed');
    expect(result.execution).toBeDefined();
    expect(result.execution.issueId).toBe('iss_test_task_01');
    expect(result.execution.fencingToken).toBeGreaterThan(0);
    expect(result.execution.contextPackage.runtimeProfileId).toBe('agy-headless');

    // Lease should be ~120s in the future
    const leaseExpiryMs = new Date(result.execution.leaseExpiresAt).getTime();
    expect(leaseExpiryMs - Date.now()).toBeGreaterThan(115 * 1000);

    // Issue status updated to in_progress
    const issue = mockIssues.find(i => i.id === 'iss_test_task_01');
    expect(issue.status).toBe('in_progress');

    // Audit events emitted
    expect(mockEvents.some(e => e.type === 'execution.claimed')).toBe(true);
  });

  it('3. enforces single active execution slot per repository and rejects concurrent claims', async () => {
    const supabase = createMockSupabase();

    // First claim occupies repository slot
    const claim1 = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });
    expect(claim1.status).toBe('claimed');

    // Second claim while slot is active is rejected with slot_busy
    const claim2 = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_2',
      workerInstanceId: 'inst_2',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });
    expect(claim2.status).toBe('slot_busy');
    expect(claim2.message).toContain('currently held');
  });

  it('4. deduplicates claims using idempotencyKey without creating duplicate sessions', async () => {
    const supabase = createMockSupabase();

    const claim1 = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app',
      idempotencyKey: 'idem_unique_123'
    });
    expect(claim1.status).toBe('claimed');

    const claim2 = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app',
      idempotencyKey: 'idem_unique_123'
    });

    expect(claim2.status).toBe('claimed');
    expect(claim2.execution.id).toBe(claim1.execution.id);
    expect(claim2.execution.fencingToken).toBe(claim1.execution.fencingToken);
  });

  it('5. conditionally renews lease and rejects renewals with stale fencing token or expired lease', async () => {
    const supabase = createMockSupabase();

    const claim = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });

    const execId = claim.execution.id;
    const token = claim.execution.fencingToken;

    // Successful renewal
    const renewed = await renewExecutionLease(supabase, userId, execId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      fencingToken: token,
      stage: 'running'
    });
    expect(renewed.success).toBe(true);

    // Rejected: stale fencing token
    const staleRenewal = await renewExecutionLease(supabase, userId, execId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      fencingToken: token - 1,
      stage: 'running'
    });
    expect(staleRenewal.success).toBe(false);
    expect(staleRenewal.error).toContain('fencing');

    // Rejected: expired lease cannot renew retroactively
    const sess = mockSessions.find(s => s.id === execId);
    sess.environment.leaseExpiresAt = new Date(Date.now() - 5000).toISOString();

    const expiredRenewal = await renewExecutionLease(supabase, userId, execId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      fencingToken: token,
      stage: 'running'
    });
    expect(expiredRenewal.success).toBe(false);
    expect(expiredRenewal.error).toContain('expired');
  });

  it('6. finalizes execution, advances issue to awaiting_acceptance, and releases repository slot', async () => {
    const supabase = createMockSupabase();

    const claim = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });

    const execId = claim.execution.id;
    const token = claim.execution.fencingToken;

    // Finalize with valid verification evidence
    const finalOutcome = await finalizeExecution(supabase, userId, execId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      fencingToken: token,
      result: {
        success: true,
        summary: 'Fixed loop audio persistence with unit tests',
        changes: ['src/lib/storage.js'],
        testResults: { passed: true, total: 42 }
      }
    });

    expect(finalOutcome.success).toBe(true);
    expect(finalOutcome.issueStatus).toBe('awaiting_acceptance');

    const issue = mockIssues.find(i => i.id === 'iss_test_task_01');
    expect(issue.status).toBe('verification'); // maps to awaiting_acceptance

    // Now repository slot is freed; second task can be claimed immediately!
    const nextClaim = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_1',
      workerInstanceId: 'inst_1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });
    expect(nextClaim.status).toBe('claimed');
    expect(nextClaim.execution.issueId).toBe('iss_test_task_02');
  });

  it('7. cloud recovery scanner detects expired abandoned leases and frees slot for execution', async () => {
    const supabase = createMockSupabase();

    const claim = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_crashed',
      workerInstanceId: 'inst_crashed',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });

    const execId = claim.execution.id;

    // Simulate worker crashing: no heartbeats for 130 seconds
    const sess = mockSessions.find(s => s.id === execId);
    sess.environment.leaseExpiresAt = new Date(Date.now() - 10 * 1000).toISOString();

    // Cloud recovery scanner executes
    const recovery = await reconcileCloudExpiredLeases(supabase);
    expect(recovery.reconciledCount).toBe(1);
    expect(recovery.expiredSessionIds).toContain(execId);

    // Session is ended and audit event is recorded
    expect(sess.status).toBe('ended');
    expect(mockEvents.some(e => e.type === 'execution.lease_expired')).toBe(true);

    // Slot is free again!
    const newClaim = await claimNextExecution(supabase, userId, {
      workerId: 'wrk_fresh',
      workerInstanceId: 'inst_fresh',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });
    expect(newClaim.status).toBe('claimed');
  });
});
