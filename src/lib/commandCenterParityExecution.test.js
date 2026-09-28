import { describe, it, expect } from 'vitest';
import { COMMAND_CENTER_CAPABILITIES, extractCommandCenterPayload } from '../../mcp-server/dist/commandCenter.js';

describe('Luna Command Center Parity Unit & Schema Test Suite', () => {
  it('1. Verifies COMMAND_CENTER_CAPABILITIES exposes 44 subActions under core hub with complete parity', () => {
    const coreSubActions = COMMAND_CENTER_CAPABILITIES.hubs.core.subActions;
    
    // Field & Temporal
    expect(coreSubActions).toContain('field.search');
    expect(coreSubActions).toContain('field.get_range');
    expect(coreSubActions).toContain('context.get_snapshot');
    expect(coreSubActions).toContain('cycle.get_records');

    // Echoes
    expect(coreSubActions).toContain('echoes.search');
    expect(coreSubActions).toContain('echoes.get');
    expect(coreSubActions).toContain('echoes.create');
    expect(coreSubActions).toContain('echoes.update');
    expect(coreSubActions).toContain('echoes.archive');
    expect(coreSubActions).toContain('echoes.restore');
    expect(coreSubActions).toContain('echoes.get_reflections');

    // Reflections
    expect(coreSubActions).toContain('reflections.create');
    expect(coreSubActions).toContain('reflections.attach');
    expect(coreSubActions).toContain('reflections.get');

    // Relational Memory
    expect(coreSubActions).toContain('relational_memory.search');
    expect(coreSubActions).toContain('relational_memory.propose');
    expect(coreSubActions).toContain('relational_memory.reinforce');
    expect(coreSubActions).toContain('relational_memory.update_status');

    // Loops
    expect(coreSubActions).toContain('loops.list');
    expect(coreSubActions).toContain('loops.get');
    expect(coreSubActions).toContain('loops.create');
    expect(coreSubActions).toContain('loops.update');
    expect(coreSubActions).toContain('loops.close');
    expect(coreSubActions).toContain('loops.reopen');
    expect(coreSubActions).toContain('loops.archive');
    expect(coreSubActions).toContain('loops.restore');
    expect(coreSubActions).toContain('loops.carry_forward');

    // Threads
    expect(coreSubActions).toContain('threads.list');
    expect(coreSubActions).toContain('threads.get');
    expect(coreSubActions).toContain('threads.create');
    expect(coreSubActions).toContain('threads.update');
    expect(coreSubActions).toContain('threads.connect_echo');
    expect(coreSubActions).toContain('threads.disconnect_echo');

    // Chat
    expect(coreSubActions).toContain('chat.list_sessions');
    expect(coreSubActions).toContain('chat.get_session');
    expect(coreSubActions).toContain('chat.search_messages');
    expect(coreSubActions).toContain('chat.rename_session');
    expect(coreSubActions).toContain('chat.archive_session');
    expect(coreSubActions).toContain('chat.restore_session');
    expect(coreSubActions).toContain('chat.delete_session');
    expect(coreSubActions).toContain('chat.preserve_to_field');
    expect(coreSubActions).toContain('chat.evaluations');
    expect(coreSubActions).toContain('chat.inference_summary');

    // Lunar
    expect(coreSubActions).toContain('lunar.get_context');
  });

  it('2. Verifies extractCommandCenterPayload parses field.get_range temporal arguments', () => {
    const fromTime = '2026-09-23T14:00:00.000Z';
    const toTime = '2026-09-24T14:00:00.000Z';
    const body = {
      action: 'field.get_range',
      payload: {
        from: fromTime,
        to: toTime,
        types: ['echo', 'loop', 'reflection'],
        status: 'active',
        sort: 'newest',
        limit: 25
      }
    };
    const extracted = extractCommandCenterPayload(body);
    expect(extracted.from).toBe(fromTime);
    expect(extracted.to).toBe(toTime);
    expect(extracted.types).toEqual(['echo', 'loop', 'reflection']);
    expect(extracted.status).toBe('active');
    expect(extracted.sort).toBe('newest');
    expect(extracted.limit).toBe(25);
    expect(extracted.action).toBeUndefined();
  });
});
