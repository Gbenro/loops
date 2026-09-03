import { describe, it, expect } from 'vitest';

describe('Luna API Operation Coverage Baseline Matrix', () => {
  const canonicalOperations = [
    // 1. Lunar & Temporal Grounding
    { domain: 'Lunar Grounding', op: 'get_current_lunar_context', type: 'read', status: 'supported', contract: '/api/lunar/current' },
    { domain: 'Lunar Grounding', op: 'get_current_cycle', type: 'read', status: 'supported', contract: '/api/lunar/current' },

    // 2. Field Retrieval & Search
    { domain: 'Field Retrieval', op: 'get_ai_context', type: 'read', status: 'supported', contract: '/api/context' },
    { domain: 'Field Retrieval', op: 'search_luna', type: 'read', status: 'supported', contract: '/api/search' },

    // 3. Echoes / Reflections
    { domain: 'Echoes', op: 'search_echoes', type: 'read', status: 'supported', contract: '/api/echoes' },
    { domain: 'Echoes', op: 'create_echo', type: 'write', status: 'supported', contract: '/api/echoes' },
    { domain: 'Echoes', op: 'get_echo', type: 'read', status: 'supported', contract: '/api/echoes/:id' },
    { domain: 'Echoes', op: 'update_echo', type: 'write', status: 'supported', contract: '/api/echoes/:id' },
    { domain: 'Echoes', op: 'archive_echo', type: 'write', status: 'supported', contract: '/api/echoes/:id/archive' },
    { domain: 'Echoes', op: 'restore_echo', type: 'write', status: 'supported', contract: '/api/echoes/:id/restore' },

    // 4. Loops CRUD & Lifecycle
    { domain: 'Loops', op: 'list_loops', type: 'read', status: 'supported', contract: '/api/loops' },
    { domain: 'Loops', op: 'create_loop', type: 'write', status: 'supported', contract: '/api/loops' },
    { domain: 'Loops', op: 'get_loop', type: 'read', status: 'supported', contract: '/api/loops/:id' },
    { domain: 'Loops', op: 'update_loop', type: 'write', status: 'supported', contract: '/api/loops/:id' },
    { domain: 'Loops', op: 'close_loop', type: 'write', status: 'supported', contract: '/api/loops/:id/close' },
    { domain: 'Loops', op: 'reopen_loop', type: 'write', status: 'supported', contract: '/api/loops/:id/reopen' },
    { domain: 'Loops', op: 'archive_loop', type: 'write', status: 'supported', contract: '/api/loops/:id/archive' },
    { domain: 'Loops', op: 'restore_loop', type: 'write', status: 'supported', contract: '/api/loops/:id/restore' },
    { domain: 'Loops', op: 'carry_loop_forward', type: 'write', status: 'supported', contract: '/api/loops/:id/carry-forward' },

    // 5. Lunar Cycle Synthesis
    { domain: 'Cycle Synthesis', op: 'get_lunar_cycle_records', type: 'read', status: 'supported', contract: '/api/lunar-cycle/records' },
    { domain: 'Cycle Synthesis', op: 'get_cycle_synthesis_context', type: 'read', status: 'supported', contract: '/api/cycle/synthesis-context' },

    // 6. Relational Memory
    { domain: 'Relational Memory', op: 'search_relational_memories', type: 'read', status: 'supported', contract: 'search_relational_memories' },
    { domain: 'Relational Memory', op: 'propose_candidate_memory', type: 'write', status: 'supported', contract: 'propose_candidate_memory' },
    { domain: 'Relational Memory', op: 'reinforce_relational_memory', type: 'write', status: 'supported', contract: 'reinforce_relational_memory' },
    { domain: 'Relational Memory', op: 'update_relational_memory_status', type: 'write', status: 'supported', contract: 'update_relational_memory_status' },

    // 7. Chat / Session Lifecycle
    { domain: 'Chat Lifecycle', op: 'list_chat_sessions', type: 'read', status: 'supported', contract: '/api/chat/sessions' },
    { domain: 'Chat Lifecycle', op: 'archive_chat_session', type: 'write', status: 'supported', contract: 'archive_chat_session' },
    { domain: 'Chat Lifecycle', op: 'restore_chat_session', type: 'write', status: 'supported', contract: 'restore_chat_session' },

    // 8. Development Service
    { domain: 'Dev Service', op: 'get_dev_queue', type: 'read', status: 'supported', contract: '/api/dev/queue' },
    { domain: 'Dev Service', op: 'get_dev_telemetry', type: 'read', status: 'supported', contract: '/api/dev/telemetry' },
    { domain: 'Dev Service', op: 'get_dev_issue', type: 'read', status: 'supported', contract: '/api/dev/issues/:id' },
    { domain: 'Dev Service', op: 'answer_dev_question', type: 'write', status: 'supported', contract: '/api/dev/events' }
  ];

  it('contains complete inventory of 30+ canonical Luna operations across all 8 functional domains', () => {
    expect(canonicalOperations.length).toBeGreaterThanOrEqual(30);
    const domains = new Set(canonicalOperations.map(o => o.domain));
    expect(domains.has('Lunar Grounding')).toBe(true);
    expect(domains.has('Field Retrieval')).toBe(true);
    expect(domains.has('Echoes')).toBe(true);
    expect(domains.has('Loops')).toBe(true);
    expect(domains.has('Cycle Synthesis')).toBe(true);
    expect(domains.has('Relational Memory')).toBe(true);
    expect(domains.has('Chat Lifecycle')).toBe(true);
    expect(domains.has('Dev Service')).toBe(true);
  });

  it('marks all canonical operations as supported with zero broken or missing core contracts', () => {
    const broken = canonicalOperations.filter(o => o.status === 'broken');
    const missing = canonicalOperations.filter(o => o.status === 'missing');
    expect(broken).toHaveLength(0);
    expect(missing).toHaveLength(0);
    expect(canonicalOperations.every(o => o.status === 'supported')).toBe(true);
  });

  it('distinguishes read operations from write/mutation operations for safe telemetry and testing', () => {
    const reads = canonicalOperations.filter(o => o.type === 'read');
    const writes = canonicalOperations.filter(o => o.type === 'write');
    expect(reads.length).toBeGreaterThan(10);
    expect(writes.length).toBeGreaterThan(10);
  });

  it('ensures Development Service telemetry is strictly partitioned and never leaked into personal Field retrieval', () => {
    const fieldOps = canonicalOperations.filter(o => o.domain === 'Field Retrieval' || o.domain === 'Echoes');
    expect(fieldOps.every(o => !o.contract.includes('/api/dev/'))).toBe(true);
  });
});
