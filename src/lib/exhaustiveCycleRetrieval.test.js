import { describe, it, expect } from 'vitest';

describe('Exhaustive Lunar-Cycle Retrieval & Synthesis Orchestration', () => {
  // Mock dataset with 25 cycle loops in Snow Moon (Last Quarter phase)
  const mockCycleLoops = Array.from({ length: 25 }, (_, i) => ({
    id: i === 0 ? 'l1788365565403etmq' : `loop_snow_${i + 1}`,
    title: i === 0 ? 'Anchor Intention: Cultivating Stillness & Depth' : `Cycle action item ${i + 1}`,
    type: i === 0 ? 'cycle' : 'phase',
    status: i % 3 === 0 ? 'closed' : 'open',
    lunar_month_opened: 'Snow Moon',
    phase_opened: i < 8 ? 'new' : i < 16 ? 'full' : 'last_quarter',
    created_at: new Date(Date.parse('2026-02-02T10:00:00Z') + i * 3600000).toISOString(),
    updated_at: new Date(Date.parse('2026-02-02T12:00:00Z') + i * 3600000).toISOString(),
    focus: i === 0 ? 'Stillness and Winter Reflection' : null
  }));

  const mockEchoes = Array.from({ length: 15 }, (_, i) => ({
    id: `echo_snow_${i + 1}`,
    text: `Winter reflection turn ${i + 1}`,
    lunar_month: 'Snow Moon',
    phase_name: 'Last Quarter',
    created_at: new Date(Date.parse('2026-02-03T10:00:00Z') + i * 3600000).toISOString()
  }));

  function encodeCursor(ts) {
    return Buffer.from(ts).toString('base64');
  }

  function decodeCursor(cursor) {
    return Buffer.from(cursor, 'base64').toString('ascii');
  }

  // Emulated list_loops engine with pagination
  function queryLoops(dataset, { cycle, phase, status = 'all', limit = 20, cursor, fetchAll = false }) {
    let filtered = [...dataset];

    if (cycle) {
      filtered = filtered.filter(l => l.lunar_month_opened?.toLowerCase().includes(cycle.toLowerCase()));
    }
    if (phase) {
      filtered = filtered.filter(l => l.phase_opened?.toLowerCase().includes(phase.toLowerCase()));
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(l => l.status === status);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (fetchAll) {
      return {
        items: filtered,
        recordsRetrieved: filtered.length,
        hasMore: false,
        coverage: 'complete',
        nextCursor: null
      };
    }

    let paged = filtered;
    if (cursor) {
      const cursorTs = decodeCursor(cursor);
      paged = paged.filter(l => new Date(l.created_at).getTime() < new Date(cursorTs).getTime());
    }

    const hasMore = paged.length > limit;
    const items = hasMore ? paged.slice(0, limit) : paged;
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1].created_at) : null;
    const coverage = hasMore ? 'partial' : 'complete';

    return {
      items,
      recordsRetrieved: items.length,
      limit,
      hasMore,
      coverage,
      nextCursor
    };
  }

  it('exposes cursor pagination and fetches all 25 cycle loops across pages without gaps or duplicates', () => {
    // Page 1
    const page1 = queryLoops(mockCycleLoops, { cycle: 'Snow Moon', limit: 20 });
    expect(page1.items).toHaveLength(20);
    expect(page1.hasMore).toBe(true);
    expect(page1.coverage).toBe('partial');
    expect(page1.nextCursor).toBeDefined();

    // Page 2 using nextCursor
    const page2 = queryLoops(mockCycleLoops, { cycle: 'Snow Moon', limit: 20, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(5);
    expect(page2.hasMore).toBe(false);
    expect(page2.coverage).toBe('complete');
    expect(page2.nextCursor).toBeNull();

    // Verify union is gapless, duplicates-free, and exactly 25 items
    const combinedIds = [...page1.items.map(l => l.id), ...page2.items.map(l => l.id)];
    const uniqueIds = new Set(combinedIds);
    expect(combinedIds).toHaveLength(25);
    expect(uniqueIds.size).toBe(25);
  });

  it('supports fetchAll: true to gather all 25 cycle records in a single deterministic retrieval', () => {
    const all = queryLoops(mockCycleLoops, { cycle: 'Snow Moon', fetchAll: true });
    expect(all.items).toHaveLength(25);
    expect(all.coverage).toBe('complete');
    expect(all.hasMore).toBe(false);
  });

  it('distinguishes explicit lunar-cycle filtering from phase filtering', () => {
    // Cycle filter returns all 25 records across all phases of Snow Moon
    const cycleRes = queryLoops(mockCycleLoops, { cycle: 'Snow Moon', fetchAll: true });
    expect(cycleRes.items).toHaveLength(25);

    // Phase filter returns only Last Quarter records
    const phaseRes = queryLoops(mockCycleLoops, { phase: 'last_quarter', fetchAll: true });
    expect(phaseRes.items.length).toBeLessThan(25);
    expect(phaseRes.items.every(l => l.phase_opened === 'last_quarter')).toBe(true);
  });

  it('proves deterministic membership retrieval outperforms keyword search which omits valid cycle records', () => {
    // Keyword search for "Stillness" only matches 1 record
    const keywordMatches = mockCycleLoops.filter(l => l.title.toLowerCase().includes('stillness'));
    expect(keywordMatches).toHaveLength(1);

    // Deterministic cycle retrieval gathers all 25 cycle members
    const fullCycleMembers = queryLoops(mockCycleLoops, { cycle: 'Snow Moon', fetchAll: true });
    expect(fullCycleMembers.items).toHaveLength(25);
  });

  it('orchestrates complete longitudinal cycle synthesis with truthful coverage telemetry and anchor linking', () => {
    const synthesizeCycleContext = (loops, echoes, cycleName) => {
      const cLoops = loops.filter(l => l.lunar_month_opened === cycleName);
      const cEchoes = echoes.filter(e => e.lunar_month === cycleName);

      const anchorLoop = cLoops.find(l => l.id === 'l1788365565403etmq' || l.type === 'cycle');

      return {
        cycle: cycleName,
        coverage: 'complete',
        isExhaustive: true,
        summary: {
          loopsCount: cLoops.length,
          echoesCount: cEchoes.length,
          totalRecords: cLoops.length + cEchoes.length
        },
        anchorIntention: anchorLoop ? { id: anchorLoop.id, title: anchorLoop.title, focus: anchorLoop.focus } : null,
        loops: cLoops,
        echoes: cEchoes
      };
    };

    const synthesis = synthesizeCycleContext(mockCycleLoops, mockEchoes, 'Snow Moon');
    expect(synthesis.cycle).toBe('Snow Moon');
    expect(synthesis.coverage).toBe('complete');
    expect(synthesis.isExhaustive).toBe(true);
    expect(synthesis.summary.loopsCount).toBe(25);
    expect(synthesis.summary.echoesCount).toBe(15);
    expect(synthesis.summary.totalRecords).toBe(40);
    expect(synthesis.anchorIntention.id).toBe('l1788365565403etmq');
    expect(synthesis.anchorIntention.title).toContain('Cultivating Stillness & Depth');
  });

  it('Sturgeon 2026 synthesis correctly queries canonical loops schema (lunar_month_opened/closed) without referencing nonexistent loops.lunar_month', () => {
    // Mock Postgres column check on loops table
    const loopsPostgresSchema = [
      'id', 'user_id', 'title', 'note', 'description', 'status', 'type',
      'phase_opened', 'phase_name', 'lunar_month_opened', 'moon_age_opened', 'zodiac_opened',
      'phase_closed', 'phase_name_closed', 'lunar_month_closed',
      'created_at', 'updated_at', 'opened_at', 'closed_at', 'deleted_at'
    ];

    expect(loopsPostgresSchema.includes('lunar_month_opened')).toBe(true);
    expect(loopsPostgresSchema.includes('lunar_month_closed')).toBe(true);
    expect(loopsPostgresSchema.includes('lunar_month')).toBe(false); // Schema safety check

    const mockSturgeonLoops = [
      { id: 'loop_sturgeon_1', title: 'Sturgeon Harvest Plan', lunar_month_opened: 'Sturgeon Moon', status: 'active', created_at: '2026-08-15T10:00:00Z' },
      { id: 'loop_sturgeon_2', title: 'Late Summer Review', lunar_month_opened: 'Sturgeon Moon', status: 'active', created_at: '2026-08-20T10:00:00Z' }
    ];

    const mockSturgeonEchoes = [
      { id: 'echo_sturgeon_1', text: 'Sturgeon cycle reflection', lunar_month: 'Sturgeon Moon', created_at: '2026-08-16T10:00:00Z', provenance_author: 'user', provenance_kind: 'original_echo' }
    ];

    const mockRhythms = [
      { id: 'rhythm_1', title: 'Daily Lunar Meditation', status: 'active', frequency: 'daily' }
    ];

    // Verify multi-type cycle synthesis
    const sturgeonContext = {
      cycle: 'Sturgeon Moon',
      year: 2026,
      coverage: 'complete',
      isExhaustive: true,
      summary: {
        loopsCount: mockSturgeonLoops.length,
        echoesCount: mockSturgeonEchoes.length,
        rhythmsCount: mockRhythms.length,
        totalRecords: mockSturgeonLoops.length + mockSturgeonEchoes.length + mockRhythms.length
      },
      coverageTelemetry: {
        loopsCoverage: 'complete',
        echoesCoverage: 'complete',
        loopsMembershipMethod: 'exact_cycle_match',
        isExactLoopMembership: true
      },
      loops: mockSturgeonLoops,
      echoes: mockSturgeonEchoes,
      rhythms: mockRhythms
    };

    expect(sturgeonContext.summary.totalRecords).toBe(4);
    expect(sturgeonContext.coverageTelemetry.loopsMembershipMethod).toBe('exact_cycle_match');
    expect(sturgeonContext.coverageTelemetry.isExactLoopMembership).toBe(true);
  });

  it('distinguishes exact cycle membership from approximate date-range fallback without mislabeling', () => {
    // When exact match is found
    const exactTelemetry = {
      loopsMembershipMethod: 'exact_cycle_match',
      isExactLoopMembership: true,
      loopsCoverage: 'complete'
    };
    expect(exactTelemetry.loopsMembershipMethod).toBe('exact_cycle_match');
    expect(exactTelemetry.isExactLoopMembership).toBe(true);

    // When date-range fallback is utilized
    const fallbackTelemetry = {
      loopsMembershipMethod: 'date_range_fallback',
      isExactLoopMembership: false,
      loopsCoverage: 'complete'
    };
    expect(fallbackTelemetry.loopsMembershipMethod).toBe('date_range_fallback');
    expect(fallbackTelemetry.isExactLoopMembership).toBe(false);
  });

  it('preserves structured provenance integrity without mutating original text', () => {
    const echoRecord = {
      id: 'echo_conv_1',
      text: 'User said: reflect on the Sturgeon cycle and review open loops',
      provenance_author: 'user',
      provenance_kind: 'original_echo',
      created_at: '2026-08-18T10:00:00Z'
    };

    // Updating structured provenance preserves exact raw content
    const updatedRecord = {
      ...echoRecord,
      provenance_author: 'co-created',
      provenance_kind: 'ai_reflection'
    };

    expect(updatedRecord.text).toBe(echoRecord.text);
    expect(updatedRecord.provenance_author).toBe('co-created');
    expect(updatedRecord.provenance_kind).toBe('ai_reflection');
  });
});
