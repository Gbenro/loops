import { afterEach, describe, expect, it, vi } from 'vitest';
import express from '../../mcp-server/node_modules/express/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { authorizeDevelopmentRequest, publicDevResult, requireAgent, DevMaintenanceError, isDevBridgeMaintenanceActive } from '../../mcp-server/dist/devAuthorization.js';
import { validateDevDiscoveryToken, validateDevSessionToken, claimPendingDevSession, listPendingDevSessions, computeFactualEvidence, createDevSession, claimNextExecution } from '../../mcp-server/dist/devBridge.js';
import { registerCommandCenterRoutes } from '../../mcp-server/dist/commandCenter.js';

const session = { id: 'session-codex', issueId: 'issue-1', agent: 'codex' };
const request = (action, payload = {}, flags = {}) => ({ method: 'POST', path: '/api/luna/command-center/dev', body: { action, payload }, ...flags });
const event = (author, workstream, passed, id) => ({ id, author, type: 'tests.reported', content: 'Local tests', createdAt: `2026-10-20T10:00:0${id}Z`, metadata: { agent: author, workstream, status: passed ? 'passed' : 'failed', passed: passed ? 4 : 0, failed: passed ? 0 : 1 } });
afterEach(() => vi.unstubAllEnvs());

describe('Development credential boundaries', () => {
  it('accepts only the configured secret and explicit configured owner', async () => {
    vi.stubEnv('LUNA_DEV_DISCOVERY_KEY', 'dsc_test_configured_secret_only');
    vi.stubEnv('LUNA_DEV_DEFAULT_USER_ID', 'owner-1');
    expect(await validateDevDiscoveryToken('dsc_test_configured_secret_only')).toEqual({ valid: true, userId: 'owner-1' });
    for (const token of ['', 'dsc_any_long_forged_credential', 'dsc_test_configured_secret_only-extra']) expect(await validateDevDiscoveryToken(token)).toBeNull();
    vi.stubEnv('LUNA_DEV_DISCOVERY_KEY', '');
    expect(await validateDevDiscoveryToken('dsc_test_configured_secret_only')).toBeNull();
  });
  it('fails closed without an owner and rejects implicit or arbitrary agents', async () => {
    vi.stubEnv('LUNA_DEV_DISCOVERY_KEY', 'dsc_test_configured_secret_only');
    vi.stubEnv('LUNA_DEV_DEFAULT_USER_ID', '');
    expect(await validateDevDiscoveryToken('dsc_test_configured_secret_only')).toBeNull();
    for (const agent of [undefined, '', 'unknown', 'admin', 'Gemini', 'root']) expect(() => requireAgent(agent)).toThrow();
    expect(requireAgent('codex')).toBe('codex');
    expect(requireAgent('gemini')).toBe('gemini');
    expect(requireAgent('luna')).toBe('luna');
    expect(requireAgent('dot')).toBe('dot');
  });
  it.each(['isDiscoverySession', 'isDevObserver'])('%s can read development data but cannot mutate or inspect the Field', role => {
    for (const action of ['dev.issues.list', 'dev.issues.get', 'dev.events.list', 'dev.sessions.get', 'dev.sessions.pending', 'dev.queue.get_state']) expect(() => authorizeDevelopmentRequest(request(action, {}, { [role]: true }))).not.toThrow();
    for (const action of ['dev.events.post', 'dev.issues.create', 'dev.issues.update_status', 'dev.sessions.claim', 'dev.sessions.create', 'dev.sessions.end', 'dev.inspect.echo']) expect(() => authorizeDevelopmentRequest(request(action, {}, { [role]: true }))).toThrow();
    for (const path of ['/api/echoes', '/api/threads', '/api/relational-memories', '/api/reflections/conversation', '/api/search', '/api/luna/command-center/core', '/api/luna/command-center/creative', '/api/dev/executions/claim-next', '/api/dev/assets']) expect(() => authorizeDevelopmentRequest({ method: 'POST', path, body: {}, [role]: true })).toThrow();
  });
  it('binds issue, session, agent, event authority and workstream to the credential', () => {
    const payload = { issueId: session.issueId, sessionId: session.id, author: 'codex', type: 'tests.reported', metadata: { agent: 'codex', workstream: 'ui' } };
    const call = p => authorizeDevelopmentRequest(request('dev.events.post', p, { devSession: session }));
    expect(() => call(payload)).not.toThrow();
    for (const change of [{ issueId: 'other' }, { sessionId: 'other' }, { author: 'gemini' }, { type: 'decision.approved' }, { type: 'deployment.reported' }, { metadata: { agent: 'gemini', workstream: 'ui' } }, { metadata: {} }]) expect(() => call({ ...payload, ...change })).toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: 'other' }, { devSession: session }))).toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: 'other', issueId: 'issue-1' }, { devSession: session }))).toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: 'issue-1' }, { devSession: session }))).not.toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.sessions.claim', { id: session.id }, { devSession: session }))).toThrow();
  });
  it('enforces identical issue and author restrictions on the legacy REST reporting route', () => {
    const req = { method: 'POST', path: `/api/dev/sessions/${session.id}/events`, devSession: session, body: { issueId: 'issue-1', author: 'codex', type: 'build.reported', metadata: { agent: 'codex', workstream: 'ui' } } };
    expect(() => authorizeDevelopmentRequest(req)).not.toThrow();
    expect(() => authorizeDevelopmentRequest({ ...req, body: { ...req.body, issueId: 'other' } })).toThrow();
    expect(() => authorizeDevelopmentRequest({ ...req, path: '/api/dev/sessions/other/events' })).toThrow();
    expect(() => authorizeDevelopmentRequest({ ...req, body: { ...req.body, type: 'scope.updated', payload: { type: 'tests.reported' } } })).toThrow();
  });
  it('removes credentials recursively from development read responses', () => {
    expect(publicDevResult({ latestSession: { id: 's', token: 'secret', tokenExpiresAt: 'time', environment: { password: 'secret', branch: 'safe' } }, list: [{ authorization: 'secret', author: 'codex' }] })).toEqual({ latestSession: { id: 's', environment: { branch: 'safe' } }, list: [{ author: 'codex' }] });
    vi.stubEnv('LUNA_DEV_DOT_READ_TOKEN', 'fixture-custom-observer-secret');
    expect(publicDevResult('old note: fixture-custom-observer-secret')).not.toContain('fixture-custom-observer-secret');
  });
});

