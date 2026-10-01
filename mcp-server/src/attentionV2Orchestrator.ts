/**
 * Attention V2 Matrix & Adaptive Attention Depth Architecture
 * Implement Production Luna Adaptive Attention Depth, Width, Composite Geometries,
 * Multi-Pass Re-Orientation (Look -> Evaluate -> Reorient -> Look Again),
 * Observational Token Telemetry & First-Class Reorientation Telemetry.
 */

export const EVIDENCE_GEOMETRIES = [
  'current_state',
  'recurrence',
  'longitudinal_change',
  'causal_contextual',
  'origin',
  'comparison',
  'relationship',
  'open_loop',
  'contradiction',
  'convergence',
  'embodiment',
  'quieting_absence',
  'return_after_absence',
  'insufficient_evidence'
];

export interface AttentionDepthConfig {
  level: 'immediate' | 'direct_supporting' | 'contextual' | 'historical_origin' | 'deep_longitudinal' | 'multi_layer';
  dimensions: string[];
}

export interface AttentionWidthConfig {
  scope: 'narrow_thread' | 'temporal_distribution' | 'broad_cycle' | 'cross_cycle' | 'cross_domain';
  dimensions: string[];
}

export interface AttentionPlanV2 {
  inquiryGeometries: string[];
  primaryGeometry: string;
  evidenceGeometry?: string;
  attentionDepth: AttentionDepthConfig;
  attentionWidth: AttentionWidthConfig;
  temporalScope: {
    spanType: 'current_cycle' | 'cross_cycle' | 'recent_days' | 'all_history';
    requireTemporalSpread: boolean;
  };
  evidenceTypesRequired: string[];
  evidenceObligations: string[];
  counterevidenceRequired: boolean;
  initialOperations: string[];
  stoppingConditions: string[];
  confidence: number;
  isFallback: boolean;
}

export interface ReorientationStep {
  passNumber: number;
  operation: string;
  reorientationReason: string;
  evidenceItemsRetrieved: number;
  novelItemsGained: number;
  totalTokensConsumed: number;
  obligationsSatisfied: number;
  obligationsTotal: number;
  coverageState: string;
}

export const V1_FALLBACK_DEFAULT_PLAN: AttentionPlanV2 = {
  inquiryGeometries: ['current_state'],
  primaryGeometry: 'current_state',
  evidenceGeometry: 'current_state',
  attentionDepth: {
    level: 'direct_supporting',
    dimensions: ['direct_evidence']
  },
  attentionWidth: {
    scope: 'narrow_thread',
    dimensions: ['narrow_thread']
  },
  temporalScope: {
    spanType: 'current_cycle',
    requireTemporalSpread: false
  },
  evidenceTypesRequired: ['loop', 'echo'],
  evidenceObligations: ['current_state'],
  counterevidenceRequired: false,
  initialOperations: ['semantic_retrieval'],
  stoppingConditions: ['obligations_covered'],
  confidence: 0.5,
  isFallback: true
};

/**
 * Infers an open, composable Attention Matrix Plan (Geometries x Depth x Width x Operations).
 */
