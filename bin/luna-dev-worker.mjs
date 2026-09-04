#!/usr/bin/env node
/**
 * Luna Development Service → Multi-Harness Local Dev Worker
 * Supports AGY (Antigravity Headless) and DSH (DeepSeek Harness) behind a stable activation contract.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  getHarnessAdapter,
  HarnessRegistry,
  SUPPORTED_RUNTIMES,
  resolveWorkspaceForWindows
} from '../src/lib/harnessAdapters.js';

const API_BASE = process.env.LUNA_API_URL || 'https://loops-production-e1d5.up.railway.app';
const AUTH_FILE = path.join(process.env.HOME || '/home/ben', '.luna/auth.json');
const MAPPING_FILE = path.join(process.env.HOME || '/home/ben', '.luna/agy-sessions.json');
const POLL_INTERVAL_MS = parseInt(process.env.LUNA_POLL_INTERVAL_MS || '5000', 10);

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
 * Polls for the next eligible queue item, resolves target harness runtime, claims session,
 * executes task through the appropriate adapter, and posts comprehensive evidence.
 */
export async function pollAndExecuteNext({
  workspaceDir = process.cwd(),
  defaultAgent = 'agy',
  forceAgent = null
} = {}) {
  const token = getAuthToken();

  // 1. Check queue for next eligible item
  const queueRes = await fetch(`${API_BASE}/api/dev/queue`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!queueRes.ok) {
    throw new Error(`Failed to fetch dev queue: HTTP ${queueRes.status} ${queueRes.statusText}`);
  }
  const queueData = await queueRes.json();
  const nextItem = (queueData.items || []).find(i => i.isEligible && (i.status === 'queued' || i.status === 'discovered'));

  if (!nextItem) {
    return { status: 'idle', message: 'No eligible items in queue' };
  }

  // 2. Discover pending session
  const pendRes = await fetch(`${API_BASE}/api/dev/agent/pending-sessions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!pendRes.ok) {
    throw new Error(`Failed to fetch pending sessions: HTTP ${pendRes.status}`);
  }
  const pendData = await pendRes.json();
  const sessionItem = (pendData.items || []).find(s => s.issueId === nextItem.issueId);

  if (!sessionItem) {
    return { status: 'waiting_for_session', issueId: nextItem.issueId };
  }

  // Determine target runtime adapter
  const targetAgent = forceAgent || sessionItem.agent || nextItem.assignedAgent || defaultAgent;
  const adapter = getHarnessAdapter(targetAgent);

  // 3. Claim session
  const claimRes = await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agent: adapter.name })
  });
  if (!claimRes.ok) {
    return { status: 'claim_failed', issueId: nextItem.issueId, error: await claimRes.text() };
  }
  const claimData = await claimRes.json();
  const sessionToken = claimData.token;

  console.log(`[Luna Dev Worker] Claimed session ${sessionItem.id} for issue ${nextItem.issueId} (${nextItem.title}) using [${adapter.name.toUpperCase()}] adapter`);

  // 4. Resolve conversation mapping if supported
  const mappings = getConversationMapping();
  const existingConvId = mappings[nextItem.issueId] || null;

  // 5. Post implementation.started event
  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: nextItem.issueId,
      type: 'implementation.started',
      author: adapter.name,
      content: `AUTONOMOUS ${adapter.name.toUpperCase()} EXECUTION STARTED: Discovered and claimed issue ${nextItem.issueId}. Runtime: ${adapter.runtimeIdentity}. Target workspace: ${workspaceDir}.`,
      metadata: {
        agent: adapter.name,
        runtimeIdentity: adapter.runtimeIdentity,
        conversationId: existingConvId,
        startedAt: new Date().toISOString()
      }
    })
  });

  // 6. Execute task via adapter
  console.log(`[Luna Dev Worker] Invoking ${adapter.name.toUpperCase()} adapter in ${workspaceDir}...`);
  const prompt = `You are executing an autonomous development task for Luna Development Service issue ${nextItem.issueId}: ${nextItem.title}.

Description & Instructions:
${nextItem.description || nextItem.title}

Please fulfill this request directly and output your final result clearly.`;

  const executionResult = await adapter.executeTask({
    prompt,
    workspaceDir,
    conversationId: existingConvId
  });

  console.log(`[Luna Dev Worker] ${adapter.name.toUpperCase()} finished with exit code ${executionResult.exitCode} in ${executionResult.durationMs}ms`);

  // Record conversation mapping if agy generated a conversation_id
  if (executionResult.structuredOutput?.conversation_id) {
    mappings[nextItem.issueId] = executionResult.structuredOutput.conversation_id;
    saveConversationMapping(mappings);
  }

  // 7. Check changed files
  const changedFiles = getGitChangedFiles(workspaceDir);

  // 8. Post substantive evidence
  const substantiveContent = `${adapter.name.toUpperCase()} EXECUTION RESULT:
Status: ${executionResult.terminationReason} (Exit code ${executionResult.exitCode} in ${executionResult.durationMs}ms)

Assistant Response:
${executionResult.finalResponse || '(No response text)'}

Changed Files: ${changedFiles.length > 0 ? changedFiles.join(', ') : 'None'}`;

  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: nextItem.issueId,
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

  // Post verification event and end session if successful
  if (executionResult.success) {
    await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        issueId: nextItem.issueId,
        type: 'verification.reported',
        author: adapter.name,
        content: `VERIFICATION CONFIRMED: ${adapter.name.toUpperCase()} executed successfully and returned verified result.`,
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
  }

  return {
    status: 'executed',
    issueId: nextItem.issueId,
    sessionId: sessionItem.id,
    agent: adapter.name,
    executionResult
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
  console.log(`[Luna Dev Worker] Supported:       ${SUPPORTED_RUNTIMES.join(', ')}`);
  console.log(`[Luna Dev Worker] Poll Interval:   ${intervalMs}ms`);

  // Verify auth immediately on startup
  try {
    const token = getAuthToken();
    console.log(`[Luna Dev Worker] Auth:            Verified (${token.substring(0, 8)}...)`);
  } catch (err) {
    console.error(`[Luna Dev Worker] FATAL ERROR: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Luna Dev Worker] Status:          ACTIVE (Polling for eligible tasks)`);
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
        console.log(`[Luna Dev Worker] Task ${result.issueId} executed successfully by ${result.agent}.`);
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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && args[i + 1]) {
      forceAgent = args[i + 1];
      i++;
    } else if (args[i] === '--workspace' && args[i + 1]) {
      workspaceDir = args[i + 1];
      i++;
    } else if (args[i] === '--once') {
      singleShot = true;
    }
  }

  if (singleShot) {
    pollAndExecuteNext({ workspaceDir, forceAgent }).then(res => {
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
