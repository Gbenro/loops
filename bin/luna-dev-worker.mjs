#!/usr/bin/env node
/**
 * Luna Development Service → Supervised Execution Worker (V2)
 * Sole authoritative owner of automatic task execution.
 * Enforces:
 * - Local singleton process lock
 * - Durable attempt journaling & outbox
 * - Isolated Git worktrees per task
 * - 15-second lease heartbeats & monotonic safety deadlines
 * - Independent verification gating
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  AgyHarnessAdapter,
  resolveWorkspaceForWindows,
  verifyExecutionOutcome,
  formatElapsed,
  formatCompletionSummary
} from '../src/lib/harnessAdapters.js';

const API_BASE = process.env.LUNA_API_URL || 'https://loops-production-e1d5.up.railway.app';
const AUTH_FILE = path.join(process.env.HOME || '/home/ben', '.luna/auth.json');
const JOURNAL_FILE = path.join(process.env.HOME || '/home/ben', '.luna/worker-journal.json');
const OUTBOX_FILE = path.join(process.env.HOME || '/home/ben', '.luna/worker-outbox.json');
const LOCK_FILE = '/tmp/luna-dev-worker.lock';
const POLL_INTERVAL_MS = parseInt(process.env.LUNA_POLL_INTERVAL_MS || '5000', 10);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ─── Identity & Process Lock ──────────────────────────────────────────────────
export const WORKER_ID = process.env.LUNA_WORKER_ID || `wrk_${os.hostname()}`;
export const WORKER_INSTANCE_ID = `inst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

export function acquireSingletonLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
      if (existingPid && existingPid !== process.pid) {
        // Test if existing process is running
        process.kill(existingPid, 0);
        console.error(`[Luna Dev Worker] Another worker instance is already running (PID: ${existingPid}). Exiting to maintain single owner.`);
        process.exit(0);
      }
    } catch {
      // Process is not running; stale lock file can be overwritten
    }
  }

  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  } catch (err) {
    console.warn(`[Luna Dev Worker] Could not write lock file: ${err.message}`);
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const p = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
        if (p === process.pid) fs.unlinkSync(LOCK_FILE);
      }
    } catch {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

// ─── Authentication & Durable State ──────────────────────────────────────────
export function getAuthToken() {
  if (process.env.LUNA_DEV_TOKEN) return process.env.LUNA_DEV_TOKEN;
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      const token = auth.discoveryToken || auth.token;
      if (token) return token;
    } catch {}
  }
  throw new Error(`Authentication token not found in ${AUTH_FILE} or LUNA_DEV_TOKEN env.`);
}

export function readJournal() {
  if (fs.existsSync(JOURNAL_FILE)) {
    try { return JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8')); } catch {}
  }
  return { workerId: WORKER_ID, activeAttempt: null, lastReconciledAt: null };
}

export function writeJournal(data) {
  const dir = path.dirname(JOURNAL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
}

// ─── Git Worktree Isolation Helpers ───────────────────────────────────────────
export function createIsolatedWorktree(issueId, attemptId) {
  const worktreeParent = '/tmp/luna-worktrees';
  if (!fs.existsSync(worktreeParent)) {
    fs.mkdirSync(worktreeParent, { recursive: true });
  }

  const worktreeDir = path.join(worktreeParent, issueId);
  const branchName = `task-${issueId}-${attemptId}`;

  // Prune dead worktrees first
  try {
    execSync('git worktree prune', { cwd: REPO_ROOT, stdio: 'ignore' });
  } catch {}

  // Remove existing worktree for this issue if leftover from crash
  if (fs.existsSync(worktreeDir)) {
    try {
      execSync(`git worktree remove --force ${worktreeDir}`, { cwd: REPO_ROOT, stdio: 'ignore' });
    } catch {}
  }

  // Create new isolated branch and worktree from HEAD
  execSync(`git worktree add -b ${branchName} ${worktreeDir} HEAD`, { cwd: REPO_ROOT, stdio: 'pipe' });
  console.log(`[Luna Dev Worker] Created isolated Git worktree at: ${worktreeDir} (branch: ${branchName})`);

  return { worktreeDir, branchName };
}

export function cleanupWorktree(worktreeDir, branchName) {
  try {
    if (fs.existsSync(worktreeDir)) {
      execSync(`git worktree remove --force ${worktreeDir}`, { cwd: REPO_ROOT, stdio: 'ignore' });
    }
    if (branchName) {
      execSync(`git branch -D ${branchName}`, { cwd: REPO_ROOT, stdio: 'ignore' });
    }
    execSync('git worktree prune', { cwd: REPO_ROOT, stdio: 'ignore' });
    console.log(`[Luna Dev Worker] Cleaned up worktree at: ${worktreeDir}`);
  } catch (err) {
    console.warn(`[Luna Dev Worker] Warning cleaning up worktree: ${err.message}`);
  }
}

export function getGitChangedFiles(workspaceDir) {
  try {
    const out = execSync('git status --porcelain', { cwd: workspaceDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map(line => line.trim().slice(3));
  } catch {
    return [];
  }
}

export function getGitPatch(workspaceDir) {
  try {
    return execSync('git diff HEAD', { cwd: workspaceDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// ─── API Clients ─────────────────────────────────────────────────────────────
export async function sendWorkerHeartbeat(token) {
  try {
    const res = await fetch(`${API_BASE}/api/dev/workers/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workerId: WORKER_ID,
        workerInstanceId: WORKER_INSTANCE_ID,
        hostname: os.hostname(),
        platform: os.platform(),
        runtimeProfiles: ['agy-headless'],
        availableCapacity: 1,
        health: { status: 'healthy', pid: process.pid, uptime: process.uptime() }
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Execution Lifecycle Handler ─────────────────────────────────────────────
export async function executeClaimedTask(token, execution) {
  const { id: executionId, attemptId, issue, fencingToken, leaseExpiresAt } = execution;
  const adapter = new AgyHarnessAdapter();

  console.log(`\n================================================================`);
  console.log(`✦ [Luna Dev Worker] STARTING EXECUTION: ${issue.id}`);
  console.log(`  Title: ${issue.title}`);
  console.log(`  Attempt ID: ${attemptId} (Fencing Token: ${fencingToken})`);
  console.log(`  Initial Lease Expiry: ${leaseExpiresAt}`);
  console.log(`================================================================\n`);

  // 1. Create isolated worktree
  const { worktreeDir, branchName } = createIsolatedWorktree(issue.id, attemptId);

  // 2. Journal launch intent
  writeJournal({
    workerId: WORKER_ID,
    workerInstanceId: WORKER_INSTANCE_ID,
    activeAttempt: {
      executionId,
      attemptId,
      issueId: issue.id,
      fencingToken,
      worktreeDir,
      branchName,
      startedAt: new Date().toISOString()
    }
  });

  // 3. Post process started event
  try {
    await fetch(`${API_BASE}/api/dev/executions/${executionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workerId: WORKER_ID,
        workerInstanceId: WORKER_INSTANCE_ID,
        fencingToken,
        events: [{
          type: 'implementation.started',
          author: 'agy',
          content: `Isolated execution started for issue ${issue.id} in worktree ${worktreeDir}`,
          metadata: { worktreeDir, branchName, startedAt: new Date().toISOString() }
        }]
      })
    });
  } catch (e) {
    console.warn('[Luna Dev Worker] Could not append started event:', e.message);
  }

  // 4. Set up lease watchdog & monotonic safety deadline
  let currentLeaseExpiresAt = new Date(leaseExpiresAt).getTime();
  let cancelledByServer = false;
  let heartbeatFailedCount = 0;

  const heartbeatTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dev/executions/${executionId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workerId: WORKER_ID,
          workerInstanceId: WORKER_INSTANCE_ID,
          fencingToken,
          stage: 'running'
        })
      });

      if (res.ok) {
        const data = await res.json();
        currentLeaseExpiresAt = new Date(data.leaseExpiresAt).getTime();
        heartbeatFailedCount = 0;
      } else {
        heartbeatFailedCount++;
        if (res.status === 409 || res.status === 410) {
          console.warn('[Luna Dev Worker] Server rejected lease renewal (cancelled/conflict). Terminating child.');
          cancelledByServer = true;
        }
      }
    } catch {
      heartbeatFailedCount++;
    }
  }, 15000);

  // 5. Construct prompt and launch child agent
  const winWorktreeDir = resolveWorkspaceForWindows(worktreeDir);
  const prompt = `You are executing an autonomous development task for Luna Development Service.
Issue ID: ${issue.id}
Title: ${issue.title}
Description:
${issue.description}

Acceptance Criteria:
${(issue.acceptanceCriteria || []).map(c => '- ' + c).join('\n')}

CRITICAL INSTRUCTIONS:
1. All changes must be made strictly in the workspace directory (${winWorktreeDir}).
2. Implement the fix or feature directly.
3. Run tests or verification commands to confirm correctness.
4. Output a concise summary of changes.`;

  console.log(`[Luna Dev Worker] Launching AGY in isolated worktree: ${winWorktreeDir}...`);

  const executionResult = await adapter.executeTask({
    prompt,
    workspaceDir: worktreeDir,
    timeoutMs: 600000,
    onHeartbeat: (hb) => {
      // Check monotonic deadline safety margin (must not run past lease)
      const remainingLeaseMs = currentLeaseExpiresAt - Date.now();
      if (remainingLeaseMs < 15000 || cancelledByServer) {
        console.error(`[Luna Dev Worker] SAFETY ABORT: Lease expiring in ${remainingLeaseMs}ms without server renewal. Halting execution.`);
        clearInterval(heartbeatTimer);
        adapter.cancel?.();
      }
    }
  });

  clearInterval(heartbeatTimer);

  console.log(`[Luna Dev Worker] AGY finished with exit code ${executionResult.exitCode} (${executionResult.durationMs}ms)`);

  // 6. Independent Verification Gate
  const changedFiles = getGitChangedFiles(worktreeDir);
  const patch = getGitPatch(worktreeDir);

  const verification = verifyExecutionOutcome({
    executionResult,
    issue,
    changedFiles
  });

  const verified = verification.verified && !cancelledByServer;
  console.log(`[Luna Dev Worker] Verification Outcome: ${verified ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!verified) {
    console.warn(`[Luna Dev Worker] Verification Failure Reasons:`, verification.reasons);
  }

  // 7. Finalize on Server
  const finalSummary = executionResult.finalResponse || `Task execution finished with exit code ${executionResult.exitCode}`;

  try {
    await fetch(`${API_BASE}/api/dev/executions/${executionId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workerId: WORKER_ID,
        workerInstanceId: WORKER_INSTANCE_ID,
        fencingToken,
        result: {
          success: verified,
          summary: finalSummary,
          changes: changedFiles,
          patch,
          testResults: { passed: verified, reasons: verification.reasons },
          deniedActions: executionResult.deniedActions,
          caveats: verification.reasons
        }
      })
    });
    console.log(`[Luna Dev Worker] Successfully finalized execution ${executionId} on server.`);
  } catch (err) {
    console.error(`[Luna Dev Worker] Error finalizing execution on server: ${err.message}`);
  }

  // 8. Cleanup worktree & journal
  cleanupWorktree(worktreeDir, branchName);
  writeJournal({ workerId: WORKER_ID, workerInstanceId: WORKER_INSTANCE_ID, activeAttempt: null, lastReconciledAt: new Date().toISOString() });

  console.log(`[Luna Dev Worker] Finished cycle for ${issue.id}. Ready for next task.\n`);
  return { success: verified, issueId: issue.id };
}

// ─── Main Worker Loop ────────────────────────────────────────────────────────
export async function startDaemonWorker({ forceOnce = false, targetIssue = null } = {}) {
  acquireSingletonLock();
  const token = getAuthToken();

  console.log(`✦ [Luna Dev Worker V2] Initialized`);
  console.log(`  Worker ID: ${WORKER_ID}`);
  console.log(`  Instance: ${WORKER_INSTANCE_ID}`);
  console.log(`  API Base: ${API_BASE}`);
  console.log(`  PID: ${process.pid}`);

  // Reconcile journal on startup
  const journal = readJournal();
  if (journal.activeAttempt) {
    console.log(`[Luna Dev Worker] Found incomplete attempt from prior run in journal: ${journal.activeAttempt.issueId}`);
    if (journal.activeAttempt.worktreeDir) {
      cleanupWorktree(journal.activeAttempt.worktreeDir, journal.activeAttempt.branchName);
    }
    writeJournal({ workerId: WORKER_ID, workerInstanceId: WORKER_INSTANCE_ID, activeAttempt: null, lastReconciledAt: new Date().toISOString() });
  }

  // Initial presence heartbeat
  await sendWorkerHeartbeat(token);

  let consecutiveErrors = 0;

  while (true) {
    try {
      // 1. Send periodic presence heartbeat
      await sendWorkerHeartbeat(token);

      // 2. Poll for next eligible execution
      const claimRes = await fetch(`${API_BASE}/api/dev/executions/claim-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workerId: WORKER_ID,
          workerInstanceId: WORKER_INSTANCE_ID,
          runtimeProfiles: ['agy-headless'],
          repository: 'loops-app',
          idempotencyKey: `claim_${WORKER_INSTANCE_ID}_${Date.now()}`,
          targetIssueId: targetIssue
        })
      });

      if (!claimRes.ok) {
        console.warn(`[Luna Dev Worker] Claim-next HTTP ${claimRes.status}: ${await claimRes.text()}`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const claimData = await claimRes.json();
      consecutiveErrors = 0;

      if (claimData.status === 'claimed' && claimData.execution) {
        await executeClaimedTask(token, claimData.execution);
        if (forceOnce) break;
      } else if (claimData.status === 'slot_busy') {
        // Slot is busy, wait before re-polling
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      } else {
        // Idle
        if (forceOnce) {
          console.log('[Luna Dev Worker] No eligible tasks found (single-run mode). Exiting.');
          break;
        }
        // Jittered sleep (4.5s - 5.5s)
        const jitter = Math.floor(Math.random() * 1000) - 500;
        await new Promise(r => setTimeout(r, Math.max(2000, POLL_INTERVAL_MS + jitter)));
      }
    } catch (err) {
      consecutiveErrors++;
      const backoff = Math.min(30000, 2000 * Math.pow(1.5, consecutiveErrors));
      console.error(`[Luna Dev Worker] Error in worker loop: ${err.message} (retrying in ${Math.round(backoff / 1000)}s)...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// ─── Direct CLI Entrypoint ────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const once = process.argv.includes('--once');
  const targetIdx = process.argv.indexOf('--issue');
  const targetIssue = targetIdx !== -1 ? process.argv[targetIdx + 1] : null;

  startDaemonWorker({ forceOnce: once, targetIssue }).catch(err => {
    console.error(`[Luna Dev Worker] Fatal worker error: ${err.message}`);
    process.exit(1);
  });
}
