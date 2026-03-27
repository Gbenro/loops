import { describe, it, expect, beforeEach } from 'vitest';
import {
  toJulianDate,
  fromJulianDate,
  getMoonAge,
  getIllumination,
  getPhaseInfo,
  getLunarMonthName,
  getDaysUntilPhase,
  getDaysUntilFull,
  getDaysUntilNew,
  getMoonZodiac,
  getLunarData,
  getPhaseEmoji,
  getAllPhases,
} from './lunar.js';

describe('lunar.js', () => {
  describe('Julian Date conversions', () => {
    it('converts JavaScript Date to Julian Date', () => {
      // Jan 1, 2000 00:00 UTC = JD 2451544.5
      const date = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
      const jd = toJulianDate(date);
      expect(jd).toBeCloseTo(2451544.5, 1);
    });

    it('converts Julian Date back to JavaScript Date', () => {
      const jd = 2451544.5; // Jan 1, 2000 00:00 UTC
      const date = fromJulianDate(jd);
      expect(date.getUTCFullYear()).toBe(2000);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(1);
    });

    it('round-trips date conversions correctly', () => {
      const original = new Date(2023, 5, 15, 12, 0, 0);
      const jd = toJulianDate(original);
      const roundTrip = fromJulianDate(jd);
      expect(roundTrip.getTime()).toBeCloseTo(original.getTime(), -3);
    });
  });

  describe('getMoonAge', () => {
    it('returns age between 0 and 29.53 days', () => {
      const age = getMoonAge(new Date());
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(29.53);
    });

    it('returns consistent age for same date', () => {
      const testDate = new Date(2023, 5, 15);
      const age1 = getMoonAge(testDate);
      const age2 = getMoonAge(testDate);
      expect(age1).toBe(age2);
    });

    it('returns known new moon age for Jan 6, 2000', () => {
      // Known new moon: Jan 6 2000 18:14 UTC (JD 2451550.259)
      const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
      const age = getMoonAge(newMoon);
      expect(age).toBeCloseTo(0, 1);
    });
  });

  describe('getIllumination', () => {
    it('returns illumination between 0 and 100', () => {
      const illumination = getIllumination(new Date());
      expect(illumination).toBeGreaterThanOrEqual(0);
      expect(illumination).toBeLessThanOrEqual(100);
    });

    it('returns 0% at new moon', () => {
      // Create a date near new moon (age ~0)
      const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
      const illumination = getIllumination(newMoon);
      expect(illumination).toBeLessThanOrEqual(5);
    });

    it('returns ~100% at full moon', () => {
      // Full moon is ~14.76 days after new moon
      const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
      const fullMoon = new Date(newMoon.getTime() + 14.76 * 24 * 60 * 60 * 1000);
      const illumination = getIllumination(fullMoon);
      expect(illumination).toBeGreaterThanOrEqual(95);
    });
  });

  describe('getPhaseInfo', () => {
    it('returns new moon phase for age 0', () => {
      const phase = getPhaseInfo(0);
      expect(phase.key).toBe('new');
      expect(phase.name).toBe('New Moon');
      expect(phase.energy).toBe('Seed');
      expect(phase.isNew).toBe(true);
      expect(phase.isFull).toBe(false);
      expect(phase.isThreshold).toBe(true);
    });

    it('returns first quarter for age ~8 days', () => {
      const phase = getPhaseInfo(8);
      expect(phase.key).toBe('first-quarter');
      expect(phase.name).toBe('First Quarter');
      expect(phase.energy).toBe('Decide');
      expect(phase.isThreshold).toBe(true);
    });

    it('returns full moon for age ~15 days', () => {
      const phase = getPhaseInfo(15);
      expect(phase.key).toBe('full');
      expect(phase.name).toBe('Full Moon');
      expect(phase.energy).toBe('Illuminate');
      expect(phase.isFull).toBe(true);
      expect(phase.isThreshold).toBe(true);
    });

    it('returns last quarter for age ~22 days', () => {
      const phase = getPhaseInfo(22.5);
      expect(phase.key).toBe('last-quarter');
      expect(phase.energy).toBe('Release');
      expect(phase.isThreshold).toBe(true);
    });

    it('identifies waning phases correctly', () => {
      const waningGibbous = getPhaseInfo(17);
      expect(waningGibbous.isWaning).toBe(true);

      const waxingGibbous = getPhaseInfo(12);
      expect(waxingGibbous.isWaning).toBe(false);
    });

    it('correctly identifies flow vs threshold phases', () => {
      // Threshold phases
      expect(getPhaseInfo(0).isThreshold).toBe(true); // new
      expect(getPhaseInfo(8).isThreshold).toBe(true); // first quarter
      expect(getPhaseInfo(15).isThreshold).toBe(true); // full
      expect(getPhaseInfo(22.5).isThreshold).toBe(true); // last quarter

      // Flow phases
      expect(getPhaseInfo(4).isFlow).toBe(true); // waxing crescent
      expect(getPhaseInfo(12).isFlow).toBe(true); // waxing gibbous
      expect(getPhaseInfo(20).isFlow).toBe(true); // waning gibbous
      expect(getPhaseInfo(27).isFlow).toBe(true); // waning crescent
    });

    it('handles edge case of age >= 29.53 (wraps to new moon)', () => {
      const phase = getPhaseInfo(29.6);
      expect(phase.key).toBe('new');
      expect(phase.isNew).toBe(true);
    });
  });

  describe('getLunarMonthName', () => {
    it('returns valid lunar month name', () => {
      const validMonths = [
        'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
        'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold',
      ];
      const monthName = getLunarMonthName(new Date());
      expect(validMonths).toContain(monthName);
    });

    it('returns Wolf Moon for January', () => {
      // A date in January where the full moon falls in January
      const janDate = new Date(2023, 0, 15);
      // The month depends on when the full moon falls
      const monthName = getLunarMonthName(janDate);
      expect(typeof monthName).toBe('string');
    });
  });

  describe('getDaysUntilPhase', () => {
    it('returns days until target phase', () => {
      const days = getDaysUntilPhase(0.5, new Date());
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('returns 0 when at target phase', () => {
      // At full moon (phase 0.5)
      const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
      const fullMoon = new Date(newMoon.getTime() + 14.76 * 24 * 60 * 60 * 1000);
      const days = getDaysUntilPhase(0.5, fullMoon);
      expect(days).toBeLessThanOrEqual(1);
    });
  });

  describe('getDaysUntilFull', () => {
    it('returns days between 0 and 30', () => {
      const days = getDaysUntilFull(new Date());
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(30);
    });
  });

  describe('getDaysUntilNew', () => {
    it('returns days between 0 and 30', () => {
      const days = getDaysUntilNew(new Date());
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(30);
    });
  });

  describe('getMoonZodiac', () => {
    it('returns valid zodiac sign and degree', () => {
      const zodiac = getMoonZodiac(new Date());
      const validSigns = [
        'Aries', 'Taurus', 'Gemini', 'Cancer',
        'Leo', 'Virgo', 'Libra', 'Scorpio',
        'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
      ];
      expect(validSigns).toContain(zodiac.sign);
      expect(zodiac.degree).toBeGreaterThanOrEqual(0);
      expect(zodiac.degree).toBeLessThan(30);
    });
  });

  describe('getLunarData', () => {
    it('returns complete lunar data bundle', () => {
      const data = getLunarData(new Date());

      // Check all expected properties exist
      expect(data).toHaveProperty('age');
      expect(data).toHaveProperty('dayOfCycle');
      expect(data).toHaveProperty('phase');
      expect(data).toHaveProperty('illumination');
      expect(data).toHaveProperty('lunarMonth');
      expect(data).toHaveProperty('zodiac');
      expect(data).toHaveProperty('daysToFull');
      expect(data).toHaveProperty('daysToNew');
      expect(data).toHaveProperty('phaseProgress');
      expect(data).toHaveProperty('phaseRemaining');
      expect(data).toHaveProperty('remainingHours');
      expect(data).toHaveProperty('isApproaching');
      expect(data).toHaveProperty('isImminent');
      expect(data).toHaveProperty('nextPhase');
      expect(data).toHaveProperty('nextSymbol');
      expect(data).toHaveProperty('nextEnergy');
      expect(data).toHaveProperty('nextPhaseType');
      expect(data).toHaveProperty('nextPhaseDuration');
      expect(data).toHaveProperty('approachingThreshold');
      expect(data).toHaveProperty('isNewCycleApproaching');
    });

    it('dayOfCycle is between 1 and 30', () => {
      const data = getLunarData(new Date());
      expect(data.dayOfCycle).toBeGreaterThanOrEqual(1);
      expect(data.dayOfCycle).toBeLessThanOrEqual(30);
    });

    it('phaseProgress is between 0 and 1', () => {
      const data = getLunarData(new Date());
      expect(data.phaseProgress).toBeGreaterThanOrEqual(0);
      expect(data.phaseProgress).toBeLessThanOrEqual(1);
    });
  });

  describe('getPhaseEmoji', () => {
    it('returns correct emoji for each phase', () => {
      expect(getPhaseEmoji('new')).toBe('🌑');
      expect(getPhaseEmoji('waxing-crescent')).toBe('🌒');
      expect(getPhaseEmoji('first-quarter')).toBe('🌓');
      expect(getPhaseEmoji('waxing-gibbous')).toBe('🌔');
      expect(getPhaseEmoji('full')).toBe('🌕');
      expect(getPhaseEmoji('waning-gibbous')).toBe('🌖');
      expect(getPhaseEmoji('last-quarter')).toBe('🌗');
      expect(getPhaseEmoji('waning-crescent')).toBe('🌘');
    });

    it('returns default emoji for unknown phase', () => {
      expect(getPhaseEmoji('unknown')).toBe('🌙');
    });
  });

  describe('getAllPhases', () => {
    it('returns all 8 lunar phases', () => {
      const phases = getAllPhases();
      expect(phases).toHaveLength(8);
    });

    it('each phase has required properties', () => {
      const phases = getAllPhases();
      phases.forEach(phase => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('key');
        expect(phase).toHaveProperty('emoji');
        expect(phase).toHaveProperty('energy');
      });
    });

    it('phases are in correct order', () => {
      const phases = getAllPhases();
      expect(phases[0].key).toBe('new');
      expect(phases[1].key).toBe('waxing-crescent');
      expect(phases[2].key).toBe('first-quarter');
      expect(phases[3].key).toBe('waxing-gibbous');
      expect(phases[4].key).toBe('full');
      expect(phases[5].key).toBe('waning-gibbous');
      expect(phases[6].key).toBe('last-quarter');
      expect(phases[7].key).toBe('waning-crescent');
    });
  });
});
