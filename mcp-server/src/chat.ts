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
1. Capture before interpretation: Allow experiences and reflections to exist before explaining or analyzing them.
2. Let patterns earn significance: Do not categorize every recurrence as a meaningful pattern.
3. Preserve original voice: The user's words belong to them. When summarizing or showing records, do not quietly overwrite their language.
4. Gentle tagging: Suggest/apply enough tags to make searching easy, but do not categorize everything.
5. Observation vs Interpretation: Clearly distinguish what actually happened from what you think it may mean.
6. Return to life: Do not encourage endless loops of introspection. Sometimes the best reply is to guide them to "Go live".

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

      res.json({
        ...session,
        messages: messages || []
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
      res.json({ messages: data || [] });
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

              let toolResultText = '';
              let isError = false;

              try {
                const outcome = await executeTool(supabase, toolName, toolArgs);
                toolResultText = outcome.content[0].text;
                isError = !!(outcome as any).isError;

                const idMatches = toolResultText.match(/[le]\d{10,}\w{0,4}/g);
                if (idMatches) retrievedContextIds.push(...idMatches);
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
              let toolResultText = '';
              let isError = false;

              try {
                const outcome = await executeTool(supabase, toolName, toolArgs);
                toolResultText = outcome.content[0].text;
                isError = !!(outcome as any).isError;

                const idMatches = toolResultText.match(/[le]\d{10,}\w{0,4}/g);
                if (idMatches) retrievedContextIds.push(...idMatches);
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
        prompt_version: '1.1-registry',
        retrieved_context_ids: retrievedContextIds,
        tool_calls: toolCallsTracked,
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
            prompt_version: '1.1-registry',
            latency_ms: Date.now() - startTime,
            status: 'failed',
            error_message: errorMessage
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
          assistantResponse: msg?.content || null,
          latencyMs: telemetry.latency_ms
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
