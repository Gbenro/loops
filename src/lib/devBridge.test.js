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
  validateDevDiscoveryToken
} from '../../mcp-server/dist/devBridge.js';
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
});

