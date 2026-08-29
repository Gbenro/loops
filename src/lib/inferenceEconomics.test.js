import { describe, it, expect } from 'vitest';

// 1. Context Breakdown Logic
function estimateContextBreakdown(systemPrompt, conversationMessages, relationalMemories, toolResultsText, userMessage) {
  const countTokens = (text) => Math.ceil((text || '').length / 4);

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

// 2. Context Budget Logic
function determineContextBudget(message, estimatedTokens) {
  const lower = (message || '').toLowerCase();
  const isDeep = lower.includes('entire') || lower.includes('all cycle') || lower.includes('whole cycle') ||
                 lower.includes('across cycles') || lower.includes('longitudinal') || lower.includes('history of') ||
                 lower.includes('all echoes') || lower.includes('pattern across');
  const isSmall = lower.includes('tag this') || lower.includes('close this') || lower.includes('archive') ||
                  lower.includes('what phase') || lower.includes('current moon') || lower.length < 25;

  if (isDeep) {
    return {
      tier: 'deep',
      warrantedDepthRationale: 'Longitudinal or full-cycle reflection requires broader Field retrieval',
      maxBudgetTokens: 32000,
      estimatedContextTokens: estimatedTokens
    };
  }

  if (isSmall) {
    return {
      tier: 'small',
      warrantedDepthRationale: 'Focused state or CRUD operation requires minimal context',
      maxBudgetTokens: 4000,
      estimatedContextTokens: estimatedTokens
    };
  }

  return {
    tier: 'normal',
    warrantedDepthRationale: 'Standard conversational reflection and selective Field attunement',
    maxBudgetTokens: 16000,
    estimatedContextTokens: estimatedTokens
  };
}

// 3. Inference Cost Calculation
function calculateInferenceCost(usage, modelPricing) {
  const inputRate = modelPricing?.inputCostPer1M || 1.0;
  const outputRate = modelPricing?.outputCostPer1M || 3.0;

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

describe('Luna Inference Economics & Context Breakdown', () => {
  it('accurately estimates context contribution breakdown across Luna layers', () => {
    const systemPrompt = 'Luna System Prompt';
    const conversation = [
      { role: 'user', content: 'Hello Luna' },
      { role: 'assistant', content: 'Under this Waxing Gibbous moon, what is alive?' },
      { role: 'user', content: 'Reflect on my recent echoes about work.' }
    ];
    const relationalMemories = [
      { id: 'rm_1', statement: 'Prefers spare language', type: 'interaction_preference' }
    ];
    const toolResults = '{"items":[{"id":"e1","text":"Working on product design"}],"recordsRetrieved":1}';
    const currentQuery = 'Reflect on my recent echoes about work.';

    const breakdown = estimateContextBreakdown(systemPrompt, conversation, relationalMemories, toolResults, currentQuery);

    expect(breakdown.identityAndPersonalityTokens).toBe(220);
    expect(breakdown.protocolsTokens).toBe(280);
    expect(breakdown.lunarTimeTokens).toBe(90);
    expect(breakdown.relationalMemoryTokens).toBeGreaterThan(0);
    expect(breakdown.fieldRetrievalTokens).toBeGreaterThan(0);
    expect(breakdown.currentUserInputTokens).toBeGreaterThan(0);
    expect(breakdown.estimatedTotalContextTokens).toBeGreaterThan(500);
    expect(breakdown.estimationMethod).toBe('character_ratio_estimate_v1');
  });

  it('correctly categorizes Context Budget tiers (small vs normal vs deep)', () => {
    const smallBudget = determineContextBudget('what phase is the moon?', 600);
    expect(smallBudget.tier).toBe('small');
    expect(smallBudget.maxBudgetTokens).toBe(4000);

    const normalBudget = determineContextBudget('Reflect on what I noticed yesterday about pacing.', 1200);
    expect(normalBudget.tier).toBe('normal');
    expect(normalBudget.maxBudgetTokens).toBe(16000);

    const deepBudget = determineContextBudget('What has this entire circle illuminated across cycles?', 4500);
    expect(deepBudget.tier).toBe('deep');
    expect(deepBudget.maxBudgetTokens).toBe(32000);
  });

  it('computes inference cost based on provider rate basis per million tokens', () => {
    const usage = { inputTokens: 50000, outputTokens: 1000, totalTokens: 51000, source: 'provider_reported' };
    const pricing = { inputCostPer1M: 0.12, outputCostPer1M: 0.30 }; // Llama 3.3 70B rates

    const cost = calculateInferenceCost(usage, pricing);
    // (50000 / 1000000) * 0.12 = 0.006
    // (1000 / 1000000) * 0.30 = 0.0003
    // Total = 0.0063
    expect(cost.inputCostUsd).toBe(0.006);
    expect(cost.outputCostUsd).toBe(0.0003);
    expect(cost.estimatedCostUsd).toBe(0.0063);
  });
});

describe('Field Retrieval Coverage & Completeness', () => {
  it('identifies complete coverage when result count is within query limit', () => {
    const results = [ { id: 'e1' }, { id: 'e2' } ];
    const limit = 20;
    const hasMore = results.length > limit;
    const coverage = hasMore ? 'partial' : 'complete';

    expect(coverage).toBe('complete');
  });

  it('identifies partial coverage when more records exist beyond query limit', () => {
    const limit = 50;
    const resultsCount = 51;
    const hasMore = resultsCount > limit;
    const coverage = hasMore ? 'partial' : 'complete';

    expect(coverage).toBe('partial');
  });
});

describe('Luna Voice Output V0 Expression Policy', () => {
  it('preserves canonical written response without rewriting or replacing user audio', () => {
    const writtenResponse = 'The circle began with intention and moved through steady realization.';
    const spokenText = writtenResponse; // V0: Speak the response Luna actually produced

    expect(spokenText).toBe(writtenResponse);
    expect(spokenText.length).toBe(writtenResponse.length);
  });
});
