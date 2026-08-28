import { describe, it, expect } from 'vitest';
import { getTimeContext } from './time.js';

describe('Authoritative Time Grounding (America/Chicago)', () => {
  describe('Year and Local Date Resolution', () => {
    it('accurately resolves current year and local date for Aug 28, 2026', () => {
      // 2026-08-28 22:00:00 UTC = 2026-08-28 17:00:00 CDT
      const testDate = new Date('2026-08-28T22:00:00.000Z');
      const timeCtx = getTimeContext('America/Chicago', testDate);

      expect(timeCtx.currentYear).toBe(2026);
      expect(timeCtx.localDate).toBe('2026-08-28');
      expect(timeCtx.today).toBe('2026-08-28');
      expect(timeCtx.yesterday).toBe('2026-08-27');
      expect(timeCtx.tomorrow).toBe('2026-08-29');
      expect(timeCtx.timezone).toBe('America/Chicago');
      expect(timeCtx.utcOffset).toBe('-05:00');
      expect(timeCtx.isDST).toBe(true);
      expect(timeCtx.source).toBe('server_authoritative_clock');
    });

    it('accurately distinguishes today vs yesterday across midnight boundary', () => {
      // 2026-08-28 05:15:00 UTC = 2026-08-28 00:15:00 CDT (just after midnight)
      const afterMidnight = new Date('2026-08-28T05:15:00.000Z');
      const ctxAfter = getTimeContext('America/Chicago', afterMidnight);

      expect(ctxAfter.today).toBe('2026-08-28');
      expect(ctxAfter.yesterday).toBe('2026-08-27');

      // 2026-08-28 04:50:00 UTC = 2026-08-27 23:50:00 CDT (just before midnight)
      const beforeMidnight = new Date('2026-08-28T04:50:00.000Z');
      const ctxBefore = getTimeContext('America/Chicago', beforeMidnight);

      expect(ctxBefore.today).toBe('2026-08-27');
      expect(ctxBefore.yesterday).toBe('2026-08-26');
    });
  });

  describe('Daylight Saving Time (DST) Transitions', () => {
    it('identifies CDT (UTC-5) during summer', () => {
      const summerDate = new Date('2026-07-15T18:00:00.000Z');
      const ctx = getTimeContext('America/Chicago', summerDate);

      expect(ctx.utcOffset).toBe('-05:00');
      expect(ctx.isDST).toBe(true);
      expect(ctx.localNow).toContain('CDT');
    });

    it('identifies CST (UTC-6) during winter', () => {
      const winterDate = new Date('2026-01-15T18:00:00.000Z');
      const ctx = getTimeContext('America/Chicago', winterDate);

      expect(ctx.utcOffset).toBe('-06:00');
      expect(ctx.isDST).toBe(false);
      expect(ctx.localNow).toContain('CST');
    });
  });

  describe('Year Rollover Boundary', () => {
    it('correctly handles Dec 31 -> Jan 1 boundary', () => {
      // 2027-01-01 06:30:00 UTC = 2027-01-01 00:30:00 CST
      const newYearDate = new Date('2027-01-01T06:30:00.000Z');
      const ctx = getTimeContext('America/Chicago', newYearDate);

      expect(ctx.currentYear).toBe(2027);
      expect(ctx.today).toBe('2027-01-01');
      expect(ctx.yesterday).toBe('2026-12-31');
    });
  });

  describe('Relative Date Search Resolution', () => {
    it('guarantees date boundaries resolve to 2026 authoritative year', () => {
      const liveDate = new Date('2026-08-28T22:00:00.000Z');
      const ctx = getTimeContext('America/Chicago', liveDate);

      // Simulating a tool query boundary for "since last week"
      const sevenDaysAgo = new Date(liveDate.getTime() - 7 * 86400000).toISOString();
      
      expect(ctx.currentYear).toBe(2026);
      expect(sevenDaysAgo).toContain('2026-08-21');
      expect(ctx.today.startsWith('2026')).toBe(true);
      expect(ctx.today.startsWith('2025')).toBe(false);
    });
  });
});
