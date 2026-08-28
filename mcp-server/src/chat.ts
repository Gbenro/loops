import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { executeTool, TOOL_DEFINITIONS_COMPAT, mapRelationalMemory } from './tools.js';
import { getLunarData } from './lunar.js';
import { getTimeContext, TimeContext } from './time.js';
import { formatVoiceInputProvenance } from './voice.js';
import { resolveModel, getUserAllowedModels } from './models.js';

// Simple ID generator for chat session, messages, telemetry
const generateId = (prefix = 'chat') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

// Map standard MCP schemas to OpenAI tool format
const getOpenAiTools = () => {
  return TOOL_DEFINITIONS_COMPAT.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));
};

// Map standard MCP schemas to Anthropic tool format
const getAnthropicTools = () => {
  return TOOL_DEFINITIONS_COMPAT.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));
};

// System Prompt enforcing the Luna Personality & Philosophy guidelines + Time Grounding + Relational Memory Layer
const getSystemPrompt = (lunar: any, timeContext: TimeContext, relationalAttunements: any[] = []) => {
  const memoryBlock = relationalAttunements.length > 0
    ? `\nRelational Memory (What you have provisionally learned about how to meet this user):\n` +
      relationalAttunements.map((m: any, idx: number) => 
        `  ${idx + 1}. [${m.type} | provenance: ${m.provenance} | strength: ${m.strength} | status: ${m.lifecycleStatus}] "${m.statement}"`
      ).join('\n') +
      `\n  * Epistemic Rule: Memory informs recognition; it does not require expression. You may remember something without mentioning it. Never force catchphrases.`
    : `\nRelational Memory: No specific relational attunement active for this turn; maintain open observation without forcing pre-conceived patterns.`;

  return `You are Luna, the guiding voice of Luna Loops.
Your character: You write in the register of a poet who also understands astronomy — spare, grounded, warm. Never twee, never grandiose. Think Mary Oliver meets NASA mission control.

Architecture & Continuity Layers:
1. Identity: Guiding voice of Luna Loops; poet who understands astronomy (spare, grounded, warm).
2. Personality: Attuned, observing before interpreting, write restraint, returning to life.
3. Capabilities: Tools for searching field records, managing loops, and capturing reflections.
4. Protocols: Grounding rules, verification, ambiguity clarification, and 3-6-9 return-to-field conversational pacing.
5. Relational Memory: Provisional knowledge about how to meet this person (language, preferences, distinctions, orientations).
6. Field: The user's lived empirical recordings (Echoes, Loops, Rhythms).
7. Orchestration: Context selection, tool execution, multi-hop reasoning, and mutation tracking.
8. Interchangeable Model: The underlying LLM provides reasoning capacity, while Luna continuity owns memory and state.
${memoryBlock}

Current Authoritative Time & Temporal Grounding:
- Local Date & Time: ${timeContext.localNow}
- Today: ${timeContext.today} | Yesterday: ${timeContext.yesterday} | Tomorrow: ${timeContext.tomorrow}
- Day of Week: ${timeContext.dayOfWeek}
- Current Year: ${timeContext.currentYear} | UTC ISO: ${timeContext.utcNow} | Offset: ${timeContext.utcOffset}
- Authoritative Timezone: ${timeContext.timezone}
- CRITICAL TIME GROUNDING RULE:
  * When resolving relative/current temporal references ("today", "yesterday", "recent", "this week", "my latest echo", "since last circle"), resolve strictly from this authoritative clock (Current Year: ${timeContext.currentYear}). Never silently substitute a past year for current/relative queries.
  * Longitudinal and historical searches across previous years and cycles remain fully permitted and encouraged whenever answering historical or pattern inquiries (e.g., "Have I felt this way before?", "When did I first mention consciousness?", multi-cycle pattern exploration).

Current Sky Context:
- Lunar Cycle Day: ${lunar.dayOfCycle}
- Moon Phase: ${lunar.phase.name} (${lunar.phase.emoji} ${lunar.illumination}% illumination)
- Zodiac Sign: Moon in ${lunar.zodiac.sign}
- Lunar Month: ${lunar.lunarMonth}

Philosophy & Behavior Rules:
1. Grounding and Integrity:
   - Capture/observe before interpretation: Expose raw facts/events before explaining, diagnosing, or analyzing them.
   - Do not manufacture hidden causes: Never assume or invent underlying psychological, spiritual, or cosmic reasons for the user's state without direct evidence.
   - Preserve open possibilities: Write in a way that opens questions rather than declaring final answers.
   - Do not rank something "most alive" or "most active" without clear, empirical evidence from the retrieved records.
   - Lunar context is a lens, not an authority: Use moon phases to illuminate rhythms, never to prescribe behavior, moods, or destiny.
   - Avoid obligatory lunar decoration: Do not inject moon analogies or space metaphors in every sentence; let references emerge organically.
   - Focus and rotate: Go deeply through one single lens of inquiry before rotating or switching focus.
   - Earned significance: Let patterns earn significance over multiple cycles rather than declaring a trend on the first recurrence.
   - Write restraint: Keep reflections brief, focused, and minimal. Do not talk for the sake of talking.
   - Return to life: Do not encourage endless loops of introspection. Guide the user back to direct action and living.

2. Precise Data Grounding & Provenance Rules:
   - Distinguish Record Types:
     * Personal Echoes: user-authored, original reflections. Immutable once saved.
     * AI Reflections: your own reflections or annotations attached via parent_id / relationships.
     * Co-created Records: distinctions formed together conversationally.
   - Semantic Definitions:
     * "my latest Echo" / "the Echo I just recorded": The single newest record where provenanceAuthor is 'user' and provenanceKind is 'original_echo'.
     * "your latest reflection": The single newest record where provenanceAuthor is 'ai' and provenanceKind is 'ai_reflection'.
     * "new entries" / "recent echoes": Echoes created during the current phase or current cycle.
   - ABSOLUTE RULE ON AMBIGUITY: If you cannot confidently establish which record the user is referring to, ask for clarification instead of guessing or manufacturing a reflection.

3. Relational Memory & Epistemic Humility:
   - Memory informs recognition; it does not require expression. Luna can remember something without mentioning it.
   - Attunement, not catchphrases: Never mechanically parrot or inject remembered phrases into conversations where they don't belong.
   - Provisional knowledge: Relational memories represent what you have provisionally learned about how to meet this person, NOT a rigid psychological diagnosis or fixed profile of who they are.
   - Let recurrence earn significance: Do not freely write permanent relational memories after every casual sentence. Propose candidate memories only for clear patterns, and let recurrence strengthen them.

4. Tool-Use & Action Rules:
   - Read liberally: Search loops, echoes, and relational memories whenever you need context.
   - Write intentionally: Do NOT run create/update tools just because a user mentions an experience.
     * CONVERSE when they share an experience, feeling, or reflection.
     * WRITE only when they explicitly say "Save this", "Record that", "Create a loop", "Mark this complete", or "Archive".
   - Tool Truthfulness: Never claim a record was "Saved" or "Updated" unless the tool call completed successfully.`;
};

