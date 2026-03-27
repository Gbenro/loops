import { describe, it, expect } from 'vitest';
import {
  getDayOfYear,
  getSolarDayOfYear,
  getSeasonInfo,
  getSunSign,
  getSolarThresholds,
  getSolarData,
} from './solar.js';

describe('solar.js', () => {
  describe('getDayOfYear', () => {
    it('returns 1 for January 1', () => {
      const jan1 = new Date(2023, 0, 1);
      expect(getDayOfYear(jan1)).toBe(1);
    });

    it('returns 365 for December 31 (non-leap year)', () => {
      const dec31 = new Date(2023, 11, 31);
      expect(getDayOfYear(dec31)).toBe(365);
    });

    it('returns 366 for December 31 (leap year)', () => {
      const dec31 = new Date(2024, 11, 31);
      expect(getDayOfYear(dec31)).toBe(366);
    });

    it('returns correct day for mid-year dates', () => {
      // July 1 is approximately day 181-182 depending on calculation
      const july1_2023 = new Date(2023, 6, 1);
      const doy2023 = getDayOfYear(july1_2023);
      expect(doy2023).toBeGreaterThanOrEqual(180);
      expect(doy2023).toBeLessThanOrEqual(183);

      const july1_2024 = new Date(2024, 6, 1);
      const doy2024 = getDayOfYear(july1_2024);
      // Leap year should have one more day for same calendar date
      expect(doy2024).toBe(doy2023 + 1);
    });
  });

  describe('getSolarDayOfYear', () => {
    it('returns day 1 for Winter Solstice (Dec 21)', () => {
      const winterSolstice = new Date(2023, 11, 21);
      const solarDay = getSolarDayOfYear(winterSolstice);
      expect(solarDay).toBe(1);
    });

    it('returns days after Winter Solstice correctly', () => {
      const dec25 = new Date(2023, 11, 25);
      const solarDay = getSolarDayOfYear(dec25);
      expect(solarDay).toBe(5); // 4 days after WS
    });

    it('handles year wrap correctly', () => {
      // January 1 is about 11 days after Winter Solstice
      const jan1 = new Date(2024, 0, 1);
      const solarDay = getSolarDayOfYear(jan1);
      expect(solarDay).toBeGreaterThan(10);
      expect(solarDay).toBeLessThan(15);
    });
  });

  describe('getSeasonInfo', () => {
    describe('Northern Hemisphere', () => {
      it('returns Winter for January', () => {
        const jan15 = new Date(2023, 0, 15);
        const season = getSeasonInfo(jan15, 'north');
        expect(season.name).toBe('Winter');
        expect(season.nextEvent).toBe('Spring Equinox');
      });

      it('returns Spring for April', () => {
        const april15 = new Date(2023, 3, 15);
        const season = getSeasonInfo(april15, 'north');
        expect(season.name).toBe('Spring');
        expect(season.nextEvent).toBe('Summer Solstice');
      });

      it('returns Summer for July', () => {
        const july15 = new Date(2023, 6, 15);
        const season = getSeasonInfo(july15, 'north');
        expect(season.name).toBe('Summer');
        expect(season.nextEvent).toBe('Autumn Equinox');
      });

      it('returns Autumn for October', () => {
        const oct15 = new Date(2023, 9, 15);
        const season = getSeasonInfo(oct15, 'north');
        expect(season.name).toBe('Autumn');
        expect(season.nextEvent).toBe('Winter Solstice');
      });

      it('returns Winter for December', () => {
        const dec25 = new Date(2023, 11, 25);
        const season = getSeasonInfo(dec25, 'north');
        expect(season.name).toBe('Winter');
      });
    });

    describe('Southern Hemisphere', () => {
      it('returns Summer for January', () => {
        const jan15 = new Date(2023, 0, 15);
        const season = getSeasonInfo(jan15, 'south');
        expect(season.name).toBe('Summer');
      });

      it('returns Autumn for April', () => {
        const april15 = new Date(2023, 3, 15);
        const season = getSeasonInfo(april15, 'south');
        expect(season.name).toBe('Autumn');
      });

      it('returns Winter for July', () => {
        const july15 = new Date(2023, 6, 15);
        const season = getSeasonInfo(july15, 'south');
        expect(season.name).toBe('Winter');
      });

      it('returns Spring for October', () => {
        const oct15 = new Date(2023, 9, 15);
        const season = getSeasonInfo(oct15, 'south');
        expect(season.name).toBe('Spring');
      });
    });

    it('includes progress percentage', () => {
      const season = getSeasonInfo(new Date(), 'north');
      expect(season.progress).toBeGreaterThanOrEqual(0);
      expect(season.progress).toBeLessThanOrEqual(100);
    });

    it('includes days to next event', () => {
      const season = getSeasonInfo(new Date(), 'north');
      expect(season.daysToNext).toBeGreaterThanOrEqual(0);
      expect(season.daysToNext).toBeLessThanOrEqual(95); // Max season length
    });

    it('includes season description', () => {
      const season = getSeasonInfo(new Date(), 'north');
      expect(season.description).toBeDefined();
      expect(typeof season.description).toBe('string');
    });
  });

  describe('getSunSign', () => {
    it('returns Aries for late March', () => {
      const march25 = new Date(2023, 2, 25);
      expect(getSunSign(march25)).toBe('Aries');
    });

    it('returns Taurus for late April', () => {
      const april25 = new Date(2023, 3, 25);
      expect(getSunSign(april25)).toBe('Taurus');
    });

    it('returns Gemini for early June', () => {
      const june5 = new Date(2023, 5, 5);
      expect(getSunSign(june5)).toBe('Gemini');
    });

    it('returns Cancer for early July', () => {
      const july5 = new Date(2023, 6, 5);
      expect(getSunSign(july5)).toBe('Cancer');
    });

    it('returns Leo for early August', () => {
      const aug5 = new Date(2023, 7, 5);
      expect(getSunSign(aug5)).toBe('Leo');
    });

    it('returns Virgo for early September', () => {
      const sep5 = new Date(2023, 8, 5);
      expect(getSunSign(sep5)).toBe('Virgo');
    });

    it('returns Libra for early October', () => {
      const oct5 = new Date(2023, 9, 5);
      expect(getSunSign(oct5)).toBe('Libra');
    });

    it('returns Scorpio for early November', () => {
      const nov5 = new Date(2023, 10, 5);
      expect(getSunSign(nov5)).toBe('Scorpio');
    });

    it('returns Sagittarius for early December', () => {
      const dec5 = new Date(2023, 11, 5);
      expect(getSunSign(dec5)).toBe('Sagittarius');
    });

    it('handles Capricorn year wrap correctly', () => {
      const dec25 = new Date(2023, 11, 25);
      expect(getSunSign(dec25)).toBe('Capricorn');

      const jan5 = new Date(2024, 0, 5);
      expect(getSunSign(jan5)).toBe('Capricorn');
    });

    it('returns Aquarius for late January', () => {
      const jan25 = new Date(2023, 0, 25);
      expect(getSunSign(jan25)).toBe('Aquarius');
    });

    it('returns Pisces for early March', () => {
      const march5 = new Date(2023, 2, 5);
      expect(getSunSign(march5)).toBe('Pisces');
    });
  });

  describe('getSolarThresholds', () => {
    it('returns all 8 solar thresholds', () => {
      const thresholds = getSolarThresholds();
      expect(thresholds).toHaveLength(8);
    });

    it('includes Winter Solstice at day 1', () => {
      const thresholds = getSolarThresholds();
      const winterSolstice = thresholds.find(t => t.name === 'Winter Solstice');
      expect(winterSolstice).toBeDefined();
      expect(winterSolstice.solarDay).toBe(1);
    });

    it('includes all major solar events', () => {
      const thresholds = getSolarThresholds();
      const names = thresholds.map(t => t.name);
      expect(names).toContain('Winter Solstice');
      expect(names).toContain('Spring Equinox');
      expect(names).toContain('Summer Solstice');
      expect(names).toContain('Autumn Equinox');
    });

    it('includes cross-quarter days', () => {
      const thresholds = getSolarThresholds();
      const names = thresholds.map(t => t.name);
      expect(names).toContain('Imbolc');
      expect(names).toContain('Beltane');
      expect(names).toContain('Lughnasadh');
      expect(names).toContain('Samhain');
    });
  });

  describe('getSolarData', () => {
    it('returns complete solar data bundle', () => {
      const data = getSolarData(new Date(), 'north');

      expect(data).toHaveProperty('season');
      expect(data).toHaveProperty('sunSign');
      expect(data).toHaveProperty('dayOfYear');
      expect(data).toHaveProperty('hemisphere');
      expect(data).toHaveProperty('daysFromLastThreshold');
      expect(data).toHaveProperty('daysToNextThreshold');
      expect(data).toHaveProperty('lastThresholdName');
      expect(data).toHaveProperty('nextThresholdName');
      expect(data).toHaveProperty('solarYearPct');
      expect(data).toHaveProperty('solarDayOfYear');
    });

    it('respects hemisphere parameter', () => {
      const jan15 = new Date(2023, 0, 15);

      const northData = getSolarData(jan15, 'north');
      const southData = getSolarData(jan15, 'south');

      expect(northData.hemisphere).toBe('north');
      expect(southData.hemisphere).toBe('south');
      expect(northData.season.name).toBe('Winter');
      expect(southData.season.name).toBe('Summer');
    });

    it('solarYearPct is between 0 and 1', () => {
      const data = getSolarData(new Date(), 'north');
      expect(data.solarYearPct).toBeGreaterThanOrEqual(0);
      expect(data.solarYearPct).toBeLessThanOrEqual(1);
    });
  });
});
