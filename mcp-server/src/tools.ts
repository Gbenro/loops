import { SupabaseClient } from '@supabase/supabase-js';
import { getLunarData } from './lunar.js';

// Schema types for tool declarations
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Declares all Luna Loop MCP tools with precise schemas and instructions for the AI client.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Context
  {
    name: 'get_ai_context',
    description: 'LIGHTWEIGHT CONTEXT: Retrieve the user\'s present state snapshot (current moon, phase, active themes, open loop lists, and last 5 reflections) for orientation. Do not use for historical retrieval or deep queries.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  
  // Echoes (Reflections)
  {
    name: 'search_echoes',
    description: 'Search the user\'s persistent Luna Loop Echo (reflection) history. Supports composable filters (query, phase, cycle, tags, loopId, date range, status, sorting, pagination). Use when the user asks about previous reflections, memories, observations, or topics.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text query (case-insensitive keyword match)' },
        phase: { type: 'string', description: 'Filter by moon phase name (e.g., \'New Moon\', \'First Quarter\')' },
        cycle: { type: 'string', description: 'Filter by lunar month name (e.g., \'Wolf Moon\', \'Snow\')' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (matches all specified tags)' },
        loopId: { type: 'string', description: 'Filter echoes associated with a specific loop ID' },
        from: { type: 'string', description: 'Filter created_at timestamp starting boundary (ISO-8601)' },
        to: { type: 'string', description: 'Filter created_at timestamp ending boundary (ISO-8601)' },
        status: { type: 'string', enum: ['active', 'archived', 'all'], default: 'active', description: 'Filter active, archived (soft-deleted), or all echoes' },
        sort: { type: 'string', enum: ['newest', 'oldest'], default: 'newest', description: 'Sorting order by creation date' },
        limit: { type: 'integer', default: 20, description: 'Number of results (max 100)' },
        cursor: { type: 'string', description: 'Pagination cursor for subsequent page fetches' }
      }
    }
  },
  {
    name: 'get_echo',
    description: 'Retrieve a complete persistent Echo (reflection) object by its stable ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Echo' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_echo',
    description: 'Create a new personal Echo (direct user observation note). Enforces provenance: author=user, kind=original_echo. Automatically stamps current lunar metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Plaintext content of the user observation' },
        source: { type: 'string', description: 'Client identifier (e.g. direct_entry, voice, chatgpt)', default: 'direct_entry' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Emotional signature tags' },
        loopIds: { type: 'array', items: { type: 'string' }, description: 'List of loop IDs to connect this observation to' },
        energyState: { type: 'string', description: 'Energy signature (e.g. resting, focused)' },
        metadata: { type: 'object', description: 'Optional custom client metadata' },
        parentId: { type: 'string', description: 'Parent echo ID if explicitly connected' }
      },
      required: ['text']
    }
  },
  {
    name: 'create_conversation_reflection',
    description: 'Save a conversation-derived / co-created reflection note born out of dialogue between the user and Luna. Enforces provenance: author=co-created, kind=conversation_reflection, source=luna_conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Plaintext content of the reflection/insight derived from conversation' },
        sessionId: { type: 'string', description: 'Chat session ID where the insight originated' },
        conversationTitle: { type: 'string', description: 'Topic or title of the conversation' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Thematic or emotional tags' },
        loopIds: { type: 'array', items: { type: 'string' }, description: 'List of loop IDs to relate this reflection to' },
        energyState: { type: 'string', description: 'Energy signature' },
        metadata: { type: 'object', description: 'Optional custom metadata' }
      },
      required: ['text']
    }
  },
  {
    name: 'update_echo',
    description: 'Modify an existing Echo identified by its stable ID using PATCH semantics (only specified fields are changed). Returns the full updated Echo.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Echo to update' },
        text: { type: 'string', description: 'Updated text content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags list (overwrites existing)' },
        status: { type: 'string', enum: ['active', 'archived'], description: 'Change status (\'active\' or \'archived\')' },
        loopIds: { type: 'array', items: { type: 'string' }, description: 'Updated list of associated loop IDs' },
        provenanceAuthor: { type: 'string', enum: ['user', 'ai', 'co-created'], description: 'Updated origin source author' },
        provenanceKind: { type: 'string', enum: ['original_echo', 'ai_reflection', 'checkpoint', 'product_note'], description: 'Updated type of record' },
        parentId: { type: 'string', description: 'Updated parent echo ID connection' }
      },
      required: ['id']
    }
  },
  {
    name: 'archive_echo',
    description: 'Soft-delete an Echo by setting its status to archived. Highly preferred over permanent delete.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Echo to archive' }
      },
      required: ['id']
    }
  },
  {
    name: 'restore_echo',
    description: 'Recover a soft-deleted (archived) Echo back to active state.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Echo to restore' }
      },
      required: ['id']
    }
  },
  
  // Loops (Intentions in Awareness)
  {
    name: 'list_loops',
    description: 'Search and query the user\'s Loops (intentions consciously held in awareness). Replaces listOpenLoops with rich filtering, status checking, and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'paused', 'closed', 'archived', 'all'], default: 'open', description: 'Lifecycle status filter' },
        query: { type: 'string', description: 'Search term query matching title or note description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        sort: { type: 'string', enum: ['newest', 'oldest', 'recently_updated'], default: 'newest', description: 'Sorting order' },
        limit: { type: 'integer', default: 20, description: 'Number of results' },
        cursor: { type: 'string', description: 'Pagination cursor' }
      }
    }
  },
  {
    name: 'list_open_loops',
    description: 'Backward-compatible shortcut to retrieve all open loops in the user\'s active awareness.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_loop',
    description: 'Retrieve a complete Loop object by its stable ID, including its associated Echo IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_loop',
    description: 'Create a new Loop (an item consciously held in awareness). Automatically stamps current lunar metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Focus title' },
        note: { type: 'string', description: 'Descriptive details or observations' },
        type: { type: 'string', description: 'Type of loop (\'phase\' or \'cycle\')', default: 'phase' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
        subtasks: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: { 
              title: { type: 'string' }, 
              completed: { type: 'boolean' } 
            }, 
            required: ['title'] 
          }, 
          description: 'Array of subtasks/steps with titles and completion status' 
        },
        steps: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: { 
              title: { type: 'string' }, 
              completed: { type: 'boolean' } 
            }, 
            required: ['title'] 
          }, 
          description: 'Conversational alias for subtasks' 
        },
        energyState: { type: 'string', description: 'Current user energy state' },
        attentionLevel: { type: 'string', description: 'Amount of awareness required (e.g. \'active\', \'background\')' },
        alivenessScore: { type: 'integer', description: 'Vitality score (1-10)' },
        parentLoopId: { type: 'string', description: 'Parent loop ID if transformed/carried forward' },
        metadata: { type: 'object', description: 'Custom client metadata' },
        provenanceAuthor: { type: 'string', enum: ['user', 'ai', 'co-created'], description: 'Origin source author' },
        provenanceKind: { type: 'string', enum: ['original_echo', 'ai_reflection', 'checkpoint', 'product_note'], description: 'Type of record' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_loop',
    description: 'Modify an existing Loop identified by its stable ID using PATCH semantics (only specified fields are changed). Returns the full updated Loop.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop to update' },
        title: { type: 'string', description: 'Updated title' },
        note: { type: 'string', description: 'Updated note description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags list (overwrites existing)' },
        status: { type: 'string', enum: ['open', 'paused', 'closed', 'archived'], description: 'Change status' },
        subtasks: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: { 
              title: { type: 'string' }, 
              completed: { type: 'boolean' } 
            }, 
            required: ['title'] 
          }, 
          description: 'Array of subtasks/steps' 
        },
        steps: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: { 
              title: { type: 'string' }, 
              completed: { type: 'boolean' } 
            }, 
            required: ['title'] 
          }, 
          description: 'Alias for subtasks' 
        },
        provenanceAuthor: { type: 'string', enum: ['user', 'ai', 'co-created'], description: 'Updated origin source author' },
        provenanceKind: { type: 'string', enum: ['original_echo', 'ai_reflection', 'checkpoint', 'product_note'], description: 'Updated type of record' }
      },
      required: ['id']
    }
  },
  {
    name: 'close_loop',
    description: 'Mark a Loop as closed (consciously completed/resolved). Stamped with closing moon phase.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop to close' },
        note: { type: 'string', description: 'Optional closing note reflection' }
      },
      required: ['id']
    }
  },
  {
    name: 'reopen_loop',
    description: 'Reopen a previously closed or archived Loop back to active state.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop to reopen' }
      },
      required: ['id']
    }
  },
  {
    name: 'archive_loop',
    description: 'Soft-delete a Loop by setting its status to archived.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop to archive' }
      },
      required: ['id']
    }
  },
  {
    name: 'restore_loop',
    description: 'Restore an archived Loop back to its previous state.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Loop to restore' }
      },
      required: ['id']
    }
  },
  {
    name: 'carry_loop_forward',
    description: 'Carries a Loop forward into the current phase/cycle, transitioning the old loop to \'carried_forward\' and opening a new linked instance.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of loop to carry forward' },
        new_note: { type: 'string', description: 'Updated note details for the new loop instance' }
      },
      required: ['id']
    }
  },
  
  // Threads (Connections across Echoes)
  {
    name: 'create_thread',
    description: 'Create a new Thread representing a theme, relationship, pattern, tension, or insight across one or many Echoes.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Thread title' },
        description: { type: 'string', description: 'Detailed description of the pattern or theme' },
        source: { type: 'string', enum: ['user_created', 'ai_suggested', 'conversation_discovered', 'system_detected'], default: 'user_created' },
        confidence: { type: 'number', description: 'Confidence level (0.0 to 1.0) of AI detection' },
        metadata: { type: 'object', description: 'Additional custom metadata' }
      },
      required: ['title']
    }
  },
  {
    name: 'list_threads',
    description: 'Search and query the user\'s Threads. Supports status, query, source filters, limit, and cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'archived', 'all'], default: 'active' },
        query: { type: 'string', description: 'Search title or description' },
        source: { type: 'string', enum: ['user_created', 'ai_suggested', 'conversation_discovered', 'system_detected'] },
        limit: { type: 'integer', default: 20 },
        cursor: { type: 'string' }
      }
    }
  },
  {
    name: 'get_thread',
    description: 'Retrieve a complete Thread object by its stable ID, including all connected Echo IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Thread' }
      },
      required: ['id']
    }
  },
  {
    name: 'update_thread',
    description: 'Modify an existing Thread. PATCH semantics. Returns the full updated Thread.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Stable unique ID of the Thread to update' },
        title: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description details' },
        status: { type: 'string', enum: ['active', 'archived'] }
      },
      required: ['id']
    }
  },
  {
    name: 'connect_echo_to_thread',
    description: 'Connect an Echo (reflection) to a Thread (theme/pattern). Establishes a many-to-many relationship.',
    inputSchema: {
      type: 'object',
      properties: {
        echoId: { type: 'string', description: 'ID of the Echo' },
        threadId: { type: 'string', description: 'ID of the Thread' },
        createdBy: { type: 'string', enum: ['user', 'ai'], default: 'user' },
        relationshipType: { type: 'string', description: 'Optional relationship qualifier (e.g. \'triggers\', \'resolves\')' },
        note: { type: 'string', description: 'Optional note explaining the connection' }
      },
      required: ['echoId', 'threadId']
    }
  },
  {
    name: 'disconnect_echo_from_thread',
    description: 'Remove a many-to-many connection between an Echo and a Thread.',
    inputSchema: {
      type: 'object',
      properties: {
        echoId: { type: 'string', description: 'ID of the Echo' },
        threadId: { type: 'string', description: 'ID of the Thread' }
      },
      required: ['echoId', 'threadId']
    }
  },

  // Echo Reflections (Insights over time)
  {
    name: 'get_echo_reflections',
    description: 'Retrieve all attached reflections/insights accumulated around a specific Echo over time.',
    inputSchema: {
      type: 'object',
      properties: {
        echoId: { type: 'string', description: 'ID of the Echo' }
      },
      required: ['echoId']
    }
  },
  {
    name: 'attach_reflection',
    description: 'Attach a new conversation reflection/insight to an Echo, keeping the user\'s original expression untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        echoId: { type: 'string', description: 'ID of the Echo to attach the insight to' },
        content: { type: 'string', description: 'Text content of the reflection/insight' },
        authorType: { type: 'string', enum: ['user', 'ai', 'co_created'], default: 'user' },
        conversationId: { type: 'string', description: 'Optional source conversation ID' }
      },
      required: ['echoId', 'content']
    }
  },

  // Cross-Object Global Search
  {
    name: 'search_luna',
    description: 'Perform a global keyword search across both Loops and Echoes. Use when the user asks a search query but does not specify if the item is a loop or a reflection.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term query' },
        types: { type: 'array', items: { type: 'string', enum: ['echo', 'loop'] }, default: ['echo', 'loop'], description: 'Filter by search types' },
        from: { type: 'string', description: 'ISO-8601 starting date' },
        to: { type: 'string', description: 'ISO-8601 ending date' },
        limit: { type: 'integer', default: 20 },
        cursor: { type: 'string' }
      },
      required: ['query']
    }
  },

  // Relational Memory (Attunement & Continuity)
  {
    name: 'search_relational_memories',
    description: 'Search or retrieve provisional Relational Memories (how Luna has learned to meet this user). Use to inspect what Luna holds regarding user language, interaction preferences, living distinctions, or orientations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword filter matching statements' },
        type: { type: 'string', enum: ['language', 'interaction_preference', 'living_distinction', 'orientation'], description: 'Filter by memory type' },
        lifecycleStatus: { type: 'string', enum: ['candidate', 'emerging', 'active', 'quiet', 'dormant', 'resurfaced', 'all'], default: 'all', description: 'Filter by lifecycle state' },
        provenance: { type: 'string', enum: ['explicit', 'observed', 'co_created'], description: 'Filter by origin provenance' },
        limit: { type: 'integer', default: 10, description: 'Number of results (max 50)' }
      }
    }
  },
  {
    name: 'propose_candidate_memory',
    description: 'Propose a candidate relational memory based on conversation observations or explicit user preferences. Inferred patterns start as candidate or emerging, requiring recurrence to promote.',
    inputSchema: {
      type: 'object',
      properties: {
        statement: { type: 'string', description: 'Provisional attunement statement (e.g. "Still Unfolding" currently functions as meaningful language for openness...)' },
        type: { type: 'string', enum: ['language', 'interaction_preference', 'living_distinction', 'orientation'], description: 'Memory category' },
        evidenceRecordIds: { type: 'array', items: { type: 'string' }, description: 'IDs of messages, echoes, loops, or conversations providing empirical evidence for this memory' },
        provenance: { type: 'string', enum: ['explicit', 'observed', 'co_created'], default: 'observed', description: 'Explicit (told directly), Observed (inferred across evidence), Co-created (conversationally developed)' },
        confidence: { type: 'number', default: 0.7, description: 'Confidence score (0.0 to 1.0)' }
      },
      required: ['statement', 'type', 'evidenceRecordIds']
    }
  },
  {
    name: 'reinforce_relational_memory',
    description: 'Reinforce an existing relational memory with new evidence, incrementing recurrence/strength and potentially promoting its lifecycle status (candidate -> emerging -> active, or quiet/dormant -> resurfaced).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the relational memory to reinforce' },
        newEvidenceRecordIds: { type: 'array', items: { type: 'string' }, description: 'New evidence IDs to append' },
        statementUpdate: { type: 'string', description: 'Optional refined statement reflecting recurring nuance' }
      },
      required: ['id']
    }
  },
  {
    name: 'update_relational_memory_status',
    description: 'Update the lifecycle status, user action status, or statement of a relational memory.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the relational memory' },
        lifecycleStatus: { type: 'string', enum: ['candidate', 'emerging', 'active', 'quiet', 'dormant', 'resurfaced', 'dismissed'], description: 'New lifecycle status' },
        userActionStatus: { type: 'string', enum: ['active', 'dismissed', 'pinned', 'corrected'], description: 'User action status' },
        statement: { type: 'string', description: 'Corrected or updated statement' }
      },
      required: ['id']
    }
  }
];

