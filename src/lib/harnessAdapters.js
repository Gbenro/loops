/**
 * Luna Harness Adapters
 * Harness-neutral runtime adapter boundary supporting multiple coding-agent runtimes:
 * - AGY (Antigravity Headless)
 * - DSH (DeepSeek Harness)
 * - Gemini (Interactive Cloud Agent / Pair Programmer)
 */

import { spawn } from 'node:child_process';
import os from 'node:os';

export const SUPPORTED_RUNTIMES = ['agy', 'dsh', 'gemini'];
export const LOCAL_RUNTIMES = ['agy', 'dsh'];

/**
 * Normalizes a workspace directory for Windows host execution when running inside WSL.
 */
export function resolveWorkspaceForWindows(wslPath) {
  if (os.platform() === 'win32') return wslPath;
  if (!wslPath) return '\\\\wsl.localhost\\Ubuntu\\home\\ben\\.openclaw\\workspace\\loops-app';
  
  if (wslPath.startsWith('/home/')) {
    const relative = wslPath.replace(/^\//, '').replace(/\//g, '\\');
    return `\\\\wsl.localhost\\Ubuntu\\${relative}`;
  }
  if (wslPath.startsWith('/mnt/')) {
    const parts = wslPath.split('/');
    const drive = parts[2].toUpperCase();
    const rest = parts.slice(3).join('\\');
    return `${drive}:\\${rest}`;
  }
  return wslPath;
}

/**
 * Formats milliseconds into human-readable elapsed time (e.g. "1m 30s").
 */
export function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

/**
 * Base abstract harness adapter interface contract
 */
export class BaseHarnessAdapter {
  constructor(name, runtimeIdentity) {
    this.name = name;
    this.runtimeIdentity = runtimeIdentity;
  }

  get capabilities() {
    return {
      resume: false,
      streamingStderr: true,
      structuredJson: false,
      workspaceTargeting: true,
      leastPrivilegePresets: true
    };
  }

  async executeTask(_options) {
    throw new Error('executeTask must be implemented by subclass');
  }
}

/**
 * AGY Harness Adapter
 */
export class AgyHarnessAdapter extends BaseHarnessAdapter {
  constructor() {
    super('agy', 'antigravity-headless-cli-v1.1.26');
  }

  get capabilities() {
    return {
      resume: true,
      streamingStderr: true,
      structuredJson: true,
      workspaceTargeting: true,
      leastPrivilegePresets: true
    };
  }

  async executeTask({
    prompt,
    workspaceDir = process.cwd(),
    conversationId = null,
    timeoutMs = 600000,
    onHeartbeat = null
  }) {
    const args = [
      '-p', prompt,
      '--output-format', 'json',
      '--mode', 'accept-edits',
      '--print-timeout', '10m'
    ];
    if (conversationId) {
      args.push('--conversation', conversationId);
    }

    const startTime = Date.now();
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('agy', args, {
        cwd: workspaceDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Explicitly close stdin so process does not block waiting for input
      proc.stdin.end();

      // Compact harness-neutral observable activity heartbeat
      const heartbeatInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const msg = `[Luna Dev Worker] [AGY] Still working — ${formatElapsed(elapsed)} (PID: ${proc.pid})`;
        console.log(msg);
        if (typeof onHeartbeat === 'function') {
          onHeartbeat({ elapsedMs: elapsed, formatted: formatElapsed(elapsed), pid: proc.pid });
        }
      }, 15000);

      const timer = setTimeout(() => {
        timedOut = true;
        clearInterval(heartbeatInterval);
        proc.kill('SIGKILL');
      }, timeoutMs);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        // Stream safe non-sensitive milestones without exposing chain-of-thought
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('ERROR:') || trimmed.includes('error') || trimmed.includes('fatal')) {
            // keep error logs clean
          } else if (trimmed.includes('running') || trimmed.includes('testing') || trimmed.includes('building')) {
            console.log(`[Luna Dev Worker] [AGY Milestone] ${trimmed.slice(0, 120)}`);
          }
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        clearInterval(heartbeatInterval);
        const durationMs = Date.now() - startTime;
        let structuredOutput = null;
        let finalResponse = stdout.trim();

        try {
          structuredOutput = JSON.parse(stdout.trim());
          if (structuredOutput.response || structuredOutput.result || structuredOutput.summary) {
            finalResponse = (structuredOutput.response || structuredOutput.result || structuredOutput.summary).trim();
          }
        } catch {
          // Plain text stdout
        }

        const denied = extractDeniedActions(stderr + '\n' + stdout);
        if (structuredOutput?.denied_actions && Array.isArray(structuredOutput.denied_actions)) {
          for (const da of structuredOutput.denied_actions) {
            denied.push(da.display_name || da.action || JSON.stringify(da));
          }
        }

        resolve({
          agent: 'agy',
          success: code === 0 && !timedOut && (!finalResponse || !finalResponse.includes('FATAL')),
          exitCode: code ?? (timedOut ? 124 : 1),
          durationMs,
          finalResponse: finalResponse || (code === 0 ? 'AGY task completed without text output.' : 'AGY task exited with code ' + code),
          rawStdout: stdout,
          rawStderr: stderr,
          structuredOutput,
          terminationReason: timedOut ? 'timeout' : (code === 0 ? 'completed' : 'error'),
          deniedActions: denied
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        clearInterval(heartbeatInterval);
        resolve({
          agent: 'agy',
          success: false,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          finalResponse: `AGY process error: ${err.message}`,
          rawStdout: stdout,
          rawStderr: stderr + '\n' + err.message,
          structuredOutput: null,
          terminationReason: 'error',
          deniedActions: []
        });
      });
    });
  }
}

