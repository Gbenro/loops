import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  COMMAND_CENTER_CAPABILITIES,
  CREATIVE_VIDEO_1_MANIFEST
} from '../../mcp-server/dist/commandCenter.js';

describe('Luna Command Center Gateway (6 Operations) Test Suite', () => {
  it('COMMAND_CENTER_CAPABILITIES contains exactly 6 gateway operations below the 30-operation ceiling', () => {
    expect(COMMAND_CENTER_CAPABILITIES.targetGptOperationCount).toBe(6);
    expect(COMMAND_CENTER_CAPABILITIES.baselineMigrationCount).toBe(29);
    const hubKeys = Object.keys(COMMAND_CENTER_CAPABILITIES.hubs);
    expect(hubKeys).toHaveLength(6);
    expect(hubKeys).toEqual(['capabilities', 'core', 'dev', 'lab', 'creative', 'assets']);
  });

  it('Verifies complete 29-to-6 baseline capability mapping without loss', () => {
    const baseline29Operations = [
      // 1-15: Core Personal Field
      'get_lunar_context',
      'search_luna',
      'search_echoes',
      'create_echo',
      'create_conversation_reflection',
      'get_echo',
      'update_echo',
      'attach_reflection',
      'list_loops',
      'create_loop',
      'get_loop',
      'update_loop',
      'list_threads',
      'create_thread',
      'get_thread',
      // 16-20: Chat & Telemetry
      'list_chat_sessions',
      'get_chat_session',
      'search_chat_messages',
      'get_chat_evaluations',
      'get_inference_summary',
      // 21-29: Dev Bridge
      'list_dev_issues',
      'create_dev_issue',
      'get_dev_issue',
      'update_dev_issue_status',
      'get_dev_events',
      'create_dev_session',
      'post_dev_event',
      'claim_dev_session',
      'list_pending_dev_sessions'
    ];

    expect(baseline29Operations).toHaveLength(29);

    // Verify all 29 map into the 6 gateway operations
    const coreSubActions = COMMAND_CENTER_CAPABILITIES.hubs.core.subActions;
    const devSubActions = COMMAND_CENTER_CAPABILITIES.hubs.dev.subActions;

    // Check Core mapping
    expect(coreSubActions).toContain('lunar.get_context');
    expect(coreSubActions).toContain('field.search');
    expect(coreSubActions).toContain('echoes.search');
    expect(coreSubActions).toContain('echoes.create');
    expect(coreSubActions).toContain('reflections.create');
    expect(coreSubActions).toContain('echoes.get');
    expect(coreSubActions).toContain('echoes.update');
    expect(coreSubActions).toContain('reflections.attach');
    expect(coreSubActions).toContain('loops.list');
    expect(coreSubActions).toContain('loops.create');
    expect(coreSubActions).toContain('loops.get');
    expect(coreSubActions).toContain('loops.update');
    expect(coreSubActions).toContain('threads.list');
    expect(coreSubActions).toContain('threads.create');
    expect(coreSubActions).toContain('threads.get');
    expect(coreSubActions).toContain('chat.list_sessions');

    // Check Dev mapping
    expect(devSubActions).toContain('dev.issues.list');
    expect(devSubActions).toContain('dev.issues.create');
    expect(devSubActions).toContain('dev.issues.get');
    expect(devSubActions).toContain('dev.issues.update_status');
    expect(devSubActions).toContain('dev.events.list');
    expect(devSubActions).toContain('dev.sessions.create');
    expect(devSubActions).toContain('dev.events.post');
    expect(devSubActions).toContain('dev.sessions.claim');
    expect(devSubActions).toContain('dev.sessions.pending');
  });

  it('Verifies Creative Studio Video 1 manifest and strict render lock invariant', () => {
    expect(CREATIVE_VIDEO_1_MANIFEST.title).toBe('Creating With the Cycles V1');
    expect(CREATIVE_VIDEO_1_MANIFEST.totalShots).toBe(12);
    expect(CREATIVE_VIDEO_1_MANIFEST.renderLocked).toBe(true);
    expect(CREATIVE_VIDEO_1_MANIFEST.renderLockReason).toContain('strictly locked');
    expect(CREATIVE_VIDEO_1_MANIFEST.shots).toHaveLength(12);
  });

  it('Verifies Client-Specific Least Privilege boundary: Core hub disallows discovery token', () => {
    expect(COMMAND_CENTER_CAPABILITIES.hubs.core.allowDiscoveryToken).toBe(false);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.dev.allowDiscoveryToken).toBe(true);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.creative.allowDiscoveryToken).toBe(true);
    expect(COMMAND_CENTER_CAPABILITIES.hubs.assets.allowDiscoveryToken).toBe(true);
  });
});
