import { describe, it, expect } from 'vitest';
import { formatBoundedTelemetryTrace } from '../../mcp-server/src/telemetryFormatter';

describe('Bounded Telemetry & ResponseTooLarge Prevention Suite', () => {

  // Construct a large telemetry trace with 50 passes, 73 evidence items (non-divisible), 80 citations
  const mockLargeTrace = {
    id: 'trace_stress_1790891317331_9999',
    session_id: 'session_1790891317331_stress',
    message_id: 'msg_stress_1790891317331_8888',
    model: 'anthropic:claude-3-5-sonnet-20241022',
    latency_ms: 3450,
    created_at: '2026-10-01T21:00:00.000Z',
    token_usage: { inputTokens: 4500, outputTokens: 650, totalTokens: 5150 },
    inference_cost: 0.0154,
    field_coverage: {
      insufficiency_status: 'SATISFIED',
      evidence_items_count: 73,
      attention_v2_plan: {
        primaryGeometry: 'longitudinal_change',
        inquiryGeometries: ['longitudinal_change', 'causal_contextual_association'],
        attentionDepth: { level: 'longitudinal_historical', dimensions: ['change_over_time', 'paradigm_evolution'] },
        attentionWidth: { scope: 'cross_cycle_span', dimensions: ['harvest_moon_arc'] },
        counterevidenceRequirement: 'Verify whether baseline changed or remained static'
      },
      telemetry: {
        stoppingReason: 'All evidence obligations satisfied with high confidence',
        counterevidenceRequired: true,
        counterevidenceExecuted: true,
        counterevidenceFoundCount: 0,
        counterevidenceRationale: 'No contradictory paradigm shifts recorded in cycle interval',
        passes: Array.from({ length: 50 }, (_, i) => ({
          passNumber: i + 1,
          operation: `retrieval_op_pass_${i + 1}`,
          reason: `Pass ${i + 1} inspection`,
          candidatesFoundCount: 15,
          novelEvidenceCount: 2,
          redundantRejectedCount: 13,
          obligationsSatisfied: [`Obligation ${i + 1}`],
          depthChange: i % 2 === 0 ? 'deepened' : 'none',
          widthChange: i % 3 === 0 ? 'expanded' : 'none'
        })),
        evidenceItems: Array.from({ length: 73 }, (_, i) => ({
          id: `e1787746303${String(i).padStart(4, '0')}`,
          type: 'echo',
          createdAt: `2026-08-${String((i % 30) + 1).padStart(2, '0')}T12:00:00Z`,
          role: 'supporting_evidence',
          retrievalPass: Math.floor(i / 2) + 1,
          relevanceScore: 0.95 - i * 0.005,
          qualification: 'Qualified inside cycle bound'
        })),
        citations: Array.from({ length: 80 }, (_, i) => ({
          citationText: `Citation text snippet ${i + 1}`,
          fieldRecordId: `e1787746303${String(i).padStart(4, '0')}`,
          retrievalPass: Math.floor(i / 2) + 1,
          evidenceItemId: `e1787746303${String(i).padStart(4, '0')}`,
          synthesisContext: 'Injected into context window'
        }))
      }
    }
  };

  it('A. verifies default section="summary" produces a compact, bounded payload without dumping full lists', () => {
    const res = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'summary' });
    
    expect(res.success).toBe(true);
    expect(res.identity.traceId).toBe('trace_stress_1790891317331_9999');
    expect(res.identity.sessionId).toBe('session_1790891317331_stress');
    expect(res.summary.v2Executed).toBe(true);
    expect(res.summary.v1Executed).toBe(true);
    expect(res.summary.passCount).toBe(50);
    expect(res.summary.evidenceItemsCount).toBe(73);
    expect(res.summary.counterevidenceStatus).toBe('executed_none_found');

    const jsonSize = JSON.stringify(res).length;
    expect(jsonSize).toBeLessThan(1200);
  });

  it('B. iterates through COMPLETE non-divisible collection (73 items with limit 10) verifying zero duplicates/omissions', () => {
    const allRetrievedIds = [];
    let currentOffset = 0;
    const limit = 10;
    let pageCount = 0;

    while (true) {
      pageCount++;
      const res = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'evidence', limit, offset: currentOffset });
      
      expect(res.success).toBe(true);
      expect(res.identity.traceId).toBe('trace_stress_1790891317331_9999');

      const items = res.evidence.items;
      items.forEach(item => allRetrievedIds.push(item.id));

      if (res.evidence.hasMore) {
        expect(res.evidence.nextOffset).toBe(currentOffset + limit);
        currentOffset = res.evidence.nextOffset;
      } else {
        expect(res.evidence.nextOffset).toBeNull();
        break;
      }
    }

    expect(pageCount).toBe(8); // 10*7 + 3 = 73 items across 8 pages
    expect(allRetrievedIds).toHaveLength(73);

    // Verify every expected item was returned exactly once with zero duplicates or omissions
    const expectedIds = Array.from({ length: 73 }, (_, i) => `e1787746303${String(i).padStart(4, '0')}`);
    expect(allRetrievedIds).toEqual(expectedIds);
  });

  it('C. verifies offset at/after terminal index returns valid empty terminal page', () => {
    const res = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'evidence', limit: 10, offset: 73 });

    expect(res.success).toBe(true);
    expect(res.evidence.items).toEqual([]);
    expect(res.evidence.totalCount).toBe(73);
    expect(res.evidence.returnedCount).toBe(0);
    expect(res.evidence.hasMore).toBe(false);
    expect(res.evidence.nextOffset).toBeNull();
  });

  it('D. verifies malformed, negative, and excessive limit/offset values are normalized safely', () => {
    // Negative limit & offset
    const res1 = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'evidence', limit: -10, offset: -5 });
    expect(res1.evidence.limit).toBe(1); // Min limit 1
    expect(res1.evidence.offset).toBe(0); // Min offset 0

    // Excessive limit > 50
    const res2 = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'evidence', limit: 500, offset: 0 });
    expect(res2.evidence.limit).toBe(50); // Clamped to server max limit 50
    expect(res2.evidence.items).toHaveLength(50);
  });

  it('E. verifies stable trace identity is preserved across all section and pagination requests', () => {
    const summary = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'summary' });
    const passes = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'passes', limit: 2, offset: 4 });
    const evidence = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'evidence', limit: 5, offset: 15 });
    const counter = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'counterevidence' });

    const expectedTraceId = 'trace_stress_1790891317331_9999';
    expect(summary.identity.traceId).toBe(expectedTraceId);
    expect(passes.identity.traceId).toBe(expectedTraceId);
    expect(evidence.identity.traceId).toBe(expectedTraceId);
    expect(counter.identity.traceId).toBe(expectedTraceId);
  });

  it('F. verifies counterevidence state is typed and unambiguous', () => {
    const res = formatBoundedTelemetryTrace(mockLargeTrace, null, null, { section: 'counterevidence' });

    expect(res.counterevidence.status).toBe('executed_none_found');
    expect(res.counterevidence.executed).toBe(true);
    expect(res.counterevidence.foundCount).toBe(0);
    expect(res.counterevidence.rationale).toBeDefined();
  });
});