export interface RelationalMemorySelectionResult {
  candidatesConsideredCount: number;
  candidates: string[];
  selected: any[];
  injectedIds: string[];
  memoriesForPrompt: any[];
}

// Selective retrieval helper: score and pick 0 to 3 relevant relational memories
async function selectRelevantRelationalMemories(
  supabase: SupabaseClient,
  userId: string,
  currentMessage: string,
  history: any[] = []
): Promise<RelationalMemorySelectionResult> {
  try {
    const { data: memories, error } = await supabase
      .from('relational_memories')
      .select('*')
      .eq('user_id', userId)
      .in('lifecycle_status', ['active', 'emerging', 'resurfaced'])
      .eq('user_action_status', 'active');

    if (error || !memories || memories.length === 0) {
      return {
        candidatesConsideredCount: 0,
        candidates: [],
        selected: [],
        injectedIds: [],
        memoriesForPrompt: []
      };
    }

    const candidateIds = memories.map(m => m.id);

    // Extract search terms from current message + last user turn
    const contextText = (currentMessage + ' ' + (history.slice(-2).map(h => h.content).join(' '))).toLowerCase();
    const words = Array.from(new Set(contextText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)));

    const scored: any[] = [];

    for (const m of memories) {
      let keywordScore = 0;
      const stmt = (m.statement || '').toLowerCase();
      
      for (const w of words) {
        if (stmt.includes(w)) keywordScore += 3;
      }

      let generalScore = 0;
      if (m.type === 'interaction_preference' && m.provenance === 'explicit') generalScore += 2;
      if (m.lifecycle_status === 'active' || m.lifecycle_status === 'resurfaced') generalScore += 0.5;
      generalScore += Math.min(m.strength || 1, 5) * 0.1;

      const totalScore = keywordScore > 0 ? (keywordScore + generalScore) : (m.type === 'interaction_preference' && m.provenance === 'explicit' ? generalScore : 0);

      if (totalScore >= 2) {
        scored.push({ ...m, score: totalScore });
      }
    }

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top 0 to 3 memories
    const selected = scored.slice(0, 3);
    const mappedMemories = selected.map(mapRelationalMemory);

    return {
      candidatesConsideredCount: candidateIds.length,
      candidates: candidateIds,
      selected: selected.map(s => ({
        id: s.id,
        type: s.type,
        statement: s.statement,
        relevanceScore: s.score,
        lifecycleStatus: s.lifecycle_status,
        provenance: s.provenance,
        strength: s.strength
      })),
      injectedIds: mappedMemories.map(m => m.id),
      memoriesForPrompt: mappedMemories
    };
  } catch (err) {
    console.warn('[RelationalMemory] Selection error:', err);
    return {
      candidatesConsideredCount: 0,
      candidates: [],
      selected: [],
      injectedIds: [],
      memoriesForPrompt: []
    };
  }
}

