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
 * Declares all V1 MCP tools with precise schemas and descriptions.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_current_lunar_context',
    description: 'Retrieve current detailed lunar cycle and phase context (illumination, zodiac, phase energy, cycle day, hours remaining).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_current_cycle',
    description: 'Retrieve the current lunar month name and when this cycle started.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_phase_summary',
    description: 'Dynamically compile stats and items opened/closed/released for a specific moon phase.',
    inputSchema: {
      type: 'object',
      properties: {
        phaseKey: { type: 'string', description: "Lunar phase key (e.g. 'new', 'waxing-crescent', 'full'). Defaults to current phase." },
        lunarMonth: { type: 'string', description: "Lunar month name (e.g. 'Wolf', 'Snow'). Defaults to current cycle." }
      }
    }
  },
  {
    name: 'list_open_loops',
    description: 'Retrieve all loops that are currently open/active in the user\'s awareness.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Limit number of loops returned. Default is 20.' },
        offset: { type: 'integer', description: 'Offset for pagination.' }
      }
    }
  },
  {
    name: 'get_loop',
    description: 'Retrieve detailed information about a specific Loop by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique loop ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'search_loops',
    description: 'Search loops across all cycles by title or note contents. Designed for semantic migration.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search for in title or note' }
      },
      required: ['query']
    }
  },
  {
    name: 'create_loop',
    description: 'Create a new Loop (an item consciously retained in awareness). Automatically stamps lunar context.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The intention or focus title' },
        note: { type: 'string', description: 'Optional descriptive notes or details' },
        type: { type: 'string', description: "Type of loop ('phase' or 'cycle'). Default is 'phase'." },
        linked_to: { type: 'string', description: 'Optional ID of another loop this is linked to' },
        energy_state: { type: 'string', description: 'Current user energy state (e.g. high, resting, focused)' },
        attention_level: { type: 'string', description: 'Amount of awareness required (e.g. active, background)' },
        aliveness_score: { type: 'integer', description: 'Self-rated score of aliveness/vitality associated (1-10)' },
        parent_loop_id: { type: 'string', description: 'Optional parent Loop ID' },
        metadata: { type: 'object', description: 'Optional custom metadata object' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_loop',
    description: 'Update properties, description, metadata or status of an existing loop.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Loop ID to update' },
        title: { type: 'string', description: 'Updated title' },
        note: { type: 'string', description: 'Updated notes' },
        status: { type: 'string', description: "New lifecycle state ('open', 'completed', 'released', 'carried_forward', 'transformed')" },
        metadata: { type: 'object', description: 'Optional key-value overrides for metadata' }
      },
      required: ['id']
    }
  },
  {
    name: 'complete_loop',
    description: 'Mark a Loop as completed (consciously resolved).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Loop ID to complete' }
      },
      required: ['id']
    }
  },
  {
    name: 'release_loop',
    description: 'Mark a Loop as released (deliberately letting go of awareness/intention).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Loop ID to release' }
      },
      required: ['id']
    }
  },
  {
    name: 'carry_loop_forward',
    description: 'Carries a Loop forward into the current phase/cycle, transitioning the old loop and creating a new linked one.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of loop to carry forward' },
        new_note: { type: 'string', description: 'Optional updated details/note for the new loop instance' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_echo',
    description: 'Create a new Echo (reflection note). Stamped with lunar data.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Decrypted plaintext content of the reflection' },
        source: { type: 'string', description: "Source client ('chatgpt', 'claude', 'voice', 'app'). Default 'text'." },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional emotional signature tags' },
        linked_loop_id: { type: 'string', description: 'Optional loop ID this reflection directly links to' },
        energy_state: { type: 'string', description: 'Current energy signature' },
        metadata: { type: 'object', description: 'Optional client metadata' }
      },
      required: ['text']
    }
  },
  {
    name: 'get_echo',
    description: 'Retrieve detailed information about a specific Echo by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Echo ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'search_echoes',
    description: 'Search through historical reflections (echoes) using keyword filters. Designed for semantic migration.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query text' },
        tag: { type: 'string', description: 'Filter by specific emotional tag' },
        lunar_month: { type: 'string', description: 'Filter by specific cycle (e.g. Wolf Moon)' }
      },
      required: ['query']
    }
  },
  {
    name: 'create_entry',
    description: 'Create a new journal entry (synonym for create_echo). Stamped with lunar data.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Plaintext journal entry text' },
        source: { type: 'string', description: "Source client ('chatgpt', 'claude', 'app')" },
        tags: { type: 'array', items: { type: 'string' } },
        linked_loop_id: { type: 'string', description: 'Optional linked loop ID' },
        metadata: { type: 'object', description: 'Client metadata' }
      },
      required: ['text']
    }
  },
  {
    name: 'get_entry',
    description: 'Retrieve detailed journal entry by ID (synonym for get_echo).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Journal Entry/Echo ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'search_entries',
    description: 'Search journal entries (synonym for search_echoes) using keyword filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query text' },
        tag: { type: 'string', description: 'Tag' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_cycle_entries',
    description: 'Get all reflections/entries recorded during a specific lunar month cycle.',
    inputSchema: {
      type: 'object',
      properties: {
        lunarMonth: { type: 'string', description: "Name of lunar month (e.g. 'Wolf Moon'). Defaults to current cycle." }
      }
    }
  },
  {
    name: 'get_cycle_summary',
    description: 'Dynamically compile statistics and activity summaries for an entire completed cycle.',
    inputSchema: {
      type: 'object',
      properties: {
        lunarMonth: { type: 'string', description: "Name of lunar month. Defaults to current cycle." }
      }
    }
  },
  {
    name: 'search_cycles',
    description: 'Search historical cycles (lunar months) matching name keywords.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Cycle name query' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_ai_context',
    description: 'LIGHTWEIGHT CONTEXT: Returns current lunar status, active themes/tags, open loops, and recent reflections without reading entire historical journal.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// ─── Underlying Search Layer (Embeddings Readiness) ─────────────────────────

async function searchEchoesInDb(supabase: SupabaseClient, userId: string, query: string, tag?: string, lunarMonth?: string) {
  // NOTE: This interface is isolated so that developers can easily hook in
  // semantic vector search (e.g. pgvector) in the future.
  let dbQuery = supabase.from('echoes').select('*').eq('user_id', userId).is('deleted_at', null);

  if (tag) {
    dbQuery = dbQuery.contains('tags', [tag]);
  }
  if (lunarMonth) {
    dbQuery = dbQuery.eq('lunar_month', lunarMonth);
  }
  
  dbQuery = dbQuery.ilike('text', `%${query}%`);
  
  const { data, error } = await dbQuery.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function searchLoopsInDb(supabase: SupabaseClient, userId: string, query: string) {
  const { data, error } = await supabase
    .from('loops')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .or(`title.ilike.%${query}%,note.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Helper to generate unique IDs on server
function generateServerId(prefix = 'l') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
}

// ─── Tools Dispatcher ────────────────────────────────────────────────────────

export async function executeTool(supabase: SupabaseClient, name: string, args: any) {
  const lunar = getLunarData();

  // Retrieve authenticated userId for data isolation
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    // get_current_lunar_context and get_current_cycle do not require database interaction
    if (name !== 'get_current_lunar_context' && name !== 'get_current_cycle') {
      throw new Error(`Authentication required for database tool "${name}": ${authError?.message || 'Session invalid'}`);
    }
  }
  
  const userId = user?.id || '';

  switch (name) {
    case 'get_current_lunar_context': {
      return { content: [{ type: 'text', text: JSON.stringify(lunar, null, 2) }] };
    }

    case 'get_current_cycle': {
      return {
        content: [{
          type: 'text',
          text: `Current Lunar Month: ${lunar.lunarMonth} Moon\nCycle Started: ${lunar.cycleStart}`
        }]
      };
    }

    case 'get_phase_summary': {
      const phaseKey = args.phaseKey || lunar.phase.key;
      const lunarMonth = args.lunarMonth || lunar.lunarMonth;

      const [echoesRes, loopsRes] = await Promise.all([
        supabase.from('echoes').select('*').eq('user_id', userId).eq('phase', phaseKey).eq('lunar_month', lunarMonth).is('deleted_at', null),
        supabase.from('loops').select('*').eq('user_id', userId).eq('lunar_month_opened', lunarMonth).is('deleted_at', null)
      ]);

      const echoes = echoesRes.data || [];
      const loops = loopsRes.data || [];

      const loopsOpened = loops.filter(l => l.phase_opened === phaseKey);
      const loopsClosed = loops.filter(l => l.phase_closed === phaseKey && l.status === 'completed');
      const loopsReleased = loops.filter(l => l.phase_closed === phaseKey && l.status === 'released');

      const summary = {
        phase: phaseKey,
        lunarMonth,
        reflectionsCount: echoes.length,
        loopsOpened: loopsOpened.map(l => ({ id: l.id, title: l.title })),
        loopsCompleted: loopsClosed.map(l => ({ id: l.id, title: l.title })),
        loopsReleased: loopsReleased.map(l => ({ id: l.id, title: l.title })),
        reflections: echoes.map(e => e.text)
      };

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }

    case 'list_open_loops': {
      const limit = args.limit || 20;
      const offset = args.offset || 0;

      const { data, error } = await supabase
        .from('loops')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['open', 'active'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(data || [], null, 2) }] };
    }

    case 'get_loop': {
      const { data, error } = await supabase
        .from('loops')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'search_loops': {
      const data = await searchLoopsInDb(supabase, userId, args.query);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
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
        status: 'open',
        source: args.source || 'chatgpt',
        source_conversation_id: args.source_conversation_id || null,
        source_excerpt: args.source_excerpt || null,
        source_reference: args.source_reference || null,
        energy_state: args.energy_state || null,
        attention_level: args.attention_level || null,
        aliveness_score: args.aliveness_score || null,
        parent_loop_id: args.parent_loop_id || null,
        metadata: args.metadata || {},
        
        // Auto lunar tracking
        phase_opened: lunar.phase.key,
        phase_name: lunar.phase.name,
        lunar_month_opened: lunar.lunarMonth,
        moon_age_opened: lunar.age,
        zodiac_opened: lunar.zodiac.sign,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('loops').insert(insertData);
      if (error) throw error;

      return {
        content: [{
          type: 'text',
          text: `Successfully created Loop: "${args.title}" (ID: ${id}) under the ${lunar.phase.name} in ${lunar.zodiac.sign}.`
        }]
      };
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
      if (args.status !== undefined) {
        updateData.status = args.status;
        if (args.status === 'completed' || args.status === 'closed') {
          updateData.closed_at = new Date().toISOString();
          updateData.phase_closed = lunar.phase.key;
          updateData.phase_name_closed = lunar.phase.name;
          updateData.lunar_month_closed = lunar.lunarMonth;
        } else if (args.status === 'released') {
          updateData.released_at = new Date().toISOString();
          updateData.phase_closed = lunar.phase.key;
          updateData.phase_name_closed = lunar.phase.name;
          updateData.lunar_month_closed = lunar.lunarMonth;
        }
      }
      if (args.metadata !== undefined) updateData.metadata = args.metadata;

      const { error } = await supabase
        .from('loops')
        .update(updateData)
        .eq('id', args.id)
        .eq('user_id', userId);

      if (error) throw error;

      return {
        content: [{
          type: 'text',
          text: `Successfully updated Loop ID: ${args.id} (Status: ${args.status || 'unchanged'}).`
        }]
      };
    }

    case 'complete_loop': {
      const { error } = await supabase
        .from('loops')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          phase_closed: lunar.phase.key,
          phase_name_closed: lunar.phase.name,
          lunar_month_closed: lunar.lunarMonth,
          updated_at: new Date().toISOString()
        })
        .eq('id', args.id)
        .eq('user_id', userId);

      if (error) throw error;
      return { content: [{ type: 'text', text: `Completed Loop ID: ${args.id}.` }] };
    }

    case 'release_loop': {
      const { error } = await supabase
        .from('loops')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          phase_closed: lunar.phase.key,
          phase_name_closed: lunar.phase.name,
          lunar_month_closed: lunar.lunarMonth,
          updated_at: new Date().toISOString()
        })
        .eq('id', args.id)
        .eq('user_id', userId);

      if (error) throw error;
      return { content: [{ type: 'text', text: `Released Loop ID: ${args.id} (let go).` }] };
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
        status: 'open',
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

      const { error: insertErr } = await supabase.from('loops').insert(insertData);
      if (insertErr) throw insertErr;

      return {
        content: [{
          type: 'text',
          text: `Carried loop forward. Old Loop (ID: ${args.id}) set to "carried_forward". New Loop (ID: ${newId}) opened under the ${lunar.phase.name}.`
        }]
      };
    }

    case 'create_echo':
    case 'create_entry': {
      const id = generateServerId('e');
      const insertData = {
        id,
        user_id: userId,
        text: args.text,
        source: args.source || 'chatgpt',
        source_conversation_id: args.source_conversation_id || null,
        source_excerpt: args.source_excerpt || null,
        source_reference: args.source_reference || null,
        energy_state: args.energy_state || null,
        metadata: args.metadata || {},
        
        // Auto lunar context
        phase: lunar.phase.key,
        phase_name: lunar.phase.name,
        phase_type: lunar.phase.key.includes('crescent') || lunar.phase.key.includes('gibbous') ? 'flow' : 'threshold',
        lunar_month: lunar.lunarMonth,
        day_of_cycle: lunar.dayOfCycle,
        zodiac: lunar.zodiac.sign,
        illumination: lunar.illumination,
        tags: args.tags || [],
        linked_loop_id: args.linked_loop_id || null,
        is_encrypted: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('echoes').insert(insertData);
      if (error) throw error;

      return {
        content: [{
          type: 'text',
          text: `Reflection recorded under the ${lunar.phase.name} in ${lunar.zodiac.sign}. (ID: ${id})`
        }]
      };
    }

    case 'get_echo':
    case 'get_entry': {
      const { data, error } = await supabase
        .from('echoes')
        .select('*')
        .eq('id', args.id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'search_echoes':
    case 'search_entries': {
      const data = await searchEchoesInDb(supabase, userId, args.query, args.tag, args.lunar_month);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'get_cycle_entries': {
      const lunarMonth = args.lunarMonth || lunar.lunarMonth;
      const { data, error } = await supabase
        .from('echoes')
        .select('*')
        .eq('user_id', userId)
        .eq('lunar_month', lunarMonth)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { content: [{ type: 'text', text: JSON.stringify(data || [], null, 2) }] };
    }

    case 'get_cycle_summary': {
      const lunarMonth = args.lunarMonth || lunar.lunarMonth;

      const [echoesRes, loopsRes] = await Promise.all([
        supabase.from('echoes').select('*').eq('user_id', userId).eq('lunar_month', lunarMonth).is('deleted_at', null),
        supabase.from('loops').select('*').eq('user_id', userId).eq('lunar_month_opened', lunarMonth).is('deleted_at', null)
      ]);

      const echoes = echoesRes.data || [];
      const loops = loopsRes.data || [];

      const summary = {
        lunarMonth,
        totalEchoes: echoes.length,
        loopsOpened: loops.length,
        loopsCompleted: loops.filter(l => l.status === 'completed' || l.status === 'closed').length,
        loopsReleased: loops.filter(l => l.status === 'released').length,
        reflectionsExcerpt: echoes.slice(0, 5).map(e => `[${e.phase_name}] ${e.text.substr(0, 100)}...`)
      };

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }

    case 'search_cycles': {
      const { data, error } = await supabase
        .from('echoes')
        .select('lunar_month')
        .eq('user_id', userId)
        .ilike('lunar_month', `%${args.query}%`);

      if (error) throw error;
      const uniqueMonths = [...new Set((data || []).map(d => d.lunar_month))];
      return { content: [{ type: 'text', text: JSON.stringify(uniqueMonths, null, 2) }] };
    }

    case 'get_ai_context': {
      // Compiled lightweight context
      const [loopsRes, echoesRes] = await Promise.all([
        supabase.from('loops').select('id, title, note, status, created_at').eq('user_id', userId).in('status', ['open', 'active']).is('deleted_at', null).limit(10),
        supabase.from('echoes').select('id, text, phase_name, tags, created_at').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5)
      ]);

      const openLoops = loopsRes.data || [];
      const recentEchoes = echoesRes.data || [];

      // Extract active themes (top tags used recently)
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
        openLoopsList: openLoops.map(l => ({ id: l.id, title: l.title, created: l.created_at })),
        recentReflections: recentEchoes.map(e => ({
          phase: e.phase_name,
          tags: e.tags,
          text: e.text.substr(0, 150) + (e.text.length > 150 ? '...' : '')
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(context, null, 2) }] };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}