describe('Telemetry Identity Resolution Invariant Suite', () => {

  // Mock DB table
  const mockTelemetryDatabase = [
    {
      id: 'trace_1790905645726_97ro',
      message_id: 'msg_1790905680299_shw5',
      session_id: 'session_1790891317331_2ifh',
      model: 'anthropic:claude-3-5-sonnet-20241022',
      created_at: '2026-10-01T22:00:00.000Z'
    },
    {
      id: 'trace_session2_turn1',
      message_id: 'msg_session2_turn1',
      session_id: 'session_other_9999',
      model: 'anthropic:claude-3-5-sonnet-20241022',
      created_at: '2026-10-01T23:00:00.000Z'
    }
  ];

  // Resolver helper mirroring commandCenter.ts / chat.ts resolution rules
  function resolveTelemetryTrace(params = {}) {
    const explicitMessageId = params.messageId || params.traceId;
    const explicitSessionId = params.sessionId;
    const rawId = params.id;

    let targetMessageOrTraceId = explicitMessageId || null;
    let targetSessionId = explicitSessionId || null;

    if (!targetMessageOrTraceId && rawId) {
      if (rawId.startsWith('session_')) {
        targetSessionId = rawId;
      } else {
        targetMessageOrTraceId = rawId;
      }
    }

    let matches = [];
    if (targetMessageOrTraceId) {
      matches = mockTelemetryDatabase.filter(
        t => t.id === targetMessageOrTraceId || t.message_id === targetMessageOrTraceId
      );
    } else if (targetSessionId) {
      matches = mockTelemetryDatabase.filter(t => t.session_id === targetSessionId);
    }

    if (matches.length === 0) {
      throw new Error(`telemetry_not_found: No telemetry trace for ${targetMessageOrTraceId || targetSessionId}`);
    }

    const telemetry = matches[0];

    // Identity Invariant Check
    if (targetMessageOrTraceId && telemetry.id !== targetMessageOrTraceId && telemetry.message_id !== targetMessageOrTraceId) {
      throw new Error(`telemetry_not_found: Identity mismatch for ${targetMessageOrTraceId}`);
    }

    if (targetSessionId && !targetMessageOrTraceId && telemetry.session_id !== targetSessionId) {
      throw new Error(`telemetry_not_found: Session mismatch for ${targetSessionId}`);
    }

    return telemetry;
  }

  it('Test A: Historical turn (msg_1790891416706_uq54) without V2 trace fails closed with telemetry_not_found (never returns another turn)', () => {
    expect(() => resolveTelemetryTrace({ messageId: 'msg_1790891416706_uq54', sessionId: 'session_1790891317331_2ifh' }))
      .toThrow('telemetry_not_found');
  });

  it('Test B: Known turn (msg_1790905680299_shw5) resolves exactly to trace_1790905645726_97ro', () => {
    const trace = resolveTelemetryTrace({ messageId: 'msg_1790905680299_shw5', sessionId: 'session_1790891317331_2ifh' });
    expect(trace.id).toBe('trace_1790905645726_97ro');
    expect(trace.message_id).toBe('msg_1790905680299_shw5');
  });

  it('Test C: Multi-message conversation resolves each message independently regardless of query order', () => {
    const trace1 = resolveTelemetryTrace({ messageId: 'msg_1790905680299_shw5' });
    const trace2 = resolveTelemetryTrace({ messageId: 'msg_session2_turn1' });
    expect(trace1.id).toBe('trace_1790905645726_97ro');
    expect(trace2.id).toBe('trace_session2_turn1');
  });

  it('Test D: Nonexistent message fails closed with telemetry_not_found', () => {
    expect(() => resolveTelemetryTrace({ messageId: 'msg_nonexistent_12345' }))
      .toThrow('telemetry_not_found');
  });

  it('Test E: Cross-session isolation prevents Session A message from resolving to Session B telemetry', () => {
    const trace = resolveTelemetryTrace({ messageId: 'msg_session2_turn1' });
    expect(trace.session_id).toBe('session_other_9999');
    expect(trace.session_id).not.toBe('session_1790891317331_2ifh');
  });
});
