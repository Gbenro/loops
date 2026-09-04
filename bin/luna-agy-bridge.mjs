#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.LUNA_API_URL || 'https://loops-production-e1d5.up.railway.app';
const AUTH_FILE = path.join(process.env.HOME || '/home/ben', '.luna/auth.json');
const MAPPING_FILE = path.join(process.env.HOME || '/home/ben', '.luna/agy-sessions.json');

export function getAuthToken() {
  if (process.env.LUNA_DEV_TOKEN) return process.env.LUNA_DEV_TOKEN;
  if (fs.existsSync(AUTH_FILE)) {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    return auth.discoveryToken || auth.token;
  }
  throw new Error('No Luna auth token found.');
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
  const queueData = await queueRes.json();
  const nextItem = (queueData.items || []).find(i => i.isEligible && (i.status === 'queued' || i.status === 'discovered'));

  if (!nextItem) {
    return { status: 'idle', message: 'No eligible items in queue' };
  }

  // 2. Discover/Claim session
  const pendRes = await fetch(`${API_BASE}/api/dev/agent/pending-sessions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
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
  const claimData = await claimRes.json();
  const sessionToken = claimData.token;

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
  const prompt = `You are executing an autonomous development task for Luna Development Service issue ${nextItem.issueId}: ${nextItem.title}. Inspect the workspace, run necessary tests, and produce required implementation changes.`;
  const agyResult = await runAgyHeadless({
    prompt,
    conversationId: existingAgyConvId,
    workspaceDir
  });

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
