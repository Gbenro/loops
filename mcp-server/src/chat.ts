import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { executeTool, TOOL_DEFINITIONS_COMPAT } from './tools.js';
import { getLunarData } from './lunar.js';
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

// System Prompt enforcing the Luna Personality & Philosophy guidelines
const getSystemPrompt = (lunar: any) => {
  return `You are Luna, the guiding voice of Luna Loops.
Your character: You write in the register of a poet who also understands astronomy — spare, grounded, warm. Never twee, never grandiose. Think Mary Oliver meets NASA mission control.

Current Sky Context:
- Lunar Cycle Day: ${lunar.dayOfCycle}
- Moon Phase: ${lunar.phase.name} (${lunar.phase.emoji} ${lunar.illumination}% illumination)
- Zodiac Sign: Moon in ${lunar.zodiac.sign}
- Current Season: ${lunar.season}

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

2. Precise Data Grounding & Semantic Rules:
   - Understand Provenance: Records returned from the database will contain a "provenanceAuthor" ('user', 'ai', 'co-created') and a "provenanceKind" ('original_echo', 'ai_reflection', 'checkpoint', 'product_note').
   - You must distinguish user-original, AI, and co-created language precisely.
   - Semantic Definitions:
     - "my latest Echo" or "the Echo I just recorded": The single newest record in the returned list where provenanceAuthor is 'user' (NOT 'ai') and provenanceKind is 'original_echo' (NOT 'ai_reflection').
     - "your latest reflection" or "your last reflection": The single newest record where provenanceAuthor is 'ai' and provenanceKind is 'ai_reflection'.
     - "new entries" or "recent echoes": Echoes created during the current phase or current cycle.
     - "since X" or "since last circle": Filtered strictly by timestamps or cycle bounds.
   - ABSOLUTE RULE ON AMBIGUITY: If you cannot confidently establish which exact record or record set the user is referring to (e.g. they say "that note", but there are multiple candidates, or "my latest Echo" but the retrieval query returned zero user echoes), you MUST ask for clarification. Do NOT reflect on the wrong records or manufacture a reflection. State clearly what you found and ask.

Tool-Use & Action Rules:
- Read liberally: You can search loops and echoes whenever you need context to answer questions.
- Write intentionally: Do NOT run create/update tools (like create_echo or create_loop) just because a user mentions an experience.
  - CONVERSE when they say "I feel grateful today" or tell you about a meeting.
  - WRITE only when they explicitly say "Save this", "Record that", "Create a loop", "Mark this complete", or "Archive".
- Modify carefully & Delete conservatively: Always verify details or ask for confirmation before bulk actions or destructive operations.
- Tool Truthfulness: Never claim a record was "Saved" or "Updated" unless the tool call actually completed successfully. If a tool fails, state the failure honestly.`;
};

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
    const { message, sessionId: clientSessionId, modelKey } = req.body;

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

      // Save user message to database
      const userMessageId = generateId('msg');
      await supabase.from('chat_messages').insert({
        id: userMessageId,
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        content: message.trim()
      });

      // Load conversation history
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const conversationMessages = history ? [...history] : [{ role: 'user', content: message }];

      const lunar = getLunarData();
      const systemPrompt = getSystemPrompt(lunar);
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

          // Parse retrieved IDs
          const idMatches = toolResultText.match(/[le]\d{10,}\w{0,4}/g);
          if (idMatches) retrievedContextIds.push(...idMatches);

          // Extract database mutations
          try {
            const parsed = JSON.parse(toolResultText);
            const recordId = parsed.id;
            if (recordId) {
              const table = recordId.startsWith('e') ? 'echoes' : (recordId.startsWith('l') ? 'loops' : (recordId.startsWith('r') ? 'echo_reflections' : (recordId.startsWith('t') ? 'threads' : 'unknown')));
              if (toolName.startsWith('create_')) {
                databaseMutationsTracked.push({ type: 'insert', table, id: recordId });
              } else if (toolName.startsWith('update_') || toolName === 'close_loop' || toolName === 'reopen_loop' || toolName === 'archive_loop' || toolName === 'restore_loop' || toolName === 'archive_echo' || toolName === 'restore_echo') {
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

      // 4. Agentic Loop (Max 5 hops)
      while (loopCount < 5) {
        let aiResult: any;

        if (provider === 'anthropic') {
          const anthropicTools = getAnthropicTools();
          aiResult = await callClaude(modelId, agentMessages, systemPrompt, anthropicTools);

          const textContent = aiResult.content.find((c: any) => c.type === 'text');
          if (textContent) {
            finalResponseText = textContent.text;
          }

          const toolUseCalls = aiResult.content.filter((c: any) => c.type === 'tool_use');
          if (toolUseCalls.length > 0) {
            agentMessages.push({ role: 'assistant', content: aiResult.content });

            for (const call of toolUseCalls) {
              const toolName = call.name;
              const toolArgs = call.input;
              console.log(`[Agent-Claude] Calling tool: ${toolName}`, toolArgs);

              const { toolResultText } = await executeAndTrackTool(toolName, toolArgs);

              agentMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: call.id,
                    content: toolResultText
                  }
                ]
              });
            }
            loopCount++;
            continue;
          }
        } else if (provider === 'google') {
          const geminiTools = getGeminiTools();
          aiResult = await callGemini(modelId, agentMessages, systemPrompt, geminiTools);

          const candidate = aiResult.candidates?.[0];
          const part = candidate?.content?.parts?.[0];

          if (part?.text) {
            finalResponseText = part.text;
          }

          const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);
          if (functionCalls && functionCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: part?.text || '',
              tool_calls: functionCalls.map((fc: any) => ({
                id: `fc_${Math.random().toString(36).substr(2, 4)}`,
                type: 'function',
                function: {
                  name: fc.functionCall.name,
                  arguments: JSON.stringify(fc.functionCall.args)
                }
              }))
            });

            for (const call of functionCalls) {
              const toolName = call.functionCall.name;
              const toolArgs = call.functionCall.args || {};

              console.log(`[Agent-Gemini] Calling tool: ${toolName}`, toolArgs);
              const { toolResultText } = await executeAndTrackTool(toolName, toolArgs);

              agentMessages.push({
                role: 'tool',
                name: toolName,
                content: toolResultText
              });
            }
            loopCount++;
            continue;
          }
        } else if (provider === 'openai') {
          const openAiTools = getOpenAiTools();
          aiResult = await callGpt(modelId, agentMessages, systemPrompt, openAiTools);

          const choice = aiResult.choices[0];
          const responseMsg = choice.message;

          if (responseMsg.content) {
            finalResponseText = responseMsg.content;
          }

          const openAiToolCalls = responseMsg.tool_calls;
          if (openAiToolCalls && openAiToolCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: responseMsg.content || '',
              tool_calls: openAiToolCalls
            });

            for (const call of openAiToolCalls) {
              const toolName = call.function.name;
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(call.function.arguments);
              } catch {}

              console.log(`[Agent-GPT] Calling tool: ${toolName}`, toolArgs);
              const { toolResultText } = await executeAndTrackTool(toolName, toolArgs);

              agentMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: toolName,
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

      // Log trace to telemetry table
      const latency = Date.now() - startTime;
      const telemetryId = generateId('trace');
      await supabase.from('chat_telemetry').insert({
        id: telemetryId,
        message_id: assistantMessageId,
        session_id: sessionId,
        user_id: user.id,
        model: `${provider}:${modelId} (${resolvedKey})`,
        prompt_version: '1.2-provenance',
        retrieved_context_ids: retrievedContextIds,
        tool_calls: toolCallsTracked,
        database_mutations: databaseMutationsTracked,
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
          await supabase.from('chat_telemetry').insert({
            id: generateId('trace'),
            user_id: user.id,
            session_id: sessionId || null,
            model: modelConfig ? `${modelConfig.provider}:${modelConfig.modelId}` : 'unknown',
            prompt_version: '1.2-provenance',
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

  // 6. GET /api/chat/telemetry/:id - Turn bundle trace for GPT Actions
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
          retrievedContextIds: telemetry.retrieved_context_ids || [],
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
}
