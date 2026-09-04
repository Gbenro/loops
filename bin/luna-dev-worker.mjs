#!/usr/bin/env node
/**
 * Luna Development Service → Multi-Harness Local Dev Worker
 * Supports AGY (Antigravity Headless) and DSH (DeepSeek Harness) behind a stable activation contract.
 * Strictly respects assignedAgent routing, recovers stale/orphaned sessions, and enforces verification gating.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  getHarnessAdapter,
  HarnessRegistry,
  SUPPORTED_RUNTIMES,
  LOCAL_RUNTIMES,
  resolveWorkspaceForWindows,
  verifyExecutionOutcome,
  formatElapsed
} from '../src/lib/harnessAdapters.js';

const API_BASE = process.env.LUNA_API_URL || 'https://loops-production-e1d5.up.railway.app';
const AUTH_FILE = path.join(process.env.HOME || '/home/ben', '.luna/auth.json');
const MAPPING_FILE = path.join(process.env.HOME || '/home/ben', '.luna/agy-sessions.json');
const POLL_INTERVAL_MS = parseInt(process.env.LUNA_POLL_INTERVAL_MS || '5000', 10);
const STALE_SESSION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function getAuthToken() {
  if (process.env.LUNA_DEV_TOKEN) return process.env.LUNA_DEV_TOKEN;
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      const token = auth.discoveryToken || auth.token;
      if (token) return token;
    } catch {
      // ignore
    }
  }
  throw new Error(`Authentication token not found in ${AUTH_FILE} or LUNA_DEV_TOKEN env.`);
}

export function getConversationMapping() {
  if (fs.existsSync(MAPPING_FILE)) {
    try { return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')); } catch { return {}; }
  }
  return {};
}

export function saveConversationMapping(mapping) {
  const dir = path.dirname(MAPPING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

export function getGitChangedFiles(workspaceDir) {
  try {
    const out = execSync('git status --porcelain', { cwd: workspaceDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map(line => line.trim().slice(3));
  } catch {
    return [];
  }
}

/**
 * Checks for orphaned or dead sessions that remain 'connected' without an active process,
 * and recovers them safely to prevent permanent WORKING stalls.
 */
export async function recoverStaleSessions(token) {
  try {
    const pendRes = await fetch(`${API_BASE}/api/dev/agent/pending-sessions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!pendRes.ok) return;
    const pendData = await pendRes.json();
    const now = Date.now();

    for (const session of pendData.items || []) {
      if (session.status === 'connected' && session.startedAt) {
        const elapsed = now - new Date(session.startedAt).getTime();
        if (elapsed > STALE_SESSION_THRESHOLD_MS) {
          console.log(`[Luna Dev Worker] Recovering orphaned stale session ${session.id} (idle for ${formatElapsed(elapsed)})...`);
          await fetch(`${API_BASE}/api/dev/sessions/${session.id}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason: 'stale_worker_recovery' })
          });
        }
      }
    }
  } catch {
    // Graceful recovery attempt
  }
}

/**
 * Polls for the next eligible queue item or pending session, resolves target harness runtime, claims session,
 * executes task through the appropriate adapter, and posts comprehensive evidence.
 */
