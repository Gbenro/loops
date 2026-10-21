import crypto from 'node:crypto';
import type { Request } from 'express';

export const DEV_READ_ACTIONS = new Set([
  'dev.issues.list', 'dev.issues.get', 'dev.events.list',
  'dev.sessions.pending', 'dev.sessions.get', 'dev.queue.get_state',
]);
export const DEV_REPORT_EVENTS = new Set([
  'developer.question', 'developer.blocked', 'implementation.started',
  'implementation.reported', 'tests.reported', 'build.reported', 'commit.reported',
  'verification.reported', 'completion.summary', 'session.handoff',
  'session.completed', 'session.failed',
]);
const DEV_ACTIONS = new Set([...DEV_READ_ACTIONS, 'dev.issues.create',
  'dev.issues.update_status', 'dev.events.post', 'dev.sessions.create',
  'dev.sessions.claim', 'dev.sessions.end']);
export const VERIFIED_AGENTS = new Set(['codex', 'gemini', 'luna']);

export function secretEquals(actual: string | undefined, configured: string | undefined): boolean {
  if (!actual || !configured) return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(actual).digest(),
    crypto.createHash('sha256').update(configured).digest(),
  );
}

export class DevAuthorizationError extends Error {
  status = 403;
}
export function requireAgent(agent: unknown): string {
  if (typeof agent !== 'string' || !VERIFIED_AGENTS.has(agent)) {
    throw new DevAuthorizationError('An explicit supported agent identity is required.');
  }
  return agent;
}
export function payloadFor(body: any): any {
  return { ...body, ...(body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}) };
}

/** Applied before supplying a service-role client. Everything not allowed is denied. */
export function authorizeDevelopmentRequest(req: Request): void {
  const r = req as any;
  const session = r.devSession;
  const readOnly = r.isDiscoverySession || r.isDevObserver;
  if (!readOnly && !session) return;
  const path = req.path;
  // Only the gateway accepts a nested payload. Legacy REST handlers use flat bodies.
  const p = path === '/api/luna/command-center/dev' ? payloadFor(req.body) : (req.body || {});
  if (path === '/api/luna/command-center/dev') {
    const action = req.body?.action;
    if (!DEV_ACTIONS.has(action)) throw new DevAuthorizationError('Development action is not permitted.');
    const issueAction = ['dev.issues.get', 'dev.events.list', 'dev.events.post'].includes(action);
    if (issueAction && new Set([p.id, p.issueId, p.issue_id].filter(value => value !== undefined)).size > 1) {
      throw new DevAuthorizationError('Conflicting issue identifiers are not permitted.');
    }
    if (readOnly) {
      if (!DEV_READ_ACTIONS.has(action)) throw new DevAuthorizationError('This development credential is read-only.');
      return;
    }
    const issue = p.issueId || p.issue_id || p.id;
    const sessionId = p.sessionId || p.session_id || p.id;
    if (['dev.issues.get', 'dev.events.list', 'dev.events.post'].includes(action)) {
      if (issue !== session.issueId) throw new DevAuthorizationError('Credential is scoped to a different issue.');
    } else if (['dev.sessions.get', 'dev.sessions.end'].includes(action)) {
      if (sessionId !== session.id) throw new DevAuthorizationError('Credential is scoped to a different session.');
    } else {
      throw new DevAuthorizationError('Session credential cannot execute this action.');
    }
    if (action === 'dev.events.list' && (p.sessionId || p.session_id) && (p.sessionId || p.session_id) !== session.id) {
      throw new DevAuthorizationError('Credential is scoped to a different session.');
    }
    if (action === 'dev.events.post') authorizeReport(p, session);
    return;
  }
  // Older REST routes obey the same policy; no Personal Field, asset, lab or execution access.
  if (readOnly) {
    if (req.method === 'GET' && (
      path === '/api/dev/queue' || path === '/api/dev/agent/pending-sessions' ||
      /^\/api\/dev\/issues(?:\/[^/]+(?:\/events)?)?$/.test(path) ||
      /^\/api\/dev\/sessions\/[^/]+(?:\/events)?$/.test(path)
    )) return;
    throw new DevAuthorizationError('Read-only development credential cannot access this route.');
  }
  const issueRoute = path.match(/^\/api\/dev\/issues\/([^/]+)(?:\/(events))?$/);
  if (req.method === 'GET' && issueRoute && issueRoute[1] === session.issueId) return;
  const sessionRoute = path.match(/^\/api\/dev\/sessions\/([^/]+)(?:\/(events|heartbeat|end))?$/);
  if (sessionRoute && sessionRoute[1] === session.id) {
    if (req.method === 'GET' && (!sessionRoute[2] || sessionRoute[2] === 'events')) return;
    if (req.method === 'POST' && ['heartbeat', 'end'].includes(sessionRoute[2])) return;
    if (req.method === 'POST' && sessionRoute[2] === 'events') { authorizeReport(p, session); return; }
  }
  throw new DevAuthorizationError('Session credential cannot access this route.');
}

export function authorizeReport(payload: any, session: any): void {
  const issue = payload.issueId || payload.issue_id || payload.id;
  if (issue !== session.issueId || (payload.sessionId || payload.session_id) && (payload.sessionId || payload.session_id) !== session.id) {
    throw new DevAuthorizationError('Report issue/session does not match its credential.');
  }
  if (requireAgent(payload.author || payload.agent) !== requireAgent(session.agent)) {
    throw new DevAuthorizationError('Report author does not match the authenticated agent.');
  }
  if (!DEV_REPORT_EVENTS.has(payload.type)) throw new DevAuthorizationError('Event requires creator authority.');
  const m = payload.metadata;
  if (!m || m.agent !== session.agent || typeof m.workstream !== 'string' || !m.workstream.trim()) {
    throw new DevAuthorizationError('Reports require matching agent and explicit workstream metadata.');
  }
}

/** Never return ephemeral credentials through read operations. */
export function publicDevResult(value: any): any {
  if (typeof value === 'string') {
    let safe = value.replace(/(?:dsc_|dtk_)[A-Za-z0-9_-]{16,}/g, '[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
    for (const secret of [process.env.LUNA_DEV_DISCOVERY_KEY, process.env.LUNA_DEV_DOT_READ_TOKEN, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
      if (secret) safe = safe.split(secret).join('[REDACTED]');
    }
    return safe;
  }
  if (Array.isArray(value)) return value.map(publicDevResult);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/token|secret|password|authorization|credential/i.test(key))
    .map(([key, item]) => [key, publicDevResult(item)]));
}
