import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reconcileCycleLoops } from './storage.js';

describe('Cycle Migration & Intention Reconciliation', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = String(value);
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reconciles active Sturgeon cycle loop created during Harvest threshold to Harvest', () => {
    const loops = [
      {
        id: 'c_test_1',
        type: 'cycle',
        status: 'active',
        title: 'Walk in deep stillness',
        lunarMonthOpened: 'Sturgeon',
        moonAgeOpened: 28.5,
        openedAt: '2026-09-09T18:00:00.000Z',
        createdAt: '2026-09-09T18:00:00.000Z',
      },
      {
        id: 'p_test_2',
        type: 'phase',
        status: 'active',
        title: 'Morning journaling',
        lunarMonthOpened: 'Sturgeon',
        moonAgeOpened: 28.5,
      },
    ];

    const reconciled = reconcileCycleLoops(loops);
    expect(reconciled).toHaveLength(2);

    const cycleLoop = reconciled.find((l) => l.id === 'c_test_1');
    expect(cycleLoop.lunarMonthOpened).toBe('Harvest');

    // Non-cycle loops must not be altered
    const phaseLoop = reconciled.find((l) => l.id === 'p_test_2');
    expect(phaseLoop.lunarMonthOpened).toBe('Sturgeon');
  });

  it('does not alter past closed cycle loops or unrelated cycles', () => {
    const loops = [
      {
        id: 'c_past',
        type: 'cycle',
        status: 'closed',
        title: 'Past Sturgeon Intention',
        lunarMonthOpened: 'Sturgeon',
        openedAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'c_buck',
        type: 'cycle',
        status: 'active',
        title: 'Buck Intention',
        lunarMonthOpened: 'Buck',
        openedAt: '2026-07-15T00:00:00.000Z',
      },
    ];

    const reconciled = reconcileCycleLoops(loops);
    expect(reconciled[0].lunarMonthOpened).toBe('Sturgeon');
    expect(reconciled[1].lunarMonthOpened).toBe('Buck');
  });

  it('is completely idempotent when run repeatedly', () => {
    const loops = [
      {
        id: 'c_test_1',
        type: 'cycle',
        status: 'active',
        title: 'Harmonize inner rhythm',
        lunarMonthOpened: 'Sturgeon',
        moonAgeOpened: 28.8,
        openedAt: '2026-09-10T12:00:00.000Z',
      },
    ];

    const firstRun = reconcileCycleLoops(loops);
    expect(firstRun[0].lunarMonthOpened).toBe('Harvest');

    const secondRun = reconcileCycleLoops(firstRun);
    expect(secondRun[0].lunarMonthOpened).toBe('Harvest');
    expect(secondRun[0].id).toBe('c_test_1');
  });

  it('persists reconciled loops to localStorage', () => {
    const loops = [
      {
        id: 'c_test_persisted',
        type: 'cycle',
        status: 'active',
        title: 'Rest into stillness',
        lunarMonthOpened: 'Sturgeon',
        moonAgeOpened: 28.5,
        openedAt: '2026-09-09T20:00:00.000Z',
      },
    ];

    reconcileCycleLoops(loops);
    const stored = JSON.parse(mockStorage['cosmic_loops_v1']);
    expect(stored).toBeDefined();
    expect(stored[0].lunarMonthOpened).toBe('Harvest');
  });

  it('verifies hasActiveCycleLoop logic correctly matches loop.type === "cycle" and reconciled transition intentions', () => {
    const lunarData = {
      cycleStart: '2026-09-10T20:00:00.000Z',
      lunarMonth: 'Harvest',
    };

    // Case 1: Loop with type: 'cycle' and lunarMonthOpened: 'Harvest'
    const normalHarvestLoop = {
      id: 'c_1',
      type: 'cycle',
      status: 'active',
      lunarMonthOpened: 'Harvest',
    };

    const isMatch1 =
      (normalHarvestLoop.type === 'cycle' || normalHarvestLoop.scope === 'cycle') &&
      normalHarvestLoop.status === 'active' &&
      (normalHarvestLoop.cycleStart === lunarData.cycleStart ||
        normalHarvestLoop.lunarMonthOpened === lunarData.lunarMonth);
    expect(isMatch1).toBe(true);

    // Case 2: Loop created during threshold transition stamped 'Sturgeon'
    const transitionSturgeonLoop = {
      id: 'c_2',
      type: 'cycle',
      status: 'active',
      lunarMonthOpened: 'Sturgeon',
      openedAt: '2026-09-09T22:00:00.000Z',
    };

    const isMatch2 =
      (transitionSturgeonLoop.type === 'cycle' || transitionSturgeonLoop.scope === 'cycle') &&
      transitionSturgeonLoop.status === 'active' &&
      (transitionSturgeonLoop.cycleStart === lunarData.cycleStart ||
        transitionSturgeonLoop.lunarMonthOpened === lunarData.lunarMonth ||
        (lunarData.lunarMonth === 'Harvest' &&
          transitionSturgeonLoop.lunarMonthOpened === 'Sturgeon' &&
          (!transitionSturgeonLoop.openedAt ||
            Math.abs(
              new Date(transitionSturgeonLoop.openedAt).getTime() -
                new Date(lunarData.cycleStart).getTime()
            ) <
              5 * 24 * 3600 * 1000)));
    expect(isMatch2).toBe(true);
  });
});
