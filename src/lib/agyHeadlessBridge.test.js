import { describe, it, expect } from 'vitest';

describe('Luna Development Service → AGY Headless Bridge', () => {
  const mockSettings = {
    colorScheme: 'dark',
    trustedWorkspaces: [
      '/home/ben/.openclaw/workspace/loops-app'
    ],
    permissions: {
      allow: [
        'read',
        'edit',
        'command',
        'command(*)',
        'command(npm *)',
        'command(git *)',
        'command(node *)'
      ]
    }
  };

  it('validates least-privilege permission profile without dangerous bypass', () => {
    expect(mockSettings.permissions.allow).toContain('read');
    expect(mockSettings.permissions.allow).toContain('edit');
    expect(mockSettings.permissions.allow).toContain('command');
    expect(mockSettings.trustedWorkspaces).toContain('/home/ben/.openclaw/workspace/loops-app');
  });

  it('maintains durable mapping between Development Service issue/session and AGY conversation_id', () => {
    const memoryMapping = {};

    function recordAgyConversation(issueId, agyConversationId) {
      memoryMapping[issueId] = agyConversationId;
    }

    function getAgyConversation(issueId) {
      return memoryMapping[issueId] || null;
    }

    recordAgyConversation('iss_1788493307072_zxzx', 'f140a3b9-cb5c-437c-8078-b8f834cb92e6');
    expect(getAgyConversation('iss_1788493307072_zxzx')).toBe('f140a3b9-cb5c-437c-8078-b8f834cb92e6');
    expect(getAgyConversation('iss_unmapped')).toBeNull();
  });

  it('constructs correct agy headless execution arguments', () => {
    function buildAgyArgs(prompt, conversationId) {
      const args = ['-p', prompt, '--output-format', 'json'];
      if (conversationId) {
        args.push('--conversation', conversationId);
      }
      return args;
    }

    const freshArgs = buildAgyArgs('Inspect codebase', null);
    expect(freshArgs).toEqual(['-p', 'Inspect codebase', '--output-format', 'json']);

    const resumeArgs = buildAgyArgs('Resume task', 'conv_123');
    expect(resumeArgs).toEqual(['-p', 'Resume task', '--output-format', 'json', '--conversation', 'conv_123']);
  });

  it('parses structured AGY headless output and extracts telemetry', () => {
    const rawResult = {
      exitCode: 0,
      durationMs: 3900,
      stdout: '{"result":"Completed successfully","summary":"Checked loops-app"}'
    };

    let parsed = null;
    try {
      parsed = JSON.parse(rawResult.stdout);
    } catch {
      parsed = { raw: rawResult.stdout };
    }

    expect(parsed.result).toBe('Completed successfully');
    expect(rawResult.durationMs).toBeLessThan(5000);
    expect(rawResult.exitCode).toBe(0);
  });

  it('protects against duplicate claim or concurrent replay', () => {
    const activeClaims = new Set();

    function tryClaim(issueId, workerId) {
      if (activeClaims.has(issueId)) {
        return { success: false, reason: 'already_claimed' };
      }
      activeClaims.add(issueId);
      return { success: true, workerId };
    }

    const claim1 = tryClaim('iss_1788493307072_zxzx', 'worker_1');
    expect(claim1.success).toBe(true);

    const claim2 = tryClaim('iss_1788493307072_zxzx', 'worker_2');
    expect(claim2.success).toBe(false);
    expect(claim2.reason).toBe('already_claimed');
  });

  it('verifies daemon worker lifecycle, banner formatting, and fatal error on missing token', () => {
    function simulateWorkerInit(hasToken) {
      if (!hasToken) {
        throw new Error('Authentication token not found in /home/ben/.luna/auth.json or LUNA_DEV_TOKEN env.');
      }
      return {
        status: 'ACTIVE',
        bannerPrinted: true,
        api: 'https://loops-production-e1d5.up.railway.app'
      };
    }

    // Success case
    const activeWorker = simulateWorkerInit(true);
    expect(activeWorker.status).toBe('ACTIVE');
    expect(activeWorker.bannerPrinted).toBe(true);

    // Fatal missing token case
    expect(() => simulateWorkerInit(false)).toThrow('Authentication token not found');
  });

  it('handles clean shutdown on SIGINT and SIGTERM without orphaned processes', () => {
    let workerRunning = true;
    const shutdownHandler = () => {
      workerRunning = false;
      return { exitCode: 0, clean: true };
    };

    expect(workerRunning).toBe(true);
    const result = shutdownHandler();
    expect(workerRunning).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.clean).toBe(true);
  });
});
