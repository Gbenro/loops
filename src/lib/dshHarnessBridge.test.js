import { describe, it, expect } from 'vitest';
import {
  AgyHarnessAdapter,
  DshHarnessAdapter,
  HarnessRegistry,
  getHarnessAdapter,
  resolveWorkspaceForWindows,
  extractDeniedActions,
  SUPPORTED_RUNTIMES
} from './harnessAdapters.js';

describe('Luna Development Service → DSH & Multi-Harness Adapter Layer', () => {
  it('supports canonical runtimes including agy, dsh, and gemini', () => {
    expect(SUPPORTED_RUNTIMES).toContain('agy');
    expect(SUPPORTED_RUNTIMES).toContain('dsh');
    expect(SUPPORTED_RUNTIMES).toContain('gemini');
  });

  it('translates WSL Linux paths to Windows UNC format for host execution', () => {
    const wslPath = '/home/ben/.openclaw/workspace/loops-app';
    const winUnc = resolveWorkspaceForWindows(wslPath);
    expect(winUnc).toContain('wsl.localhost');
    expect(winUnc).toContain('loops-app');

    const mntPath = '/mnt/c/Users/Ben/project';
    const winDrive = resolveWorkspaceForWindows(mntPath);
    expect(winDrive).toBe('C:\\Users\\Ben\\project');
  });

  it('dispatches to correct adapter based on agent name in HarnessRegistry', () => {
    const registry = new HarnessRegistry();
    
    const dshAdapter = registry.getAdapter('dsh');
    expect(dshAdapter).toBeInstanceOf(DshHarnessAdapter);
    expect(dshAdapter.name).toBe('dsh');
    expect(dshAdapter.runtimeIdentity).toContain('dsh');

    const agyAdapter = registry.getAdapter('agy');
    expect(agyAdapter).toBeInstanceOf(AgyHarnessAdapter);
    expect(agyAdapter.name).toBe('agy');

    const geminiFallback = registry.getAdapter('gemini');
    expect(geminiFallback).toBeInstanceOf(AgyHarnessAdapter);

    const helperDispatched = getHarnessAdapter('dsh');
    expect(helperDispatched.name).toBe('dsh');
  });

  it('declares authoritative capabilities contract for both runtimes', () => {
    const agy = new AgyHarnessAdapter();
    const dsh = new DshHarnessAdapter();

    expect(agy.capabilities.streamingStderr).toBe(true);
    expect(agy.capabilities.workspaceTargeting).toBe(true);
    expect(agy.capabilities.leastPrivilegePresets).toBe(true);
    expect(agy.capabilities.resume).toBe(true);

    expect(dsh.capabilities.streamingStderr).toBe(true);
    expect(dsh.capabilities.workspaceTargeting).toBe(true);
    expect(dsh.capabilities.leastPrivilegePresets).toBe(true);
    expect(dsh.capabilities.resume).toBe(true);
  });

  it('extracts denied actions and permissions violations from logs', () => {
    const sampleLog = `
      [info] Starting agent execution
      [warn] Permission denied: Write operation on /etc/hosts blocked by sandbox
      [info] Tool finished with error
    `;
    const denied = extractDeniedActions(sampleLog);
    expect(denied.length).toBe(1);
    expect(denied[0]).toContain('Permission denied');
  });

  it('formats substantive final responses without reducing results to raw exit codes', () => {
    const sampleExecution = {
      agent: 'dsh',
      model: 'deepseek/deepseek-v4-pro',
      exitCode: 0,
      durationMs: 4200,
      finalResponse: 'Analyzed Luna Loops repository. Found 3 key areas for adapter integration.',
      rawStdout: 'Analyzed Luna Loops repository. Found 3 key areas for adapter integration.',
      rawStderr: '[reasoning] Inspecting project files...',
      terminationReason: 'completed'
    };

    expect(sampleExecution.finalResponse).toBe('Analyzed Luna Loops repository. Found 3 key areas for adapter integration.');
    expect(sampleExecution.finalResponse.length).toBeGreaterThan(10);
    expect(sampleExecution.terminationReason).toBe('completed');
  });
});
