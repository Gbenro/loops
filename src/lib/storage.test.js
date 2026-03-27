import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateId,
  getPhaseSummaries,
  savePhaseSummary,
  generatePhaseSummary,
  getCycleSummaries,
  saveCycleSummary,
  generateCycleSummary,
  getCurrentCyclePhaseSummaries,
  clearLocalCache,
  storage,
} from './storage.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _store: store,
    _reset: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('storage.js', () => {
  beforeEach(() => {
    localStorageMock._reset();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('uses default prefix l', () => {
      const id = generateId();
      expect(id.startsWith('l')).toBe(true);
    });

    it('uses custom prefix when provided', () => {
      const id = generateId('test');
      expect(id.startsWith('test')).toBe(true);
    });

    it('includes timestamp component', () => {
      const before = Date.now();
      const id = generateId('x');
      const after = Date.now();

      // Extract timestamp (after prefix, before random suffix)
      const timestampStr = id.slice(1, 14);
      const timestamp = parseInt(timestampStr, 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Phase Summaries', () => {
    describe('getPhaseSummaries', () => {
      it('returns empty array when no summaries exist', () => {
        localStorageMock.getItem.mockReturnValue(null);
        const summaries = getPhaseSummaries();
        expect(summaries).toEqual([]);
      });

      it('returns parsed summaries from localStorage', () => {
        const mockSummaries = [{ id: 'ps1', phaseKey: 'new' }];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSummaries));

        const summaries = getPhaseSummaries();
        expect(summaries).toEqual(mockSummaries);
      });
    });

    describe('savePhaseSummary', () => {
      it('adds new summary to storage', () => {
        localStorageMock.getItem.mockReturnValue('[]');
        const summary = {
          id: 'ps1',
          phaseKey: 'new',
          phaseName: 'New Moon',
          lunarMonth: 'Wolf',
        };

        savePhaseSummary(summary);

        expect(localStorageMock.setItem).toHaveBeenCalled();
        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedData[0]).toEqual(summary);
      });

      it('updates existing summary for same phase/month', () => {
        const existing = [{
          id: 'ps1',
          phaseKey: 'new',
          phaseName: 'New Moon',
          lunarMonth: 'Wolf',
          stats: { echoCount: 1 },
        }];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

        const updated = {
          id: 'ps1',
          phaseKey: 'new',
          phaseName: 'New Moon',
          lunarMonth: 'Wolf',
          stats: { echoCount: 5 },
        };

        savePhaseSummary(updated);

        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedData).toHaveLength(1);
        expect(savedData[0].stats.echoCount).toBe(5);
      });

      it('keeps only last 30 summaries', () => {
        const manySummaries = Array.from({ length: 35 }, (_, i) => ({
          id: `ps${i}`,
          phaseKey: `phase${i}`,
          lunarMonth: `Month${i}`,
        }));
        localStorageMock.getItem.mockReturnValue(JSON.stringify(manySummaries));

        const newSummary = {
          id: 'psNew',
          phaseKey: 'new',
          lunarMonth: 'NewMonth',
        };

        savePhaseSummary(newSummary);

        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedData.length).toBeLessThanOrEqual(30);
      });
    });

    describe('generatePhaseSummary', () => {
      it('generates summary from echoes and loops', () => {
        const echoes = [
          { id: 'e1', text: 'Echo 1', phase: 'new', lunarMonth: 'Wolf', source: 'text' },
          { id: 'e2', text: 'Echo 2', phase: 'new', lunarMonth: 'Wolf', source: 'voice' },
          { id: 'e3', text: 'Echo 3', phase: 'full', lunarMonth: 'Wolf', source: 'text' },
        ];

        const loops = [
          { id: 'l1', title: 'Loop 1', type: 'phase', phaseOpened: 'new', lunarMonthOpened: 'Wolf' },
          { id: 'l2', title: 'Loop 2', type: 'cycle', phaseClosed: 'new', status: 'closed' },
          { id: 'l3', title: 'Loop 3', type: 'phase', phaseClosed: 'new', status: 'released' },
        ];

        const summary = generatePhaseSummary('new', 'New Moon', 'Wolf', echoes, loops);

        expect(summary.phaseKey).toBe('new');
        expect(summary.phaseName).toBe('New Moon');
        expect(summary.lunarMonth).toBe('Wolf');
        expect(summary.echoes).toHaveLength(2);
        expect(summary.loopsOpened).toHaveLength(1);
        expect(summary.loopsClosed).toHaveLength(1);
        expect(summary.loopsReleased).toHaveLength(1);
        expect(summary.stats.echoCount).toBe(2);
        expect(summary.stats.loopsOpenedCount).toBe(1);
        expect(summary.stats.loopsClosedCount).toBe(1);
        expect(summary.stats.loopsReleasedCount).toBe(1);
      });

      it('generates valid ID with ps prefix', () => {
        const summary = generatePhaseSummary('new', 'New Moon', 'Wolf', [], []);
        expect(summary.id.startsWith('ps')).toBe(true);
      });

      it('includes createdAt timestamp', () => {
        const before = new Date().toISOString();
        const summary = generatePhaseSummary('new', 'New Moon', 'Wolf', [], []);
        const after = new Date().toISOString();

        expect(summary.createdAt).toBeDefined();
        expect(summary.createdAt >= before).toBe(true);
        expect(summary.createdAt <= after).toBe(true);
      });
    });
  });

  describe('Cycle Summaries', () => {
    describe('getCycleSummaries', () => {
      it('returns empty array when no summaries exist', () => {
        localStorageMock.getItem.mockReturnValue(null);
        const summaries = getCycleSummaries();
        expect(summaries).toEqual([]);
      });
    });

    describe('saveCycleSummary', () => {
      it('adds summary to storage', () => {
        localStorageMock.getItem.mockReturnValue('[]');
        const summary = { id: 'cs1', lunarMonth: 'Wolf' };

        saveCycleSummary(summary);

        expect(localStorageMock.setItem).toHaveBeenCalled();
      });

      it('keeps only last 6 cycle summaries', () => {
        const existing = Array.from({ length: 8 }, (_, i) => ({
          id: `cs${i}`,
          lunarMonth: `Month${i}`,
        }));
        localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

        saveCycleSummary({ id: 'csNew', lunarMonth: 'NewMonth' });

        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedData.length).toBeLessThanOrEqual(6);
      });
    });

    describe('generateCycleSummary', () => {
      it('aggregates stats from phase summaries', () => {
        const phaseSummaries = [
          {
            id: 'ps1',
            lunarMonth: 'Wolf',
            stats: {
              echoCount: 5,
              loopsOpenedCount: 2,
              loopsClosedCount: 1,
              loopsReleasedCount: 0,
            },
          },
          {
            id: 'ps2',
            lunarMonth: 'Wolf',
            stats: {
              echoCount: 3,
              loopsOpenedCount: 1,
              loopsClosedCount: 2,
              loopsReleasedCount: 1,
            },
          },
          {
            id: 'ps3',
            lunarMonth: 'Snow', // Different month, should be excluded
            stats: {
              echoCount: 10,
              loopsOpenedCount: 5,
              loopsClosedCount: 3,
              loopsReleasedCount: 2,
            },
          },
        ];

        const summary = generateCycleSummary('Wolf', phaseSummaries);

        expect(summary.lunarMonth).toBe('Wolf');
        expect(summary.stats.totalEchoes).toBe(8);
        expect(summary.stats.totalLoopsOpened).toBe(3);
        expect(summary.stats.totalLoopsClosed).toBe(3);
        expect(summary.stats.totalLoopsReleased).toBe(1);
        expect(summary.phaseSummaries).toHaveLength(2);
      });

      it('counts phases with activity', () => {
        const phaseSummaries = [
          { id: 'ps1', lunarMonth: 'Wolf', stats: { echoCount: 5, loopsOpenedCount: 0, loopsClosedCount: 0, loopsReleasedCount: 0 } },
          { id: 'ps2', lunarMonth: 'Wolf', stats: { echoCount: 0, loopsOpenedCount: 1, loopsClosedCount: 0, loopsReleasedCount: 0 } },
          { id: 'ps3', lunarMonth: 'Wolf', stats: { echoCount: 0, loopsOpenedCount: 0, loopsClosedCount: 0, loopsReleasedCount: 0 } },
        ];

        const summary = generateCycleSummary('Wolf', phaseSummaries);

        expect(summary.stats.phasesWithActivity).toBe(2);
      });
    });

    describe('getCurrentCyclePhaseSummaries', () => {
      it('filters summaries by lunar month', () => {
        const summaries = [
          { id: 'ps1', lunarMonth: 'Wolf' },
          { id: 'ps2', lunarMonth: 'Snow' },
          { id: 'ps3', lunarMonth: 'Wolf' },
        ];
        localStorageMock.getItem.mockReturnValue(JSON.stringify(summaries));

        const wolfSummaries = getCurrentCyclePhaseSummaries('Wolf');

        expect(wolfSummaries).toHaveLength(2);
        expect(wolfSummaries.every(s => s.lunarMonth === 'Wolf')).toBe(true);
      });
    });
  });

  describe('clearLocalCache', () => {
    it('removes all storage keys', () => {
      clearLocalCache();

      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(4);
    });
  });

  describe('Legacy storage exports', () => {
    it('provides generateId function', () => {
      expect(storage.generateId).toBeDefined();
      const id = storage.generateId();
      expect(id.startsWith('l')).toBe(true);
    });

    it('provides getLoops function', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([{ id: 'l1' }]));
      const loops = storage.getLoops();
      expect(loops).toEqual([{ id: 'l1' }]);
    });

    it('provides saveLoops function', () => {
      const loops = [{ id: 'l1' }];
      storage.saveLoops(loops);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('provides getEchoes function', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([{ id: 'e1' }]));
      const echoes = storage.getEchoes();
      expect(echoes).toEqual([{ id: 'e1' }]);
    });

    it('provides saveEchoes function', () => {
      const echoes = [{ id: 'e1' }];
      storage.saveEchoes(echoes);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});
