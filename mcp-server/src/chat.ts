import { Express, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { executeTool, TOOL_DEFINITIONS_COMPAT, mapRelationalMemory } from './tools.js';
import { getSupabaseAnon } from './db.js';
import { getLunarData } from './lunar.js';
import { getTimeContext, TimeContext } from './time.js';
import { formatVoiceInputProvenance, synthesizeLunaVoice } from './voice.js';
import { resolveModel, getUserAllowedModels, MODEL_REGISTRY, DEFAULT_MODEL_KEY } from './models.js';

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

3. Relational Memory & Earned Relational Attunement:
   - Relational Memory is earned learning about how Luna and the user meet, explore, reflect, correct, or understand one another; ordinary biographical events, stories, and life experiences belong in the Field (Echoes/Loops), NOT relational memory.
   - Memory informs recognition; it does not require expression. Luna can remember something without mentioning it. Never force catchphrases or parrot remembered phrases into conversations where they don't belong.
   - Quiet Autonomous Maintenance (No User Maintenance Required):
     * When the user expresses an explicit durable interaction preference, boundary, or orientation for how they wish to interact with Luna (e.g., "Let what we genuinely learn about one another survive the conversation in which we learned it", "Speak directly without preamble", "I prefer short spare responses"), autonomously call \`propose_candidate_memory\` with \`provenance: 'explicit'\` and \`type: 'interaction_preference'\` or \`'orientation'\`. (This path activates immediately in code).
     * When a meaningful relational pattern or shared living distinction naturally emerges from conversational evidence, call \`propose_candidate_memory\` with \`provenance: 'observed'\` or \`'co_created'\` (starts as a candidate).
     * When recurring relational evidence matches an existing candidate or memory, call \`reinforce_relational_memory\` with the existing ID rather than creating a duplicate.
     * User corrections to how Luna should meet or address them are strong relational evidence.
     * Maintain relational memories quietly during normal dialogue without forcing the user to say "save this as a memory" or behaving like a database clerk.
   - Epistemic Restraint: Do not turn every casual remark or profound life thought into a relational memory. Preserve earned significance and high signal.

4. Tool-Use & Persistence Invariant:
   - Read liberally: Search loops, echoes, and relational memories whenever you need context.
   - Write on user directive for Field records:
     * CONVERSE when they share an experience, feeling, or reflection without asking to record it.
     * WRITE whenever the user asks, directs, or hints to save, record, add, or remember a Field entry (e.g. "Save this", "Add this as a reflection", "Keep this intentional reflection", "Record this", "Create a loop", "Save my intention", "Add to my echoes", "Mark complete", "Archive").
     * When saving an insight, synthesis, or intentional reflection born out of dialogue, ALWAYS call \`create_conversation_reflection\`.
     * When recording a direct user observation or raw personal note, call \`create_echo\`.
     * When attaching a reflection to a specific existing echo, call \`attach_reflection\`.
   - Quiet Relational Maintenance:
     * Relational memory maintenance (\`propose_candidate_memory\`, \`reinforce_relational_memory\`) operates quietly in the background on genuine relational evidence without requiring explicit user save commands.
   - STRICT TOOL TRUTHFULNESS & NON-SIMULATION INVARIANT:
     * NEVER say "Done", "Saved", "Added to your reflections", "Recorded", "Held in your loops", or format fake database tags (e.g. [reflection], [intentional]) in plain text UNLESS the corresponding database mutation tool call (\`create_conversation_reflection\`, \`create_echo\`, \`create_loop\`, etc.) actually executed successfully in this turn.
     * If you did NOT execute a database tool, or if the tool call failed, NEVER simulate persistence. Openly acknowledge the conversation without falsely claiming a record was saved to the database.

5. Epistemic Restraint & Retrieval Coverage Constraints:
   - Observed Recurrence vs Exhaustive Truth:
     * An observed recurrence across retrieved notes is an empirical observation of past mentions, NOT an absolute law, destiny, or causal certainty.
     * Never declare exhaustive claims such as "Every single waxing crescent...", "The record proves you...", "You've just lived the proof", or "The pattern, validated".
   - Partial Coverage Softening:
     * When evaluating longitudinal searches or phase patterns where retrieval returned a partial sample (or hasMore is true), ALWAYS explicitly soften your claims to reflect the sample:
       "Across the records retrieved...", "A strong recurring pattern appears in these notes...", "In most of the retrieved examples...".
     * Never turn recurrence into lunar causation (e.g. do not state "the phase is working as designed" or make predictive assertions about what future phases will do).
   - Provenance Boundary (Conversational Context ≠ Field Fact):
     * Conversation context alone cannot establish database completeness, total record counts, or historical extent.
     * If you have NOT performed a retrieval search to establish the database record count or historical range, do NOT assert claims that depend on database completeness (e.g. "across five cycles of lived data", "in all your recorded history", "the only time you noted this", "your earliest record").
     * If referencing items discussed earlier in the chat without an empirical Field search, explicitly ground the claim in conversational provenance: "Across the five cycles we've been discussing...", "In the examples we walked through earlier...".
     * Only make claims about database extent or complete history when you have actually executed a Field retrieval sufficient to verify that fact.
    - Conversational Aperture & Resonance:
      * Good reflection creates conditions for reflection to continue unfolding rather than resolving and shutting down the inquiry.
      * Operational completion ≠ conversational completion: when performing a save, tag, or reflection attachment, acknowledge the action while continuing warm, open resonance without collapsing into a database clerk.`;
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

// ─── Context Breakdown & Budget Helpers ─────────────────────────────────────

export interface ContextBreakdown {
  identityAndPersonalityTokens: number;
  protocolsTokens: number;
  conversationContextTokens: number;
  fieldRetrievalTokens: number;
  relationalMemoryTokens: number;
  lunarTimeTokens: number;
  toolResultsTokens: number;
  currentUserInputTokens: number;
  estimatedTotalContextTokens: number;
  estimationMethod: 'character_ratio_estimate_v1';
}

export function estimateContextBreakdown(
  systemPrompt: string,
  conversationMessages: any[],
  relationalMemories: any[],
  toolResultsText: string,
  userMessage: string
): ContextBreakdown {
  const countTokens = (text: string) => Math.ceil((text || '').length / 4);

  const identityAndPersonalityTokens = 220;
  const protocolsTokens = 280;
  const lunarTimeTokens = 90;
  const relationalMemoryTokens = relationalMemories.length > 0
    ? countTokens(JSON.stringify(relationalMemories))
    : 0;
  const conversationContextTokens = countTokens(
    conversationMessages.slice(0, -1).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join(' ')
  );
  const currentUserInputTokens = countTokens(userMessage);
  const toolResultsTokens = countTokens(toolResultsText);
  const fieldRetrievalTokens = toolResultsTokens > 0 ? Math.round(toolResultsTokens * 0.8) : 0;

  const estimatedTotalContextTokens =
    identityAndPersonalityTokens +
    protocolsTokens +
    lunarTimeTokens +
    relationalMemoryTokens +
    conversationContextTokens +
    currentUserInputTokens +
    toolResultsTokens;

  return {
    identityAndPersonalityTokens,
    protocolsTokens,
    conversationContextTokens,
    fieldRetrievalTokens,
    relationalMemoryTokens,
    lunarTimeTokens,
    toolResultsTokens,
    currentUserInputTokens,
    estimatedTotalContextTokens,
    estimationMethod: 'character_ratio_estimate_v1'
  };
}

export interface ContextBudget {
  tier: 'small' | 'normal' | 'deep';
  warrantedDepthRationale: string;
  targetContextBudget: number;      // Target guidance: "How much context would we normally expect this inquiry to need?"
  actualContextUsed: number;        // What this inquiry actually required
  modelContextLimit: number;        // Physical/API constraint of the chosen model
  exceededTarget: boolean;          // Elastic indicator
  expansionReason?: string | null;  // Evidence-driven expansion rationale
  elasticPolicy: 'fidelity_first_observability';
}

export function determineContextBudget(
  message: string,
  actualTokens: number,
  modelContextLimit: number = 128000,
  hasExpandedFieldRetrieval: boolean = false
): ContextBudget {
  const lower = (message || '').toLowerCase();
  const isDeep = lower.includes('entire') || lower.includes('all cycle') || lower.includes('whole cycle') ||
                 lower.includes('across cycles') || lower.includes('longitudinal') || lower.includes('history of') ||
                 lower.includes('all echoes') || lower.includes('pattern across');
  const isSmall = lower.includes('tag this') || lower.includes('close this') || lower.includes('archive') ||
                  lower.includes('what phase') || lower.includes('current moon') || (lower.length < 25 && !hasExpandedFieldRetrieval);

  let tier: 'small' | 'normal' | 'deep' = 'normal';
  let targetContextBudget = 16000;
  let warrantedDepthRationale = 'Standard conversational reflection and selective Field attunement';

  if (isDeep) {
    tier = 'deep';
    targetContextBudget = 32000;
    warrantedDepthRationale = 'Longitudinal or full-cycle reflection expected to need broader Field retrieval';
  } else if (isSmall) {
    tier = 'small';
    targetContextBudget = 4000;
    warrantedDepthRationale = 'Focused state or CRUD operation expected to need minimal context';
  }

  const exceededTarget = actualTokens > targetContextBudget;
  let expansionReason: string | null = null;
  if (exceededTarget) {
    expansionReason = hasExpandedFieldRetrieval
      ? 'Relevant Field retrieval required additional empirical evidence'
      : 'Conversational depth naturally expanded context beyond baseline target';
  }

  return {
    tier,
    warrantedDepthRationale,
    targetContextBudget,
    actualContextUsed: actualTokens,
    modelContextLimit,
    exceededTarget,
    expansionReason,
    elasticPolicy: 'fidelity_first_observability'
  };
}

export interface TokenUsageReport {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens: number;
  source: 'provider_reported' | 'estimated';
}

export interface InferenceCostReport {
  estimatedCostUsd: number;
  inputCostUsd: number;
  outputCostUsd: number;
  rateBasisPer1M: {
    input: number;
    output: number;
  };
}

export function calculateInferenceCost(usage: TokenUsageReport, modelConfig: any): InferenceCostReport {
  const inputRate = modelConfig?.pricing?.inputCostPer1M || 1.0;
  const outputRate = modelConfig?.pricing?.outputCostPer1M || 3.0;

  const inputCost = (usage.inputTokens / 1000000) * inputRate;
  const outputCost = (usage.outputTokens / 1000000) * outputRate;
  const totalCost = Number((inputCost + outputCost).toFixed(6));

  return {
    estimatedCostUsd: totalCost,
    inputCostUsd: Number(inputCost.toFixed(6)),
    outputCostUsd: Number(outputCost.toFixed(6)),
    rateBasisPer1M: {
      input: inputRate,
      output: outputRate
    }
  };
}

export type OperationClass = 'conversation' | 'field_lookup' | 'longitudinal_synthesis' | 'crud_mutation' | 'relational_memory' | 'deep_reflection';

export function classifyOperation(toolCalls: any[], message: string, fieldCoverage?: any): OperationClass {
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

export function extractDatabaseMutation(toolName: string, toolArgs: any, parsedResult: any): any | null {
  if (!parsedResult || typeof parsedResult !== 'object') return null;

  // 1. Reflection Attachment
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

  // 2. Echo CRUD
  if (toolName === 'create_echo' || toolName === 'create_entry') {
    return {
      operation: 'create',
      entityType: 'echo',
      entityId: parsedResult.id,
      tags: parsedResult.tags || toolArgs.tags,
      loopIds: parsedResult.loopIds || toolArgs.loopIds,
      table: 'echoes',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'update_echo') {
    return {
      operation: 'update',
      entityType: 'echo',
      entityId: parsedResult.id || toolArgs.id,
      tags: parsedResult.tags || toolArgs.tags,
      loopIds: parsedResult.loopIds || toolArgs.loopIds,
      table: 'echoes',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'archive_echo') {
    return {
      operation: 'archive',
      entityType: 'echo',
      entityId: parsedResult.id || toolArgs.id,
      table: 'echoes',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'restore_echo') {
    return {
      operation: 'restore',
      entityType: 'echo',
      entityId: parsedResult.id || toolArgs.id,
      table: 'echoes',
      timestamp: new Date().toISOString()
    };
  }

  // 3. Loop CRUD
  if (toolName === 'create_loop') {
    return {
      operation: 'create',
      entityType: 'loop',
      entityId: parsedResult.id,
      title: parsedResult.title || toolArgs.title,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'update_loop') {
    return {
      operation: 'update',
      entityType: 'loop',
      entityId: parsedResult.id || toolArgs.id,
      title: parsedResult.title || toolArgs.title,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'close_loop') {
    return {
      operation: 'close',
      entityType: 'loop',
      entityId: parsedResult.id || toolArgs.id,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'reopen_loop') {
    return {
      operation: 'reopen',
      entityType: 'loop',
      entityId: parsedResult.id || toolArgs.id,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'archive_loop') {
    return {
      operation: 'archive',
      entityType: 'loop',
      entityId: parsedResult.id || toolArgs.id,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'restore_loop') {
    return {
      operation: 'restore',
      entityType: 'loop',
      entityId: parsedResult.id || toolArgs.id,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'carry_loop_forward') {
    return {
      operation: 'carry_forward',
      entityType: 'loop',
      entityId: parsedResult.id,
      oldLoopId: toolArgs.id,
      table: 'loops',
      timestamp: new Date().toISOString()
    };
  }

  // 4. Threads
  if (toolName === 'create_thread') {
    return {
      operation: 'create',
      entityType: 'thread',
      entityId: parsedResult.id,
      title: parsedResult.title || toolArgs.title,
      table: 'threads',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'update_thread') {
    return {
      operation: 'update',
      entityType: 'thread',
      entityId: parsedResult.id || toolArgs.id,
      table: 'threads',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'connect_echo_to_thread') {
    return {
      operation: 'connect',
      entityType: 'echo_thread',
      echoId: toolArgs.echoId,
      threadId: toolArgs.threadId,
      table: 'echo_threads',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'disconnect_echo_from_thread') {
    return {
      operation: 'disconnect',
      entityType: 'echo_thread',
      echoId: toolArgs.echoId,
      threadId: toolArgs.threadId,
      table: 'echo_threads',
      timestamp: new Date().toISOString()
    };
  }

  // 5. Relational Memories
  if (toolName === 'propose_candidate_memory') {
    return {
      operation: 'create',
      entityType: 'relational_memory',
      entityId: parsedResult.id,
      statement: parsedResult.statement || toolArgs.statement,
      type: parsedResult.type || toolArgs.type,
      table: 'relational_memories',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'reinforce_relational_memory') {
    return {
      operation: 'update',
      entityType: 'relational_memory',
      entityId: parsedResult.id || toolArgs.id,
      table: 'relational_memories',
      timestamp: new Date().toISOString()
    };
  }
  if (toolName === 'update_relational_memory_status') {
    return {
      operation: 'update',
      entityType: 'relational_memory',
      entityId: parsedResult.id || toolArgs.id,
      table: 'relational_memories',
      timestamp: new Date().toISOString()
    };
  }

  return null;
}

// ─── Provider Orchestration Adapters ────────────────────────────────────────

// Inference timeout: prevents indefinite hangs when upstream providers stall.
// Reasoning models (DeepSeek, o-series) may take 30-60s; 90s provides headroom.
const INFERENCE_TIMEOUT_MS = 90_000;

// 1. Anthropic Claude Adapter
async function callClaude(modelId: string, messages: any[], systemPrompt: string, tools: any[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured on server');

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
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
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Anthropic inference timeout after ${INFERENCE_TIMEOUT_MS / 1000}s for model ${modelId}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// 2. OpenAI Compatible Adapter
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
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
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`OpenAI inference timeout after ${INFERENCE_TIMEOUT_MS / 1000}s for model ${modelId}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// 3. OpenRouter Adapter
async function callOpenRouter(modelId: string, messages: any[], systemPrompt: string, tools: any[]): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured on server');

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://lunaloops.app',
        'X-Title': 'Luna Loops',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: formattedMessages,
        tools: tools.length > 0 ? tools : undefined
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`OpenRouter inference timeout after ${INFERENCE_TIMEOUT_MS / 1000}s for model ${modelId}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// 4. Google Gemini Adapter
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
      parts: [{ text: m.content || ' ' }]
    };
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
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
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Gemini inference timeout after ${INFERENCE_TIMEOUT_MS / 1000}s for model ${modelId}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Route Registration ─────────────────────────────────────────────────────

export function registerChatRoutes(app: Express, authenticateRest: any, authenticateRestOptional?: any) {
  const authOpt = authenticateRestOptional || authenticateRest;

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

  // 2. GET /api/chat/sessions - Lists continuous chat sessions (active, archived, or all)
  app.get('/api/chat/sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { status = 'active', archived, limit = 50 } = req.query;
    const maxLimit = Math.min(Number(limit) || 50, 100);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      let query = supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(maxLimit);

      if (status === 'archived' || archived === 'true') {
        query = query.or('is_archived.eq.true,archived_at.not.is.null');
      } else if (status === 'all') {
        // Return all sessions regardless of archive status
      } else {
        // Default: active sessions only
        query = query.or('is_archived.is.null,is_archived.eq.false');
      }

      let { data, error } = await query;
      if (error) {
        // Fallback for database schema missing archive columns
        const fallback = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(maxLimit);
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }

      let sessions = data || [];
      if (status === 'archived' || archived === 'true') {
        sessions = sessions.filter((s: any) => s.is_archived === true || s.is_archived === 'true' || s.archived_at);
      } else if (status !== 'all') {
        // Default: active sessions only - robustly exclude archived sessions
        sessions = sessions.filter((s: any) => !s.is_archived && !s.archived_at);
      }

      res.json({ sessions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2b. POST /api/chat/sessions - Explicitly creates a new active chat session
  app.post('/api/chat/sessions', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { title, modelKey } = req.body || {};
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const newSessionId = generateId('session');
      const resolved = await resolveModel(modelKey || DEFAULT_MODEL_KEY, user.id);
      const sessionTitle = title?.trim() || 'Continuous Reflection';

      let { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          id: newSessionId,
          user_id: user.id,
          title: sessionTitle,
          model_key: resolved.key,
          is_archived: false,
          archived_at: null
        })
        .select()
        .single();

      if (error) {
        const retry = await supabase
          .from('chat_sessions')
          .insert({
            id: newSessionId,
            user_id: user.id,
            title: sessionTitle,
            model_key: resolved.key
          })
          .select()
          .single();
        if (retry.error) {
          const baseRetry = await supabase
            .from('chat_sessions')
            .insert({
              id: newSessionId,
              user_id: user.id,
              title: sessionTitle
            })
            .select()
            .single();
          if (baseRetry.error) throw baseRetry.error;
          data = baseRetry.data;
        } else {
          data = retry.data;
        }
      }

      res.status(201).json({ session: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/chat/sessions/:id - Get specific session and message history with telemetry
  app.get('/api/chat/sessions/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: session, error: sError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', user.id)
        .single();

      if (sError || !session) throw new Error('Session not found or unauthorized');

      const { data: messages, error: mError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', req.params.id)
        .order('created_at', { ascending: true });

      if (mError) throw mError;

      // Join with telemetry traces if available
      const messageIds = (messages || []).map(m => m.id);
      const { data: telemetryList } = await supabase
        .from('chat_telemetry')
        .select('id, message_id, model, prompt_version, latency_ms, status, token_usage, inference_cost')
        .in('message_id', messageIds);

      const telMap = new Map((telemetryList || []).map(t => [t.message_id, t]));
      const messagesWithTelemetry = (messages || []).map(m => ({
        ...m,
        telemetry: telMap.get(m.id) || null
      }));

      res.json({ session, messages: messagesWithTelemetry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3b. PATCH /api/chat/sessions/:id - Update session title (rename), model, or archive/restore status
  app.patch(['/api/chat/sessions/:id/model', '/api/chat/sessions/:id'], authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { modelKey, title, isArchived, archived, archivedAt } = req.body;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const updates: any = { updated_at: new Date().toISOString() };
      if (modelKey) {
        const resolved = await resolveModel(modelKey, user.id);
        updates.model_key = resolved.key;
      }
      if (typeof title === 'string') {
        updates.title = title.trim();
      }
      if (typeof isArchived === 'boolean' || typeof archived === 'boolean') {
        const shouldArchive = typeof isArchived === 'boolean' ? isArchived : archived;
        updates.is_archived = shouldArchive;
        updates.archived_at = shouldArchive ? (archivedAt || new Date().toISOString()) : null;
      }

      let { data, error } = await supabase
        .from('chat_sessions')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error && (updates.is_archived !== undefined || updates.archived_at !== undefined)) {
        // Retry without archive columns if database lacks them
        delete updates.is_archived;
        delete updates.archived_at;
        const retry = await supabase
          .from('chat_sessions')
          .update(updates)
          .eq('id', req.params.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (retry.error) throw retry.error;
        data = retry.data;
      } else if (error) {
        throw error;
      }

      if (!data) throw new Error(`Update failed: Session with ID "${req.params.id}" not found or unauthorized.`);
      res.json({ session: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3c. DELETE /api/chat/sessions/:id - Deliberate permanent deletion of a session
  app.delete('/api/chat/sessions/:id', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: existing, error: findErr } = await supabase
        .from('chat_sessions')
        .select('id, title')
        .eq('id', req.params.id)
        .eq('user_id', user.id)
        .single();

      if (findErr || !existing) {
        return res.status(404).json({ error: 'Chat session not found or unauthorized' });
      }

      const { error: delErr } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', user.id);

      if (delErr) throw delErr;
      res.json({ success: true, deletedSessionId: req.params.id, title: existing.title });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3d. POST /api/chat/sessions/:id/preserve-to-field - Preserve key material/reflection to Field (Echo)
  app.post(['/api/chat/sessions/:id/preserve-to-field', '/api/chat/sessions/:id/preserve'], authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { customText, tags = ['chat-reflection'] } = req.body || {};
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: session, error: sErr } = await supabase
        .from('chat_sessions')
        .select('id, title')
        .eq('id', req.params.id)
        .eq('user_id', user.id)
        .single();

      if (sErr || !session) return res.status(404).json({ error: 'Session not found or unauthorized' });

      let echoText = customText?.trim();
      if (!echoText) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', req.params.id)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          const turns = msgs.map(m => `${m.role === 'user' ? 'You' : 'Luna'}: ${m.content}`);
          const full = turns.join('\n\n');
          const formatted = full.length > 6000
            ? `...[Earlier conversation archived in session history]...\n\n` + turns.slice(-10).join('\n\n')
            : full;
          echoText = `Preserved Reflection from Chat "${session.title}":\n\n` + formatted;
        } else {
          echoText = `Preserved Reflection from Chat "${session.title}"`;
        }
      }

      const lunar = getLunarData();
      const echoId = generateId('e');
      let { data: newEcho, error: echoErr } = await supabase
        .from('echoes')
        .insert({
          id: echoId,
          user_id: user.id,
          text: echoText,
          source: 'chat_reflection',
          phase: lunar.phase.key,
          phase_name: lunar.phase.name,
          phase_type: lunar.phase.phaseType || null,
          lunar_month: lunar.lunarMonth,
          day_of_cycle: lunar.dayOfCycle,
          zodiac: lunar.zodiac.sign,
          illumination: lunar.illumination,
          tags: Array.isArray(tags) ? tags : ['chat-reflection'],
          provenance_author: 'user',
          provenance_kind: 'chat_reflection',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (echoErr) {
        // Fallback to core echoes columns
        const retry = await supabase
          .from('echoes')
          .insert({
            id: echoId,
            user_id: user.id,
            text: echoText,
            source: 'chat_reflection',
            phase: lunar.phase.key,
            phase_name: lunar.phase.name,
            phase_type: lunar.phase.phaseType || null,
            lunar_month: lunar.lunarMonth,
            day_of_cycle: lunar.dayOfCycle,
            zodiac: lunar.zodiac.sign,
            illumination: lunar.illumination,
            tags: Array.isArray(tags) ? tags : ['chat-reflection'],
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (retry.error) throw retry.error;
        newEcho = retry.data;
      }

      res.status(201).json({ success: true, echo: newEcho });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /api/chat/messages - Search conversation messages
  app.get('/api/chat/messages', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { query, limit = 50 } = req.query;

    try {
      let dbQuery = supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (query) {
        dbQuery = dbQuery.ilike('content', `%${query}%`);
      }

      const { data: messages, error } = await dbQuery;
      if (error) throw error;

      // Join with telemetry traces if available
      const messageIds = (messages || []).map(m => m.id);
      const { data: telemetryList } = await supabase
        .from('chat_telemetry')
        .select('id, message_id, model, prompt_version, latency_ms, status')
        .in('message_id', messageIds);

      const telMap = new Map((telemetryList || []).map(t => [t.message_id, t]));

      const messagesWithTelemetry = (messages || []).map(m => ({
        ...m,
        telemetry: telMap.get(m.id) || null
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
    let userMessageId: string | null = null;
    const telemetryId = generateId('trace');
    let status: 'success' | 'failed' = 'success';
    let errorMessage: string | null = null;
    let toolCallsTracked: any[] = [];
    let retrievedContextIds: string[] = [];
    let databaseMutationsTracked: any[] = [];
    let rawToolResultsAccumulated = '';
    let fieldCoverageData: any = { recordsMatched: 0, recordsRetrieved: 0, limit: 20, hasMore: false, coverage: 'none' };
    let tokenUsageReport: TokenUsageReport = { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: 'estimated' };
    let modelConfig: any;

    // Resolve user BEFORE try so catch block always has access for error telemetry
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      res.status(401).json({ error: 'User session not authenticated' });
      return;
    }

    try {

      // 2. Resolve Session ID and Session Model
      let currentSessionModel: string | undefined = undefined;
      if (!sessionId) {
        const { data: existingSessions } = await supabase
          .from('chat_sessions')
          .select('id, model_key')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existingSessions && existingSessions.length > 0) {
          sessionId = existingSessions[0].id;
          currentSessionModel = existingSessions[0].model_key;
        } else {
          sessionId = generateId('session');
        }
      } else {
        const { data: sessionRow } = await supabase
          .from('chat_sessions')
          .select('id, model_key')
          .eq('id', sessionId)
          .maybeSingle();
        if (sessionRow) {
          currentSessionModel = sessionRow.model_key;
        }
      }

      // 3. Resolve Model via Config Registry (Authoritative session model fallback)
      const requestedModelKey = modelKey || currentSessionModel || DEFAULT_MODEL_KEY;
      modelConfig = await resolveModel(requestedModelKey, user.id);
      const { provider, accessProvider, modelId, key: resolvedKey } = modelConfig;
      const targetProvider = accessProvider || provider;

      // Upsert / Persist session record with authoritative model_key
      const { data: existingSessionCheck } = await supabase
        .from('chat_sessions')
        .select('id, model_key')
        .eq('id', sessionId)
        .maybeSingle();

      if (!existingSessionCheck) {
        await supabase.from('chat_sessions').insert({
          id: sessionId,
          user_id: user.id,
          title: 'Continuous Reflection',
          model_key: resolvedKey
        });
      } else if (modelKey && existingSessionCheck.model_key !== resolvedKey) {
        // Explicit modelKey passed by user updates the session
        await supabase
          .from('chat_sessions')
          .update({ model_key: resolvedKey, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }

      // Save user message to database with input provenance
      userMessageId = generateId('msg');
      await supabase.from('chat_messages').insert({
        id: userMessageId,
        session_id: sessionId,
        user_id: user.id,
        role: 'user',
        content: message.trim(),
        input_type: inputType === 'voice' ? 'voice' : 'text',
        metadata: metadata || {}
      });

      // Load and normalize conversation history (collapse consecutive identical-role orphan turns)
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const rawHistory = history && history.length > 0 ? history : [{ role: 'user', content: message.trim() }];
      const cleanedHistory: Array<{ role: string; content: string }> = [];
      for (const h of rawHistory) {
        if (!h.content || !h.content.trim()) continue;
        const last = cleanedHistory[cleanedHistory.length - 1];
        if (last && last.role === h.role) {
          last.content = `${last.content}\n\n${h.content.trim()}`;
        } else {
          cleanedHistory.push({ role: h.role, content: h.content.trim() });
        }
      }

      const conversationMessages = cleanedHistory.length > 0 ? cleanedHistory : [{ role: 'user', content: message.trim() }];

      // 1. Authoritative Time Grounding (America/Chicago)
      const timeContext = getTimeContext('America/Chicago');

      // 2. Real-time Lunar Astronomical Data
      const lunar = getLunarData();

      // 3. Selective Relational Memories Attunement (Top 0–3 relevant)
      const memorySelection = await selectRelevantRelationalMemories(supabase, user.id, message, conversationMessages);

      // 4. Voice Input Provenance with character length
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
          rawToolResultsAccumulated += ' ' + toolResultText;

          // Parse retrieved IDs (including relational memories)
          const idMatches = toolResultText.match(/(?:rm_|rm|[le])\d{10,}\w{0,4}/g);
          if (idMatches) retrievedContextIds.push(...idMatches);

          // Extract database mutations and coverage metadata
          try {
            const parsed = JSON.parse(toolResultText);
            
            // Extract retrieval coverage
            if (parsed.recordsRetrieved !== undefined) {
              fieldCoverageData = {
                recordsMatched: parsed.recordsRetrieved + (parsed.hasMore ? 1 : 0),
                recordsRetrieved: parsed.recordsRetrieved,
                limit: parsed.limit || 20,
                hasMore: !!parsed.hasMore,
                coverage: parsed.coverage || (parsed.hasMore ? 'partial' : 'complete')
              };

              if (fieldCoverageData.coverage === 'partial' || fieldCoverageData.hasMore) {
                toolResultText += `\n\n[Coverage Note: Retrieval returned a partial sample of ${parsed.recordsRetrieved} records. Apply epistemic softening (e.g. "Across the records retrieved...", "A recurring pattern appears..."). Do not make absolute or exhaustive claims.]`;
              }
            }

            const mutation = extractDatabaseMutation(toolName, toolArgs, parsed);
            if (mutation) {
              databaseMutationsTracked.push(mutation);
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

      // Multi-step Tool Calling Loop (up to 8 steps for complex search + attach workflows)
      while (loopCount < 8) {
        if (targetProvider === 'anthropic') {
          const anthropicTools = getAnthropicTools();
          const response = await callClaude(modelId, agentMessages, systemPrompt, anthropicTools);

          // Extract token usage
          if (response.usage) {
            tokenUsageReport = {
              inputTokens: response.usage.input_tokens || 0,
              outputTokens: response.usage.output_tokens || 0,
              totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
              source: 'provider_reported'
            };
          }

          const toolUseBlocks = response.content?.filter((b: any) => b.type === 'tool_use') || [];
          const textBlocks = response.content?.filter((b: any) => b.type === 'text') || [];

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
        } else if (targetProvider === 'google') {
          const geminiTools = getGeminiTools();
          const response = await callGemini(modelId, agentMessages, systemPrompt, geminiTools);

          // Extract token usage
          if (response.usageMetadata) {
            tokenUsageReport = {
              inputTokens: response.usageMetadata.promptTokenCount || 0,
              outputTokens: response.usageMetadata.candidatesTokenCount || 0,
              totalTokens: response.usageMetadata.totalTokenCount || 0,
              source: 'provider_reported'
            };
          }

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
        } else if (targetProvider === 'openrouter') {
          // OpenRouter Adapter
          const openAiTools = getOpenAiTools();
          const responseMsg = await callOpenRouter(modelId, agentMessages, systemPrompt, openAiTools);

          // Extract token usage
          if (responseMsg.usage) {
            tokenUsageReport = {
              inputTokens: responseMsg.usage.prompt_tokens || 0,
              outputTokens: responseMsg.usage.completion_tokens || 0,
              cachedInputTokens: responseMsg.usage.prompt_tokens_details?.cached_tokens,
              reasoningTokens: responseMsg.usage.completion_tokens_details?.reasoning_tokens,
              totalTokens: responseMsg.usage.total_tokens || 0,
              source: 'provider_reported'
            };
          }

          const choice = responseMsg.choices?.[0];
          const messageObj = choice?.message;
          finalResponseText = messageObj?.content || '';
          const toolCalls = messageObj?.tool_calls;

          if (toolCalls && toolCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: finalResponseText,
              tool_calls: toolCalls
            });

            for (const call of toolCalls) {
              let toolArgs = {};
              try {
                toolArgs = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
              } catch {}

              console.log(`[Agent-OpenRouter] Calling tool: ${call.function.name}`, toolArgs);
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
        } else {
          // Default: OpenAI Compatible
          const openAiTools = getOpenAiTools();
          const responseMsg = await callGpt(modelId, agentMessages, systemPrompt, openAiTools);

          // Extract token usage
          if (responseMsg.usage) {
            tokenUsageReport = {
              inputTokens: responseMsg.usage.prompt_tokens || 0,
              outputTokens: responseMsg.usage.completion_tokens || 0,
              cachedInputTokens: responseMsg.usage.prompt_tokens_details?.cached_tokens,
              reasoningTokens: responseMsg.usage.completion_tokens_details?.reasoning_tokens,
              totalTokens: responseMsg.usage.total_tokens || 0,
              source: 'provider_reported'
            };
          }

          const choice = responseMsg.choices?.[0];
          const messageObj = choice?.message;
          finalResponseText = messageObj?.content || '';
          const openAiToolCalls = messageObj?.tool_calls;

          if (openAiToolCalls && openAiToolCalls.length > 0) {
            agentMessages.push({
              role: 'assistant',
              content: finalResponseText,
              tool_calls: openAiToolCalls
            });

            for (const call of openAiToolCalls) {
              let toolArgs = {};
              try {
                toolArgs = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;
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

      // Guarantee complete assistant response if response was empty or if loop exited right after tool calls
      if (!finalResponseText || !finalResponseText.trim()) {
        try {
          if (targetProvider === 'anthropic') {
            const finalResp = await callClaude(modelId, agentMessages, systemPrompt, []);
            const textBlocks = finalResp.content?.filter((b: any) => b.type === 'text') || [];
            if (textBlocks.length > 0) finalResponseText = textBlocks.map((b: any) => b.text).join('\n');
          } else if (targetProvider === 'google') {
            const finalResp = await callGemini(modelId, agentMessages, systemPrompt, []);
            const parts = finalResp.candidates?.[0]?.content?.parts || [];
            const textParts = parts.filter((p: any) => p.text);
            if (textParts.length > 0) finalResponseText = textParts.map((p: any) => p.text).join('\n');
          } else if (targetProvider === 'openrouter') {
            const finalResp = await callOpenRouter(modelId, agentMessages, systemPrompt, []);
            finalResponseText = finalResp.choices?.[0]?.message?.content || finalResp.choices?.[0]?.message?.reasoning_content || finalResp.choices?.[0]?.text || '';
          } else {
            const finalResp = await callGpt(modelId, agentMessages, systemPrompt, []);
            finalResponseText = finalResp.choices?.[0]?.message?.content || finalResp.choices?.[0]?.message?.reasoning_content || finalResp.choices?.[0]?.text || '';
          }
        } catch (postErr) {
          console.warn('[Post-tool completion fallback]:', postErr);
        }
      }

      // STRICT VALIDATION: Never persist an empty assistant response and never mark empty inference as successful
      if (!finalResponseText || !finalResponseText.trim()) {
        throw new Error('Model produced an empty response. Inference aborted without persisting an empty turn.');
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

      // Calculate context breakdown and context budget
      const contextBreakdown = estimateContextBreakdown(
        systemPrompt,
        conversationMessages,
        memorySelection.memoriesForPrompt,
        rawToolResultsAccumulated,
        message
      );
      const hasExpandedRetrieval = retrievedContextIds.length > 5 || fieldCoverageData.recordsRetrieved > 10;
      const contextBudget = determineContextBudget(
        message,
        contextBreakdown.estimatedTotalContextTokens,
        modelConfig?.contextWindow || 128000,
        hasExpandedRetrieval
      );

      // If token usage wasn't reported by provider, calculate fallback estimate
      if (tokenUsageReport.source === 'estimated') {
        tokenUsageReport = {
          inputTokens: contextBreakdown.estimatedTotalContextTokens,
          outputTokens: Math.ceil(finalResponseText.length / 4),
          totalTokens: contextBreakdown.estimatedTotalContextTokens + Math.ceil(finalResponseText.length / 4),
          source: 'estimated'
        };
      }

      // Calculate inference cost
      const inferenceCost = calculateInferenceCost(tokenUsageReport, modelConfig);

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

      // Update the early 'pending' telemetry trace with full observability data
      const latency = Date.now() - startTime;
      const operationClass = classifyOperation(toolCallsTracked, message, fieldCoverageData);

      await supabase.from('chat_telemetry').insert({
        id: telemetryId,
        message_id: assistantMessageId,
        session_id: sessionId,
        user_id: user.id,
        model: `${provider}:${modelId} (${resolvedKey})`,
        prompt_version: '1.4-observability',
        operation_class: operationClass,
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
        token_usage: tokenUsageReport,
        inference_cost: inferenceCost,
        context_breakdown: contextBreakdown,
        context_budget: contextBudget,
        field_coverage: fieldCoverageData,
        voice_output: {
          playbackRequested: false,
          ttsProvider: 'none',
          status: 'idle'
        },
        latency_ms: latency,
        status: 'success'
      });

      // Update session timestamp
      await supabase.from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      res.json({
        sessionId,
        modelKey: resolvedKey,
        reply: finalResponseText.trim(),
        userMessageId,
        assistantMessageId,
        message: {
          id: assistantMessageId,
          role: 'assistant',
          content: finalResponseText.trim(),
          createdAt: new Date().toISOString()
        },
        telemetryId,
        traceId: telemetryId
      });
    } catch (err: any) {
      status = 'failed';
      errorMessage = err.message;
      console.error('[Orchestration loop failure]:', err);

      try {
        const timeCtx = getTimeContext('America/Chicago');
        const lunarCtx = getLunarData();
        await supabase.from('chat_telemetry').insert({
          id: telemetryId,
          message_id: userMessageId || null,
          session_id: sessionId || null,
          user_id: user?.id,
          model: modelConfig ? `${modelConfig.provider}:${modelConfig.modelId} (${modelConfig.key})` : 'unknown',
          prompt_version: '1.4-observability',
          operation_class: 'conversation',
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
      } catch (telErr) {
        console.error('[Failed to insert error telemetry]:', telErr);
      }

      res.status(500).json({
        error: err.message,
        userMessageId,
        telemetryId,
        status: 'failed'
      });
    }
  });

  // 5b. GET /api/chat/voices - List available TTS voices and playground options
  app.get('/api/chat/voices', authOpt, async (req: Request, res: Response) => {
    const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || process.env.XI_API_KEY);
    res.json({
      defaultVoice: 'af_nova',
      defaultProvider: 'openrouter',
      hasElevenLabsConfigured: hasElevenLabs,
      voices: [
        {
          id: 'luna-default',
          name: 'Luna Default (Kokoro · af_nova)',
          provider: 'openrouter',
          model: 'hexgrad/kokoro-82m',
          voiceId: 'af_nova',
          description: 'Contemplative, grounded, and poetic baseline'
        },
        {
          id: 'eleven-rachel',
          name: 'ElevenLabs — Rachel',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          description: 'Calm, thoughtful, and natural'
        },
        {
          id: 'eleven-bella',
          name: 'ElevenLabs — Bella',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voiceId: 'EXAVITQu4vr4xnSDxMaL',
          description: 'Warm, expressive, and gentle'
        },
        {
          id: 'eleven-antoni',
          name: 'ElevenLabs — Antoni',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voiceId: 'ErXwobaYiN019PkySvjV',
          description: 'Well-rounded, modulated, and narrative'
        },
        {
          id: 'eleven-nicole',
          name: 'ElevenLabs — Nicole',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voiceId: 'piTKgcLEGmPE4e6mEKli',
          description: 'Quiet, soft whisper, poetic cadence'
        },
        {
          id: 'eleven-adam',
          name: 'ElevenLabs — Adam',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voiceId: 'pNInz6obpgDQGcFmaJgB',
          description: 'Deep, resonant, grounded'
        },
        {
          id: 'browser-web-speech',
          name: 'Browser Native Web Speech',
          provider: 'web_speech',
          model: 'browser-native',
          voiceId: 'default',
          description: 'Local browser speech synthesis benchmark'
        }
      ],
      models: [
        {
          id: 'eleven_flash_v2_5',
          name: 'Flash v2.5',
          tier: 'economy',
          costPer1kCharsUsd: 0.015,
          description: '50% cheaper, ultra-low latency, fast conversational synthesis'
        },
        {
          id: 'eleven_turbo_v2_5',
          name: 'Turbo v2.5',
          tier: 'standard',
          costPer1kCharsUsd: 0.03,
          description: 'Balanced latency and quality'
        },
        {
          id: 'eleven_multilingual_v2',
          name: 'Multilingual v2',
          tier: 'premium',
          costPer1kCharsUsd: 0.03,
          description: 'Flagship model with rich emotional prosody and expression'
        }
      ]
    });
  });

  // 6. POST /api/chat/synthesize-speech - Synthesize Luna voice output for an assistant response
  app.post('/api/chat/synthesize-speech', authOpt, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient || getSupabaseAnon();
    const { text, messageId, voiceId, model, provider, speed, segmentationMode } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text is required for voice synthesis' });
      return;
    }

    try {
      const result = await synthesizeLunaVoice({
        text,
        voiceId,
        model,
        provider,
        speed,
        segmentationMode
      });

      // Update telemetry trace for this message if messageId provided
      if (messageId) {
        try {
          const voiceStatus = result.success ? (result.useClientFallback ? 'fallback' : 'succeeded') : 'error';
          const voiceData = {
            playbackRequested: true,
            playbackMode: result.playbackMode || (result.useClientFallback ? 'web_speech' : 'provider_audio'),
            ttsProvider: result.provider,
            ttsModel: result.model,
            voiceId: result.voiceId,
            characterCount: result.characterCount,
            rawByteCount: result.rawByteCount || 0,
            packagedByteCount: result.packagedByteCount || result.byteCount || 0,
            byteCount: result.byteCount || 0,
            audioMime: result.contentType,
            audioDurationSec: result.audioDurationSec || 0,
            bytesPerSecond: result.bytesPerSecond || 0,
            bytesPerCharacter: result.bytesPerCharacter || 0,
            networkPayloadSizeBytes: result.networkPayloadSizeBytes || result.byteCount || 0,
            costPerSpokenMinuteUsd: result.costPerSpokenMinuteUsd || 0,
            synthesisLatencyMs: result.latencyMs,
            httpStatus: result.httpStatus || 200,
            requestId: result.requestId || null,
            estimatedCostUsd: result.estimatedCostUsd || 0,
            requestHandled: true,
            synthesisSucceeded: result.synthesisSucceeded,
            audioValidated: result.audioValidated,
            playbackStarted: false,
            playbackAdvanced: false,
            playbackCompleted: false,
            playbackSucceeded: false,
            status: voiceStatus,
            success: result.success,
            error: result.error || null,
            fallbackAttempted: !!result.useClientFallback,
            fallbackResult: result.useClientFallback ? 'client_web_speech' : null,
            cached: false
          };

          await supabase
            .from('chat_telemetry')
            .update({
              voice_output: voiceData,
              voice_feedback: {
                status: voiceStatus,
                playbackMode: voiceData.playbackMode,
                provider: result.provider,
                model: result.model,
                voiceId: result.voiceId,
                characterCount: result.characterCount,
                rawByteCount: result.rawByteCount || 0,
                packagedByteCount: result.packagedByteCount || result.byteCount || 0,
                audioDurationSec: result.audioDurationSec || 0,
                synthesisLatencyMs: result.latencyMs,
                requestId: result.requestId || null,
                estimatedCostUsd: result.estimatedCostUsd || 0,
                requestHandled: true,
                synthesisSucceeded: result.synthesisSucceeded,
                audioValidated: result.audioValidated,
                error: result.error || null,
                timestamp: new Date().toISOString()
              }
            })
            .or(`message_id.eq.${messageId},id.eq.${messageId}`);
        } catch (telErr) {
          console.warn('[Telemetry Voice Output Update error]:', telErr);
        }
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6b. POST /api/chat/telemetry/voice-feedback - Log client-side playback success or error
  app.post('/api/chat/telemetry/voice-feedback', authOpt, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient || getSupabaseAnon();
    const {
      messageId,
      event,
      provider,
      playbackMode,
      error,
      errorClass,
      currentTime,
      duration,
      paused,
      muted,
      volume,
      readyState,
      networkState,
      hasAdvancedAboveZero,
      playingTimestamp,
      firstAdvancedTimestamp,
      endedTimestamp,
      playbackDurationMs,
      browserVoiceName,
      localService
    } = req.body;

    if (!messageId) {
      res.status(400).json({ error: 'messageId is required' });
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('chat_telemetry')
        .select('voice_output, voice_feedback')
        .or(`message_id.eq.${messageId},id.eq.${messageId}`)
        .maybeSingle();

      const currentVoice = existing?.voice_output || {};
      const isStarted = event === 'playback_started' || !!currentVoice.playbackStarted;
      const isAdvanced = event === 'playback_advanced' || !!hasAdvancedAboveZero || !!currentVoice.playbackAdvanced || event === 'playback_ended';
      const isCompleted = event === 'playback_ended' || !!currentVoice.playbackCompleted;
      const isPaused = event === 'playback_paused';
      const isResumed = event === 'playback_resumed';
      const isStopped = event === 'playback_stopped';
      const isFailed = event === 'playback_failed';

      const playingTime = playingTimestamp || currentVoice.playingTimestamp || (isStarted ? new Date().toISOString() : null);
      const firstAdvTime = firstAdvancedTimestamp || currentVoice.firstAdvancedTimestamp || (isAdvanced ? (playingTime || new Date().toISOString()) : null);
      const endedTime = endedTimestamp || currentVoice.endedTimestamp || (isCompleted ? new Date().toISOString() : null);
      const resolvedDurationMs = playbackDurationMs || currentVoice.playbackDurationMs || (endedTime && playingTime ? Math.max(0, new Date(endedTime).getTime() - new Date(playingTime).getTime()) : null);

      const updatedVoice = {
        ...currentVoice,
        playbackRequested: true,
        playbackMode: playbackMode || currentVoice.playbackMode || (provider === 'web_speech' ? 'web_speech' : 'provider_audio'),
        clientEvent: event, // 'playback_started' | 'playback_advanced' | 'playback_paused' | 'playback_resumed' | 'playback_stopped' | 'playback_ended' | 'playback_failed'
        clientTtsProvider: provider || currentVoice.ttsProvider,
        playbackStarted: isStarted,
        playbackAdvanced: isAdvanced,
        playbackCompleted: isCompleted,
        playbackSucceeded: isCompleted || (isStarted && isAdvanced && !isFailed),
        playingTimestamp: playingTime,
        firstAdvancedTimestamp: firstAdvTime,
        endedTimestamp: endedTime,
        playbackDurationMs: resolvedDurationMs,
        clientError: error || null,
        clientErrorClass: errorClass || null,
        audioElementDiagnostics: {
          currentTime: currentTime !== undefined ? currentTime : null,
          duration: duration !== undefined ? duration : null,
          paused: paused !== undefined ? paused : (isPaused ? true : (isStarted ? false : null)),
          muted: muted !== undefined ? muted : null,
          volume: volume !== undefined ? volume : null,
          readyState: readyState !== undefined ? readyState : null,
          networkState: networkState !== undefined ? networkState : null,
          browserVoiceName: browserVoiceName || null,
          localService: localService !== undefined ? localService : null
        },
        status: isFailed ? 'error' : (isCompleted ? 'completed' : (isPaused ? 'paused' : (isStarted ? 'playing' : currentVoice.status || 'requested')))
      };

      const feedbackData = {
        event,
        playbackMode: updatedVoice.playbackMode,
        provider: provider || currentVoice.ttsProvider,
        playbackStarted: isStarted,
        playbackAdvanced: isAdvanced,
        playbackCompleted: isCompleted,
        playbackSucceeded: updatedVoice.playbackSucceeded,
        currentTime: currentTime !== undefined ? currentTime : null,
        duration: duration !== undefined ? duration : null,
        playbackDurationMs: resolvedDurationMs,
        error: error || null,
        errorClass: errorClass || null,
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('chat_telemetry')
        .update({
          voice_output: updatedVoice,
          voice_feedback: feedbackData
        })
        .or(`message_id.eq.${messageId},id.eq.${messageId}`);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6c. GET /api/chat/inference-summary - Aggregate cost and usage metrics for inference receipts
  app.get('/api/chat/inference-summary', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { sessionId, date } = req.query;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      let query = supabase
        .from('chat_telemetry')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionId) {
        query = query.eq('session_id', sessionId as string);
      }
      if (date) {
        query = query.gte('created_at', `${date}T00:00:00.000Z`).lte('created_at', `${date}T23:59:59.999Z`);
      }

      const { data: traces, error } = await query.limit(200);
      if (error) throw error;

      const items = traces || [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostUsd = 0;
      let totalLatencyMs = 0;
      let totalToolCalls = 0;
      const modelBreakdown: Record<string, { turns: number; costUsd: number; tokens: number }> = {};
      const operationBreakdown: Record<string, { count: number; costUsd: number }> = {};

      items.forEach(t => {
        const inTokens = t.token_usage?.inputTokens || 0;
        const outTokens = t.token_usage?.outputTokens || 0;
        const cost = t.inference_cost?.estimatedCostUsd || 0;
        const latency = t.latency_ms || 0;
        const tools = (t.tool_calls || []).length;
        const op = t.operation_class || 'conversation';
        const model = t.model || 'unknown';

        totalInputTokens += inTokens;
        totalOutputTokens += outTokens;
        totalCostUsd += cost;
        totalLatencyMs += latency;
        totalToolCalls += tools;

        if (!modelBreakdown[model]) {
          modelBreakdown[model] = { turns: 0, costUsd: 0, tokens: 0 };
        }
        modelBreakdown[model].turns += 1;
        modelBreakdown[model].costUsd += cost;
        modelBreakdown[model].tokens += (inTokens + outTokens);

        if (!operationBreakdown[op]) {
          operationBreakdown[op] = { count: 0, costUsd: 0 };
        }
        operationBreakdown[op].count += 1;
        operationBreakdown[op].costUsd += cost;
      });

      res.json({
        totalTurns: items.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        averageLatencyMs: items.length > 0 ? Math.round(totalLatencyMs / items.length) : 0,
        totalToolCalls,
        modelBreakdown,
        operationBreakdown,
        period: date ? `day:${date}` : (sessionId ? `session:${sessionId}` : 'recent_200_turns')
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });



  // 6f. GET /api/chat/messages - Search & filter chat messages
  app.get('/api/chat/messages', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const { sessionId, role, query } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      let dbQuery = supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sessionId) {
        dbQuery = dbQuery.eq('session_id', sessionId as string);
      }
      if (role) {
        dbQuery = dbQuery.eq('role', role as string);
      }
      if (query) {
        dbQuery = dbQuery.ilike('content', `%${query}%`);
      }

      const { data: messages, error } = await dbQuery;
      if (error) throw error;

      // Join with telemetry traces if available
      const messageIds = (messages || []).map(m => m.id);
      const { data: telemetryList } = await supabase
        .from('chat_telemetry')
        .select('id, message_id, model, prompt_version, latency_ms, status, token_usage, inference_cost')
        .in('message_id', messageIds);

      const telMap = new Map((telemetryList || []).map(t => [t.message_id, t]));

      const messagesWithTelemetry = (messages || []).map(m => ({
        ...m,
        telemetry: telMap.get(m.id) || null
      }));

      res.json({ messages: messagesWithTelemetry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. GET /api/chat/telemetry/:id, /api/chat/turns/:id, /api/chat/traces/:id - Modular turn trace bundle
  app.get(['/api/chat/telemetry/:id', '/api/chat/turns/:id', '/api/chat/traces/:id'], authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    try {
      const { data: telemetry, error: telError } = await supabase
        .from('chat_telemetry')
        .select('*')
        .or(`id.eq.${req.params.id},message_id.eq.${req.params.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
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
          traceId: telemetry.id,
          messageId: telemetry.message_id,
          userQuery: userMsg?.content || null,
          timeContext: telemetry.time_context || null,
          lunarContext: telemetry.lunar_context || null,
          relationalMemory: telemetry.relational_memory || null,
          voiceInput: telemetry.voice_input || null,
          protocols: telemetry.protocols || null,
          tokenUsage: telemetry.token_usage || null,
          inferenceCost: telemetry.inference_cost || null,
          contextBreakdown: telemetry.context_breakdown || null,
          contextBudget: telemetry.context_budget || null,
          fieldCoverage: telemetry.field_coverage || null,
          voiceOutput: telemetry.voice_output || null,
          voiceFeedback: telemetry.voice_feedback || null,
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

  // 8. GET /api/chat/evaluations - Retrieve audits
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

  // 9. POST /api/chat/evaluations - Log rubric audit
  app.post('/api/chat/evaluations', authenticateRest, async (req: Request, res: Response) => {
    const supabase: SupabaseClient = req.body.supabaseClient;
    const {
      telemetryId,
      groundingScore,
      observingVsInterpreting,
      earnedSignificance,
      writeRestraint,
      lunarRelevance,
      toolDiscipline,
      feedbackNotes
    } = req.body;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const evalId = generateId('eval');
      const { data, error } = await supabase
        .from('chat_evaluations')
        .insert({
          id: evalId,
          telemetry_id: telemetryId,
          user_id: user.id,
          grounding_score: groundingScore,
          observing_vs_interpreting: observingVsInterpreting,
          earned_significance: earnedSignificance,
          write_restraint: writeRestraint,
          lunar_relevance: lunarRelevance,
          tool_discipline: toolDiscipline,
          feedback_notes: feedbackNotes
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ evaluation: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