// Aliases for compatibility
export const TOOL_DEFINITIONS_COMPAT = [
  ...TOOL_DEFINITIONS,
  {
    name: 'create_entry',
    description: 'Synonym for create_echo.',
    inputSchema: TOOL_DEFINITIONS.find(t => t.name === 'create_echo')!.inputSchema
  },
  {
    name: 'get_entry',
    description: 'Synonym for get_echo.',
    inputSchema: TOOL_DEFINITIONS.find(t => t.name === 'get_echo')!.inputSchema
  },
  {
    name: 'search_entries',
    description: 'Synonym for search_echoes.',
    inputSchema: TOOL_DEFINITIONS.find(t => t.name === 'search_echoes')!.inputSchema
  }
];

// ─── Pagination Helpers ──────────────────────────────────────────────────────

function encodeCursor(timestamp: string): string {
  return Buffer.from(timestamp).toString('base64');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('ascii');
}

// ─── Schema Mappers ─────────────────────────────────────────────────────────

function mapEcho(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    text: row.text,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    phase: row.phase_name || row.phase,
    cycle: row.lunar_month,
    phaseEnergy: row.energy_state,
    illumination: row.illumination,
    zodiacSign: row.zodiac,
    loopIds: Array.isArray(row.loop_ids) ? row.loop_ids : (row.linked_loop_id ? [row.linked_loop_id] : []),
    status: row.deleted_at ? 'archived' : 'active',
    metadata: row.metadata || {},
    provenanceAuthor: row.provenance_author || 'user',
    provenanceKind: row.provenance_kind || 'original_echo',
    parentId: row.parent_id || null,
    audioPath: row.audio_path || null
  };
}