/**
 * DSH (DeepSeek Harness) Adapter
 */
export class DshHarnessAdapter extends BaseHarnessAdapter {
  constructor() {
    super('dsh', '@deepseek-ai/dsh-headless-v0.1.2-rc.1');
  }

  get capabilities() {
    return {
      resume: true, // Supported via session checkpoint & storage cache
      streamingStderr: true,
      structuredJson: false,
      workspaceTargeting: true,
      leastPrivilegePresets: true
    };
  }

  async executeTask({
    prompt,
    workspaceDir = process.cwd(),
    model = 'deepseek/deepseek-v4-pro',
    timeoutMs = 180000,
    onHeartbeat = null
  }) {
    const startTime = Date.now();
    const isWindows = os.platform() === 'win32';
    const windowsWorkspace = resolveWorkspaceForWindows(workspaceDir);

    // Escape double quotes in prompt for cmd execution
    const sanitizedPrompt = prompt.replace(/"/g, '\\"');

    let cmdExecutable = 'cmd.exe';
    let cmdArgs = [];

    if (isWindows) {
      cmdArgs = [
        '/c',
        `set PATH=C:\\Program Files\\nodejs;%APPDATA%\\npm;%PATH% && dsh --profile headless "${sanitizedPrompt}"`
      ];
    } else {
      // In WSL/Linux, use pushd to map UNC path cleanly, run dsh, and popd
      const dshCommand = `pushd ${windowsWorkspace} && set PATH=C:\\Program Files\\nodejs;%APPDATA%\\npm;%PATH% && dsh --profile headless "${sanitizedPrompt}" & popd`;
      cmdArgs = ['/c', dshCommand];
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn(cmdExecutable, cmdArgs, {
        cwd: isWindows ? workspaceDir : undefined,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Compact harness-neutral observable activity heartbeat
      const heartbeatInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const msg = `[Luna Dev Worker] [DSH] Still working — ${formatElapsed(elapsed)} (PID: ${proc.pid})`;
        console.log(msg);
        if (typeof onHeartbeat === 'function') {
          onHeartbeat({ elapsedMs: elapsed, formatted: formatElapsed(elapsed), pid: proc.pid });
        }
      }, 15000);

      const timer = setTimeout(() => {
        timedOut = true;
        clearInterval(heartbeatInterval);
        proc.kill('SIGKILL');
      }, timeoutMs);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        clearInterval(heartbeatInterval);
        const durationMs = Date.now() - startTime;
        const cleanStdout = stdout.trim();
        const denied = extractDeniedActions(stderr + '\n' + stdout);

        resolve({
          agent: 'dsh',
          model,
          success: code === 0 && !timedOut,
          exitCode: code ?? (timedOut ? 124 : 1),
          durationMs,
          finalResponse: cleanStdout || (code === 0 ? 'DSH execution completed without text output.' : `DSH execution failed with exit code ${code}`),
          rawStdout: stdout,
          rawStderr: stderr,
          structuredOutput: {
            reasoningLogLength: stderr.length,
            model,
            workspaceTarget: windowsWorkspace
          },
          terminationReason: timedOut ? 'timeout' : (code === 0 ? 'completed' : 'error'),
          deniedActions: denied
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        clearInterval(heartbeatInterval);
        resolve({
          agent: 'dsh',
          model,
          success: false,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          finalResponse: `DSH process spawn error: ${err.message}`,
          rawStdout: stdout,
          rawStderr: stderr + '\n' + err.message,
          structuredOutput: null,
          terminationReason: 'error',
          deniedActions: []
        });
      });
    });
  }
}

