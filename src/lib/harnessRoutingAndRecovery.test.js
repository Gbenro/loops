import { describe, it, expect } from 'vitest';
import {
  HarnessRegistry,
  getHarnessAdapter,
  AgyHarnessAdapter,
  DshHarnessAdapter,
  verifyExecutionOutcome,
  formatElapsed,
  LOCAL_RUNTIMES
} from './harnessAdapters.js';

describe('Harness Routing, Stale-Session Recovery, and Verification Gating', () => {
  it('strictly isolates local runtimes (agy, dsh) from interactive cloud agent (gemini)', () => {
    expect(LOCAL_RUNTIMES).toEqual(['agy', 'dsh']);
    expect(LOCAL_RUNTIMES).not.toContain('gemini');

    const registry = new HarnessRegistry();
    // 'gemini' must NEVER map to a local headless adapter
    expect(registry.getAdapter('gemini')).toBeNull();
    expect(getHarnessAdapter('gemini')).toBeNull();

    // Valid local runtimes
    expect(registry.getAdapter('agy')).toBeInstanceOf(AgyHarnessAdapter);
    expect(registry.getAdapter('dsh')).toBeInstanceOf(DshHarnessAdapter);
  });

  it('formats elapsed heartbeat times cleanly', () => {
    expect(formatElapsed(15000)).toBe('15s');
    expect(formatElapsed(90000)).toBe('1m 30s');
    expect(formatElapsed(135000)).toBe('2m 15s');
  });

  describe('verifyExecutionOutcome — Strict verification gating', () => {
    it('rejects execution when process exit code is non-zero', () => {
      const result = {
        exitCode: 1,
        finalResponse: 'An error occurred during build',
        terminationReason: 'error',
        deniedActions: []
      };
      const check = verifyExecutionOutcome({ executionResult: result });
      expect(check.verified).toBe(false);
      expect(check.reasons.some(r => r.includes('non-zero code'))).toBe(true);
    });

    it('rejects execution when timeout occurred', () => {
      const result = {
        exitCode: 124,
        finalResponse: 'AGY task exited with code null',
        terminationReason: 'timeout',
        deniedActions: []
      };
      const check = verifyExecutionOutcome({ executionResult: result });
      expect(check.verified).toBe(false);
      expect(check.reasons.some(r => r.includes('timed out'))).toBe(true);
    });

    it('rejects execution when final response is empty or insubstantial', () => {
      const result = {
        exitCode: 0,
        finalResponse: '   ',
        terminationReason: 'completed',
        deniedActions: []
      };
      const check = verifyExecutionOutcome({ executionResult: result });
      expect(check.verified).toBe(false);
      expect(check.reasons.some(r => r.includes('empty or insubstantial'))).toBe(true);
    });

    it('rejects execution when sandbox denied actions occurred even if exit code is 0', () => {
      const result = {
        exitCode: 0,
        finalResponse: 'Inspected files and planned changes.',
        terminationReason: 'completed',
        deniedActions: ['WriteToFile blocked by permissions']
      };
      const check = verifyExecutionOutcome({ executionResult: result });
      expect(check.verified).toBe(false);
      expect(check.reasons.some(r => r.includes('denied actions'))).toBe(true);
    });

    it('rejects bug/implementation task if zero files were changed and not a ping test', () => {
      const result = {
        exitCode: 0,
        finalResponse: 'I investigated the problem but made no edits.',
        terminationReason: 'completed',
        deniedActions: []
      };
      const issue = {
        title: 'DEV BUG — AGY — Hide archived chats from active chat dropdown'
      };
      const check = verifyExecutionOutcome({ executionResult: result, issue, changedFiles: [] });
      expect(check.verified).toBe(false);
      expect(check.reasons.some(r => r.includes('zero repository files were modified'))).toBe(true);
    });

    it('approves clean execution with substantive outcome and required deliverables', () => {
      const result = {
        exitCode: 0,
        finalResponse: 'Fixed the dropdown filter logic in Chat.jsx and verified active count.',
        terminationReason: 'completed',
        deniedActions: []
      };
      const issue = {
        title: 'DEV BUG — Fix active count'
      };
      const check = verifyExecutionOutcome({
        executionResult: result,
        issue,
        changedFiles: ['src/tabs/Chat.jsx']
      });
      expect(check.verified).toBe(true);
      expect(check.reasons).toHaveLength(0);
    });
  });

  describe('Stale session detection logic', () => {
    it('identifies orphaned connected sessions older than threshold', () => {
      const now = Date.now();
      const staleSession = {
        id: 'sess_stale_1',
        status: 'connected',
        startedAt: new Date(now - 10 * 60 * 1000).toISOString() // 10m ago
      };
      const recentSession = {
        id: 'sess_fresh_2',
        status: 'connected',
        startedAt: new Date(now - 1 * 60 * 1000).toISOString() // 1m ago
      };

      const isStale = (s, thresholdMs) =>
        s.status === 'connected' && (now - new Date(s.startedAt).getTime()) > thresholdMs;

      expect(isStale(staleSession, 5 * 60 * 1000)).toBe(true);
      expect(isStale(recentSession, 5 * 60 * 1000)).toBe(false);
    });
  });
});
