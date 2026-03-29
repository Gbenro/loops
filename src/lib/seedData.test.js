// Tests for seed data generation
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
vi.spyOn(global.crypto, 'randomUUID').mockImplementation(() => `uuid-${Date.now()}-${Math.random()}`);

// Import after mocks are set up
import {
  seedAllData,
  seedLoops,
  seedEchoes,
  seedRhythms,
  clearAllData,
} from './seedData.js';

describe('seedData', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('seedAllData', () => {
    it('generates all data types', () => {
      const result = seedAllData({ cycleCount: 2 });

      expect(result.loops).toBeDefined();
      expect(result.loops.length).toBeGreaterThan(0);
      expect(result.echoes).toBeDefined();
      expect(result.echoes.length).toBeGreaterThan(0);
      expect(result.rhythms).toBeDefined();
      expect(result.rhythms.length).toBeGreaterThan(0);
      expect(result.instances).toBeDefined();
      expect(result.observations).toBeDefined();
    });

    it('saves data to localStorage', () => {
      seedAllData({ cycleCount: 1 });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cosmic_loops_v1',
        expect.any(String)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cosmic_echoes_v1',
        expect.any(String)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cosmic_rhythms_v1',
        expect.any(String)
      );
    });

    it('clears existing data when clearExisting is true', () => {
      seedAllData({ cycleCount: 1, clearExisting: true });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_loops_v1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_echoes_v1');
    });
  });

  describe('seedLoops', () => {
    it('generates loops with required fields', () => {
      const loops = seedLoops(1);

      expect(loops.length).toBeGreaterThan(0);

      const loop = loops[0];
      expect(loop.id).toBeDefined();
      expect(loop.title).toBeDefined();
      expect(loop.type).toMatch(/^(cycle|phase)$/);
      expect(loop.status).toMatch(/^(active|closed|released)$/);
      expect(loop.color).toMatch(/^#[A-F0-9]{6}$/);
      expect(loop.subtasks).toBeDefined();
      expect(Array.isArray(loop.subtasks)).toBe(true);
      expect(loop.phaseOpened).toBeDefined();
      expect(loop.phaseName).toBeDefined();
      expect(loop.openedAt).toBeDefined();
    });

    it('generates both cycle and phase loops', () => {
      const loops = seedLoops(2);

      const cycleLoops = loops.filter(l => l.type === 'cycle');
      const phaseLoops = loops.filter(l => l.type === 'phase');

      expect(cycleLoops.length).toBeGreaterThan(0);
      expect(phaseLoops.length).toBeGreaterThan(0);
    });

    it('generates subtasks with proper structure', () => {
      const loops = seedLoops(1);
      const loopWithSubtasks = loops.find(l => l.subtasks.length > 0);

      expect(loopWithSubtasks).toBeDefined();
      const subtask = loopWithSubtasks.subtasks[0];
      expect(subtask.id).toBeDefined();
      expect(subtask.text).toBeDefined();
      expect(typeof subtask.done).toBe('boolean');
    });
  });

  describe('seedEchoes', () => {
    it('generates echoes with required fields', () => {
      const echoes = seedEchoes(1);

      expect(echoes.length).toBeGreaterThan(0);

      const echo = echoes[0];
      expect(echo.id).toBeDefined();
      expect(echo.text).toBeDefined();
      expect(echo.source).toMatch(/^(text|voice)$/);
      expect(echo.phase).toBeDefined();
      expect(echo.phaseName).toBeDefined();
      expect(echo.lunarMonth).toBeDefined();
      expect(echo.dayOfCycle).toBeDefined();
      expect(echo.zodiac).toBeDefined();
      expect(echo.illumination).toBeDefined();
      expect(echo.createdAt).toBeDefined();
    });

    it('generates echoes across different phases', () => {
      const echoes = seedEchoes(2);
      const phases = new Set(echoes.map(e => e.phase));

      // Should have echoes from multiple phases
      expect(phases.size).toBeGreaterThan(1);
    });

    it('generates echoes with valid tags', () => {
      const echoes = seedEchoes(2);
      const echoWithTags = echoes.find(e => e.tags && e.tags.length > 0);

      if (echoWithTags) {
        expect(Array.isArray(echoWithTags.tags)).toBe(true);
      }
    });
  });

  describe('seedRhythms', () => {
    it('generates rhythms with required fields', () => {
      const data = seedRhythms(1);

      expect(data.rhythms.length).toBeGreaterThan(0);

      const rhythm = data.rhythms[0];
      expect(rhythm.id).toBeDefined();
      expect(rhythm.name).toBeDefined();
      expect(rhythm.scope).toMatch(/^(ongoing|this-cycle)$/);
      expect(rhythm.active).toBe(true);
      expect(rhythm.createdAt).toBeDefined();
    });

    it('generates cycle instances for rhythms', () => {
      const data = seedRhythms(2);

      expect(data.instances.length).toBeGreaterThan(0);

      const instance = data.instances[0];
      expect(instance.id).toBeDefined();
      expect(instance.rhythmId).toBeDefined();
      expect(instance.cycleStart).toBeDefined();
      expect(instance.intentionType).toMatch(/^(whole|phase)$/);
    });

    it('generates observations for instances', () => {
      const data = seedRhythms(2);

      expect(data.observations.length).toBeGreaterThan(0);

      const obs = data.observations[0];
      expect(obs.id).toBeDefined();
      expect(obs.cycleInstanceId).toBeDefined();
      expect(obs.phase).toBeDefined();
      expect(obs.engagement).toMatch(/^(none|light|moderate|deep|ceremonial)$/);
      expect(obs.loggedAt).toBeDefined();
      expect(obs.dateKey).toBeDefined();
    });

    it('links instances to their rhythms', () => {
      const data = seedRhythms(1);

      const rhythmIds = new Set(data.rhythms.map(r => r.id));
      for (const instance of data.instances) {
        expect(rhythmIds.has(instance.rhythmId)).toBe(true);
      }
    });

    it('links observations to their instances', () => {
      const data = seedRhythms(1);

      const instanceIds = new Set(data.instances.map(i => i.id));
      for (const obs of data.observations) {
        expect(instanceIds.has(obs.cycleInstanceId)).toBe(true);
      }
    });
  });

  describe('clearAllData', () => {
    it('removes all app data from localStorage', () => {
      // First seed some data
      seedAllData({ cycleCount: 1 });

      // Then clear it
      clearAllData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_loops_v1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_echoes_v1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_rhythms_v1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_rhythm_instances_v1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cosmic_rhythm_observations_v1');
    });
  });

  describe('data consistency', () => {
    it('generates loops with valid lunar month names', () => {
      const loops = seedLoops(3);
      const validMonths = [
        'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
        'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold'
      ];

      for (const loop of loops) {
        expect(validMonths).toContain(loop.lunarMonthOpened);
      }
    });

    it('generates echoes with valid phase keys', () => {
      const echoes = seedEchoes(2);
      const validPhases = [
        'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
        'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'
      ];

      for (const echo of echoes) {
        expect(validPhases).toContain(echo.phase);
      }
    });

    it('generates observations with valid engagement levels', () => {
      const data = seedRhythms(2);
      const validEngagements = ['none', 'light', 'moderate', 'deep', 'ceremonial'];

      for (const obs of data.observations) {
        expect(validEngagements).toContain(obs.engagement);
      }
    });
  });
});
