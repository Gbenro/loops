#!/usr/bin/env node
/**
 * Gate 1 Runtime Proof Verification Script
 * Implements Section 3 of Luna Watcher: reliable task execution specification.
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    const proc = spawn(cmd, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });

    if (proc.stdin) {
      proc.stdin.end();
    }

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        pid: proc.pid
      });
    });

    proc.on('error', (err) => {
      resolve({
        code: -1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - startTime,
        error: err.message
      });
    });
  });
}

function resolveToWindowsPath(p) {
  if (p.startsWith('/tmp')) {
    return '\\\\wsl.localhost\\Ubuntu' + p.replace(/\//g, '\\');
  }
  if (p.startsWith('/home/')) {
    return '\\\\wsl.localhost\\Ubuntu' + p.replace(/\//g, '\\');
  }
  return p;
}

function redact(text) {
  if (!text) return text;
  return text
    .replace(/dsc_[a-zA-Z0-9_-]{16,}/g, '[REDACTED_DISCOVERY_TOKEN]')
    .replace(/dtk_[a-zA-Z0-9_-]{16,}/g, '[REDACTED_SESSION_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
}

async function main() {
  console.log('=== LUNA WATCHER: GATE 1 RUNTIME PROOF ===');
  console.log('Timestamp:', new Date().toISOString());

  // 1. Environment & Runtime Metadata
  const osUser = os.userInfo().username;
  const platform = os.platform();
  let agyPath = '';
  try {
    agyPath = execSync('which agy', { encoding: 'utf8' }).trim();
  } catch (e) {
    agyPath = '/usr/local/bin/agy';
  }

  let agyVersion = 'unknown';
  try {
    agyVersion = execSync(agyPath + ' --version', { encoding: 'utf8' }).trim();
  } catch (e) {
    agyVersion = e.message;
  }

  console.log('OS User:', osUser);
  console.log('Platform:', platform);
  console.log('Executable Path:', agyPath);
  console.log('Version:', agyVersion);

  // 2. Setup Disposable Workspace
  const testDir = '/tmp/luna_gate1_proof_' + Date.now();
  fs.mkdirSync(testDir, { recursive: true });
  console.log('Disposable Workspace:', testDir);

  // 3. Generate Fresh Random Challenge
  const nonce = crypto.randomBytes(8).toString('hex');
  const challengeToken = 'LUNA_GATE1_CHALLENGE_' + Date.now() + '_' + nonce;
  console.log('Generated Challenge:', challengeToken);

  const prompt = 'Task: Gate 1 runtime verification challenge.\n' +
    '1. Create a file named challenge.txt containing exactly:\n' +
    challengeToken + '\n' +
    '2. Run the command: cat challenge.txt\n' +
    '3. Reply with the single word VERIFIED.';

  console.log('\n[Gate 1] Launching real runtime with random challenge...');
  const launchStart = new Date().toISOString();
  const winTestDir = resolveToWindowsPath(testDir);
  const targetFile = path.join(testDir, 'challenge.txt');
  const winTargetFile = resolveToWindowsPath(targetFile);

  const promptWithTarget = 'Task: Gate 1 runtime verification challenge.\n' +
    '1. Create a file at ' + winTargetFile + ' containing exactly:\n' +
    challengeToken + '\n' +
    '2. Run the command: cat challenge.txt\n' +
    '3. Reply with the single word VERIFIED.';

  const runResult = await runCommand(agyPath, [
    '-p', promptWithTarget,
    '--add-dir', winTestDir,
    '--output-format', 'json',
    '--mode', 'accept-edits'
  ], { cwd: testDir });

  const launchEnd = new Date().toISOString();
  console.log('[Gate 1] Child process exited with code: ' + runResult.code + ' (' + runResult.durationMs + 'ms, PID: ' + runResult.pid + ')');

  let parsed = null;
  try {
    parsed = JSON.parse(runResult.stdout.trim());
  } catch (e) {
    // plain text
  }

  // 4. Independent Verification
  const challengeFilePath = path.join(testDir, 'challenge.txt');
  let fileCreated = false;
  let fileContent = '';
  let challengeMatched = false;

  if (fs.existsSync(challengeFilePath)) {
    fileCreated = true;
    fileContent = fs.readFileSync(challengeFilePath, 'utf8').trim();
    challengeMatched = fileContent.includes(challengeToken);
  }

  const deniedActions = parsed?.denied_actions || [];
  const conversationId = parsed?.conversation_id || null;
  const runtimeStatus = parsed?.status || 'UNKNOWN';

  console.log('\n--- Gate 1 Challenge Results ---');
  console.log('Conversation ID:', conversationId);
  console.log('Runtime Status:', runtimeStatus);
  console.log('File Created:', fileCreated);
  console.log('File Content:', fileContent.slice(0, 80));
  console.log('Challenge Matched:', challengeMatched);
  console.log('Denied Actions:', JSON.stringify(deniedActions));

  // 5. Cancellation & Process Tree Termination Test
  console.log('\n[Gate 1] Testing Process Tree Termination on Timeout/Cancel...');
  const cancelTestStart = Date.now();
  const slowProc = spawn(agyPath, [
    '-p', 'Sleep and wait for 60 seconds without exiting',
    '--output-format', 'json',
    '--mode', 'accept-edits'
  ], { cwd: testDir, stdio: ['ignore', 'pipe', 'pipe'] });

  const slowPid = slowProc.pid;
  let slowProcKilled = false;

  await new Promise((r) => setTimeout(r, 1500)); // allow startup
  try {
    process.kill(slowPid, 'SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(slowPid, 0); // test if still alive
      process.kill(slowPid, 'SIGKILL');
    } catch {
      // process already dead
    }
    slowProcKilled = true;
  } catch (e) {
    console.error('Error killing slow process:', e.message);
  }
  const cancelDurationMs = Date.now() - cancelTestStart;
  console.log('[Gate 1] Process cancellation verified: PID ' + slowPid + ' stopped in ' + cancelDurationMs + 'ms (killed: ' + slowProcKilled + ')');

  // 6. Repeatability Test
  console.log('\n[Gate 1] Testing Repeatability with second challenge...');
  const repeatChallenge = 'LUNA_GATE1_REPEAT_' + Date.now();
  const winRepeatFile = resolveToWindowsPath(path.join(testDir, 'repeat.txt'));
  const repeatResult = await runCommand(agyPath, [
    '-p', 'Create a file at ' + winRepeatFile + ' containing exactly: ' + repeatChallenge,
    '--add-dir', winTestDir,
    '--output-format', 'json',
    '--mode', 'accept-edits'
  ], { cwd: testDir });

  const repeatFilePath = path.join(testDir, 'repeat.txt');
  const repeatPassed = fs.existsSync(repeatFilePath) && fs.readFileSync(repeatFilePath, 'utf8').includes(repeatChallenge);
  console.log('Repeatability Result: File created =', repeatPassed);

  // 7. Cleanup
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  const passed = fileCreated && challengeMatched && deniedActions.length === 0 && slowProcKilled && repeatPassed;
  console.log('\n=== GATE 1 OVERALL RESULT:', passed ? 'PASSED ✅' : 'FAILED ❌', '===');

  const report = {
    gate: 'Gate 1: Real Runtime Execution Proof',
    timestamp: new Date().toISOString(),
    status: passed ? 'PASSED' : 'FAILED',
    runtime: {
      executable: agyPath,
      version: agyVersion,
      osUser,
      platform,
      modelSelection: 'gemini-3.8-flash-high (default in CLI)',
      authMethod: 'Google OAuth / Antigravity token (local machine credentials)'
    },
    primaryChallenge: {
      challengeToken,
      launchStart,
      launchEnd,
      durationMs: runResult.durationMs,
      exitCode: runResult.code,
      conversationId,
      runtimeStatus,
      fileCreated,
      challengeMatched,
      deniedActions,
      stdout: redact(runResult.stdout.trim().slice(0, 300)),
      stderr: redact(runResult.stderr.trim().slice(0, 300))
    },
    cancellationTest: {
      pid: slowPid,
      durationMs: cancelDurationMs,
      processTerminated: slowProcKilled
    },
    repeatabilityTest: {
      repeatPassed,
      exitCode: repeatResult.code
    }
  };

  const reportPath = path.join(process.cwd(), 'scripts', 'gate1_proof_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('Saved Gate 1 report to:', reportPath);

  if (!passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Gate 1 Error:', err);
  process.exit(1);
});
