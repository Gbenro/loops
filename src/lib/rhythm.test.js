import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRhythms,
  saveRhythm,
  deleteRhythm,
  getInstancesForRhythm,
  getOrCreateCurrentInstance,
  saveInstance,
  getObservationsForInstance,
  saveObservation,
  clearRhythmCache,
} from './rhythm.js';

// Mock supabase
vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('rhythm.js', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
    vi.spyOn(window.localStorage, 'clear').mockImplementation(() => {
      mockStorage = {};
    });

    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1234');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRhythms', () => {
    it('returns empty array when no rhythms exist', async () => {
      const rhythms = await getRhythms(null);
      expect(rhythms).toEqual([]);
    });

    it('returns locally stored rhythms when no userId', async () => {
      const testRhythms = [
        { id: 'rhythm-1', name: 'Daily Meditation', scope: 'ongoing' },
        { id: 'rhythm-2', name: 'Moon Journal', scope: 'cycle' },
      ];
      mockStorage['cosmic_rhythms_v1'] = JSON.stringify(testRhythms);

      const rhythms = await getRhythms(null);
      expect(rhythms).toHaveLength(2);
      expect(rhythms[0].name).toBe('Daily Meditation');
    });

    it('handles corrupted localStorage gracefully', async () => {
      mockStorage['cosmic_rhythms_v1'] = 'invalid json';

      const rhythms = await getRhythms(null);
      expect(rhythms).toEqual([]);
    });
  });

  describe('saveRhythm', () => {
    it('saves rhythm to localStorage', async () => {
      const rhythm = {
        id: 'new-rhythm',
        name: 'Morning Routine',
        scope: 'ongoing',
        active: true,
        createdAt: new Date().toISOString(),
      };

      await saveRhythm(rhythm, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythms_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Morning Routine');
    });

    it('updates existing rhythm in localStorage', async () => {
      const originalRhythm = {
        id: 'rhythm-1',
        name: 'Original Name',
        scope: 'ongoing',
      };
      mockStorage['cosmic_rhythms_v1'] = JSON.stringify([originalRhythm]);

      const updatedRhythm = {
        id: 'rhythm-1',
        name: 'Updated Name',
        scope: 'cycle',
      };

      await saveRhythm(updatedRhythm, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythms_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Updated Name');
      expect(stored[0].scope).toBe('cycle');
    });

    it('returns the saved rhythm', async () => {
      const rhythm = { id: 'test', name: 'Test Rhythm' };
      const result = await saveRhythm(rhythm, null);
      expect(result).toEqual(rhythm);
    });
  });

  describe('deleteRhythm', () => {
    it('removes rhythm from localStorage', async () => {
      const rhythms = [
        { id: 'rhythm-1', name: 'Keep This' },
        { id: 'rhythm-2', name: 'Delete This' },
      ];
      mockStorage['cosmic_rhythms_v1'] = JSON.stringify(rhythms);

      await deleteRhythm('rhythm-2', null);

      const stored = JSON.parse(mockStorage['cosmic_rhythms_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('rhythm-1');
    });

    it('handles deleting non-existent rhythm', async () => {
      const rhythms = [{ id: 'rhythm-1', name: 'Only One' }];
      mockStorage['cosmic_rhythms_v1'] = JSON.stringify(rhythms);

      await deleteRhythm('non-existent', null);

      const stored = JSON.parse(mockStorage['cosmic_rhythms_v1']);
      expect(stored).toHaveLength(1);
    });
  });

  describe('getOrCreateCurrentInstance', () => {
    it('creates new instance when none exists', async () => {
      const rhythm = { id: 'rhythm-1', name: 'Test Rhythm' };
      const cycleStart = new Date('2024-01-01');

      const instance = await getOrCreateCurrentInstance(rhythm, cycleStart, null);

      expect(instance.rhythmId).toBe('rhythm-1');
      expect(instance.cycleStart).toBe(cycleStart.toISOString());
      expect(instance.intentionType).toBeNull();
      expect(instance.phaseIntentions).toEqual({});
      expect(instance.reportGenerated).toBe(false);
    });

    it('returns existing instance when one exists', async () => {
      const existingInstance = {
        id: 'existing-instance',
        rhythmId: 'rhythm-1',
        cycleStart: new Date('2024-01-01').toISOString(),
        intentionType: 'whole',
        wholeIntention: 'Be mindful',
      };
      mockStorage['cosmic_rhythm_instances_v1'] = JSON.stringify([existingInstance]);

      const rhythm = { id: 'rhythm-1', name: 'Test Rhythm' };
      const instance = await getOrCreateCurrentInstance(rhythm, new Date('2024-01-01'), null);

      expect(instance.id).toBe('existing-instance');
      expect(instance.wholeIntention).toBe('Be mindful');
    });

    it('stores new instance in localStorage', async () => {
      const rhythm = { id: 'rhythm-1' };

      await getOrCreateCurrentInstance(rhythm, new Date(), null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_instances_v1']);
      expect(stored).toHaveLength(1);
    });
  });

  describe('saveInstance', () => {
    it('saves new instance to localStorage', async () => {
      const instance = {
        id: 'new-instance',
        rhythmId: 'rhythm-1',
        cycleStart: new Date().toISOString(),
      };

      await saveInstance(instance, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_instances_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('new-instance');
    });

    it('updates existing instance', async () => {
      const instance = {
        id: 'instance-1',
        rhythmId: 'rhythm-1',
        intentionType: null,
      };
      mockStorage['cosmic_rhythm_instances_v1'] = JSON.stringify([instance]);

      const updatedInstance = {
        id: 'instance-1',
        rhythmId: 'rhythm-1',
        intentionType: 'whole',
        wholeIntention: 'New intention',
      };

      await saveInstance(updatedInstance, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_instances_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].wholeIntention).toBe('New intention');
    });
  });

  describe('saveObservation', () => {
    it('saves new observation to localStorage', async () => {
      const observation = {
        id: 'obs-1',
        cycleInstanceId: 'instance-1',
        phase: 'new',
        engagement: 'engaged',
        note: 'Feeling connected',
        loggedAt: new Date().toISOString(),
      };

      await saveObservation(observation, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_observations_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].engagement).toBe('engaged');
      expect(stored[0].dateKey).toBeDefined(); // dateKey auto-populated
    });

    it('replaces observation for same phase/instance/date', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const existingObs = {
        id: 'obs-1',
        cycleInstanceId: 'instance-1',
        phase: 'full',
        engagement: 'skipped',
        loggedAt: new Date().toISOString(),
        dateKey: today,
      };
      mockStorage['cosmic_rhythm_observations_v1'] = JSON.stringify([existingObs]);

      const newObs = {
        id: 'obs-2',
        cycleInstanceId: 'instance-1',
        phase: 'full',
        engagement: 'engaged',
        note: 'Updated note',
        loggedAt: new Date().toISOString(),
        dateKey: today,
      };

      await saveObservation(newObs, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_observations_v1']);
      expect(stored).toHaveLength(1);
      expect(stored[0].engagement).toBe('engaged');
      expect(stored[0].note).toBe('Updated note');
    });

    it('allows multiple observations for same phase on different days', async () => {
      const existingObs = {
        id: 'obs-1',
        cycleInstanceId: 'instance-1',
        phase: 'full',
        engagement: 'light',
        loggedAt: '2024-01-01T12:00:00.000Z',
        dateKey: '2024-01-01',
      };
      mockStorage['cosmic_rhythm_observations_v1'] = JSON.stringify([existingObs]);

      const newObs = {
        id: 'obs-2',
        cycleInstanceId: 'instance-1',
        phase: 'full',
        engagement: 'deep',
        note: 'Day 2',
        loggedAt: '2024-01-02T12:00:00.000Z',
        dateKey: '2024-01-02',
      };

      await saveObservation(newObs, null);

      const stored = JSON.parse(mockStorage['cosmic_rhythm_observations_v1']);
      expect(stored).toHaveLength(2); // Both observations kept - different days
      expect(stored[0].dateKey).toBe('2024-01-01');
      expect(stored[1].dateKey).toBe('2024-01-02');
    });
  });

  describe('getObservationsForInstance', () => {
    it('returns observations for specific instance', async () => {
      const observations = [
        { id: 'obs-1', cycleInstanceId: 'instance-1', phase: 'new' },
        { id: 'obs-2', cycleInstanceId: 'instance-1', phase: 'full' },
        { id: 'obs-3', cycleInstanceId: 'instance-2', phase: 'new' },
      ];
      mockStorage['cosmic_rhythm_observations_v1'] = JSON.stringify(observations);

      const result = await getObservationsForInstance('instance-1', null);
      expect(result).toHaveLength(2);
      expect(result.every((o) => o.cycleInstanceId === 'instance-1')).toBe(true);
    });

    it('returns empty array when no observations exist', async () => {
      const result = await getObservationsForInstance('non-existent', null);
      expect(result).toEqual([]);
    });
  });

  describe('getInstancesForRhythm', () => {
    it('returns instances for specific rhythm', async () => {
      const instances = [
        { id: 'inst-1', rhythmId: 'rhythm-1' },
        { id: 'inst-2', rhythmId: 'rhythm-1' },
        { id: 'inst-3', rhythmId: 'rhythm-2' },
      ];
      mockStorage['cosmic_rhythm_instances_v1'] = JSON.stringify(instances);

      const result = await getInstancesForRhythm('rhythm-1', null);
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.rhythmId === 'rhythm-1')).toBe(true);
    });
  });

  describe('clearRhythmCache', () => {
    it('clears all rhythm-related localStorage keys', () => {
      mockStorage['cosmic_rhythms_v1'] = JSON.stringify([{ id: '1' }]);
      mockStorage['cosmic_rhythm_instances_v1'] = JSON.stringify([{ id: '2' }]);
      mockStorage['cosmic_rhythm_observations_v1'] = JSON.stringify([{ id: '3' }]);
      mockStorage['other_key'] = 'should remain';

      clearRhythmCache();

      expect(mockStorage['cosmic_rhythms_v1']).toBeUndefined();
      expect(mockStorage['cosmic_rhythm_instances_v1']).toBeUndefined();
      expect(mockStorage['cosmic_rhythm_observations_v1']).toBeUndefined();
      expect(mockStorage['other_key']).toBe('should remain');
    });
  });
});