/**
 * Extracts any denied actions or permission errors from logs.
 */
export function extractDeniedActions(logText) {
  const denied = [];
  const lines = logText.split('\n');
  for (const line of lines) {
    if (line.match(/permission denied|denied action|approval rejected|unauthorized|denied_action/i)) {
      denied.push(line.trim());
    }
  }
  return denied;
}

/**
 * Strict verification gating: evaluates required acceptance criteria and evidence
 * rather than equating a process exit code of 0 with engineering success.
 */
export function verifyExecutionOutcome({ executionResult, issue = {}, changedFiles = [] }) {
  const failures = [];

  if (!executionResult) {
    return { verified: false, reasons: ['Missing execution result.'] };
  }

  // 1. Process exit code
  if (executionResult.exitCode !== 0) {
    failures.push(`Process exited with non-zero code ${executionResult.exitCode}.`);
  }

  // 2. Timeout check
  if (executionResult.terminationReason === 'timeout') {
    failures.push('Execution timed out before completion.');
  }

  // 3. Substantive response check (prevent empty replies)
  const responseText = (executionResult.finalResponse || '').trim();
  if (responseText.length < 20 || responseText === 'AGY task completed without text output.') {
    failures.push('Agent returned an empty or insubstantial response.');
  }

  // 4. Denied action check
  if (executionResult.deniedActions && executionResult.deniedActions.length > 0) {
    failures.push(`Execution encountered blocked/denied actions: ${executionResult.deniedActions.join(', ')}.`);
  }

  // 5. Deliverable check for code implementation tasks
  const isCodeTask = issue.title && (issue.title.includes('BUG') || issue.title.includes('FIX') || issue.title.includes('IMPLEMENTATION'));
  if (isCodeTask && (!changedFiles || changedFiles.length === 0)) {
    // Check if task explicitly forbade changes (e.g. ping test)
    const isPingOnly = issue.title.includes('ping') || (issue.description && issue.description.includes('Do not modify repository files'));
    if (!isPingOnly) {
      failures.push('Task required implementation changes but zero repository files were modified.');
    }
  }

  return {
    verified: failures.length === 0,
    reasons: failures
  };
}

/**
 * Harness Registry and Dispatcher
 */
export class HarnessRegistry {
  constructor() {
    this.adapters = new Map();
    this.register(new AgyHarnessAdapter());
    this.register(new DshHarnessAdapter());
  }

  register(adapter) {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  getAdapter(agentName) {
    if (!agentName) return null;
    const normalized = agentName.toLowerCase().trim();

    // 'gemini' is an interactive cloud agent / pair programmer, NOT a local headless adapter!
    if (normalized === 'gemini') {
      return null;
    }

    if (this.adapters.has(normalized)) {
      return this.adapters.get(normalized);
    }

    return null;
  }

  listAdapters() {
    return Array.from(this.adapters.keys());
  }
}

export const defaultHarnessRegistry = new HarnessRegistry();

export function getHarnessAdapter(agentName) {
  return defaultHarnessRegistry.getAdapter(agentName);
}

/**
 * Formats a canonical completion summary for dev agents and harnesses.
 * Required before an issue can be marked acceptance-ready or advanced.
 */
export function formatCompletionSummary({
  agent,
  summary,
  changes = [],
  testResults,
  buildResults,
  commit,
  deployment,
  caveats = [],
  acceptanceStatus = 'awaiting_user_acceptance',
  nextStep
} = {}) {
  return {
    agent: agent || 'unknown',
    summary: summary || '',
    changes: Array.isArray(changes) ? changes : [],
    testResults: testResults || { passed: true },
    buildResults: buildResults || { passed: true },
    commit: commit || null,
    deployment: deployment || null,
    caveats: Array.isArray(caveats) ? caveats : [],
    acceptanceStatus,
    nextStep: nextStep || 'Please review changes and accept via Luna Dev Service.'
  };
}