function normalizeSubtasks(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((st: any) => {
    const text = st.text || st.title || '';
    const done = st.done !== undefined ? st.done : (st.completed !== undefined ? st.completed : false);
    return {
      id: st.id || `st_${Math.random().toString(36).substr(2, 9)}`,
      text,
      done
    };
  });
}

function mapLoop(row: any, relatedEchoIds: string[] = []): any {
  if (!row) return null;
  let status = 'open';
  if (row.deleted_at) {
    status = 'archived';
  } else if (row.status === 'paused') {
    status = 'paused';
  } else if (row.status === 'completed' || row.status === 'closed' || row.status === 'released') {
    status = 'closed';
  }
  
  const rawSubtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
  const subtasks = rawSubtasks.map((st: any) => ({
    id: st.id || `st_${Math.random().toString(36).substr(2, 9)}`,
    text: st.text || st.title || '',
    done: st.done !== undefined ? st.done : (st.completed !== undefined ? st.completed : false),
    title: st.title || st.text || '',
    completed: st.completed !== undefined ? st.completed : (st.done !== undefined ? st.done : false)
  }));

  return {
    id: row.id,
    title: row.title,
    note: row.note || row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    status,
    subtasks,
    steps: subtasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    closedAt: row.closed_at || null,
    relatedEchoIds,
    metadata: row.metadata || {},
    provenanceAuthor: row.provenance_author || 'user',
    provenanceKind: row.provenance_kind || 'original_echo'
  };
}

function mapThread(row: any, echoIds: string[] = []): any {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    source: row.source,
    confidence: row.confidence || null,
    echoIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    metadata: row.metadata || {}
  };
}

function mapReflection(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    echoId: row.echo_id,
    content: row.content,
    authorType: row.author_type,
    conversationId: row.conversation_id || null,
    lunarContext: row.lunar_context || {},
    createdAt: row.created_at
  };
}

export function mapRelationalMemory(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    statement: row.statement,
    type: row.type,
    evidenceRecordIds: Array.isArray(row.evidence_record_ids) ? row.evidence_record_ids : [],
    confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : 0.7,
    strength: row.strength || 1,
    recurrenceCount: row.recurrence_count !== undefined && row.recurrence_count !== null ? row.recurrence_count : (row.strength || 1),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lifecycleStatus: row.lifecycle_status,
    provenance: row.provenance,
    userActionStatus: row.user_action_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Helper to generate unique IDs on server
function generateServerId(prefix = 'l') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
}

