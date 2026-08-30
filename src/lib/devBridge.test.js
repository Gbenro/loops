import { describe, it, expect, vi } from 'vitest';
import {
  computeFactualEvidence,
  mapDevIssue,
  mapDevSession,
  mapDevEvent
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
    expect(parsed.token).toMatch(/^dtk_/);
    expect(parsed.expiresAt).toBeDefined();
    expect(parsed.connectCommand).toContain('iss_1788132031507_65z7');
    expect(parsed.connectCommand).toContain('--token dtk_');
  });
});
