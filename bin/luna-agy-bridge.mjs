#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      // JSON parse error
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

export async function runAgyHeadless({ prompt, conversationId, workspaceDir = process.cwd() }) {
  const args = ['-p', prompt, '--output-format', 'json'];
  if (conversationId) {
    args.push('--conversation', conversationId);
  }

  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const proc = spawn('agy', args, {
      cwd: workspaceDir,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.stderr.on('data', data => { stderr += data.toString(); });

    proc.on('close', code => {
      const durationMs = Date.now() - startTime;
      let parsedOutput = null;
      try {
        parsedOutput = JSON.parse(stdout.trim());
      } catch {
        parsedOutput = { rawText: stdout.trim() };
      }

      resolve({
        success: code === 0,
        exitCode: code,
        durationMs,
        output: parsedOutput,
        rawStdout: stdout,
        rawStderr: stderr
      });
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

export async function pollAndExecuteNext({ workspaceDir = process.cwd() } = {}) {
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

  // 2. Discover/Claim session
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

  const claimRes = await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agent: 'agy' })
  });
  if (!claimRes.ok) {
    return { status: 'claim_failed', issueId: nextItem.issueId, error: await claimRes.text() };
  }
  const claimData = await claimRes.json();
  const sessionToken = claimData.token;

  console.log(`[Luna AGY Bridge] Claimed session ${sessionItem.id} for issue ${nextItem.issueId} (${nextItem.title})`);

  // 3. Resolve mapped AGY conversation ID
  const mappings = getConversationMapping();
  const existingAgyConvId = mappings[nextItem.issueId] || null;

  // 4. Post implementation.started event
  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: nextItem.issueId,
      type: 'implementation.started',
      author: 'agy',
      content: `AUTONOMOUS AGY HEADLESS EXECUTION STARTED: Discovered and claimed issue ${nextItem.issueId} via local AGY bridge. Running headless worker in ${workspaceDir}.`,
      metadata: { agyConversationId: existingAgyConvId, startedAt: new Date().toISOString() }
    })
  });

  // 5. Execute AGY Headless
  console.log(`[Luna AGY Bridge] Invoking headless AGY in ${workspaceDir}...`);
  const prompt = `You are executing an autonomous development task for Luna Development Service issue ${nextItem.issueId}: ${nextItem.title}. Inspect the workspace, run necessary tests, and produce required implementation changes.`;
  const agyResult = await runAgyHeadless({
    prompt,
    conversationId: existingAgyConvId,
    workspaceDir
  });

  console.log(`[Luna AGY Bridge] AGY finished with exit code ${agyResult.exitCode} in ${agyResult.durationMs}ms`);

  // 6. Post execution evidence
  await fetch(`${API_BASE}/api/dev/sessions/${sessionItem.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      issueId: nextItem.issueId,
      type: 'implementation.reported',
      author: 'agy',
      content: `AGY HEADLESS EXECUTION COMPLETED: Exit code ${agyResult.exitCode} in ${agyResult.durationMs}ms.`,
      metadata: {
        exitCode: agyResult.exitCode,
        durationMs: agyResult.durationMs,
        success: agyResult.success
      }
    })
  });

  return {
    status: 'executed',
    issueId: nextItem.issueId,
    sessionId: sessionItem.id,
    agyResult
  };
}

export async function startDaemonWorker({ workspaceDir = process.cwd(), intervalMs = POLL_INTERVAL_MS } = {}) {
  let isRunning = true;
  let activePoll = false;

  console.log('===============================================================');
  console.log('  LUNA DEVELOPMENT SERVICE → AGY HEADLESS BRIDGE WORKER');
  console.log('===============================================================');
  console.log(`[Luna AGY Bridge] Target API: ${API_BASE}`);
  console.log(`[Luna AGY Bridge] Workspace:  ${workspaceDir}`);
  console.log(`[Luna AGY Bridge] Interval:   ${intervalMs}ms`);

  // Verify auth immediately on startup
  try {
    const token = getAuthToken();
    console.log(`[Luna AGY Bridge] Auth:       Verified (${token.substring(0, 8)}...)`);
  } catch (err) {
    console.error(`[Luna AGY Bridge] FATAL ERROR: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Luna AGY Bridge] Status:     ACTIVE (Polling for eligible tasks)`);
  console.log('---------------------------------------------------------------');

  const shutdown = () => {
    if (!isRunning) return;
    isRunning = false;
    console.log('\n[Luna AGY Bridge] Shutting down AGY bridge worker cleanly...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const tick = async () => {
    if (!isRunning || activePoll) return;
    activePoll = true;
    try {
      const result = await pollAndExecuteNext({ workspaceDir });
      if (result.status === 'executed') {
        console.log(`[Luna AGY Bridge] Task ${result.issueId} execution recorded successfully.`);
      }
    } catch (err) {
      console.warn(`[Luna AGY Bridge] Poll warning: ${err.message}`);
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
  startDaemonWorker({ workspaceDir: process.cwd() }).catch(err => {
    console.error(`[Luna AGY Bridge] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
