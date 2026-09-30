/**
 * Attention V1 ↔ V2 Seamless Integration Contract (Order 108)
 * Connects V2 perspective & evidence geometry planning to V1 bounded-context retrieval.
 * Flow: Inquiry -> V2 Evidence Plan -> V1 Bounded Retrieval -> Evidence Bundle -> Synthesis Calibration
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
  tokenBudget: 3000,
  confidence: 1.0,
  isFallback: true
};

/**
 * Dynamically infers Attention V2 Perspective & Evidence Geometry Plan from inquiry text.
 */
export function inferAttentionV2Plan(question, options = {}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    return { ...V1_FALLBACK_DEFAULT_PLAN };
  }

  const q = question.toLowerCase().trim();
  const tokenBudget = options.tokenBudget || 3000;

  let evidenceGeometry = 'current_state';
  let coverageStrategy = 'balanced';
  let requireTemporalSpread = false;
  let requireCounterevidence = false;

  if (/\b(shift|evolv|change|over time|across|grew|transform)\b/.test(q)) {
    evidenceGeometry = 'longitudinal_change';
    coverageStrategy = 'longitudinal_span';
    requireTemporalSpread = true;
  } else if (/\b(repeat|recur|pattern|keep|often|always|habit)\b/.test(q)) {
    evidenceGeometry = 'recurrence';
    coverageStrategy = 'recurrence_deepening';
  } else if (/\b(where|origin|start|root|begin|first|source)\b/.test(q)) {
    evidenceGeometry = 'origin';
    coverageStrategy = 'longitudinal_span';
    requireTemporalSpread = true;
  } else if (/\b(compare|contrast|versus|vs|between|different)\b/.test(q)) {
    evidenceGeometry = 'comparison';
    coverageStrategy = 'temporal_distribution';
    requireTemporalSpread = true;
  } else if (/\b(alex|studio|book|editorial|partnership|collaborat)\b/.test(q)) {
    evidenceGeometry = 'relationship';
    coverageStrategy = 'entity_cluster';
  } else if (/\b(open|unresolved|unfinished|stuck|pending|block)\b/.test(q)) {
    evidenceGeometry = 'open_loop';
    coverageStrategy = 'recurrence_deepening';
    requireCounterevidence = true;
  } else if (/\b(body|physical|breath|somatic|tired|tension|headache)\b/.test(q)) {
    evidenceGeometry = 'embodiment';
    coverageStrategy = 'balanced';
  } else if (/\b(quiet|silence|pause|absence|return|disappear)\b/.test(q)) {
    evidenceGeometry = 'quieting_absence';
    coverageStrategy = 'longitudinal_span';
    requireTemporalSpread = true;
  }

  return {
    evidenceGeometry,
    coverageStrategy,
    requireTemporalSpread,
    requireCounterevidence,
    tokenBudget,
    confidence: 0.95,
    isFallback: false
  };
}

/**
 * Executes the seamless Attention V1 ↔ V2 pipeline.
 * Reuses V1 bounded retrieval engine while applying V2 evidence planning & synthesis calibration.
 */
export async function executeSeamlessAttentionPipeline(question, options = {}, engine = null) {
  const v2Plan = inferAttentionV2Plan(question, options);

  let v1Result = null;
  if (engine && typeof engine.planAndAssemble === 'function') {
    v1Result = await engine.planAndAssemble(question, {
      tokenBudget: v2Plan.tokenBudget,
      coverageStrategy: v2Plan.coverageStrategy
    });
  }

  const evidenceItems = v1Result?.contextPacket?.evidenceItems || [];
  const hasItems = evidenceItems.length > 0;

  const synthesisCalibration = {
    epistemicSofteningRequired: !hasItems || (v1Result?.contextPacket?.totalTokensUsed || 0) < 500,
    insufficiencyStatus: hasItems ? 'SATISFIED' : 'INSUFFICIENT_EVIDENCE',
    guidance: hasItems
      ? `Synthesize evidence using geometry '${v2Plan.evidenceGeometry}' with temporal spread.`
      : "Insufficient evidence found across Field records. State clearly: 'Across retrieved records, no direct prior evidence was found.'"
  };

  return {
    v2Plan,
    v1AttentionPlan: v1Result?.plan || null,
    contextPacket: v1Result?.contextPacket || null,
    evidenceItems,
    synthesisCalibration,
    executedAt: new Date().toISOString()
  };
}