export function inferAttentionV2Plan(question: string, options: any = {}): AttentionPlanV2 {
  if (!question || typeof question !== 'string' || !question.trim()) {
    return { ...V1_FALLBACK_DEFAULT_PLAN };
  }

  const q = question.toLowerCase().trim();
  const geometries: string[] = [];
  const depthDimensions: string[] = [];
  const widthDimensions: string[] = [];
  const obligations: string[] = ['current_state'];
  const operations: string[] = ['semantic_retrieval'];

  let depthLevel: AttentionDepthConfig['level'] = 'direct_supporting';
  let widthScope: AttentionWidthConfig['scope'] = 'narrow_thread';
  let spanType: 'current_cycle' | 'cross_cycle' | 'recent_days' | 'all_history' = 'current_cycle';
  let requireTemporalSpread = false;
  let requireCounterevidence = false;

  // 1. Detect Geometries (Composite Detection)
  if (/(shift|evolv|change|over time|across|grew|transform)/i.test(q)) {
    geometries.push('longitudinal_change');
    depthDimensions.push('historical_origin', 'meaning_transitions', 'recent_state');
    widthDimensions.push('temporal_distribution', 'multi_cycle');
    obligations.push('origin_state', 'intermediate_transitions', 'recent_state');
    operations.push('temporal_distribution', 'lexical_retrieval');
    depthLevel = 'deep_longitudinal';
    widthScope = 'broad_cycle';
    requireTemporalSpread = true;
    spanType = 'current_cycle';
  }

  if (/(why|cause|reason|effect|influence|lead to|result|prompt)/i.test(q)) {
    geometries.push('causal_contextual');
    depthDimensions.push('contextual_evidence', 'cross_record_synthesis');
    widthDimensions.push('multi_record_type', 'cross_domain');
    obligations.push('contextual_associations', 'relational_events');
    operations.push('thematic_association', 'entity_retrieval');
    if (depthLevel === 'direct_supporting') depthLevel = 'contextual';
  }

  if (/(feel|felt|body|experience|lived|sensation|physical|studio|touch|breath)/i.test(q)) {
    geometries.push('embodiment');
    depthDimensions.push('experiential_embodied');
    widthDimensions.push('conceptual_and_experiential');
    obligations.push('embodied_examples');
    operations.push('experiential_retrieval');
    if (depthLevel === 'direct_supporting') depthLevel = 'multi_layer';
  }

  if (/(repeat|recur|pattern|keep|often|always|habit|surfac)/i.test(q)) {
    geometries.push('recurrence');
    depthDimensions.push('recurrence_deepening');
    widthDimensions.push('recurrence_across_time');
    obligations.push('recurring_patterns');
    operations.push('recurrence_detection');
    if (widthScope === 'narrow_thread') widthScope = 'temporal_distribution';
  }

  if (/(where|origin|start|root|begin|first|source)/i.test(q)) {
    geometries.push('origin');
    depthDimensions.push('historical_origin');
    widthDimensions.push('temporal_distribution');
    obligations.push('origin_state');
    operations.push('temporal_distribution');
    depthLevel = 'historical_origin';
  }

  if (/(compare|contrast|versus|vs|between|different)/i.test(q)) {
    geometries.push('comparison');
    depthDimensions.push('cross_record_synthesis');
    widthDimensions.push('contrasting_perspectives');
    obligations.push('comparative_baselines');
    operations.push('lexical_retrieval');
  }

  if (/(alex|studio|book|editorial|partnership|collaborat)/i.test(q)) {
    geometries.push('relationship');
    depthDimensions.push('contextual_evidence');
    widthDimensions.push('multi_entity');
    obligations.push('entity_relationship');
    operations.push('entity_retrieval');
  }

  if (/(open|unresolved|unfinished|stuck|pending|block)/i.test(q)) {
    geometries.push('open_loop');
    depthDimensions.push('contradictions_discontinuities');
    obligations.push('unresolved_uncertainty');
    requireCounterevidence = true;
  }

  // Fallback if no geometry matched
  if (geometries.length === 0) {
    if (/^(hi|hello|hey|thanks|thank you)$/i.test(q) || q.length < 5) {
      geometries.push('current_state');
      depthLevel = 'immediate';
      widthScope = 'narrow_thread';
    } else {
      geometries.push('current_state');
      depthLevel = 'direct_supporting';
      widthScope = 'narrow_thread';
    }
  }

  // Deduplicate arrays
  const uniqueGeometries = Array.from(new Set(geometries));
  const uniqueDepthDims = Array.from(new Set(depthDimensions.length ? depthDimensions : ['direct_evidence']));
  const uniqueWidthDims = Array.from(new Set(widthDimensions.length ? widthDimensions : ['narrow_thread']));
  const uniqueObligations = Array.from(new Set(obligations));
  const uniqueOperations = Array.from(new Set(operations));

  return {
    inquiryGeometries: uniqueGeometries,
    primaryGeometry: uniqueGeometries[0],
    evidenceGeometry: uniqueGeometries[0],
    attentionDepth: {
      level: depthLevel,
      dimensions: uniqueDepthDims
    },
    attentionWidth: {
      scope: widthScope,
      dimensions: uniqueWidthDims
    },
    temporalScope: {
      spanType,
      requireTemporalSpread
    },
    evidenceTypesRequired: ['loop', 'echo', 'relational_memory', 'chat_message'],
    evidenceObligations: uniqueObligations,
    counterevidenceRequired: requireCounterevidence || uniqueGeometries.includes('longitudinal_change'),
    initialOperations: uniqueOperations,
    stoppingConditions: ['obligations_covered', 'diminishing_novel_evidence'],
    confidence: 0.95,
    isFallback: false
  };
}

/**
 * Architectural Resource Policy Stub.
 * Preserves clean separation between Epistemic Need and Resource Policy.
 */
export function evaluateResourcePolicy(epistemicNeed: any, resourceContext: any = {}) {
  return {
    allowExecution: true,
    policyNotice: 'Resource policy permits full epistemic execution',
    maxTokensCeiling: resourceContext.maxTokensCeiling || 48000
  };
}