export async function pollAndExecuteNext({
  workspaceDir = process.cwd(),
  defaultAgent = 'agy',
  forceAgent = null,
  targetIssue = null
} = {}) {
  const token = getAuthToken();

  // Recover any dead/orphaned sessions before claiming new work
  await recoverStaleSessions(token);

  // 1. Check pending-sessions first (covers sessions started by Development Service)
  const pendRes = await fetch(`${API_BASE}/api/dev/agent/pending-sessions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let sessionItem = null;
  let targetIssueId = targetIssue;

  if (pendRes.ok) {
    const pendData = await pendRes.json();
    const items = pendData.items || [];
    
    if (targetIssue) {
      sessionItem = items.find(s => s.issueId === targetIssue && s.status === 'pending');
    } else {
      // Find sessions explicitly matching local runtimes (agy, dsh). Do NOT claim 'gemini' tasks!
      sessionItem = items.find(s => {
        if (s.status !== 'pending') return false;
        // Never claim gemini tasks with the local headless worker!
        if (s.agent === 'gemini') return false;
        if (forceAgent) return s.agent === forceAgent;
        return LOCAL_RUNTIMES.includes(s.agent) || s.agent === defaultAgent;
      });
    }
    
    if (sessionItem) {
      targetIssueId = sessionItem.issueId;
    }
  }

  // 2. If no pending session found directly, check dev queue for next eligible item
  let nextItem = null;
  if (!sessionItem && !targetIssue) {
    const queueRes = await fetch(`${API_BASE}/api/dev/queue`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (queueRes.ok) {
      const queueData = await queueRes.json();
      nextItem = (queueData.items || []).find(i => {
        if (!i.isEligible || (i.status !== 'queued' && i.status !== 'discovered')) return false;
        // Never claim gemini tasks with the local headless worker!
        if (i.assignedAgent === 'gemini') return false;
        if (forceAgent) return i.assignedAgent === forceAgent;
        return true;
      });
      if (nextItem) {
        targetIssueId = nextItem.issueId;
      }
    }
  }

  if (!targetIssueId && !sessionItem) {
    return { status: 'idle', message: 'No eligible items or pending sessions in queue' };
  }

  // 3. Fetch issue details
  const issueRes = await fetch(`${API_BASE}/api/dev/issues/${targetIssueId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let issueData = {};
  if (issueRes.ok) {
    const raw = await issueRes.json();
    issueData = raw.issue || raw;
  }

  // STRICT AGENT ROUTING: If issue is assigned to 'gemini', local worker must NOT claim it!
  const authoritativeAgent = issueData.assignedAgent || (sessionItem ? sessionItem.agent : null) || defaultAgent;
  if (authoritativeAgent === 'gemini') {
    console.log(`[Luna Dev Worker] Skipping issue ${targetIssueId} assigned to [GEMINI] (interactive cloud agent).`);
    return { status: 'skipped_gemini_task', issueId: targetIssueId };
  }

  // Determine target runtime adapter
  const targetAgent = forceAgent || authoritativeAgent;
  const adapter = getHarnessAdapter(targetAgent);

  if (!adapter) {
    console.warn(`[Luna Dev Worker] No local harness adapter found for target agent: '${targetAgent}'. Skipping.`);
    return { status: 'unsupported_agent', agent: targetAgent, issueId: targetIssueId };
  }

  // If sessionItem wasn't found from pending-sessions directly, find it now
  if (!sessionItem) {
    const pendRes2 = await fetch(`${API_BASE}/api/dev/agent/pending-sessions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (pendRes2.ok) {
      const pendData2 = await pendRes2.json();
      sessionItem = (pendData2.items || []).find(s => s.issueId === targetIssueId);
    }
  }

  if (!sessionItem) {
    return { status: 'waiting_for_session', issueId: targetIssueId };
  }

  // 4. Claim session with explicit adapter name
  const claimRes = await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agent: adapter.name })
  });
  if (!claimRes.ok) {
    return { status: 'claim_failed', issueId: targetIssueId, error: await claimRes.text() };
  }
  const claimData = await claimRes.json();
  const sessionToken = claimData.token;

  console.log(`[Luna Dev Worker] Claimed session ${sessionItem.id} for issue ${targetIssueId} (${issueData.title || targetIssueId}) using [${adapter.name.toUpperCase()}] adapter`);

  // 5. Resolve conversation mapping if supported
  const mappings = getConversationMapping();
  const existingConvId = mappings[targetIssueId] || null;

  // 6. Post implementation.started event
  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: targetIssueId,
      type: 'implementation.started',
      author: adapter.name,
      content: `AUTONOMOUS ${adapter.name.toUpperCase()} EXECUTION STARTED: Discovered and claimed issue ${targetIssueId}. Runtime: ${adapter.runtimeIdentity}. Target workspace: ${workspaceDir}.`,
      metadata: {
        agent: adapter.name,
        runtimeIdentity: adapter.runtimeIdentity,
        conversationId: existingConvId,
        startedAt: new Date().toISOString()
      }
    })
  });

  // 7. Execute task via adapter with heartbeat logging
  console.log(`[Luna Dev Worker] Invoking ${adapter.name.toUpperCase()} adapter in ${workspaceDir}...`);
  const prompt = `You are executing an autonomous development task for Luna Development Service issue ${targetIssueId}: ${issueData.title || targetIssueId}.

Description & Instructions:
${issueData.description || issueData.title || targetIssueId}

Please fulfill this request directly and output your final result clearly.`;

  const executionResult = await adapter.executeTask({
    prompt,
    workspaceDir,
    conversationId: existingConvId
  });

  console.log(`[Luna Dev Worker] ${adapter.name.toUpperCase()} finished with exit code ${executionResult.exitCode} in ${executionResult.durationMs}ms`);

  // Record conversation mapping if agy generated a conversation_id
  if (executionResult.structuredOutput?.conversation_id) {
    mappings[targetIssueId] = executionResult.structuredOutput.conversation_id;
    saveConversationMapping(mappings);
  }

  // 8. Check changed files
  const changedFiles = getGitChangedFiles(workspaceDir);

  // 9. Post substantive evidence
  const substantiveContent = `${adapter.name.toUpperCase()} EXECUTION RESULT:
Status: ${executionResult.terminationReason} (Exit code ${executionResult.exitCode} in ${executionResult.durationMs}ms)

Assistant Response:
${executionResult.finalResponse || '(No response text)'}

Changed Files: ${changedFiles.length > 0 ? changedFiles.join(', ') : 'None'}`;

  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: targetIssueId,
      type: 'implementation.reported',
      author: adapter.name,
      content: substantiveContent,
      metadata: {
        agent: adapter.name,
        exitCode: executionResult.exitCode,
        durationMs: executionResult.durationMs,
        success: executionResult.success,
        model: executionResult.model,
        finalResponse: executionResult.finalResponse,
        changedFiles,
        deniedActions: executionResult.deniedActions,
        terminationReason: executionResult.terminationReason
      }
    })
  });

  // 10. Strict verification gating
  const verification = verifyExecutionOutcome({
    executionResult,
    issue: issueData,
    changedFiles
  });

  if (verification.verified) {
    console.log(`[Luna Dev Worker] Verification PASSED for ${targetIssueId}.`);
    await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        issueId: targetIssueId,
        type: 'verification.reported',
        author: adapter.name,
        content: `VERIFICATION CONFIRMED: ${adapter.name.toUpperCase()} executed successfully and satisfied all verification gates.`,
        metadata: {
          verified: true,
          agent: adapter.name,
          durationMs: executionResult.durationMs
        }
      })
    });

    await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ reason: 'completed' })
    });
  } else {
    console.warn(`[Luna Dev Worker] Verification REJECTED for ${targetIssueId}: ${verification.reasons.join(' ')}`);
    await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        issueId: targetIssueId,
        type: 'verification.reported',
        author: adapter.name,
        content: `VERIFICATION FAILED / INCOMPLETE: ${verification.reasons.join(' ')}`,
        metadata: {
          verified: false,
          reasons: verification.reasons,
          agent: adapter.name
        }
      })
    });
  }

  return {
    status: 'executed',
    issueId: targetIssueId,
    sessionId: sessionItem.id,
    agent: adapter.name,
    executionResult,
    verified: verification.verified
  };
}

/**
 * Starts continuous daemon worker loop
 */
export async function startDaemonWorker({
  workspaceDir = process.cwd(),
  intervalMs = POLL_INTERVAL_MS,
  defaultAgent = 'agy',
  forceAgent = null
} = {}) {
  let isRunning = true;
  let activePoll = false;

  console.log('===============================================================');
  console.log('  LUNA DEVELOPMENT SERVICE → MULTI-HARNESS DEV WORKER');
  console.log('===============================================================');
  console.log(`[Luna Dev Worker] Target API:      ${API_BASE}`);
  console.log(`[Luna Dev Worker] Workspace:       ${workspaceDir}`);
  console.log(`[Luna Dev Worker] Default Agent:   ${forceAgent || defaultAgent}`);
  console.log(`[Luna Dev Worker] Local Runtimes:  ${LOCAL_RUNTIMES.join(', ')}`);
  console.log(`[Luna Dev Worker] Poll Interval:   ${intervalMs}ms`);

  // Verify auth immediately on startup
  try {
    const token = getAuthToken();
    console.log(`[Luna Dev Worker] Auth:            Verified (${token.substring(0, 8)}...)`);
  } catch (err) {
    console.error(`[Luna Dev Worker] FATAL ERROR: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Luna Dev Worker] Status:          ACTIVE (Polling for eligible tasks & pending sessions)`);
  console.log('---------------------------------------------------------------');

  const shutdown = () => {
    if (!isRunning) return;
    isRunning = false;
    console.log('\n[Luna Dev Worker] Shutting down dev worker cleanly...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const tick = async () => {
    if (!isRunning || activePoll) return;
    activePoll = true;
    try {
      const result = await pollAndExecuteNext({
        workspaceDir,
        defaultAgent,
        forceAgent
      });
      if (result.status === 'executed') {
        console.log(`[Luna Dev Worker] Task ${result.issueId} executed by ${result.agent} (verified: ${result.verified}).`);
      }
    } catch (err) {
      console.warn(`[Luna Dev Worker] Poll warning: ${err.message}`);
    } finally {
      activePoll = false;
    }
  };

  // Initial tick
  await tick();

  // Recurring loop
  const timer = setInterval(tick, intervalMs);

  return {
    stop: () => {
      clearInterval(timer);
      isRunning = false;
    }
  };
}

// ─── Direct CLI Entrypoint ────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  let forceAgent = null;
  let workspaceDir = process.cwd();
  let singleShot = false;
  let targetIssue = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && args[i + 1]) {
      forceAgent = args[i + 1];
      i++;
    } else if (args[i] === '--workspace' && args[i + 1]) {
      workspaceDir = args[i + 1];
      i++;
    } else if (args[i] === '--issue' && args[i + 1]) {
      targetIssue = args[i + 1];
      i++;
    } else if (args[i] === '--once') {
      singleShot = true;
    }
  }

  if (singleShot) {
    pollAndExecuteNext({ workspaceDir, forceAgent, targetIssue }).then(res => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }).catch(err => {
      console.error(`[Luna Dev Worker] Error: ${err.message}`);
      process.exit(1);
    });
  } else {
    startDaemonWorker({ workspaceDir, forceAgent }).catch(err => {
      console.error(`[Luna Dev Worker] Fatal error: ${err.message}`);
      process.exit(1);
    });
  }
}