function claimDatabase(row, win = true) {
  const filters = [];
  const update = vi.fn();
  const selectChain = { eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: row, error: null }) };
  const mutation = { eq: vi.fn((key, value) => { filters.push([key, value]); return mutation; }), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: win ? { ...row, status: 'connected' } : null, error: win ? null : { message: 'Concurrent claim' } }) };
  update.mockReturnValue(mutation);
  return { filters, update, db: { from: () => ({ select: () => selectChain, update }) } };
}
describe('Claims, discovery and evidence isolation', () => {
  it('session validation reads the credential without renewing it or performing writes', async () => {
    const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 's', user_id: 'owner', issue_id: 'i', agent: 'codex', status: 'connected' }, error: null }), update: vi.fn() };
    expect((await validateDevSessionToken('dtk_fixture_session_credential', { from: () => table })).session.agent).toBe('codex');
    expect(table.update).not.toHaveBeenCalled();
    table.single.mockResolvedValue({ data: null, error: null });
    expect(await validateDevSessionToken('dtk_fixture_wrong_session_credential', { from: () => table })).toBeNull();
  });
  it('creator cannot provision a session for an issue owned by someone else', async () => {
    const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), insert: vi.fn() };
    await expect(createDevSession({ from: () => table }, 'owner', { issueId: 'someone-elses-issue', agent: 'codex' })).rejects.toThrow(/not owned/);
    expect(table.insert).not.toHaveBeenCalled();
  });
  it('claims only a pending session owned by the explicitly assigned agent, with compare-and-set filters', async () => {
    const mock = claimDatabase({ id: 's', agent: 'codex', status: 'pending' });
    const result = await claimPendingDevSession(mock.db, 'owner', 's', 'codex');
    expect(result.token).toMatch(/^dtk_[a-f0-9]{64}$/);
    expect(mock.filters).toContainEqual(['status', 'pending']);
    expect(mock.filters).toContainEqual(['agent', 'codex']);
    const race = claimDatabase({ id: 's', agent: 'codex', status: 'pending' }, false);
    await expect(claimPendingDevSession(race.db, 'owner', 's', 'codex')).rejects.toThrow();
  });
  it.each(['connected', 'working', 'ended'])('cannot replace a %s session token', async status => {
    const mock = claimDatabase({ id: 's', agent: 'codex', status, token: 'original-token' });
    await expect(claimPendingDevSession(mock.db, 'owner', 's', 'codex')).rejects.toThrow();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('cannot claim another agent’s pending session', async () => {
    const mock = claimDatabase({ id: 's', agent: 'gemini', status: 'pending' });
    await expect(claimPendingDevSession(mock.db, 'owner', 's', 'codex')).rejects.toThrow();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('pending discovery never provisions a session or changes database state', async () => {
    const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }), insert: vi.fn(), update: vi.fn() };
    await listPendingDevSessions({ from: () => table }, 'owner');
    expect(table.insert).not.toHaveBeenCalled();
    expect(table.update).not.toHaveBeenCalled();
  });
  it('preserves separate contributor evidence and does not overwrite legacy evidence', () => {
    const legacy = { ...event('luna', '', true, 0), metadata: { status: 'passed', passed: 9 } };
    const summary = computeFactualEvidence([legacy, event('codex', 'ui', true, 1), event('gemini', 'integration', false, 2)]);
    expect(summary.tests.passed).toBe(9);
    expect(summary.workstreams['codex:ui'].tests.status).toBe('passed');
    expect(summary.workstreams['gemini:integration'].tests.status).toBe('failed');
    expect(summary.completionSummary.reported).toBe(false);
  });
});