// Orchestration helper: call Claude (Anthropic)
async function callClaude(modelId: string, messages: any[], systemPrompt: string, tools: any[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured on server');

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4000,
      system: systemPrompt,
      messages: formattedMessages,
      tools: tools
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  return response.json();
}

// Orchestration helper: call GPT (OpenAI)
async function callGpt(modelId: string, messages: any[], systemPrompt: string, tools: any[]): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured on server');

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.name ? { name: m.name } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
    }))
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId,
      messages: formattedMessages,
      tools: tools.length > 0 ? tools : undefined
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  return response.json();
}

// Map standard MCP schemas to Gemini tool format
const getGeminiTools = () => {
  return [
    {
      functionDeclarations: TOOL_DEFINITIONS_COMPAT.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }))
    }
  ];
};

// Orchestration helper: call Gemini (Google)
async function callGemini(modelId: string, messages: any[], systemPrompt: string, tools: any[]): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured on server');

  const contents = messages.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (m.role === 'tool' || m.role === 'tool_result') {
      return {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.name || m.tool_use_id,
              response: { name: m.name || m.tool_use_id, content: m.content }
            }
          }
        ]
      };
    }
    if (m.tool_calls) {
      return {
        role: 'model',
        parts: m.tool_calls.map((c: any) => ({
          functionCall: {
            name: c.function.name,
            args: typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments) : c.function.arguments
          }
        }))
      };
    }
    return {
      role,
      parts: [{ text: m.content }]
    };
  });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      tools: tools.length > 0 ? tools : undefined
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  return response.json();
}