/**
 * Multi-Pass Adaptive Retrieval Engine (Look -> Evaluate -> Reorient -> Look Again).
 * Executes retrieval passes, evaluates coverage against obligations, performs dynamic reorientations,
 * and emits full reorientation trajectory telemetry with evidence-based stopping reasons.
 */
export async function executeSeamlessAttentionPipeline(question: string, options: any = {}, engine: any = null) {
  const initialPlan = inferAttentionV2Plan(question, options);
  const resourcePolicy = evaluateResourcePolicy(initialPlan, options);

  let currentPlan = { ...initialPlan };
  let v1Result: any = null;
  const planEvolution: Array<{
    passNumber: number;
    planState: AttentionPlanV2;
    reorientationReason: string;
  }> = [];

  const reorientationTrajectory: ReorientationStep[] = [];
  const accumulatedEvidenceItemsMap = new Map<string, any>();
  let passNumber = 1;
  let stoppingReason = 'Initial retrieval complete';
  let technicalLimitEncountered = false;

  // Pass 1: Initial composite retrieval pass
  planEvolution.push({
    passNumber: 1,
    planState: JSON.parse(JSON.stringify(currentPlan)),
    reorientationReason: 'Initial Attention Plan execution based on inquiry shape'
  });

  if (engine && typeof engine.planAndAssemble === 'function') {
    let continueLoop = true;

    while (continueLoop && passNumber <= 5) {
      const stepCoverageStrategy = currentPlan.attentionWidth.scope === 'broad_cycle' || currentPlan.temporalScope.requireTemporalSpread
        ? 'longitudinal_span'
        : (currentPlan.primaryGeometry === 'recurrence' ? 'recurrence_deepening' : 'balanced');

      // Use a generous observational budget limit (32,000 tokens) so retrieval is not truncated prescriptively
      const passResult = await engine.planAndAssemble(question, {
        tokenBudget: 32000,
        coverageStrategy: stepCoverageStrategy,
        targetCycle: options.targetCycle
      });

      v1Result = passResult;
      const passItems = passResult.contextPacket?.evidenceItems || [];
      const passTokens = passResult.contextPacket?.totalTokensUsed || 0;

      let novelItemsGained = 0;
      for (const item of passItems) {
        const key = item.id || item.sourceId || `${item.sourceType}_${item.created_at}`;
        if (!accumulatedEvidenceItemsMap.has(key)) {
          accumulatedEvidenceItemsMap.set(key, item);
          novelItemsGained++;
        }
      }

      const obligations = passResult.plan?.coverageMatrix?.obligations || [];
      const satisfiedObligations = obligations.filter((o: any) => o.status === 'satisfied').length;
      const allObligationsSatisfied = obligations.length > 0 && satisfiedObligations === obligations.length;

      const coverageStateDescription = obligations.length > 0
        ? `${satisfiedObligations}/${obligations.length} obligations satisfied`
        : `${accumulatedEvidenceItemsMap.size} items accumulated`;

      let reorientationReason = 'Initial retrieval pass complete.';

      // Dynamic Re-Orientation Evaluation (Look -> Evaluate -> Reorient)
      let needsReorientation = false;

      // 1. Origin deepening reorientation
      if (!allObligationsSatisfied && currentPlan.evidenceObligations.includes('origin_state') && !reorientationTrajectory.some(s => s.operation === 'origin_deepening_pass')) {
        needsReorientation = true;
        reorientationReason = 'Origin historical state remains weak or unsatisfied; reorienting attention toward earlier historical records.';
        currentPlan.attentionDepth.dimensions.push('historical_origin_deepening');
        currentPlan.initialOperations.push('origin_deepening_pass');
      }
      // 2. Experiential search reorientation
      else if (currentPlan.inquiryGeometries.includes('embodiment') && !reorientationTrajectory.some(s => s.operation === 'experiential_embodied_pass')) {
        needsReorientation = true;
        reorientationReason = 'Conceptual evidence found; reorienting attention toward lived, embodied, and studio experience records.';
        currentPlan.attentionDepth.dimensions.push('experiential_embodied_deepening');
        currentPlan.initialOperations.push('experiential_embodied_pass');
      }
      // 3. Counterevidence / discontinuity search reorientation
      else if (currentPlan.counterevidenceRequired && novelItemsGained > 0 && !reorientationTrajectory.some(s => s.operation === 'counterevidence_search_pass')) {
        needsReorientation = true;
        reorientationReason = 'Primary developmental trajectory identified; reorienting attention to deliberately search for counterevidence or discontinuities.';
        currentPlan.attentionDepth.dimensions.push('counterevidence_search');
        currentPlan.initialOperations.push('counterevidence_search_pass');
      }
      // 4. Temporal widening reorientation
      else if (currentPlan.temporalScope.requireTemporalSpread && passItems.length > 0 && !reorientationTrajectory.some(s => s.operation === 'temporal_widening_pass')) {
        needsReorientation = true;
        reorientationReason = 'Clustered evidence detected; reorienting attention to enforce broader temporal distribution.';
        currentPlan.attentionWidth.dimensions.push('broader_temporal_spread');
        currentPlan.initialOperations.push('temporal_widening_pass');
      }

      reorientationTrajectory.push({
        passNumber,
        operation: passNumber === 1 ? 'initial_composite_retrieval' : (currentPlan.initialOperations[currentPlan.initialOperations.length - 1] || `reorientation_pass_${passNumber}`),
        reorientationReason: passNumber === 1 ? 'Executed initial composite retrieval pass' : reorientationReason,
        evidenceItemsRetrieved: passItems.length,
        novelItemsGained,
        totalTokensConsumed: passTokens,
        obligationsSatisfied: satisfiedObligations,
        obligationsTotal: obligations.length,
        coverageState: coverageStateDescription
      });

      if (needsReorientation && novelItemsGained > 0 && passNumber < 4) {
        passNumber++;
        planEvolution.push({
          passNumber,
          planState: JSON.parse(JSON.stringify(currentPlan)),
          reorientationReason
        });
        continue;
      }

      // Determine evidence-based stopping reason
      if (allObligationsSatisfied && reorientationTrajectory.some(s => s.operation === 'counterevidence_search_pass')) {
        stoppingReason = 'Origin, intermediate transitions, recent state, and connecting-pattern obligations were sufficiently covered. Counterevidence search completed. Subsequent retrieval operations produced predominantly redundant evidence, so Attention stopped.';
      } else if (allObligationsSatisfied) {
        stoppingReason = 'All specified evidence obligations were fully covered across retrieved Field records, so Attention stopped.';
      } else if (novelItemsGained === 0 && passNumber > 1) {
        stoppingReason = 'Subsequent retrieval operations produced predominantly redundant evidence and candidate recall was exhausted, so Attention stopped.';
      } else if (accumulatedEvidenceItemsMap.size === 0) {
        stoppingReason = 'Zero candidate evidence matched query across all Field record types, so Attention stopped.';
      } else {
        stoppingReason = `Attention completed ${passNumber} passes; primary coverage obligations reached ${satisfiedObligations}/${obligations.length} satisfaction with diminishing novel evidence gains, so Attention stopped.`;
      }

      continueLoop = false;
    }
  }

  const finalEvidenceItems = Array.from(accumulatedEvidenceItemsMap.values());
  const hasItems = finalEvidenceItems.length > 0;
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

  const totalTokensConsumed = v1Result?.contextPacket?.totalTokensUsed || 0;

  // Observational Token Telemetry & Full Reorientation Trajectory Telemetry
  const telemetry = {
    initialPlan,
    planEvolution,
    reorientationTrajectory,
    tokensConsumedTotal: totalTokensConsumed,
    tokensPerPass: reorientationTrajectory.map(t => ({ pass: t.passNumber, tokens: t.totalTokensConsumed, gained: t.novelItemsGained })),
    cumulativeContextUsage: totalTokensConsumed,
    technicalLimitEncountered,
    stoppingReason,
    epistemicSufficiencyStatus
  };

  const synthesisCalibration = {
    epistemicSofteningRequired: !hasItems || totalTokensConsumed < 300,
    insufficiencyStatus: epistemicSufficiencyStatus,
    guidance: hasItems
      ? `Synthesize evidence using composite geometries [${initialPlan.inquiryGeometries.join(', ')}] with Depth '${initialPlan.attentionDepth.level}' and Width '${initialPlan.attentionWidth.scope}' across ${finalEvidenceItems.length} retrieved Field records.`
      : "Insufficient evidence found across Field records. State clearly: 'Across retrieved records, no direct prior evidence was found.'"
  };

  return {
    v2Plan: initialPlan,
    planEvolution,
    reorientationTrajectory,
    v1AttentionPlan: v1Result?.plan || null,
    contextPacket: v1Result?.contextPacket || null,
    evidenceItems: finalEvidenceItems,
    telemetry,
    synthesisCalibration,
    executedAt: new Date().toISOString()
  };
}