describe('Dot contributor role and security boundaries', () => {
  const dotSession = { id: 'session-dot', issueId: 'issue-1', agent: 'dot' };
  const dotPayload = (overrides = {}) => ({
    issueId: dotSession.issueId,
    sessionId: dotSession.id,
    author: 'dot',
    type: 'developer.question',
    content: 'Dot coordination query or QA finding',
    metadata: { agent: 'dot', workstream: 'qa' },
    ...overrides
  });

  it('allows authenticated dot session to read development state and post verified coordination events', () => {
    // Reads permitted for Dot
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: dotSession.issueId }, { devSession: dotSession }))).not.toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.events.list', { issueId: dotSession.issueId }, { devSession: dotSession }))).not.toThrow();
    expect(() => authorizeDevelopmentRequest(request('dev.sessions.get', { id: dotSession.id }, { devSession: dotSession }))).not.toThrow();

    // Allowed coordination reporting types
    for (const type of ['developer.question', 'developer.blocked', 'implementation.started', 'implementation.reported', 'tests.reported', 'session.handoff', 'completion.summary']) {
      expect(() => authorizeDevelopmentRequest(request('dev.events.post', dotPayload({ type }), { devSession: dotSession }))).not.toThrow();
    }
  });

  it('rejects dot session attempting impersonation, cross-issue writes, or unauthorized actions', () => {
    const call = p => authorizeDevelopmentRequest(request('dev.events.post', p, { devSession: dotSession }));

    // Rejects impersonating other agents
    for (const impostor of ['codex', 'gemini', 'luna']) {
      expect(() => call(dotPayload({ author: impostor }))).toThrow(/author does not match/i);
      expect(() => call(dotPayload({ metadata: { agent: impostor, workstream: 'qa' } }))).toThrow(/matching agent/i);
    }

    // Rejects cross-issue and cross-session writes
    expect(() => call(dotPayload({ issueId: 'different-issue' }))).toThrow(/scoped to a different issue|does not match/i);
    expect(() => call(dotPayload({ sessionId: 'session-other' }))).toThrow(/does not match/i);

    // Rejects deployment or approval event types (no creator authority)
    for (const disallowedType of ['deployment.reported', 'decision.approved', 'decision.rejected']) {
      expect(() => call(dotPayload({ type: disallowedType }))).toThrow(/creator authority/i);
    }

    // Rejects creator administrative actions
    for (const action of ['dev.issues.create', 'dev.issues.update_status', 'dev.sessions.create', 'dev.sessions.claim', 'dev.inspect.echo']) {
      expect(() => authorizeDevelopmentRequest(request(action, {}, { devSession: dotSession }))).toThrow();
    }

    // Rejects access to Personal Field or core routes
    for (const path of ['/api/echoes', '/api/threads', '/api/relational-memories', '/api/luna/command-center/core']) {
      expect(() => authorizeDevelopmentRequest({ method: 'POST', path, body: {}, devSession: dotSession })).toThrow();
    }
  });

  it('provisions and claims dedicated pending session for dot', async () => {
    const mock = claimDatabase({ id: 's-dot', agent: 'dot', status: 'pending' });
    const result = await claimPendingDevSession(mock.db, 'owner', 's-dot', 'dot');
    expect(result.token).toMatch(/^dtk_[a-f0-9]{64}$/);
    expect(mock.filters).toContainEqual(['status', 'pending']);
    expect(mock.filters).toContainEqual(['agent', 'dot']);

    // Another agent cannot claim Dot's pending session
    const otherMock = claimDatabase({ id: 's-dot', agent: 'dot', status: 'pending' });
    await expect(claimPendingDevSession(otherMock.db, 'owner', 's-dot', 'codex')).rejects.toThrow();
  });

  it('preserves four-agent contributor evidence without cross-agent collisions', () => {
    const legacy = { ...event('luna', '', true, 0), metadata: { status: 'passed', passed: 9 } };
    const codexEvt = event('codex', 'ui', true, 1);
    const geminiEvt = event('gemini', 'integration', true, 2);
    const dotEvt = { ...event('dot', 'qa', true, 3), content: 'Dot verified QA suite' };
    const summary = computeFactualEvidence([legacy, codexEvt, geminiEvt, dotEvt]);

    expect(summary.tests.passed).toBe(9);
    expect(summary.workstreams['codex:ui'].tests.status).toBe('passed');
    expect(summary.workstreams['gemini:integration'].tests.status).toBe('passed');
    expect(summary.workstreams['dot:qa'].tests.status).toBe('passed');
    expect(summary.workstreams['dot:qa'].tests.passed).toBe(4);
  });

  it('enforces that scoped dot session cannot execute discovery actions', () => {
    // Discovery actions only permitted to discovery/observer credentials, not scoped sessions
    for (const action of ['dev.issues.list', 'dev.sessions.pending', 'dev.queue.get_state']) {
      expect(() => authorizeDevelopmentRequest(request(action, {}, { devSession: dotSession }))).toThrow(/Session credential cannot execute this action/i);
    }
  });
});