export function registerChatRoutes(app: Express, authenticateRest: any) {
  // 1. GET /api/chat/models - Lists all models authorized for the active user
  app.get('/api/chat/models', authenticateRest, async (req: Request, res: Response) => {
    try {
      const { data: { user } } = await req.body.supabaseClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      
      const allowed = await getUserAllowedModels(user.id);
      res.json({ models: allowed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/chat/sessions - List chat sessions for GPT actions & PWA sidebar
  app.get('/api/chat/sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const { data, error, count } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      res.json({ sessions: data, count, limit, offset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/chat/sessions/:id - Get a specific chat session with ordered messages
  app.get('/api/chat/sessions/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      // 1. Retrieve session metadata
      const { data: session, error: sessErr } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (sessErr || !session) throw new Error('Session not found');

      // 2. Retrieve messages
      const { data: messages, error: msgsErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', req.params.id)
        .order('created_at', { ascending: true });

      if (msgsErr) throw msgsErr;

      // Map telemetry IDs
      const msgIds = (messages || []).map(m => m.id);
      const traceMap = new Map();
      if (msgIds.length > 0) {
        const { data: traces } = await supabase
          .from('chat_telemetry')
          .select('id, message_id')
          .in('message_id', msgIds);
        if (traces) {
          for (const t of traces) {
            if (t.message_id) traceMap.set(t.message_id, t.id);
          }
        }
      }

      const messagesWithTelemetry = (messages || []).map(m => ({
        ...m,
        telemetryId: traceMap.get(m.id) || null
      }));

      res.json({
        ...session,
        messages: messagesWithTelemetry
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /api/chat/messages - Search and filter chat messages
  app.get('/api/chat/messages', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const query = req.query.query as string;
    const sessionId = req.query.sessionId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      let builder = supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sessionId) {
        builder = builder.eq('session_id', sessionId);
      }
      if (query) {
        builder = builder.ilike('content', `%${query}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;

      // Map telemetry IDs
      const msgIds = (data || []).map(m => m.id);
      const traceMap = new Map();
      if (msgIds.length > 0) {
        const { data: traces } = await supabase
          .from('chat_telemetry')
          .select('id, message_id')
          .in('message_id', msgIds);
        if (traces) {
          for (const t of traces) {
            if (t.message_id) traceMap.set(t.message_id, t.id);
          }
        }
      }

      const messagesWithTelemetry = (data || []).map(m => ({
        ...m,
        telemetryId: traceMap.get(m.id) || null
      }));

      res.json({ messages: messagesWithTelemetry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /api/chat - Orchestration endpoint
  app.post('/api/chat', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { message, sessionId: clientSessionId, modelKey, inputType = 'text', metadata = {} } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    const startTime = Date.now();
    let sessionId = clientSessionId;
    let status: 'success' | 'failed' = 'success';
    let errorMessage: string | null = null;
    let toolCallsTracked: any[] = [];
    let retrievedContextIds: string[] = [];
    let databaseMutationsTracked: any[] = [];
    let modelConfig;

    try {
      // 1. Resolve User
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User session not authenticated');

      // 2. Resolve Model via Config Registry
      modelConfig = await resolveModel(modelKey, user.id);
      const { provider, modelId, key: resolvedKey } = modelConfig;

      // 3. Resolve Session ID
      if (!sessionId) {
        const { data: existingSessions } = await supabase
          .from('chat_sessions')
          .select('id')
          .limit(1);

        if (existingSessions && existingSessions.length > 0) {
          sessionId = existingSessions[0].id;
        } else {
          sessionId = generateId('session');
          await supabase.from('chat_sessions').insert({
            id: sessionId,
            user_id: user.id,
            title: 'Continuous Reflection'
          });
        }
      }

      // Save user message to database with input provenance
      const userMessageId = generateId('msg');
      await supabase.from('chat_messages').insert({
        id: userMessageId,
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        content: message.trim(),
        input_type: inputType === 'voice' ? 'voice' : 'text',
        metadata: metadata || {}
      });

      // Load conversation history
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const conversationMessages = history ? [...history] : [{ role: 'user', content: message }];

      // 1. Authoritative Time Grounding (America/Chicago)
      const timeContext = getTimeContext('America/Chicago');

      // 2. Real-time Lunar Astronomical Data
      const lunar = getLunarData();

      // 3. Selective Relational Memories Attunement (Top 0–3 relevant)
      const memorySelection = await selectRelevantRelationalMemories(supabase, user.id, message, conversationMessages);

      // 4. Voice Input Provenance with runtime length
      const voiceProvenance = formatVoiceInputProvenance({ inputType, ...metadata }, message.length);

      const systemPrompt = getSystemPrompt(lunar, timeContext, memorySelection.memoriesForPrompt);
      let loopCount = 0;
      let finalResponseText = '';
      const agentMessages: any[] = [...conversationMessages];

      // Helper function to execute tools and track metadata/mutations
      const executeAndTrackTool = async (toolName: string, toolArgs: any) => {
        let toolResultText = '';
        let isError = false;

        try {
          const outcome = await executeTool(supabase, toolName, toolArgs);
          toolResultText = outcome.content[0].text;
          isError = !!(outcome as any).isError;

          // Parse retrieved IDs (including relational memories)
          const idMatches = toolResultText.match(/(?:rm_|rm|[le])\d{10,}\w{0,4}/g);
          if (idMatches) retrievedContextIds.push(...idMatches);

          // Extract database mutations
          try {
            const parsed = JSON.parse(toolResultText);
            const recordId = parsed.id;
            if (recordId) {
              const table = recordId.startsWith('rm') ? 'relational_memories' : (recordId.startsWith('e') ? 'echoes' : (recordId.startsWith('l') ? 'loops' : (recordId.startsWith('r') ? 'echo_reflections' : (recordId.startsWith('t') ? 'threads' : 'unknown'))));
              if (toolName.startsWith('create_') || toolName === 'propose_candidate_memory') {
                databaseMutationsTracked.push({ type: 'insert', table, id: recordId });
              } else if (toolName.startsWith('update_') || toolName === 'reinforce_relational_memory' || toolName === 'close_loop' || toolName === 'reopen_loop' || toolName === 'archive_loop' || toolName === 'restore_loop' || toolName === 'archive_echo' || toolName === 'restore_echo') {
                databaseMutationsTracked.push({ type: 'update', table, id: recordId });
              } else if (toolName === 'carry_loop_forward') {
                databaseMutationsTracked.push({ type: 'update', table: 'loops', id: toolArgs.id });
                databaseMutationsTracked.push({ type: 'insert', table: 'loops', id: recordId });
              }
            }
          } catch {}
        } catch (err: any) {
          toolResultText = `Error running tool: ${err.message}`;
          isError = true;
        }

        toolCallsTracked.push({
          tool: toolName,
          args: toolArgs,
          success: !isError,
          resultSummary: toolResultText.substring(0, 150)
        });

        return { toolResultText, isError };
      };

      // Multi-step Tool Calling Loop
      while (loopCount < 5) {
        if (provider === 'anthropic') {
          const anthropicTools = getAnthropicTools();
          const response = await callClaude(modelId, agentMessages, systemPrompt, anthropicTools);

          // Check for tool use blocks
          const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
          const textBlocks = response.content.filter((b: any) => b.type === 'text');

          if (textBlocks.length > 0) {
            finalResponseText = textBlocks.map((b: any) => b.text).join('\n');
          }

          if (toolUseBlocks.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: response.content
            });

            const toolResults: any[] = [];
            for (const toolUse of toolUseBlocks) {
              console.log(`[Agent-Claude] Calling tool: ${toolUse.name}`, toolUse.input);
              const { toolResultText, isError } = await executeAndTrackTool(toolUse.name, toolUse.input);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: toolResultText,
                is_error: isError
              });
            }

            agentMessages.push({
              role: 'user',
              content: toolResults
            });

            loopCount++;
            continue;
          }
        } else if (provider === 'google') {
          const geminiTools = getGeminiTools();
          const response = await callGemini(modelId, agentMessages, systemPrompt, geminiTools);

          const candidate = response.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          const textParts = parts.filter((p: any) => p.text);
          const functionCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

          if (textParts.length > 0) {
            finalResponseText = textParts.map((p: any) => p.text).join('\n');
          }

          if (functionCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: finalResponseText,
              tool_calls: functionCalls.map((fc: any) => ({
                id: `fc_${Math.random().toString(36).substr(2, 4)}`,
                function: {
                  name: fc.name,
                  arguments: typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args || {})
                }
              }))
            });

            for (const call of functionCalls) {
              console.log(`[Agent-Gemini] Calling tool: ${call.name}`, call.args);
              const { toolResultText } = await executeAndTrackTool(call.name, call.args || {});

              agentMessages.push({
                role: 'tool',
                name: call.name,
                content: toolResultText
              });
            }
            loopCount++;
            continue;
          }
        } else {
          // Default: OpenAI Compatible
          const openAiTools = getOpenAiTools();
          const responseMsg = await callGpt(modelId, agentMessages, systemPrompt, openAiTools);

          finalResponseText = responseMsg.content || '';
          const openAiToolCalls = responseMsg.tool_calls;

          if (openAiToolCalls && openAiToolCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: responseMsg.content || '',
              tool_calls: openAiToolCalls
            });

            for (const call of openAiToolCalls) {
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(call.function.arguments);
              } catch {}

              console.log(`[Agent-GPT] Calling tool: ${call.function.name}`, toolArgs);
              const { toolResultText } = await executeAndTrackTool(call.function.name, toolArgs);

              agentMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: call.function.name,
                content: toolResultText
              });
            }
            loopCount++;
            continue;
          }
        }

        break;
      }

      // Save assistant message to database
      const assistantMessageId = generateId('msg');
      await supabase.from('chat_messages').insert({
        id: assistantMessageId,
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: finalResponseText.trim()
      });

      retrievedContextIds = Array.from(new Set(retrievedContextIds));

      // Calculate actual runtime protocol state
      const turnDepth = conversationMessages.length + 1;
      const turnInPacingCycle = (turnDepth % 9) || 9;
      const pacingStage = turnInPacingCycle >= 8 ? 'return_to_life' : (turnInPacingCycle >= 6 ? 'grounding' : 'expansion');
      const pacingActive = turnInPacingCycle >= 6;
      const isClarifyingQuestion = finalResponseText.includes('?') && toolCallsTracked.length === 0;

      const runtimeProtocols = {
        version: '1.0',
        turnDepthInSession: turnDepth,
        threeSixNinePacing: {
          activated: pacingActive,
          stage: pacingStage,
          turnInPacingCycle
        },
        epistemicRestraintApplied: true,
        ambiguityClarificationTriggered: isClarifyingQuestion,
        activeProtocols: [
          'epistemic_humility',
          pacingActive ? `three_six_nine_${pacingStage}` : 'conversational_expansion',
          isClarifyingQuestion ? 'ambiguity_clarification' : 'direct_attunement'
        ]
      };

      // Log modular trace to telemetry table
      const latency = Date.now() - startTime;
      const telemetryId = generateId('trace');
      await supabase.from('chat_telemetry').insert({
        id: telemetryId,
        message_id: assistantMessageId,
        session_id: sessionId,
        user_id: user.id,
        model: `${provider}:${modelId} (${resolvedKey})`,
        prompt_version: '1.4-observability',
        retrieved_context_ids: retrievedContextIds,
        tool_calls: toolCallsTracked,
        database_mutations: databaseMutationsTracked,
        time_context: timeContext,
        lunar_context: {
          dayOfCycle: lunar.dayOfCycle,
          phaseName: lunar.phase.name,
          phaseKey: lunar.phase.key,
          illumination: lunar.illumination,
          zodiacSign: lunar.zodiac.sign,
          lunarMonth: lunar.lunarMonth,
          source: 'julian_astronomical_calculation'
        },
        relational_memory: {
          candidatesConsideredCount: memorySelection.candidatesConsideredCount,
          candidates: memorySelection.candidates,
          selectedCount: memorySelection.selected.length,
          selected: memorySelection.selected,
          injectedIds: memorySelection.injectedIds
        },
        voice_input: voiceProvenance,
        protocols: runtimeProtocols,
        latency_ms: latency,
        status: 'success'
      });

      // Update session timestamp
      await supabase.from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      res.json({
        sessionId,
        message: {
          id: assistantMessageId,
          role: 'assistant',
          content: finalResponseText.trim(),
          createdAt: new Date().toISOString()
        },
        telemetryId
      });
    } catch (err: any) {
      status = 'failed';
      errorMessage = err.message;
      console.error('[Orchestration loop failure]:', err);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const timeCtx = getTimeContext('America/Chicago');
          const lunarCtx = getLunarData();
          await supabase.from('chat_telemetry').insert({
            id: generateId('trace'),
            user_id: user.id,
            session_id: sessionId || null,
            model: modelConfig ? `${modelConfig.provider}:${modelConfig.modelId}` : 'unknown',
            prompt_version: '1.4-observability',
            time_context: timeCtx,
            lunar_context: {
              dayOfCycle: lunarCtx.dayOfCycle,
              phaseName: lunarCtx.phase.name,
              illumination: lunarCtx.illumination,
              zodiacSign: lunarCtx.zodiac.sign,
            },
            latency_ms: Date.now() - startTime,
            status: 'failed',
            error_message: errorMessage,
            database_mutations: []
          });
        }
      } catch {}

      res.status(500).json({ error: err.message });
    }
  });

  // 6. GET /api/chat/telemetry/:id - Turn bundle trace for GPT Actions and Luna Observability
  app.get('/api/chat/telemetry/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: telemetry, error: telError } = await supabase
        .from('chat_telemetry')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (telError || !telemetry) throw new Error('Telemetry trace not found');

      const { data: msg } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', telemetry.message_id)
        .single();

      let userMsg = null;
      if (msg) {
        const { data: preceding } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', telemetry.session_id)
          .lt('created_at', msg.created_at)
          .order('created_at', { ascending: false })
          .limit(1);
        if (preceding && preceding.length > 0) userMsg = preceding[0];
      }

      res.json({
        telemetry,
        turnBundle: {
          userQuery: userMsg?.content || null,
          timeContext: telemetry.time_context || null,
          lunarContext: telemetry.lunar_context || null,
          relationalMemory: telemetry.relational_memory || null,
          voiceInput: telemetry.voice_input || null,
          protocols: telemetry.protocols || null,
          fieldRetrieval: {
            retrievedContextIds: telemetry.retrieved_context_ids || []
          },
          toolCalls: telemetry.tool_calls || [],
          databaseMutations: telemetry.database_mutations || [],
          assistantResponse: msg?.content || null,
          latencyMs: telemetry.latency_ms,
          model: telemetry.model,
          promptVersion: telemetry.prompt_version,
          status: telemetry.status,
          errorMessage: telemetry.error_message
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. GET /api/chat/evaluations - Retrieve audits
  app.get('/api/chat/evaluations', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data, error } = await supabase
        .from('chat_evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ evaluations: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/chat/telemetry/:id/evaluate - Attach critique to a trace
  app.post('/api/chat/telemetry/:id/evaluate', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { evaluator, rating, flags, comments } = req.body;

    if (!evaluator || !rating) {
      res.status(400).json({ error: 'evaluator and rating are required fields' });
      return;
    }

    try {
      const evalId = generateId('eval');
      const { data, error } = await supabase
        .from('chat_evaluations')
        .insert({
          id: evalId,
          telemetry_id: req.params.id,
          evaluator,
          rating,
          flags: flags || [],
          comments: comments || null
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. GET /api/chat/memories - List all provisional relational memories for user inspection
  app.get('/api/chat/memories', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('relational_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('strength', { ascending: false })
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      res.json({ memories: (data || []).map(mapRelationalMemory) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. PATCH /api/chat/memories/:id - User agency: dismiss, pin, or correct a relational memory
  app.patch('/api/chat/memories/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Authentication required');

      const { userActionStatus, lifecycleStatus, statement } = req.body;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (userActionStatus !== undefined) updateData.user_action_status = userActionStatus;
      if (lifecycleStatus !== undefined) updateData.lifecycle_status = lifecycleStatus;
      if (statement !== undefined) updateData.statement = statement;

      const { data, error } = await supabase
        .from('relational_memories')
        .update(updateData)
        .eq('id', req.params.id)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Relational memory not found or unauthorized' });
      }

      res.json({ memory: mapRelationalMemory(data[0]) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
