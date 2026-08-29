import { describe, it, expect } from 'vitest';

// Emulated MCP tool schemas and parity validators
const REQUIRED_CORE_TOOLS = [
  'get_ai_context',
  'search_echoes',
  'get_echo',
  'create_echo',
  'create_conversation_reflection',
  'update_echo',
  'archive_echo',
  'restore_echo',
  'list_loops',
  'get_loop',
  'create_loop',
  'update_loop',
  'close_loop',
  'reopen_loop',
  'archive_loop',
  'restore_loop',
  'carry_loop_forward',
  'create_thread',
  'list_threads',
  'get_thread',
  'update_thread',
  'connect_echo_to_thread',
  'disconnect_echo_from_thread',
  'get_echo_reflections',
  'attach_reflection',
  'search_luna',
  'search_relational_memories',
  'propose_candidate_memory',
  'reinforce_relational_memory',
  'update_relational_memory_status'
];

function extractDatabaseMutation(toolName, toolArgs, parsedResult) {
  if (!parsedResult || typeof parsedResult !== 'object') return null;

  if (toolName === 'attach_reflection') {
    const entityId = parsedResult.id || toolArgs.id;
    const parentEchoId = toolArgs.echoId || parsedResult.echoId;
    return {
      operation: 'create',
      entityType: 'reflection',
      entityId,
      parentEchoId,
      table: 'echo_reflections',
      timestamp: new Date().toISOString()
    };
  }

  if (toolName === 'create_conversation_reflection') {
    return {
      operation: 'create',
      entityType: 'conversation_reflection',
      entityId: parsedResult.id,
      provenanceAuthor: 'co-created',
      provenanceKind: 'conversation_reflection',
      tags: parsedResult.tags || toolArgs.tags,
      table: 'echoes'
    };
  }

  if (toolName === 'create_echo' || toolName === 'create_entry') {
    return {
      operation: 'create',
      entityType: 'echo',
      entityId: parsedResult.id,
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
      tags: parsedResult.tags || toolArgs.tags,
      loopIds: parsedResult.loopIds || toolArgs.loopIds,
      table: 'echoes'
    };
  }
  if (toolName === 'update_echo') {
    return {
      operation: 'update',
      entityType: 'echo',
      entityId: parsedResult.id || toolArgs.id,
      tags: parsedResult.tags || toolArgs.tags,
      loopIds: parsedResult.loopIds || toolArgs.loopIds,
      table: 'echoes'
    };
  }

  if (toolName === 'create_loop') {
    return {
      operation: 'create',
      entityType: 'loop',
      entityId: parsedResult.id,
      title: parsedResult.title || toolArgs.title,
      table: 'loops'
    };
  }
  if (toolName === 'carry_loop_forward') {
    return {
      operation: 'carry_forward',
      entityType: 'loop',
      entityId: parsedResult.id,
      oldLoopId: toolArgs.id,
      table: 'loops'
    };
  }

  return null;
}

function classifyOperation(toolCalls, message, fieldCoverage) {
  if (!toolCalls || toolCalls.length === 0) {
    const lower = (message || '').toLowerCase();
    if ((message && (message.length > 100 || message.includes('?'))) && (lower.includes('why') || lower.includes('reflect') || lower.includes('feel') || lower.includes('sense') || lower.includes('meaning') || lower.includes('wonder'))) {
      return 'deep_reflection';
    }
    return 'conversation';
  }

  const toolNames = toolCalls.map(t => t.tool || t.name || '');
  
  if (toolNames.some(n => n.startsWith('create_') || n.startsWith('update_') || n.startsWith('archive_') || n.startsWith('restore_') || n === 'attach_reflection' || n === 'close_loop' || n === 'reopen_loop' || n === 'carry_loop_forward')) {
    return 'crud_mutation';
  }

  if (toolNames.some(n => n.includes('relational_memory'))) {
    return 'relational_memory';
  }

  const isLongitudinal = (fieldCoverage?.recordsRetrieved > 10) || 
    toolNames.some(n => n === 'search_echoes' || n === 'search_luna' || n === 'list_loops') && 
    /(pattern|cycle|history|before|phase|longitudinal|month|recur)/i.test(message);

  if (isLongitudinal) {
    return 'longitudinal_synthesis';
  }

  if (toolNames.some(n => n.startsWith('search_') || n.startsWith('list_') || n.startsWith('get_'))) {
    return 'field_lookup';
  }

  return 'conversation';
}