describe('Development Bridge Maintenance Gate', () => {
  it('fails closed with status 503 when LUNA_DEV_MAINTENANCE is set, without affecting public routes', async () => {
    vi.stubEnv('LUNA_DEV_MAINTENANCE', 'true');
    expect(isDevBridgeMaintenanceActive()).toBe(true);

    const dotSession = { id: 'session-dot', issueId: 'issue-1', agent: 'dot' };
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: 'issue-1' }, { devSession: dotSession })))
      .toThrow(DevMaintenanceError);

    try {
      authorizeDevelopmentRequest(request('dev.issues.get', { id: 'issue-1' }, { devSession: dotSession }));
    } catch (err) {
      expect(err.status).toBe(503);
      expect(err.code).toBe('DEV_BRIDGE_MAINTENANCE');
    }

    // Command Center dev route returns 503 under maintenance
    const app = express(); app.use(express.json());
    registerCommandCenterRoutes(app, (req, _res, next) => { req.devSession = dotSession; req.devUserId = 'owner'; next(); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}/api/luna/command-center/dev`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dev.issues.get', payload: { id: 'issue-1' } })
      });
      const data = await res.json();
      expect(res.status).toBe(503);
      expect(data.error.code).toBe('DEV_BRIDGE_MAINTENANCE');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('restores normal operation when maintenance mode is inactive', () => {
    vi.stubEnv('LUNA_DEV_MAINTENANCE', 'false');
    expect(isDevBridgeMaintenanceActive()).toBe(false);
    const dotSession = { id: 'session-dot', issueId: 'issue-1', agent: 'dot' };
    expect(() => authorizeDevelopmentRequest(request('dev.issues.get', { id: 'issue-1' }, { devSession: dotSession }))).not.toThrow();
  });
});

describe('Session provisioning and execution queue isolation', () => {
  it('marks created dev sessions as coordination mode and prevents them from entering execution queue', async () => {
    const table = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'iss-coord-1' }, error: null }),
      insert: vi.fn((data) => ({ select: () => ({ single: async () => ({ data: { ...data, id: 'sess-coord-1' }, error: null }) }) })),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
    };

    const session = await createDevSession({ from: () => table }, 'owner', {
      issueId: 'iss-coord-1',
      agent: 'dot'
    });

    expect(session.environment.mode).toBe('coordination');

    // In claimNextExecution, active coordination sessions do not block repository execution slot
    const mockDb = {
      from: (tbl) => {
        if (tbl === 'dev_sessions') {
          const sessionObj = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'sess-coord-1', status: 'connected' }, error: null }),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'sess-coord-1',
                  issue_id: 'iss-coord-1',
                  user_id: 'owner',
                  status: 'connected',
                  repository: 'loops-app',
                  environment: { mode: 'coordination' },
                  started_at: new Date().toISOString()
                }
              ],
              error: null
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'exec-sess-1' }, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
          };
          return sessionObj;
        }
        if (tbl === 'dev_issues') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [{ id: 'iss-exec-1', title: 'Worker Task', status: 'ready', priority: 'high', user_id: 'owner', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
              error: null
            }),
            single: vi.fn().mockResolvedValue({
              data: { id: 'iss-exec-1', title: 'Worker Task', status: 'ready', priority: 'high', user_id: 'owner' },
              error: null
            }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) })
          };
        }
        if (tbl === 'dev_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }) }) })
          };
        }
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'exec-1' }, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
        };
      }
    };

    const result = await claimNextExecution(mockDb, 'owner', {
      workerId: 'worker-1',
      workerInstanceId: 'inst-1',
      runtimeProfiles: ['agy-headless'],
      repository: 'loops-app'
    });

    expect(result.status).toBe('claimed');
    expect(result.execution.issueId).toBe('iss-exec-1');
  });

  it('provisions separate agent-bound sessions for codex, gemini, and dot with distinct CAS filters', async () => {
    for (const agent of ['codex', 'gemini', 'dot']) {
      const mock = claimDatabase({ id: `sess-${agent}`, agent, status: 'pending' });
      const claimed = await claimPendingDevSession(mock.db, 'owner', `sess-${agent}`, agent);
      expect(claimed.token).toMatch(/^dtk_[a-f0-9]{64}$/);
      expect(mock.filters).toContainEqual(['agent', agent]);
    }
  });
});

describe('Real local Command Center route', () => {
  it('observer can retrieve status with credentials redacted and an authenticated creator cannot use the removed inspection action', async () => {
    const app = express(); app.use(express.json());
    const row = { id: 's', issue_id: 'i', user_id: 'owner', agent: 'gemini', status: 'connected', token: 'secret', environment: { secret: 'also-secret', branch: 'agent/gemini-integration' } };
    const table = { select() { return this; }, eq() { return this; }, single: async () => ({ data: row, error: null }) };
    registerCommandCenterRoutes(app, (req, _res, next) => { req.isDevObserver = req.headers['x-fixture-creator'] !== 'yes'; req.devUserId = 'owner'; req.body.supabaseClient = { from: () => table }; next(); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}/api/luna/command-center/dev`;
      const result = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dev.sessions.get', payload: { sessionId: 's' } }) });
      const body = await result.json();
      expect(result.status).toBe(200);
      expect(body.data.agent).toBe('gemini');
      expect(body.data.token).toBeUndefined();
      expect(body.data.environment.secret).toBeUndefined();
      const removed = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fixture-creator': 'yes' }, body: JSON.stringify({ action: 'dev.inspect.echo' }) });
      expect(removed.status).toBe(400);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  it('rejects restricted gateway actions before any database access', async () => {
    const app = express(); app.use(express.json());
    const database = { from: vi.fn(() => { throw new Error('Unexpected database access'); }) };
    registerCommandCenterRoutes(app, (req, _res, next) => { req.isDevObserver = true; req.devUserId = 'owner'; req.body.supabaseClient = database; next(); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      for (const action of ['dev.inspect.echo', 'dev.events.post', 'dev.sessions.claim', 'dev.issues.update_status']) {
        const result = await fetch(`http://127.0.0.1:${server.address().port}/api/luna/command-center/dev`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload: {} }) });
        expect(result.status).toBe(403);
      }
      expect(database.from).not.toHaveBeenCalled();
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});

