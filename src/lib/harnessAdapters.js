/**
 * Luna Harness Adapters
 * Harness-neutral runtime adapter boundary supporting multiple local coding-agent runtimes:
 * - AGY (Antigravity Headless)
 * - DSH (DeepSeek Harness)
 */

import { spawn } from 'node:child_process';
import os from 'node:os';

export const SUPPORTED_RUNTIMES = ['agy', 'dsh', 'gemini'];

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
    super('agy', 'antigravity-headless-cli');
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
    timeoutMs = 120000
  }) {
    const args = ['-p', prompt, '--output-format', 'json'];
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

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, timeoutMs);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        let structuredOutput = null;
        let finalResponse = stdout.trim();

        try {
          structuredOutput = JSON.parse(stdout.trim());
          if (structuredOutput.result || structuredOutput.response || structuredOutput.summary) {
            finalResponse = structuredOutput.result || structuredOutput.response || structuredOutput.summary;
          }
        } catch {
          // Plain text stdout
        }

        resolve({
          agent: 'agy',
          success: code === 0 && !timedOut,
          exitCode: code ?? (timedOut ? 124 : 1),
          durationMs,
          finalResponse: finalResponse || (code === 0 ? 'AGY task completed successfully.' : 'AGY task exited with code ' + code),
          rawStdout: stdout,
          rawStderr: stderr,
          structuredOutput,
          terminationReason: timedOut ? 'timeout' : (code === 0 ? 'completed' : 'error'),
          deniedActions: extractDeniedActions(stderr + '\n' + stdout)
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
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
    timeoutMs = 180000
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

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, timeoutMs);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
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
    if (line.match(/permission denied|denied action|approval rejected|unauthorized/i)) {
      denied.push(line.trim());
    }
  }
  return denied;
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

  getAdapter(agentName = 'dsh') {
    const normalized = (agentName || 'dsh').toLowerCase().trim();
    if (this.adapters.has(normalized)) {
      return this.adapters.get(normalized);
    }
    // Fallback if 'gemini' or unspecified
    if (normalized === 'gemini' || normalized === 'agy') {
      return this.adapters.get('agy');
    }
    return this.adapters.get('dsh');
  }

  listAdapters() {
    return Array.from(this.adapters.keys());
  }
}

export const defaultHarnessRegistry = new HarnessRegistry();

export function getHarnessAdapter(agentName) {
  return defaultHarnessRegistry.getAdapter(agentName);
}
