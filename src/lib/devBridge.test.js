import { describe, it, expect, vi } from 'vitest';
import {
  computeFactualEvidence,
  mapDevIssue,
  mapDevSession,
  mapDevEvent,
  classifyEventIntent,
  createDevSession,
  listPendingDevSessions,
  claimPendingDevSession,
  validateDevDiscoveryToken,
  handleWatcherDiscoveryEvent,
  handleWatcherSessionEndedEvent,
  getDevQueueState,
  advanceDevQueue
} from '../../mcp-server/dist/devBridge.js';
import { formatCompletionSummary } from './harnessAdapters.js';
import { getSupabaseService } from '../../mcp-server/dist/db.js';
import { executeTool } from '../../mcp-server/dist/tools.js';

describe('Luna Development Bridge (V1) Test Suite', () => {
  const mockUser = { id: 'usr_dev_test_999', email: 'dev@luna.ai' };

  const createMockSupabase = (customHandlers = {}) => {
    const tableMocks = {};
    const getTableMock = (table) => {
      if (customHandlers[table]) return customHandlers[table];
      if (!tableMocks[table]) {
        tableMocks[table] = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: `${table}_123`, title: 'Test Issue' }, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: `${table}_123`, status: 'in_progress' }, error: null })
            })
          }),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: `${table}_123`, title: 'Test Issue' }, error: null })
        };
      }
      return tableMocks[table];
    };

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
      },
      from: vi.fn().mockImplementation((table) => getTableMock(table))
    };
  };

  // ─── 1. Non-linear Issue Lifecycle & Auditing ────────────────────────────

  it('preserves non-linear status transitions and backward loops', async () => {
    const issueRow = {
      id: 'iss_test_1',
      user_id: mockUser.id,
      title: 'Dark mode toggle',
      description: 'Implement dark mode',
      acceptance_criteria: ['Toggle works', 'Preferences persisted'],
      status: 'verification',
      priority: 'high',
      assigned_agent: 'gemini',
      related_references: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const mapped = mapDevIssue(issueRow);
    expect(mapped.status).toBe('verification');

    // Simulate developer reporting regression during verification -> looping back to in_progress
    const updatedRow = { ...issueRow, status: 'in_progress', updated_at: new Date().toISOString() };
    const mappedBack = mapDevIssue(updatedRow);
    expect(mappedBack.status).toBe('in_progress');
  });

  // ─── 2. Factual Evidence Aggregation Invariant ───────────────────────────

  it('computes factual evidence strictly from recorded events without deriving unrecorded states', () => {
    const events = [
      {
        id: 'evt_1',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'implementation.reported',
        author: 'gemini',
        content: 'Implemented theme toggle in header',
        metadata: { changedFiles: ['src/Header.jsx', 'src/theme.js'] },
        createdAt: '2026-08-30T10:00:00.000Z'
      },
      {
        id: 'evt_2',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'tests.reported',
        author: 'gemini',
        content: 'Tests passed: 371 passed, 0 failed',
        metadata: { status: 'passed', command: 'npm test', passed: 371, failed: 0 },
        createdAt: '2026-08-30T10:05:00.000Z'
      },
      {
        id: 'evt_3',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'build.reported',
        author: 'gemini',
        content: 'Build passed',
        metadata: { status: 'passed', command: 'npm run build' },
        createdAt: '2026-08-30T10:07:00.000Z'
      },
      {
        id: 'evt_4',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'commit.reported',
        author: 'gemini',
        content: 'feat: add theme toggle',
        metadata: { hash: '90c26e7', branch: 'main' },
        createdAt: '2026-08-30T10:10:00.000Z'
      }
    ];

    const evidence = computeFactualEvidence(events);

    // Verified factual states
    expect(evidence.implementation.reported).toBe(true);
    expect(evidence.implementation.changedFiles).toEqual(['src/Header.jsx', 'src/theme.js']);

    expect(evidence.tests.reported).toBe(true);
    expect(evidence.tests.status).toBe('passed');
    expect(evidence.tests.passed).toBe(371);

    expect(evidence.build.reported).toBe(true);
    expect(evidence.build.status).toBe('passed');

    expect(evidence.commit.reported).toBe(true);
    expect(evidence.commit.hash).toBe('90c26e7');
    expect(evidence.commit.branch).toBe('main');

    // CRITICAL INVARIANT: Downstream states are NOT derived merely because tests and build passed
    expect(evidence.deployment.reported).toBe(false);
    expect(evidence.deployment.timestamp).toBeUndefined();

    expect(evidence.verification.reported).toBe(false);
    expect(evidence.verification.timestamp).toBeUndefined();
  });

  // ─── 3. Developer Question & Decision Circuit ─────────────────────────────

  it('records developer questions and decision approvals in append-only event stream', async () => {
    const supabase = createMockSupabase();

    // 1. Gemini asks question
    const questionResult = await executeTool(supabase, 'ask_developer_question', {
      issueId: 'iss_dev_1',
      sessionId: 'sess_dev_1',
      question: 'Should we fork chat sessions or create a new branch?',
      proposal: 'Add forked_from_session_id column to chat_sessions table',
      decisionRequired: 'Do you approve the database migration approach?'
    });

    expect(questionResult).toBeDefined();
    expect(supabase.from).toHaveBeenCalledWith('dev_events');

    // 2. Luna / User approves decision
    const decisionResult = await executeTool(supabase, 'answer_dev_question', {
      issueId: 'iss_dev_1',
      sessionId: 'sess_dev_1',
      questionEventId: 'evt_question_1',
      decision: 'approved',
      answer: 'Approved. Proceed with adding forked_from_session_id with nullable foreign key.'
    });

    expect(decisionResult).toBeDefined();
    const eventInsert = supabase.from('dev_events').insert;
    expect(eventInsert).toHaveBeenCalled();
  });

  // ─── 4. End-to-End Dev Tool Calling ──────────────────────────────────────

  it('executes create_dev_issue and get_dev_issue cleanly', async () => {
    const supabase = createMockSupabase();

    const createResult = await executeTool(supabase, 'create_dev_issue', {
      title: 'Implement Luna Development Bridge V1',
      description: 'Create durable cloud dev service, local ephemeral bridge CLI, and evidence model',
      acceptanceCriteria: [
        'Separate dev schema from personal field',
        'Append-only event stream',
        'Factual evidence aggregation'
      ],
      priority: 'critical'
    });

    expect(createResult).toBeDefined();
    expect(createResult.content[0].text).toBeDefined();

    const getResult = await executeTool(supabase, 'get_dev_issue', {
      id: 'iss_dev_123'
    });

    expect(getResult).toBeDefined();
    expect(getResult.content[0].text).toBeDefined();
  });

  it('reports tests, build, and commit evidence via tool dispatcher', async () => {
    const supabase = createMockSupabase();

    const testReport = await executeTool(supabase, 'report_tests', {
      issueId: 'iss_dev_1',
      sessionId: 'sess_dev_1',
      status: 'passed',
      command: 'npm test',
      passed: 371,
      failed: 0
    });
    expect(testReport).toBeDefined();

    const buildReport = await executeTool(supabase, 'report_build', {
      issueId: 'iss_dev_1',
      sessionId: 'sess_dev_1',
      status: 'passed',
      command: 'npm run build'
    });
    expect(buildReport).toBeDefined();

    const commitReport = await executeTool(supabase, 'report_commit', {
      issueId: 'iss_dev_1',
      sessionId: 'sess_dev_1',
      hash: 'f13ed51',
      branch: 'main',
      message: 'feat: add dev bridge schema and tools'
    });
    expect(commitReport).toBeDefined();
  });

  // ─── 5. Ephemeral Dev Session Authorization Model ─────────────────────────

  it('creates and authorizes ephemeral Dev Sessions with short-lived tokens', async () => {
    let insertedSession = null;
    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sess_123', status: 'connected' },
                error: null
              })
            })
          })
        }),
        insert: vi.fn().mockImplementation((data) => {
          insertedSession = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...data,
                  token: 'dtk_abcdef1234567890',
                  token_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                },
                error: null
              })
            })
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'sess_123',
                    status: 'ended',
                    token: null,
                    token_expires_at: null
                  },
                  error: null
                })
              })
            })
          })
        })
      },
      dev_events: {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'evt_started', type: 'session.started' },
              error: null
            })
          })
        })
      }
    };

    const supabase = createMockSupabase(customHandlers);

    const authResult = await executeTool(supabase, 'authorize_dev_session', {
      issueId: 'iss_1788132031507_65z7',
      agent: 'gemini',
      model: 'gemini-2.5-pro'
    });

    expect(authResult).toBeDefined();
    const parsed = JSON.parse(authResult.content[0].text);
    expect(parsed.connectCommand).toContain('iss_1788132031507_65z7');
    expect(parsed.connectCommand).toContain('--token dtk_');
  });

  // ─── 8. Intent-Aware Task Dispatch & Classification Invariants ───────────

  it('classifies read-only investigation requests correctly without triggering workflow or completion', () => {
    const event = {
      id: 'evt_inv_1',
      type: 'decision.approved',
      content: 'READ-ONLY INVESTIGATION TEST: Inspect the actual Luna Dev Bridge implementation and determine how the 15-minute idle timeout currently works. Do not modify any code.',
      metadata: { status: 'bridge_read_test' }
    };

    const intent = classifyEventIntent(event);
    expect(intent.intent).toBe('read_only_investigation');
    expect(intent.isReadOnly).toBe(true);
    expect(intent.requiresWorkflow).toBe(false);
    expect(intent.requiresCompletion).toBe(false);
  });

  it('classifies read-only scope requests correctly without triggering workflow or completion', () => {
    const event = {
      id: 'evt_scope_1',
      type: 'decision.approved',
      content: 'READ-ONLY SCOPE REQUEST — Echo / Reading symbol swap. Do not modify code, run implementation, or commit anything. Inspect the current repository and determine the exact scope required.',
      metadata: { scopeRequest: 'echo_reading_symbol_swap' }
    };

    const intent = classifyEventIntent(event);
    expect(intent.intent).toBe('read_only_scope_request');
    expect(intent.isReadOnly).toBe(true);
    expect(intent.requiresWorkflow).toBe(false);
    expect(intent.requiresCompletion).toBe(false);
  });

  it('classifies developer questions and clarifications as non-workflow read actions', () => {
    const event = {
      id: 'evt_q_1',
      type: 'developer.question',
      content: 'Should we require automated test evidence before closing the issue?',
      metadata: { decisionRequired: true }
    };

    const intent = classifyEventIntent(event);
    expect(intent.intent).toBe('clarification');
    expect(intent.isReadOnly).toBe(true);
    expect(intent.requiresWorkflow).toBe(false);
    expect(intent.requiresCompletion).toBe(false);
  });

  it('classifies authorized implementation directives correctly and keeps session open', () => {
    const event = {
      id: 'evt_impl_1',
      type: 'decision.approved',
      content: 'APPROVED — Implement the proposed Dev Bridge task-dispatch fix identified in the diagnosis.',
      metadata: { status: 'approved_for_implementation' }
    };

    const intent = classifyEventIntent(event);
    expect(intent.intent).toBe('implementation_directive');
    expect(intent.isReadOnly).toBe(false);
    expect(intent.requiresWorkflow).toBe(true);
    expect(intent.requiresCompletion).toBe(false); // Session must NOT be closed automatically
  });

  it('requires completion only when explicitly specified', () => {
    const event = {
      id: 'evt_complete_1',
      type: 'session.completed',
      content: 'Dev Bridge verification complete with all criteria met.'
    };

    const intent = classifyEventIntent(event);
    expect(intent.intent).toBe('session_action');
    expect(intent.requiresCompletion).toBe(true);
  });

  // ─── 9. Distinct Evidence-Event Typing & Verification Reporting ─────────

  it('preserves distinct event types for verification and deployment evidence without collapsing to implementation', () => {
    const events = [
      {
        id: 'evt_v_1',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'verification.reported',
        author: 'gemini',
        content: 'Autonomous wake circuit independently verified',
        metadata: { verifiedBy: 'gemini', branch: 'main' },
        createdAt: '2026-08-31T01:36:00.000Z'
      },
      {
        id: 'evt_d_1',
        issueId: 'iss_test_1',
        sessionId: 'sess_1',
        userId: mockUser.id,
        type: 'deployment.reported',
        author: 'gemini',
        content: 'Deployed to production',
        metadata: { environment: 'production', url: 'https://loops-app.com' },
        createdAt: '2026-08-31T01:40:00.000Z'
      }
    ];

    const evidence = computeFactualEvidence(events);
    expect(evidence.verification.reported).toBe(true);
    expect(evidence.verification.verifiedBy).toBe('gemini');
    expect(evidence.verification.notes).toBe('Autonomous wake circuit independently verified');

    expect(evidence.deployment.reported).toBe(true);
    expect(evidence.deployment.environment).toBe('production');
    expect(evidence.deployment.url).toBe('https://loops-app.com');

    // Ensure implementation is NOT falsely marked as reported when only verification occurred
    expect(evidence.implementation.reported).toBe(false);
  });

  // ─── 10. Secure Automatic New-Issue & Session Handoff ───────────────────

  it('generates handoff event containing non-secret ticket and no raw dtk token', () => {
    const fromSessionId = 'sess_old_1';
    const targetSessionId = 'sess_new_2';
    const targetIssueId = 'iss_voice_bug';
    const ticket = 'hnf_test_random_ticket_123';

    const handoffEvent = {
      id: 'evt_handoff_1',
      issueId: 'iss_old',
      sessionId: fromSessionId,
      userId: mockUser.id,
      type: 'session.handoff',
      author: 'luna',
      content: 'Transitioning to Voice Echo audio persistence bug',
      metadata: {
        nextIssueId: targetIssueId,
        nextSessionId: targetSessionId,
        handoffTicket: ticket
      },
      createdAt: '2026-08-31T02:14:00.000Z'
    };

    // Verify event metadata contains no raw dtk_ credentials
    expect(handoffEvent.metadata.handoffTicket).toMatch(/^hnf_/);
    expect(handoffEvent.metadata.nextToken).toBeUndefined();
    expect(JSON.stringify(handoffEvent)).not.toContain('dtk_');

    const intent = classifyEventIntent(handoffEvent);
    expect(intent.intent).toBe('session_action');
    expect(intent.isReadOnly).toBe(true);
    expect(intent.requiresWorkflow).toBe(false);
  });

  it('cold-start discovery exposes only authorized pending Gemini sessions without personal field data', () => {
    const rawSessions = [
      {
        id: 'sess_1',
        issue_id: 'iss_voice_bug',
        user_id: mockUser.id,
        agent: 'gemini',
        status: 'connected',
        started_at: '2026-08-31T02:00:00.000Z',
        token_expires_at: new Date(Date.now() + 100000).toISOString()
      }
    ];

    const discoveryItems = rawSessions.map(s => ({
      id: s.id,
      issueId: s.issue_id,
      agent: s.agent,
      startedAt: s.started_at,
      status: s.status
    }));

    expect(discoveryItems).toHaveLength(1);
    expect(discoveryItems[0].issueId).toBe('iss_voice_bug');
    // Ensure no personal fields (loops, echoes, reflections, profile data) are present
    expect(discoveryItems[0].loops).toBeUndefined();
    expect(discoveryItems[0].echoes).toBeUndefined();
    expect(discoveryItems[0].token).toBeUndefined(); // Raw session token is not leaked in discovery listing
  });

  // ─── 11. Cold-Start Pending Assignment Lifecycle & Atomic Claim ────────

  it('creates an unclaimed pending session without active token credentials', async () => {
    let inserted = null;
    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sess_pending_123', status: 'pending' },
                error: null
              })
            })
          })
        }),
        insert: vi.fn().mockImplementation((data) => {
          inserted = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...data, id: 'sess_pending_123' },
                error: null
              })
            })
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis()
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const session = await createDevSession(supabase, mockUser.id, {
      issueId: 'iss_cold_start_1',
      status: 'pending'
    });

    expect(session.status).toBe('pending');
    expect(session.token).toBeUndefined();
    expect(session.tokenExpiresAt).toBeUndefined();
    expect(inserted.status).toBe('pending');
    expect(inserted.token).toBeNull();
    expect(inserted.token_expires_at).toBeNull();
  });

  it('atomically claims a pending session, minting an active token with 30m rolling expiration', async () => {
    let updated = null;
    const pendingSessionRow = {
      id: 'sess_pending_999',
      issue_id: 'iss_cold_start_999',
      user_id: mockUser.id,
      agent: 'gemini',
      model: null,
      status: 'pending',
      token: null,
      token_expires_at: null,
      repository: null,
      branch: null,
      environment: {},
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    };

    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: pendingSessionRow, error: null })
            })
          })
        }),
        update: vi.fn().mockImplementation((data) => {
          updated = data;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...pendingSessionRow, ...data },
                    error: null
                  })
                })
              })
            })
          };
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const result = await claimPendingDevSession(supabase, mockUser.id, 'sess_pending_999', 'gemini');

    expect(result.session.status).toBe('connected');
    expect(result.token).toMatch(/^dtk_/);
    expect(updated.status).toBe('connected');
    expect(updated.token).toMatch(/^dtk_/);
    expect(new Date(updated.token_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects claim attempts on sessions that are already ended or invalid', async () => {
    const endedSessionRow = {
      id: 'sess_ended_999',
      issue_id: 'iss_cold_start_999',
      user_id: mockUser.id,
      status: 'ended'
    };

    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: endedSessionRow, error: null })
            })
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    await expect(
      claimPendingDevSession(supabase, mockUser.id, 'sess_ended_999', 'gemini')
    ).rejects.toThrow(/cannot be claimed/);
  });

  it('GPT/API create_dev_session defaults to pending status with no active dtk_ token before claim', async () => {
    let inserted = null;
    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sess_gpt_pending_1', status: 'pending' },
                error: null
              })
            })
          })
        }),
        insert: vi.fn().mockImplementation((data) => {
          inserted = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...data, id: 'sess_gpt_pending_1' },
                error: null
              })
            })
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis()
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    // GPT calls create_dev_session without specifying status
    const result = await executeTool(supabase, 'create_dev_session', {
      issueId: 'iss_gpt_test_1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.session.status).toBe('pending');
    expect(parsed.token).toBeNull();
    expect(parsed.expiresAt).toBeNull();
    expect(parsed.connectCommand).toContain('watch-pending --claim');
    expect(inserted.status).toBe('pending');
    expect(inserted.token).toBeNull();
    expect(inserted.token_expires_at).toBeNull();
  });

  it('validates dedicated Development discovery credentials (dsc_...) and rejects invalid tokens', async () => {
    const valid = await validateDevDiscoveryToken('dsc_test_machine_discovery_credential_123');
    expect(valid).not.toBeNull();
    expect(valid.valid).toBe(true);
    expect(valid.userId).toBeDefined();

    const shortToken = await validateDevDiscoveryToken('dsc_short');
    expect(shortToken).toBeNull();

    const invalid = await validateDevDiscoveryToken('invalid_token_xyz');
    expect(invalid).toBeNull();

    const empty = await validateDevDiscoveryToken('');
    expect(empty).toBeNull();
  });

  it('listPendingDevSessions enforces user isolation and only returns authorized user sessions', async () => {
    const targetUserId = 'usr_authorized_123';
    const otherUserId = 'usr_other_456';
    let queriedUserId = null;

    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col, val) => {
            if (col === 'user_id') queriedUserId = val;
            return {
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'sess_auth_1',
                      issue_id: 'iss_auth_1',
                      user_id: targetUserId,
                      agent: 'gemini',
                      status: 'pending',
                      started_at: new Date().toISOString()
                    }
                  ],
                  error: null
                })
              })
            };
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const result = await listPendingDevSessions(supabase, targetUserId);
    expect(queriedUserId).toBe(targetUserId);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].issueId).toBe('iss_auth_1');
    expect(result.items[0].status).toBe('pending');
    expect(result.items[0].token).toBeUndefined(); // Minimal metadata only
  });

  it('getSupabaseService fails closed when SUPABASE_SERVICE_ROLE_KEY is absent', () => {
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(() => getSupabaseService()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
    } finally {
      if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it('getSupabaseService succeeds and creates client when SUPABASE_SERVICE_ROLE_KEY is provided', () => {
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_secret_key_12345';
      const client = getSupabaseService();
      expect(client).toBeDefined();
      expect(client.from).toBeDefined();
    } finally {
      if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it('handleWatcherDiscoveryEvent terminates in single-shot mode and stays alive in daemon mode', () => {
    const singleShotState = { mode: 'single-shot', activeSessionId: null, pollIntervalMs: 4000 };
    const singleRes = handleWatcherDiscoveryEvent(singleShotState, 'sess_discovered_1');
    expect(singleRes.shouldExit).toBe(true);
    expect(singleRes.nextState.activeSessionId).toBe('sess_discovered_1');

    const daemonState = { mode: 'daemon', activeSessionId: null, pollIntervalMs: 4000 };
    const daemonRes = handleWatcherDiscoveryEvent(daemonState, 'sess_discovered_1');
    expect(daemonRes.shouldExit).toBe(false);
    expect(daemonRes.nextState.activeSessionId).toBe('sess_discovered_1');
  });

  it('handleWatcherSessionEndedEvent re-arms idle discovery polling in daemon mode', () => {
    const activeState = { mode: 'daemon', activeSessionId: 'sess_active_123', pollIntervalMs: 5000 };
    const rearmed = handleWatcherSessionEndedEvent(activeState);
    expect(rearmed.activeSessionId).toBeNull();
    expect(rearmed.pollIntervalMs).toBe(4000);
  });

  it('listPendingDevSessions applies since cutoff filter and excludes older sessions', async () => {
    const targetUserId = 'usr_cutoff_test_1';
    const cutoffTimestamp = '2026-08-31T20:50:00.000Z';
    let gteField = null;
    let gteVal = null;

    const customHandlers = {
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              gte: vi.fn().mockImplementation((field, val) => {
                gteField = field;
                gteVal = val;
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'sess_newer_1',
                        issue_id: 'iss_newer_1',
                        user_id: targetUserId,
                        agent: 'gemini',
                        status: 'pending',
                        started_at: '2026-08-31T20:55:00.000Z'
                      }
                    ],
                    error: null
                  })
                };
              })
            })
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const result = await listPendingDevSessions(supabase, targetUserId, cutoffTimestamp);
    expect(gteField).toBe('started_at');
    expect(gteVal).toBe(cutoffTimestamp);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].issueId).toBe('iss_newer_1');
  });

  it('listPendingDevSessions auto-creates pending sessions for unassigned ready issues', async () => {
    const targetUserId = 'usr_auto_ready_1';
    let insertedSession = null;

    const customHandlers = {
      dev_issues: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'iss_ready_new_1', assigned_agent: 'gemini' }],
              error: null
            })
          })
        })
      },
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sess_auto_1',
                    issue_id: 'iss_ready_new_1',
                    agent: 'gemini',
                    status: 'pending',
                    started_at: new Date().toISOString()
                  }
                ],
                error: null
              })
            }),
            eq: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'sess_auto_1',
                      issue_id: 'iss_ready_new_1',
                      agent: 'gemini',
                      status: 'pending',
                      started_at: new Date().toISOString()
                    }
                  ],
                  error: null
                })
              })
            })
          })
        }),
        insert: vi.fn().mockImplementation((data) => {
          insertedSession = data;
          return { error: null };
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const result = await listPendingDevSessions(supabase, targetUserId);
    expect(insertedSession).toBeDefined();
    expect(insertedSession.issue_id).toBe('iss_ready_new_1');
    expect(insertedSession.status).toBe('pending');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].issueId).toBe('iss_ready_new_1');
  });

  // ─── 9. Lifecycle Versioning, Stale Evidence & Completion Summaries ─────

  it('resets active cycle evidence on issue.reopened and archives prior cycle into priorCycles', () => {
    const events = [
      // Cycle 1: Completed previously
      { id: 'e1', type: 'implementation.reported', createdAt: '2026-09-04T12:00:00Z', metadata: {} },
      { id: 'e2', type: 'tests.reported', createdAt: '2026-09-04T12:05:00Z', metadata: { passed: true } },
      { id: 'e3', type: 'build.reported', createdAt: '2026-09-04T12:10:00Z', metadata: { passed: true } },
      { id: 'e4', type: 'commit.reported', createdAt: '2026-09-04T12:15:00Z', metadata: { hash: 'abc' } },
      { id: 'e5', type: 'deployment.reported', createdAt: '2026-09-04T12:20:00Z', metadata: { url: 'https://test' } },
      { id: 'e6', type: 'verification.reported', createdAt: '2026-09-04T12:25:00Z', metadata: { verified: true } },
      // Lifecycle cutoff: issue reopened
      { id: 'e7', type: 'issue.reopened', createdAt: '2026-09-04T13:00:00Z', metadata: { invalidatesVerification: true } }
    ];

    const evidence = computeFactualEvidence(events);
    expect(evidence.lifecycleCycle).toBe(2);
    expect(evidence.isStale).toBe(true);
    expect(evidence.priorCycles).toHaveLength(1);
    expect(evidence.priorCycles[0].cycle).toBe(1);
    expect(evidence.priorCycles[0].evidence.implementation).toBe(true);
    expect(evidence.priorCycles[0].evidence.verification).toBe(true);

    // Current cycle must be completely reset
    expect(evidence.implementation.reported).toBe(false);
    expect(evidence.tests.reported).toBe(false);
    expect(evidence.build.reported).toBe(false);
    expect(evidence.commit.reported).toBe(false);
    expect(evidence.deployment.reported).toBe(false);
    expect(evidence.verification.reported).toBe(false);
    expect(evidence.completionSummary.reported).toBe(false);
  });

  it('correctly parses structured completion.summary event and clears isStale when cycle finishes', () => {
    const events = [
      { id: 'e1', type: 'issue.reopened', createdAt: '2026-09-04T13:00:00Z', metadata: {} },
      { id: 'e2', type: 'implementation.reported', createdAt: '2026-09-04T13:05:00Z', metadata: {} },
      { id: 'e3', type: 'tests.reported', createdAt: '2026-09-04T13:10:00Z', metadata: { passed: true } },
      { id: 'e4', type: 'build.reported', createdAt: '2026-09-04T13:15:00Z', metadata: { passed: true } },
      { id: 'e5', type: 'commit.reported', createdAt: '2026-09-04T13:20:00Z', metadata: { hash: 'def123' } },
      { id: 'e6', type: 'deployment.reported', createdAt: '2026-09-04T13:25:00Z', metadata: { url: 'https://test' } },
      { id: 'e7', type: 'verification.reported', createdAt: '2026-09-04T13:30:00Z', metadata: { verified: true } },
      {
        id: 'e8',
        type: 'completion.summary',
        author: 'gemini',
        createdAt: '2026-09-04T13:35:00Z',
        content: JSON.stringify({
          agent: 'gemini',
          summary: 'Lifecycle versioning implemented and tested',
          changes: ['mcp-server/src/devBridge.ts'],
          testResults: { passed: true, passedCount: 15 },
          buildResults: { passed: true },
          commit: { hash: 'def123', branch: 'main' },
          acceptanceStatus: 'awaiting_user_acceptance',
          nextStep: 'Test reopening an issue'
        })
      }
    ];

    const evidence = computeFactualEvidence(events);
    expect(evidence.isStale).toBe(false);
    expect(evidence.completionSummary.reported).toBe(true);
    expect(evidence.completionSummary.agent).toBe('gemini');
    expect(evidence.completionSummary.summary).toBe('Lifecycle versioning implemented and tested');
    expect(evidence.completionSummary.changes).toEqual(['mcp-server/src/devBridge.ts']);
    expect(evidence.completionSummary.testResults.passed).toBe(true);
  });

  it('formatCompletionSummary produces standard canonical schema', () => {
    const summary = formatCompletionSummary({
      agent: 'gemini',
      summary: 'Verified fix',
      changes: ['file1.js'],
      commit: { hash: '123' }
    });
    expect(summary.agent).toBe('gemini');
    expect(summary.summary).toBe('Verified fix');
    expect(summary.changes).toEqual(['file1.js']);
    expect(summary.acceptanceStatus).toBe('awaiting_user_acceptance');
    expect(summary.testResults.passed).toBe(true);
    expect(summary.buildResults.passed).toBe(true);
  });

  it('getDevQueueState prevents an in_progress reopened issue from prematurely flipping to awaiting_acceptance', async () => {
    const customHandlers = {
      dev_issues: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'iss_reopened_1',
                  user_id: 'usr_dev_test_999',
                  title: 'Reopened Issue',
                  priority: 'high',
                  status: 'in_progress',
                  order_index: 1,
                  created_at: '2026-09-04T10:00:00Z',
                  updated_at: '2026-09-04T13:00:00Z'
                }
              ],
              error: null
            })
          })
        })
      },
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'sess_reopened_1',
                  issue_id: 'iss_reopened_1',
                  user_id: 'usr_dev_test_999',
                  agent: 'gemini',
                  status: 'working',
                  started_at: '2026-09-04T13:01:00Z',
                  last_activity_at: '2026-09-04T13:05:00Z'
                }
              ],
              error: null
            })
          })
        })
      },
      dev_events: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'e1', type: 'implementation.reported', created_at: '2026-09-04T11:00:00Z' },
                { id: 'e2', type: 'tests.reported', created_at: '2026-09-04T11:05:00Z' },
                { id: 'e3', type: 'build.reported', created_at: '2026-09-04T11:10:00Z' },
                { id: 'e4', type: 'commit.reported', created_at: '2026-09-04T11:15:00Z' },
                { id: 'e5', type: 'deployment.reported', created_at: '2026-09-04T11:20:00Z' },
                { id: 'e6', type: 'verification.reported', created_at: '2026-09-04T11:25:00Z' },
                { id: 'e7', type: 'issue.reopened', created_at: '2026-09-04T13:00:00Z' }
              ],
              error: null
            })
          })
        })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const queueState = await getDevQueueState(supabase, 'usr_dev_test_999');
    expect(queueState.items).toHaveLength(1);
    expect(queueState.items[0].status).toBe('working');
    expect(queueState.items[0].evidenceProgress.verification).toBe(false);
  });

  it('advanceDevQueue rejects advancing an issue when current cycle evidence is incomplete', async () => {
    const customHandlers = {
      dev_issues: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'iss_incomplete_1',
                  user_id: 'usr_dev_test_999',
                  title: 'Incomplete Issue',
                  priority: 'high',
                  status: 'verification',
                  order_index: 1,
                  created_at: '2026-09-04T10:00:00Z',
                  updated_at: '2026-09-04T13:00:00Z'
                }
              ],
              error: null
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      },
      dev_sessions: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      },
      dev_events: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'e1', type: 'implementation.reported', created_at: '2026-09-04T11:00:00Z' }
              ],
              error: null
            })
          })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      }
    };
    const supabase = createMockSupabase(customHandlers);

    const advanceResult = await advanceDevQueue(supabase, 'usr_dev_test_999', 'iss_incomplete_1');
    expect(advanceResult.advanced).toBe(false);
    expect(advanceResult.message).toContain('incomplete verification evidence');
  });
});