describe('Coordination CLI publishing boundary', () => {
  it('defaults to an offline dry-run and rejects discovery credentials for publishing', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-coordination-test-'));
    const file = path.join(folder, 'report.json');
    const report = { reportId: 'fixture-report', agent: 'codex', workstream: 'security', sessionId: 'fixture-session', type: 'tests.reported', content: 'Local fixture report', changedFiles: [], completedWork: [], testResults: [], dependencies: [], blockers: [], requiredDecisions: [] };
    fs.writeFileSync(file, JSON.stringify(report));
    try {
      const args = ['bin/luna-coordinate.mjs', 'report', 'fixture-issue', file];
      const options = { encoding: 'utf8', env: { ...process.env, LUNA_DEV_API_URL: 'http://127.0.0.1:1', LUNA_DEV_TOKEN: 'dsc_fixture_read_credential' }, stdio: ['ignore', 'pipe', 'pipe'] };
      const result = JSON.parse(execFileSync(process.execPath, args, options));
      expect(result.dryRun).toBe(true);
      expect(result.payload.metadata.agent).toBe('codex');
      expect(result.payload.metadata.branch).toBeTruthy();
      expect(() => execFileSync(process.execPath, [...args, '--publish'], options)).toThrow();
      fs.writeFileSync(file, JSON.stringify({ ...report, agent: 'dot' }));
      expect(() => execFileSync(process.execPath, args, options)).toThrow();
    } finally { fs.unlinkSync(file); fs.rmdirSync(folder); }
  });
});
