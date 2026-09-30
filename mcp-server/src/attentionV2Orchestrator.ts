/**
 * Attention V1 ↔ V2 Seamless Integration Contract (Order 108 + Order 109 Elastic Budgeting)
 * Connects V2 perspective & evidence geometry planning to V1 bounded-context retrieval.
 * Flow: Inquiry -> V2 Evidence Plan -> Initial Adaptive Budget -> V1 Retrieval -> Coverage Evaluation -> Optional Budget Expansion -> Synthesis Calibration
 */

export const EVIDENCE_GEOMETRIES = [
  'current_state',
  'recurrence',
  'longitudinal_change',
  'origin',
  'comparison',
  'relationship',
  'open_loop',
  'contradiction',
  'convergence',
  'embodiment',
  'quieting_absence',
  'insufficient_evidence'
];

export const V1_FALLBACK_DEFAULT_PLAN = {
  evidenceGeometry: 'current_state',
  coverageStrategy: 'balanced',
  requireTemporalSpread: false,
  requireCounterevidence: false,
  initialBudget: 1500,
  initialEpistemicBudget: 1500,
  resourceCeiling: 12000,
  confidence: 0.5,
  isFallback: true
};

export function inferAttentionV2Plan(question: string, options: any = {}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    return { ...V1_FALLBACK_DEFAULT_PLAN };
  }

  const q = question.toLowerCase().trim();
  const resourceCeiling = options.resourceCeiling || 12000;

  let evidenceGeometry = 'current_state';
  let coverageStrategy: 'temporal_distribution' | 'longitudinal_span' | 'entity_cluster' | 'recurrence_deepening' | 'balanced' = 'balanced';
  let requireTemporalSpread = false;
  let requireCounterevidence = false;
  let initialEpistemicBudget = 1500;

  if (/^(hi|hello|hey|thanks|thank you)$/i.test(q) || q.length < 5) {
    evidenceGeometry = 'casual';
    coverageStrategy = 'balanced';
    initialEpistemicBudget = 500;
  } else if (/(shift|evolv|change|over time|across|grew|transform)/i.test(q)) {
    evidenceGeometry = 'longitudinal_change';
    coverageStrategy = 'longitudinal_span';
    requireTemporalSpread = true;
    initialEpistemicBudget = 3500;
  } else if (/(repeat|recur|pattern|keep|often|always|habit)/i.test(q)) {
    evidenceGeometry = 'recurrence';
    coverageStrategy = 'recurrence_deepening';
    initialEpistemicBudget = 2500;
  } else if (/(where|origin|start|root|begin|first|source)/i.test(q)) {
    evidenceGeometry = 'origin';
    coverageStrategy = 'longitudinal_span';
    requireTemporalSpread = true;
    initialEpistemicBudget = 3500;
  } else if (/(compare|contrast|versus|vs|between|different)/i.test(q)) {
    evidenceGeometry = 'comparison';
    coverageStrategy = 'temporal_distribution';
    requireTemporalSpread = true;
    initialEpistemicBudget = 2500;
  } else if (/(alex|studio|book|editorial|partnership|collaborat)/i.test(q)) {
    evidenceGeometry = 'relationship';
    coverageStrategy = 'entity_cluster';
    initialEpistemicBudget = 2500;
  } else if (/(open|unresolved|unfinished|stuck|pending|block)/i.test(q)) {
    evidenceGeometry = 'open_loop';
    coverageStrategy = 'recurrence_deepening';
    requireCounterevidence = true;
    initialEpistemicBudget = 2500;
  }

  return {
    evidenceGeometry,
    coverageStrategy,
    requireTemporalSpread,
    requireCounterevidence,
    initialBudget: initialEpistemicBudget,
    initialEpistemicBudget,
    resourceCeiling,
    confidence: 0.95,
    isFallback: false
  };
}

/**
 * Executes the seamless Attention V1 ↔ V2 pipeline with dynamic budget expansion.
 * Reuses V1 bounded retrieval engine while evaluating coverage obligations and performing expansion steps.
 */
