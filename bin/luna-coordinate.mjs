#!/usr/bin/env node
// Explicit read/report commands only. No watcher, execution worker, claims, or deploys.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [command, issueId, file, flag] = process.argv.slice(2);
const base = process.env.LUNA_DEV_API_URL || 'https://loops-production-e1d5.up.railway.app';
const reads = new Set(['read', 'events', 'sessions', 'queue']);
const types = new Set(['developer.question', 'developer.blocked', 'implementation.reported', 'tests.reported', 'build.reported', 'session.handoff', 'completion.summary']);
const scrub = value => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|secret|password|authorization|credential/i.test(key)).map(([key, item]) => [key, scrub(item)]));
  return typeof value === 'string' ? value.replace(/(?:dsc_|dtk_)[A-Za-z0-9_-]{16,}/g, '[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]') : value;
};
async function call(action, payload, token) {
  const response = await fetch(`${base}/api/luna/command-center/dev`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, payload }), signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(`Bridge request failed (${response.status}): ${JSON.stringify(scrub(body.error))}`);
  return body.data;
}
async function main() {
  if (reads.has(command)) {
    const token = process.env.LUNA_DEV_OBSERVER_TOKEN || process.env.LUNA_DEV_DISCOVERY_KEY || process.env.LUNA_DEV_TOKEN;
    if (!token) throw new Error('Set a scoped development read credential in the environment.');
    const action = { read: 'dev.issues.get', events: 'dev.events.list', sessions: 'dev.sessions.pending', queue: 'dev.queue.get_state' }[command];
    if (['read', 'events'].includes(command) && !issueId) throw new Error('An issue ID is required.');
    console.log(JSON.stringify(scrub(await call(action, { id: issueId, issueId }, token)), null, 2));
    return;
  }
  if (command !== 'report' || !issueId || !file) throw new Error('Usage: luna-coordinate.mjs read|events <issueId>; sessions; queue; report <issueId> <report.json> [--publish]');
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!['codex', 'gemini'].includes(report.agent) || !types.has(report.type) || !report.sessionId || !report.workstream || !report.content) throw new Error('Report requires agent, workstream, sessionId, recognized type, and content.');
  for (const field of ['changedFiles', 'completedWork', 'testResults', 'dependencies', 'blockers', 'requiredDecisions']) if (!Array.isArray(report[field])) throw new Error(`${field} must be an explicit array.`);
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const reportId = report.reportId || (await import('node:crypto')).randomUUID();
  const payload = { issueId, sessionId: report.sessionId, author: report.agent, type: report.type, content: report.content, metadata: { ...report, reportId, branch: git(['branch', '--show-current']), commit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])) } };
  // Dry-run by default. Publishing uses an issued agent session credential only.
  if (flag !== '--publish') { console.log(JSON.stringify({ dryRun: true, payload: scrub(payload) }, null, 2)); return; }
  const token = process.env.LUNA_DEV_TOKEN;
  if (!token?.startsWith('dtk_')) throw new Error('Publishing requires an agent-bound session token; discovery/observer credentials cannot write.');
  const events = await call('dev.events.list', { issueId }, token);
  const existing = (Array.isArray(events) ? events : []).find(event => event.metadata?.reportId === reportId && event.author === report.agent);
  if (existing) { console.log(JSON.stringify({ alreadyPublished: true, eventId: existing.id })); return; }
  // A timeout remains ambiguous: retry with the SAME reportId after reading events.
  console.log(JSON.stringify(scrub(await call('dev.events.post', payload, token)), null, 2));
}
main().catch(error => { console.error(scrub(error.message)); process.exitCode = 1; });