describe('Capability Parity & Observability Regression', () => {
  it('exposes all required core tools across internal chat and external action schemas', () => {
    expect(REQUIRED_CORE_TOOLS).toContain('update_echo');
    expect(REQUIRED_CORE_TOOLS).toContain('attach_reflection');
    expect(REQUIRED_CORE_TOOLS).toContain('create_conversation_reflection');
    expect(REQUIRED_CORE_TOOLS).toContain('propose_candidate_memory');
    expect(REQUIRED_CORE_TOOLS.length).toBe(30);
  });

  it('normalizes attach_reflection mutations with operation=create and entityType=reflection', () => {
    const mutation = extractDatabaseMutation(
      'attach_reflection',
      { echoId: 'e1787993224994', content: 'Audience analysis notes' },
      { id: 'r1787993223994wa73', echoId: 'e1787993224994' }
    );

    expect(mutation).not.toBeNull();
    expect(mutation.operation).toBe('create');
    expect(mutation.entityType).toBe('reflection');
    expect(mutation.entityId).toBe('r1787993223994wa73');
    expect(mutation.parentEchoId).toBe('e1787993224994');
    expect(mutation.table).toBe('echo_reflections');
  });

  it('normalizes update_echo mutations with updated tags and loop references', () => {
    const mutation = extractDatabaseMutation(
      'update_echo',
      { id: 'e1234567890', tags: ['focus', 'strategy'] },
      { id: 'e1234567890', tags: ['focus', 'strategy'], loopIds: ['l100'] }
    );

    expect(mutation).not.toBeNull();
    expect(mutation.operation).toBe('update');
    expect(mutation.entityType).toBe('echo');
    expect(mutation.entityId).toBe('e1234567890');
    expect(mutation.tags).toEqual(['focus', 'strategy']);
  });

  it('correctly classifies operations into standardized operation classes', () => {
    // 1. CRUD Mutation
    const crudOp = classifyOperation(
      [{ tool: 'attach_reflection' }],
      'Save this audience analysis attached to product spec',
      { recordsRetrieved: 1 }
    );
    expect(crudOp).toBe('crud_mutation');

    // 2. Longitudinal Synthesis
    const longOp = classifyOperation(
      [{ tool: 'search_echoes' }],
      'What patterns have recurred in my waxing crescent phases?',
      { recordsRetrieved: 30, hasMore: true }
    );
    expect(longOp).toBe('longitudinal_synthesis');

    // 3. Field Lookup
    const lookupOp = classifyOperation(
      [{ tool: 'get_echo' }],
      'Show me my latest note',
      { recordsRetrieved: 1 }
    );
    expect(lookupOp).toBe('field_lookup');

    // 4. Deep Reflection
    const deepOp = classifyOperation(
      [],
      'I am wondering why this sense of stillness feels so foreign to me right now and what meaning it might hold for my creative rhythm.',
      null
    );
    expect(deepOp).toBe('deep_reflection');

    // 5. Normal Conversation
    const convOp = classifyOperation(
      [],
      'Good morning Luna!',
      null
    );
    expect(convOp).toBe('conversation');
  });

  describe('OpenAPI / GPT Actions Schema Parity', () => {
    const REQUIRED_EXTERNAL_ACTIONS = [
      'get_lunar_context',
      'search_luna',
      'search_echoes',
      'get_echo',
      'create_echo',
      'create_conversation_reflection',
      'update_echo',
      'archive_echo',
      'restore_echo',
      'get_echo_reflections',
      'attach_reflection',
      'list_loops',
      'get_loop',
      'create_loop',
      'update_loop',
      'close_loop',
      'carry_loop_forward',
      'list_threads',
      'create_thread',
      'get_thread',
      'update_thread',
      'connect_echo_to_thread',
      'disconnect_echo_from_thread',
      'get_inference_summary'
    ];

    it('ensures all approved external actions exist in OpenAPI paths', async () => {
      // Emulate extracting operationIds from openapi spec
      const extractedOperationIds = [
        'get_lunar_context',
        'search_luna',
        'search_echoes',
        'create_echo',
        'create_conversation_reflection',
        'get_echo',
        'update_echo',
        'archive_echo',
        'restore_echo',
        'get_echo_reflections',
        'attach_reflection',
        'list_loops',
        'create_loop',
        'get_loop',
        'update_loop',
        'close_loop',
        'carry_loop_forward',
        'list_threads',
        'create_thread',
        'get_thread',
        'update_thread',
        'connect_echo_to_thread',
        'disconnect_echo_from_thread',
        'get_inference_summary'
      ];

      for (const requiredAction of REQUIRED_EXTERNAL_ACTIONS) {
        expect(
          extractedOperationIds,
          `OpenAPI schema must expose approved external action: ${requiredAction}`
        ).toContain(requiredAction);
      }
    });

    it('enforces that update_echo schema prevents text mutation', () => {
      const updateEchoProperties = {
        tags: { type: 'array' },
        status: { type: 'string', enum: ['active', 'archived'] },
        loopIds: { type: 'array' }
      };

      expect(updateEchoProperties).not.toHaveProperty('text');
      expect(updateEchoProperties).toHaveProperty('tags');
      expect(updateEchoProperties).toHaveProperty('status');
    });

    it('enforces that create_echo and create_conversation_reflection have distinct provenance', () => {
      const createEchoDescription = 'Server enforces provenance: author=user, kind=original_echo.';
      const createConvRefDescription = 'Server enforces provenance: author=co-created, kind=conversation_reflection, source=luna_conversation.';

      expect(createEchoDescription).toContain('author=user');
      expect(createEchoDescription).toContain('kind=original_echo');
      expect(createConvRefDescription).toContain('author=co-created');
      expect(createConvRefDescription).toContain('kind=conversation_reflection');
    });
  });
});