export async function executeSeamlessAttentionPipeline(question: string, options: any = {}, engine: any = null) {
  const v2Plan = inferAttentionV2Plan(question, options);
  const resourceCeiling = options.resourceCeiling || v2Plan.resourceCeiling || 12000;

  let currentBudget = v2Plan.initialEpistemicBudget;
  let v1Result: any = null;
  let expansionsPerformed = 0;
  const coverageGainedAtEachExpansion: any[] = [];
  let stoppingReason = 'Initial retrieval complete';

  if (engine && typeof engine.planAndAssemble === 'function') {
    let prevItemsCount = 0;

    while (currentBudget <= resourceCeiling) {
      const stepResult = await engine.planAndAssemble(question, {
        tokenBudget: currentBudget,
        coverageStrategy: v2Plan.coverageStrategy
      });
      v1Result = stepResult;

      const items = stepResult.contextPacket?.evidenceItems || [];
      const obligations = stepResult.plan?.coverageMatrix?.obligations || [];
      const satisfiedCount = obligations.filter((o: any) => o.status === 'satisfied').length;
      const allSatisfied = obligations.length > 0 && satisfiedCount === obligations.length;

      const gain = items.length - prevItemsCount;
      const gainPct = prevItemsCount > 0 ? Math.round(((gain) / prevItemsCount) * 100) : (items.length > 0 ? 100 : 0);

      coverageGainedAtEachExpansion.push({
        step: expansionsPerformed + 1,
        budget: currentBudget,
        tokensUsed: stepResult.contextPacket?.totalTokensUsed || 0,
        itemsCount: items.length,
        obligationsSatisfied: satisfiedCount,
        obligationsTotal: obligations.length,
        allObligationsSatisfied: allSatisfied,
        gainCount: gain,
        gainPct
      });

      // Coverage expansion evaluation rule:
      // If obligations remain unsatisfied AND we have not hit resourceCeiling AND new items were discovered, expand budget.
      if (!allSatisfied && obligations.length > 0 && currentBudget < resourceCeiling && gain > 0 && expansionsPerformed < 3) {
        const nextBudget = Math.min(resourceCeiling, currentBudget + 2000);
        if (nextBudget > currentBudget) {
          currentBudget = nextBudget;
          expansionsPerformed++;
          prevItemsCount = items.length;
          continue;
        }
      }

      if (allSatisfied) {
        stoppingReason = 'All coverage obligations satisfied';
      } else if (currentBudget >= resourceCeiling) {
        stoppingReason = `Resource ceiling (${resourceCeiling} tokens) reached`;
      } else if (gain === 0 && expansionsPerformed > 0) {
        stoppingReason = 'Candidate recall saturated';
      }
      break;
    }
  }

  const evidenceItems = v1Result?.contextPacket?.evidenceItems || [];
  const hasItems = evidenceItems.length > 0;
  const obligations = v1Result?.plan?.coverageMatrix?.obligations || [];
  const satisfiedCount = obligations.filter((o: any) => o.status === 'satisfied').length;
  const allObligationsSatisfied = obligations.length > 0 && satisfiedCount === obligations.length;

  let epistemicSufficiencyStatus: 'SATISFIED' | 'INSUFFICIENT_EVIDENCE' | 'PARTIAL' = 'INSUFFICIENT_EVIDENCE';
  if (hasItems) {
    if (allObligationsSatisfied || obligations.length === 0) {
      epistemicSufficiencyStatus = 'SATISFIED';
    } else {
      epistemicSufficiencyStatus = 'PARTIAL';
    }
  }

  const telemetry = {
    initialBudgetRequested: v2Plan.initialEpistemicBudget,
    expansionsPerformed,
    finalBudgetAvailable: currentBudget,
    tokensActuallyConsumed: v1Result?.contextPacket?.totalTokensUsed || 0,
    coverageGainedAtEachExpansion,
    stoppingReason,
    resourceCeiling,
    epistemicSufficiencyStatus
  };

  const synthesisCalibration = {
    epistemicSofteningRequired: !hasItems || (v1Result?.contextPacket?.totalTokensUsed || 0) < 500,
    insufficiencyStatus: epistemicSufficiencyStatus,
    guidance: hasItems
      ? `Synthesize evidence using geometry '${v2Plan.evidenceGeometry}' with temporal spread across ${evidenceItems.length} retrieved Field records.`
      : "Insufficient evidence found across Field records. State clearly: 'Across retrieved records, no direct prior evidence was found.'"
  };

  return {
    v2Plan,
    v1AttentionPlan: v1Result?.plan || null,
    contextPacket: v1Result?.contextPacket || null,
    evidenceItems,
    telemetry,
    synthesisCalibration,
    executedAt: new Date().toISOString()
  };
}