// ─── Tools Dispatcher ────────────────────────────────────────────────────────

export async function executeTool(supabase: SupabaseClient, name: string, args: any) {
  const lunar = getLunarData();

  // Retrieve authenticated userId
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    if (name !== 'get_current_lunar_context' && name !== 'get_current_cycle') {
      throw new Error(`Authentication required for database tool "${name}": ${authError?.message || 'Session invalid'}`);
    }
  }
  
  const userId = user?.id || '';

  // Standardize aliases
  const activeToolName = name === 'create_entry' ? 'create_echo' :
                         name === 'get_entry' ? 'get_echo' :
                         name === 'search_entries' ? 'search_echoes' : name;

  switch (activeToolName) {
    case 'get_ai_context': {
      const [loopsRes, echoesRes] = await Promise.all([
        supabase.from('loops').select('id, title, note, status, created_at').eq('user_id', userId).in('status', ['open', 'active', 'paused']).is('deleted_at', null).limit(10),
        supabase.from('echoes').select('id, text, phase_name, tags, created_at').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5)
      ]);

      const openLoops = loopsRes.data || [];
      const recentEchoes = echoesRes.data || [];
      const recentTags = new Set<string>();
      recentEchoes.forEach(e => {
        if (Array.isArray(e.tags)) {
          e.tags.forEach(t => recentTags.add(t));
        }
      });

      const context = {
        currentCycle: `${lunar.lunarMonth} Moon`,
        currentPhase: lunar.phase.name,
        phaseEnergy: lunar.phase.energy,
        illumination: `${lunar.illumination}%`,
        zodiacSign: lunar.zodiac.sign,
        hoursRemainingInPhase: lunar.remainingHours,
        openLoopsCount: openLoops.length,
        activeThemes: Array.from(recentTags).slice(0, 5),
        openLoopsPreview: openLoops.map(l => ({ id: l.id, title: l.title, status: l.status })),
        recentEchoesPreview: recentEchoes.map(e => ({
          id: e.id,
          phase: e.phase_name,
          tags: e.tags,
          text: e.text.substr(0, 100) + (e.text.length > 100 ? '...' : '')
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
    }

    case 'search_echoes': {
      const { query, phase, cycle, tags, loopId, from, to, status = 'active', sort = 'newest', limit = 20 } = args;
      let dbQuery = supabase.from('echoes').select('*').eq('user_id', userId);

      // Status filters
      if (status === 'active') {
        dbQuery = dbQuery.is('deleted_at', null);
      } else if (status === 'archived') {
        dbQuery = dbQuery.not('deleted_at', 'is', null);
      }

      // Composable filters
      if (phase) {
        dbQuery = dbQuery.or(`phase.eq."${phase}",phase_name.eq."${phase}"`);
      }
      if (cycle) {
        dbQuery = dbQuery.eq('lunar_month', cycle);
      }
      if (tags && Array.isArray(tags) && tags.length > 0) {
        dbQuery = dbQuery.contains('tags', tags);
      }
      if (loopId) {
        dbQuery = dbQuery.or(`linked_loop_id.eq."${loopId}",loop_ids.contains.["${loopId}"]`);
      }
      if (from) {
        dbQuery = dbQuery.gte('created_at', from);
      }
      if (to) {
        dbQuery = dbQuery.lte('created_at', to);
      }
      if (query) {
        dbQuery = dbQuery.ilike('text', `%${query}%`);
      }

      // Pagination Cursor
      if (args.cursor) {
        const cursorTimestamp = decodeCursor(args.cursor);
        if (sort === 'newest') {
          dbQuery = dbQuery.lt('created_at', cursorTimestamp);
        } else {
          dbQuery = dbQuery.gt('created_at', cursorTimestamp);
        }
      }

      // Sort & Limit
      const isAscending = sort === 'oldest';
      dbQuery = dbQuery.order('created_at', { ascending: isAscending }).limit(limit + 1);

      const { data, error } = await dbQuery;
      if (error) throw error;

      const results = data || [];
      const hasMore = results.length > limit;
      const paginatedData = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? encodeCursor(paginatedData[paginatedData.length - 1].created_at) : null;
      const coverage = hasMore ? 'partial' : 'complete';

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            items: paginatedData.map(mapEcho),
            recordsRetrieved: paginatedData.length,
            limit,
            hasMore,
            coverage,
            nextCursor
          }, null, 2)
        }]
      };
    }

    case 'get_echo': {
      const { data, error } = await supabase
        .from('echoes')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();

      if (error || !data) throw new Error(error?.message || `Echo not found: ${args.id}`);

      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(data), null, 2) }] };
    }

    case 'create_echo': {
      const id = generateServerId('e');
      const loopIds = args.loopIds || [];
      const insertData = {
        id,
        user_id: userId,
        text: args.text,
        source: args.source || 'direct_entry',
        tags: args.tags || [],
        linked_loop_id: loopIds[0] || null,
        loop_ids: loopIds,
        energy_state: args.energyState || null,
        metadata: args.metadata || {},
        
        // Auto lunar tracking
        phase: lunar.phase.key,
        phase_name: lunar.phase.name,
        phase_type: (lunar.phase.key === 'new' || lunar.phase.key === 'first-quarter' || lunar.phase.key === 'full' || lunar.phase.key === 'last-quarter') ? 'threshold' : 'flow',
        lunar_month: lunar.lunarMonth,
        day_of_cycle: lunar.dayOfCycle,
        zodiac: lunar.zodiac.sign,
        illumination: lunar.illumination,
        is_encrypted: false,
        created_at: new Date().toISOString(),

        // Strictly enforced provenance: direct user observation
        provenance_author: 'user',
        provenance_kind: 'original_echo',
        parent_id: args.parentId || null
      };

      let result = await supabase.from('echoes').insert(insertData).select();
      let error = result.error;
      let createdRow = result.data?.[0];
      
      // Undefined column schema fallback check
      if (error && error.code === '42703') {
        console.warn('Metadata columns missing, retrying with core columns only.');
        const baseInsertData = {
          id: insertData.id,
          user_id: insertData.user_id,
          text: insertData.text,
          source: insertData.source,
          phase: insertData.phase,
          phase_name: insertData.phase_name,
          phase_type: insertData.phase_type,
          lunar_month: insertData.lunar_month,
          day_of_cycle: insertData.day_of_cycle,
          zodiac: insertData.zodiac,
          illumination: insertData.illumination,
          tags: insertData.tags,
          linked_loop_id: insertData.linked_loop_id,
          is_encrypted: insertData.is_encrypted,
          created_at: insertData.created_at
        };
        const retryResult = await supabase.from('echoes').insert(baseInsertData).select();
        error = retryResult.error;
        createdRow = retryResult.data?.[0];
      }
      
      if (error) throw error;
      if (!createdRow) {
        throw new Error(`Failed to confirm creation of Echo with ID "${id}"`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(createdRow), null, 2) }] };
    }

    case 'create_conversation_reflection': {
      const id = generateServerId('e');
      const loopIds = args.loopIds || [];
      const insertData = {
        id,
        user_id: userId,
        text: args.text,
        source: 'luna_conversation',
        tags: args.tags || ['conversation-reflection'],
        linked_loop_id: loopIds[0] || null,
        loop_ids: loopIds,
        energy_state: args.energyState || null,
        metadata: {
          ...(args.metadata || {}),
          sessionId: args.sessionId || null,
          conversationTitle: args.conversationTitle || null,
          coCreatedWith: 'Luna'
        },
        
        // Auto lunar tracking
        phase: lunar.phase.key,
        phase_name: lunar.phase.name,
        phase_type: (lunar.phase.key === 'new' || lunar.phase.key === 'first-quarter' || lunar.phase.key === 'full' || lunar.phase.key === 'last-quarter') ? 'threshold' : 'flow',
        lunar_month: lunar.lunarMonth,
        day_of_cycle: lunar.dayOfCycle,
        zodiac: lunar.zodiac.sign,
        illumination: lunar.illumination,
        is_encrypted: false,
        created_at: new Date().toISOString(),

        // Strictly enforced provenance: conversation-derived / co-created reflection
        provenance_author: 'co-created',
        provenance_kind: 'conversation_reflection',
        parent_id: null
      };

      let result = await supabase.from('echoes').insert(insertData).select();
      let error = result.error;
      let createdRow = result.data?.[0];
      
      if (error) throw error;
      if (!createdRow) {
        throw new Error(`Failed to confirm creation of Conversation Reflection with ID "${id}"`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(createdRow), null, 2) }] };
    }

    case 'update_echo': {
      // Fetch current record first to check immutability constraints
      const { data: currentEcho, error: fetchErr } = await supabase
        .from('echoes')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!currentEcho) {
        throw new Error(`Update failed: Echo with ID "${args.id}" not found or unauthorized.`);
      }

      // Enforce immutability for user personal echoes
      const isPersonalEcho = currentEcho.provenance_author === 'user' && currentEcho.provenance_kind === 'original_echo';
      if (isPersonalEcho) {
        if (args.text !== undefined && args.text !== currentEcho.text) {
          throw new Error('Personal Echo text content is immutable and cannot be updated.');
        }
        if (args.audioPath !== undefined && currentEcho.audio_path && args.audioPath !== currentEcho.audio_path) {
          throw new Error('Personal Echo audio reference is immutable and cannot be updated.');
        }
        if (args.provenanceAuthor !== undefined && args.provenanceAuthor !== currentEcho.provenance_author) {
          throw new Error('Personal Echo authorship/provenance is immutable and cannot be updated.');
        }
        if (args.provenanceKind !== undefined && args.provenanceKind !== currentEcho.provenance_kind) {
          throw new Error('Personal Echo authorship/provenance is immutable and cannot be updated.');
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (args.text !== undefined) updateData.text = args.text;
      if (args.tags !== undefined) updateData.tags = args.tags;
      if (args.loopIds !== undefined) {
        updateData.loop_ids = args.loopIds;
        updateData.linked_loop_id = args.loopIds[0] || null;
      }
      if (args.status !== undefined) {
        updateData.deleted_at = args.status === 'archived' ? new Date().toISOString() : null;
      }
      if (args.provenanceAuthor !== undefined) updateData.provenance_author = args.provenanceAuthor;
      if (args.provenanceKind !== undefined) updateData.provenance_kind = args.provenanceKind;
      if (args.parentId !== undefined) updateData.parent_id = args.parentId;

      let result = await supabase
        .from('echoes')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      let error = result.error;
      let data = result.data;

      // Fallback in case columns do not exist in their DB
      if (error && error.code === '42703') {
        const cleanUpdateData = { ...updateData };
        delete cleanUpdateData.loop_ids;
        delete cleanUpdateData.provenance_author;
        delete cleanUpdateData.provenance_kind;
        delete cleanUpdateData.parent_id;

        const retryResult = await supabase
          .from('echoes')
          .update(cleanUpdateData)
          .eq('id', args.id)
          .eq('user_id', userId)
          .select();
        error = retryResult.error;
        data = retryResult.data;
      }

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Update failed: Echo with ID "${args.id}" not found or unauthorized.`);
      }

      const updatedRow = data[0];
      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(updatedRow), null, 2) }] };
    }

    case 'archive_echo': {
      const { data, error } = await supabase
        .from('echoes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Archive failed: Echo with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(data[0]), null, 2) }] };
    }

    case 'restore_echo': {
      const { data, error } = await supabase
        .from('echoes')
        .update({ deleted_at: null })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Restore failed: Echo with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapEcho(data[0]), null, 2) }] };
    }

    case 'list_loops': {
      const { status = 'open', query, tags, sort = 'newest', limit = 20 } = args;
      let dbQuery = supabase.from('loops').select('*').eq('user_id', userId);

      // Status filters mapping
      if (status === 'open') {
        dbQuery = dbQuery.in('status', ['open', 'active']).is('deleted_at', null);
      } else if (status === 'paused') {
        dbQuery = dbQuery.eq('status', 'paused').is('deleted_at', null);
      } else if (status === 'closed') {
        dbQuery = dbQuery.in('status', ['closed', 'completed', 'released']).is('deleted_at', null);
      } else if (status === 'archived') {
        dbQuery = dbQuery.not('deleted_at', 'is', null);
      }

      // Composable filters
      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,note.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (tags && Array.isArray(tags) && tags.length > 0) {
        dbQuery = dbQuery.contains('tags', tags);
      }

      // Pagination Cursor
      if (args.cursor) {
        const cursorTimestamp = decodeCursor(args.cursor);
        if (sort === 'newest') {
          dbQuery = dbQuery.lt('created_at', cursorTimestamp);
        } else if (sort === 'oldest') {
          dbQuery = dbQuery.gt('created_at', cursorTimestamp);
        } else {
          dbQuery = dbQuery.lt('updated_at', cursorTimestamp);
        }
      }

      // Sorting
      if (sort === 'oldest') {
        dbQuery = dbQuery.order('created_at', { ascending: true });
      } else if (sort === 'recently_updated') {
        dbQuery = dbQuery.order('updated_at', { ascending: false });
      } else {
        dbQuery = dbQuery.order('created_at', { ascending: false });
      }

      dbQuery = dbQuery.limit(limit + 1);

      const { data, error } = await dbQuery;
      if (error) throw error;

      const results = data || [];
      const hasMore = results.length > limit;
      const paginatedData = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? encodeCursor(sort === 'recently_updated' ? paginatedData[paginatedData.length - 1].updated_at : paginatedData[paginatedData.length - 1].created_at) : null;

      // Resolve relationships (Echo IDs) for all returned loops in bulk
      const loopIds = paginatedData.map(l => l.id);
      const { data: matches } = await supabase
        .from('echoes')
        .select('id, linked_loop_id, loop_ids')
        .eq('user_id', userId)
        .is('deleted_at', null);

      const echoMatches = matches || [];
      const items = paginatedData.map(row => {
        const related = echoMatches
          .filter(e => e.linked_loop_id === row.id || (Array.isArray(e.loop_ids) && e.loop_ids.includes(row.id)))
          .map(e => e.id);
        return mapLoop(row, related);
      });

      const coverage = hasMore ? 'partial' : 'complete';

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            items,
            recordsRetrieved: paginatedData.length,
            limit,
            hasMore,
            coverage,
            nextCursor
          }, null, 2)
        }]
      };
    }

    case 'list_open_loops': {
      const { data, error } = await supabase
        .from('loops')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['open', 'active'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify((data || []).map(row => mapLoop(row)), null, 2) }] };
    }

    case 'get_loop': {
      const { data, error } = await supabase
        .from('loops')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();

      if (error || !data) throw new Error(error?.message || `Loop not found: ${args.id}`);

      // Query associated echo IDs
      const { data: echoes } = await supabase
        .from('echoes')
        .select('id, linked_loop_id, loop_ids')
        .eq('user_id', userId)
        .is('deleted_at', null);

      const relatedEchoIds = (echoes || [])
        .filter(e => e.linked_loop_id === args.id || (Array.isArray(e.loop_ids) && e.loop_ids.includes(args.id)))
        .map(e => e.id);

      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(data, relatedEchoIds), null, 2) }] };
    }

    case 'create_loop': {
      const id = generateServerId('l');
      const insertData = {
        id,
        user_id: userId,
        title: args.title,
        note: args.note || null,
        description: args.note || null,
        type: args.type || 'phase',
        status: 'active',
        tags: args.tags || [],
        subtasks: normalizeSubtasks(args.subtasks || args.steps || []),
        energy_state: args.energyState || null,
        attention_level: args.attentionLevel || null,
        aliveness_score: args.alivenessScore || null,
        parent_loop_id: args.parentLoopId || null,
        metadata: args.metadata || {},
        
        // Auto lunar tracking
        phase_opened: lunar.phase.key,
        phase_name: lunar.phase.name,
        lunar_month_opened: lunar.lunarMonth,
        moon_age_opened: lunar.age,
        zodiac_opened: lunar.zodiac.sign,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),

        // Provenance tracking
        provenance_author: args.provenanceAuthor || 'user',
        provenance_kind: args.provenanceKind || 'original_echo'
      };

      let result = await supabase.from('loops').insert(insertData).select();
      let error = result.error;
      let createdRow = result.data?.[0];
      
      if (error && error.code === '42703') {
        console.warn('Metadata columns missing, retrying with core columns only.');
        const baseInsertData = {
          id: insertData.id,
          user_id: insertData.user_id,
          title: insertData.title,
          note: insertData.note,
          type: insertData.type,
          status: 'active',
          subtasks: insertData.subtasks,
          phase_opened: insertData.phase_opened,
          phase_name: insertData.phase_name,
          lunar_month_opened: insertData.lunar_month_opened,
          moon_age_opened: insertData.moon_age_opened,
          zodiac_opened: insertData.zodiac_opened,
          opened_at: insertData.opened_at,
          created_at: insertData.created_at
        };
        const retryResult = await supabase.from('loops').insert(baseInsertData).select();
        error = retryResult.error;
        createdRow = retryResult.data?.[0];
      }
 
      if (error) throw error;
      if (!createdRow) {
        throw new Error(`Failed to confirm creation of Loop with ID "${id}"`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(createdRow), null, 2) }] };
    }

    case 'update_loop': {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (args.title !== undefined) updateData.title = args.title;
      if (args.note !== undefined) {
        updateData.note = args.note;
        updateData.description = args.note;
      }
      if (args.tags !== undefined) updateData.tags = args.tags;
      if (args.subtasks !== undefined) {
        updateData.subtasks = normalizeSubtasks(args.subtasks);
      } else if (args.steps !== undefined) {
        updateData.subtasks = normalizeSubtasks(args.steps);
      }
      if (args.status !== undefined) {
        if (args.status === 'archived') {
          updateData.deleted_at = new Date().toISOString();
        } else {
          updateData.deleted_at = null;
          updateData.status = args.status === 'open' ? 'active' : args.status;
          if (args.status === 'closed') {
            updateData.closed_at = new Date().toISOString();
            updateData.phase_closed = lunar.phase.key;
            updateData.phase_name_closed = lunar.phase.name;
            updateData.lunar_month_closed = lunar.lunarMonth;
          }
        }
      }
      if (args.provenanceAuthor !== undefined) updateData.provenance_author = args.provenanceAuthor;
      if (args.provenanceKind !== undefined) updateData.provenance_kind = args.provenanceKind;

      let result = await supabase
        .from('loops')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      let error = result.error;
      let data = result.data;

      // Fallback in case columns do not exist in their DB
      if (error && error.code === '42703') {
        const cleanUpdateData = { ...updateData };
        delete cleanUpdateData.provenance_author;
        delete cleanUpdateData.provenance_kind;

        const retryResult = await supabase
          .from('loops')
          .update(cleanUpdateData)
          .eq('id', args.id)
          .eq('user_id', userId)
          .select();
        error = retryResult.error;
        data = retryResult.data;
      }

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Update failed: Loop with ID "${args.id}" not found or unauthorized.`);
      }

      const updatedRow = data[0];
      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(updatedRow), null, 2) }] };
    }

    case 'close_loop': {
      const { data, error } = await supabase
        .from('loops')
        .update({
          status: 'completed', // maps to closed status state in loop
          closed_at: new Date().toISOString(),
          phase_closed: lunar.phase.key,
          phase_name_closed: lunar.phase.name,
          lunar_month_closed: lunar.lunarMonth,
          updated_at: new Date().toISOString(),
          note: args.note || undefined
        })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Close failed: Loop with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(data[0]), null, 2) }] };
    }

    case 'reopen_loop': {
      const { data, error } = await supabase
        .from('loops')
        .update({
          status: 'active',
          closed_at: null,
          phase_closed: null,
          phase_name_closed: null,
          lunar_month_closed: null,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Reopen failed: Loop with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(data[0]), null, 2) }] };
    }

    case 'archive_loop': {
      const { data, error } = await supabase
        .from('loops')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Archive failed: Loop with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(data[0]), null, 2) }] };
    }

    case 'restore_loop': {
      const { data, error } = await supabase
        .from('loops')
        .update({ deleted_at: null })
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Restore failed: Loop with ID "${args.id}" not found or unauthorized.`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(data[0]), null, 2) }] };
    }

    case 'carry_loop_forward': {
      // 1. Fetch old loop details
      const { data: oldLoop, error: fetchErr } = await supabase
        .from('loops')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !oldLoop) throw new Error(`Loop not found: ${args.id}`);

      // 2. Mark old loop as carried_forward
      const { error: updateErr } = await supabase
        .from('loops')
        .update({
          status: 'carried_forward',
          closed_at: new Date().toISOString(),
          phase_closed: lunar.phase.key,
          phase_name_closed: lunar.phase.name,
          lunar_month_closed: lunar.lunarMonth,
          updated_at: new Date().toISOString()
        })
        .eq('id', args.id)
        .eq('user_id', userId);

      if (updateErr) throw updateErr;

      // 3. Create new Loop linked to the old one
      const newId = generateServerId('l');
      const insertData = {
        id: newId,
        user_id: userId,
        title: oldLoop.title,
        note: args.new_note || oldLoop.note,
        description: args.new_note || oldLoop.note,
        type: oldLoop.type,
        status: 'active',
        source: 'chatgpt',
        parent_loop_id: oldLoop.id,
        metadata: {
          carried_from_id: oldLoop.id,
          carried_at: new Date().toISOString()
        },
        
        // Stamped with current lunar context
        phase_opened: lunar.phase.key,
        phase_name: lunar.phase.name,
        lunar_month_opened: lunar.lunarMonth,
        moon_age_opened: lunar.age,
        zodiac_opened: lunar.zodiac.sign,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      let { error: insertErr } = await supabase.from('loops').insert(insertData);
      
      if (insertErr && insertErr.code === '42703') {
        console.warn('Metadata columns missing in loops table, retrying with core columns only.');
        const baseInsertData = {
          id: insertData.id,
          user_id: insertData.user_id,
          title: insertData.title,
          note: insertData.note,
          type: insertData.type,
          status: 'active',
          phase_opened: insertData.phase_opened,
          phase_name: insertData.phase_name,
          lunar_month_opened: insertData.lunar_month_opened,
          moon_age_opened: insertData.moon_age_opened,
          zodiac_opened: insertData.zodiac_opened,
          opened_at: insertData.opened_at,
          created_at: insertData.created_at
        };
        const retryResult = await supabase.from('loops').insert(baseInsertData);
        insertErr = retryResult.error;
      }

      if (insertErr) throw insertErr;

      // Query and return the new loop object
      const { data: newRow } = await supabase.from('loops').select('*').eq('id', newId).eq('user_id', userId).single();
      return { content: [{ type: 'text', text: JSON.stringify(mapLoop(newRow), null, 2) }] };
    }

    case 'search_luna': {
      const { query, types = ['echo', 'loop'], from, to, limit = 20 } = args;
      
      const searchTasks: Promise<any>[] = [];
      if (types.includes('echo')) {
        let echoQuery = supabase.from('echoes').select('id, text, created_at').eq('user_id', userId).is('deleted_at', null).ilike('text', `%${query}%`);
        if (from) echoQuery = echoQuery.gte('created_at', from);
        if (to) echoQuery = echoQuery.lte('created_at', to);
        searchTasks.push(echoQuery as any);
      } else {
        searchTasks.push(Promise.resolve({ data: [] }));
      }

      if (types.includes('loop')) {
        let loopQuery = supabase.from('loops').select('id, title, note, description, created_at').eq('user_id', userId).is('deleted_at', null).or(`title.ilike.%${query}%,note.ilike.%${query}%,description.ilike.%${query}%`);
        if (from) loopQuery = loopQuery.gte('created_at', from);
        if (to) loopQuery = loopQuery.lte('created_at', to);
        searchTasks.push(loopQuery as any);
      } else {
        searchTasks.push(Promise.resolve({ data: [] }));
      }

      const [echoesRes, loopsRes] = await Promise.all(searchTasks);
      
      const combined: any[] = [];
      (echoesRes.data || []).forEach((row: any) => {
        combined.push({
          type: 'echo',
          id: row.id,
          text: row.text,
          createdAt: row.created_at
        });
      });
      (loopsRes.data || []).forEach((row: any) => {
        combined.push({
          type: 'loop',
          id: row.id,
          title: row.title,
          note: row.note || row.description || '',
          createdAt: row.created_at
        });
      });

      // Sort combined newest first
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Paginate
      let paginated = combined;
      if (args.cursor) {
        const decodedTime = decodeCursor(args.cursor);
        paginated = combined.filter(item => new Date(item.createdAt).getTime() < new Date(decodedTime).getTime());
      }
      
      const hasMore = paginated.length > limit;
      const pageData = hasMore ? paginated.slice(0, limit) : paginated;
      const nextCursor = hasMore ? encodeCursor(pageData[pageData.length - 1].createdAt) : null;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            items: pageData,
            nextCursor
          }, null, 2)
        }]
      };
    }

    case 'create_thread': {
      const id = generateServerId('t');
      const insertData = {
        id,
        user_id: userId,
        title: args.title,
        description: args.description || null,
        status: 'active',
        source: args.source || 'user_created',
        confidence: args.confidence || null,
        metadata: args.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('threads').insert(insertData);
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(mapThread(insertData), null, 2) }] };
    }

    case 'list_threads': {
      const { status = 'active', query, source, limit = 20 } = args;
      let dbQuery = supabase.from('threads').select('*').eq('user_id', userId);
      
      if (status === 'active') {
        dbQuery = dbQuery.eq('status', 'active');
      } else if (status === 'archived') {
        dbQuery = dbQuery.eq('status', 'archived');
      }
      
      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (source) {
        dbQuery = dbQuery.eq('source', source);
      }
      
      if (args.cursor) {
        const cursorTimestamp = decodeCursor(args.cursor);
        dbQuery = dbQuery.lt('created_at', cursorTimestamp);
      }
      
      dbQuery = dbQuery.order('created_at', { ascending: false }).limit(limit + 1);
      const { data, error } = await dbQuery;
      if (error) throw error;
      
      const results = data || [];
      const hasMore = results.length > limit;
      const paginatedData = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? encodeCursor(paginatedData[paginatedData.length - 1].created_at) : null;
      
      // bulk fetch echo IDs for the threads to populate their lists
      const threadIds = paginatedData.map(t => t.id);
      let echoIdsMap: Record<string, string[]> = {};
      if (threadIds.length > 0) {
        const { data: links } = await supabase
          .from('echo_threads')
          .select('echo_id, thread_id')
          .in('thread_id', threadIds);
        
        (links || []).forEach(link => {
          if (!echoIdsMap[link.thread_id]) {
            echoIdsMap[link.thread_id] = [];
          }
          echoIdsMap[link.thread_id].push(link.echo_id);
        });
      }
      
      const items = paginatedData.map(row => mapThread(row, echoIdsMap[row.id] || []));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ items, nextCursor }, null, 2)
        }]
      };
    }

    case 'get_thread': {
      const { data: thread, error } = await supabase
        .from('threads')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();
      if (error || !thread) throw new Error(error?.message || `Thread not found: ${args.id}`);
      
      const { data: links } = await supabase
        .from('echo_threads')
        .select('echo_id')
        .eq('thread_id', args.id);
      
      const echoIds = (links || []).map(l => l.echo_id);
      return { content: [{ type: 'text', text: JSON.stringify(mapThread(thread, echoIds), null, 2) }] };
    }

    case 'update_thread': {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (args.title !== undefined) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.status !== undefined) updateData.status = args.status;
      
      const { data, error } = await supabase
        .from('threads')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Update failed: Thread with ID "${args.id}" not found or unauthorized.`);
      }
      
      return { content: [{ type: 'text', text: JSON.stringify(mapThread(data[0]), null, 2) }] };
    }

    case 'connect_echo_to_thread': {
      const { echoId, threadId, createdBy = 'user', relationshipType, note } = args;
      const insertData = {
        echo_id: echoId,
        thread_id: threadId,
        created_by: createdBy,
        relationship_type: relationshipType || null,
        note: note || null,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('echo_threads').insert(insertData);
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, echoId, threadId }, null, 2) }] };
    }

    case 'disconnect_echo_from_thread': {
      const { echoId, threadId } = args;
      const { error } = await supabase
        .from('echo_threads')
        .delete()
        .eq('echo_id', echoId)
        .eq('thread_id', threadId);
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, echoId, threadId }, null, 2) }] };
    }

    case 'get_echo_reflections': {
      const { data, error } = await supabase
        .from('echo_reflections')
        .select('*')
        .eq('echo_id', args.echoId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify((data || []).map(mapReflection), null, 2) }] };
    }

    case 'attach_reflection': {
      const id = generateServerId('r');
      const insertData = {
        id,
        echo_id: args.echoId,
        user_id: userId,
        content: args.content,
        author_type: args.authorType || 'user',
        conversation_id: args.conversationId || null,
        lunar_context: {
          cycle: lunar.lunarMonth,
          phase: lunar.phase.name,
          illumination: lunar.illumination,
          zodiac: lunar.zodiac.sign
        },
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('echo_reflections').insert(insertData);
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(mapReflection(insertData), null, 2) }] };
    }

    // ─── Relational Memory (Attunement & Continuity) ───────────────────────────

    case 'search_relational_memories': {
      let builder = supabase
        .from('relational_memories')
        .select('*')
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(Math.min(args.limit || 10, 50));

      if (args.lifecycleStatus && args.lifecycleStatus !== 'all') {
        builder = builder.eq('lifecycle_status', args.lifecycleStatus);
      }
      if (args.type) {
        builder = builder.eq('type', args.type);
      }
      if (args.provenance) {
        builder = builder.eq('provenance', args.provenance);
      }
      if (args.query) {
        builder = builder.ilike('statement', `%${args.query}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify((data || []).map(mapRelationalMemory), null, 2) }] };
    }

    case 'propose_candidate_memory': {
      const id = generateServerId('rm');
      const provenance = args.provenance || 'observed';
      // Immediate activation is reserved for explicit statements that establish a durable interaction preference, boundary, or orientation
      const isDurableExplicit = provenance === 'explicit' && (args.type === 'interaction_preference' || args.type === 'orientation');
      const lifecycle_status = isDurableExplicit ? 'active' : 'candidate';
      const confidence = typeof args.confidence === 'number' ? args.confidence : (provenance === 'explicit' ? 0.95 : 0.70);
      const evidence = Array.isArray(args.evidenceRecordIds) ? args.evidenceRecordIds : [];

      const insertData = {
        id,
        user_id: userId,
        statement: args.statement,
        type: args.type,
        evidence_record_ids: evidence,
        confidence,
        strength: 1,
        recurrence_count: 1,
        lifecycle_status,
        provenance,
        user_action_status: 'active',
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('relational_memories').insert(insertData).select();
      if (error) throw error;
      const createdRow = data?.[0] || insertData;
      return { content: [{ type: 'text', text: JSON.stringify(mapRelationalMemory(createdRow), null, 2) }] };
    }

    case 'reinforce_relational_memory': {
      const { data: existing, error: fetchErr } = await supabase
        .from('relational_memories')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !existing) {
        throw new Error(`Relational memory with ID "${args.id}" not found.`);
      }

      const newRecurrence = (existing.recurrence_count !== undefined && existing.recurrence_count !== null ? existing.recurrence_count : (existing.strength || 1)) + 1;
      const newStrength = (existing.strength || 1) + 1;
      let newLifecycleStatus = existing.lifecycle_status;

      // Lifecycle progression: quiet/dormant -> resurfaced; candidate (2) -> emerging; emerging (3+) -> active
      if (existing.lifecycle_status === 'quiet' || existing.lifecycle_status === 'dormant') {
        newLifecycleStatus = 'resurfaced';
      } else if (existing.lifecycle_status === 'candidate' && newRecurrence >= 2) {
        newLifecycleStatus = 'emerging';
      } else if (existing.lifecycle_status === 'emerging' && newRecurrence >= 3) {
        newLifecycleStatus = 'active';
      }

      const existingEvidence = Array.isArray(existing.evidence_record_ids) ? existing.evidence_record_ids : [];
      const newEvidence = Array.isArray(args.newEvidenceRecordIds) ? args.newEvidenceRecordIds : [];
      const mergedEvidence = Array.from(new Set([...existingEvidence, ...newEvidence]));

      const updateData: any = {
        strength: newStrength,
        recurrence_count: newRecurrence,
        lifecycle_status: newLifecycleStatus,
        evidence_record_ids: mergedEvidence,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (args.statementUpdate) {
        updateData.statement = args.statementUpdate;
      }

      const { data, error } = await supabase
        .from('relational_memories')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Failed to update relational memory "${args.id}".`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapRelationalMemory(data[0]), null, 2) }] };
    }

    case 'update_relational_memory_status': {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      if (args.lifecycleStatus) updateData.lifecycle_status = args.lifecycleStatus;
      if (args.userActionStatus) updateData.user_action_status = args.userActionStatus;
      if (args.statement) updateData.statement = args.statement;

      const { data, error } = await supabase
        .from('relational_memories')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`Failed to update relational memory "${args.id}".`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(mapRelationalMemory(data[0]), null, 2) }] };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}
