import { describe, it, expect } from 'vitest';
import {
  resolvePhaseText,
  getPhaseGuidanceText,
  getPhaseRelevantTags,
  TEXT_SLOTS,
} from './phaseText.js';

describe('phaseText.js', () => {
  describe('TEXT_SLOTS structure', () => {
    it('has expected slot definitions', () => {
      expect(TEXT_SLOTS).toHaveProperty('loopTitlePlaceholder');
      expect(TEXT_SLOTS).toHaveProperty('subtaskPlaceholder');
      expect(TEXT_SLOTS).toHaveProperty('notePlaceholder');
      expect(TEXT_SLOTS).toHaveProperty('noLoopsMessage');
      expect(TEXT_SLOTS).toHaveProperty('noLoopsSubtext');
      expect(TEXT_SLOTS).toHaveProperty('noEchoesMessage');
      expect(TEXT_SLOTS).toHaveProperty('noRhythmsMessage');
      expect(TEXT_SLOTS).toHaveProperty('noRhythmsSubtext');
      expect(TEXT_SLOTS).toHaveProperty('rhythmContinuePrompt');
      expect(TEXT_SLOTS).toHaveProperty('openLoopPrompt');
    });

    it('each slot has a fallback', () => {
      Object.values(TEXT_SLOTS).forEach((slot) => {
        expect(slot).toHaveProperty('fallback');
        expect(typeof slot.fallback).toBe('string');
      });
    });

    it('phase pools contain arrays of strings', () => {
      Object.values(TEXT_SLOTS).forEach((slot) => {
        if (slot.phases) {
          Object.values(slot.phases).forEach((pool) => {
            expect(Array.isArray(pool)).toBe(true);
            pool.forEach((text) => {
              expect(typeof text).toBe('string');
            });
          });
        }
      });
    });
  });

  describe('resolvePhaseText', () => {
    it('returns empty string for unknown slot', () => {
      expect(resolvePhaseText('unknownSlot', 'new')).toBe('');
    });

    it('returns fallback when phase has no specific text', () => {
      // rhythmContinuePrompt only has 'new' phase defined
      const result = resolvePhaseText('rhythmContinuePrompt', 'full');
      expect(result).toBe(TEXT_SLOTS.rhythmContinuePrompt.fallback);
    });

    it('returns phase-specific text when available', () => {
      const result = resolvePhaseText('loopTitlePlaceholder', 'new');
      const newPhrases = TEXT_SLOTS.loopTitlePlaceholder.phases['new'];
      expect(newPhrases).toContain(result);
    });

    it('returns consistent result for same slot/phase on same day', () => {
      const result1 = resolvePhaseText('noLoopsMessage', 'full');
      const result2 = resolvePhaseText('noLoopsMessage', 'full');
      expect(result1).toBe(result2);
    });

    it('returns different results for different slots on same day', () => {
      // Different slots use different seeds, so should pick differently
      const result1 = resolvePhaseText('loopTitlePlaceholder', 'new');
      const result2 = resolvePhaseText('notePlaceholder', 'new');
      // These are from different pools so should be different texts
      expect(result1).not.toBe(result2);
    });

    it('works for all 8 lunar phases', () => {
      const phases = [
        'new',
        'waxing-crescent',
        'first-quarter',
        'waxing-gibbous',
        'full',
        'waning-gibbous',
        'last-quarter',
        'waning-crescent',
      ];

      phases.forEach((phase) => {
        const result = resolvePhaseText('noLoopsMessage', phase);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getPhaseGuidanceText', () => {
    it('returns object with expected properties', () => {
      const guidance = getPhaseGuidanceText('new');

      expect(guidance).toHaveProperty('title');
      expect(guidance).toHaveProperty('energy');
      expect(guidance).toHaveProperty('guidance');
      expect(guidance).toHaveProperty('asks');
      expect(guidance).toHaveProperty('loopAdvice');
      expect(guidance).toHaveProperty('deep');
      expect(guidance).toHaveProperty('keywords');
      expect(guidance).toHaveProperty('tideOpening');
      expect(guidance).toHaveProperty('deepTide');
    });

    it('returns content for all lunar phases', () => {
      const phases = [
        'new',
        'waxing-crescent',
        'first-quarter',
        'waxing-gibbous',
        'full',
        'waning-gibbous',
        'last-quarter',
        'waning-crescent',
      ];

      phases.forEach((phase) => {
        const guidance = getPhaseGuidanceText(phase);
        expect(guidance.title).toBeDefined();
        expect(guidance.energy).toBeDefined();
      });
    });

    it('accepts tide parameter', () => {
      const tides = ['opening', 'flowing', 'completing', 'closing'];

      tides.forEach((tide) => {
        const guidance = getPhaseGuidanceText('full', tide);
        expect(guidance).toBeDefined();
      });
    });

    it('defaults to flowing tide when no tide specified', () => {
      const guidance = getPhaseGuidanceText('new');
      expect(guidance).toBeDefined();
      expect(guidance.deepTide).toBeDefined();
    });
  });

  describe('getPhaseRelevantTags', () => {
    it('returns array of strings', () => {
      const tags = getPhaseRelevantTags('new');
      expect(Array.isArray(tags)).toBe(true);
      tags.forEach((tag) => {
        expect(typeof tag).toBe('string');
      });
    });

    it('returns 5 tags for each phase', () => {
      const phases = [
        'new',
        'waxing-crescent',
        'first-quarter',
        'waxing-gibbous',
        'full',
        'waning-gibbous',
        'last-quarter',
        'waning-crescent',
      ];

      phases.forEach((phase) => {
        const tags = getPhaseRelevantTags(phase);
        expect(tags.length).toBe(5);
      });
    });

    it('returns expected tags for new moon', () => {
      const tags = getPhaseRelevantTags('new');
      expect(tags).toContain('intention');
      expect(tags).toContain('seed');
      expect(tags).toContain('rest');
    });

    it('returns expected tags for full moon', () => {
      const tags = getPhaseRelevantTags('full');
      expect(tags).toContain('clarity');
      expect(tags).toContain('insight');
      expect(tags).toContain('revelation');
    });

    it('returns expected tags for last quarter', () => {
      const tags = getPhaseRelevantTags('last-quarter');
      expect(tags).toContain('release');
      expect(tags).toContain('grief');
    });

    it('falls back to new moon tags for unknown phase', () => {
      const tags = getPhaseRelevantTags('unknown-phase');
      const newTags = getPhaseRelevantTags('new');
      expect(tags).toEqual(newTags);
    });
  });

  describe('stablePick consistency', () => {
    it('produces same result within same day', () => {
      // This is implicitly tested, but we verify the determinism
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(resolvePhaseText('loopTitlePlaceholder', 'new'));
      }
      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });
  });
});
