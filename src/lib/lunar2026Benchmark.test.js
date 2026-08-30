import { describe, it, expect } from 'vitest';
import { getLunarData, getMoonElongation, getMoonAge, getIllumination, getPhaseInfo, getLunarMonthName } from './lunar.js';

// Authoritative 2026 USNO Astronomical Ephemeris table (UTC)
const ASTRONOMICAL_2026_EVENTS = [
  { name: 'Full Moon', key: 'full', utc: '2026-01-03T10:03:00Z', expectedMonth: 'Wolf' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-01-10T15:47:00Z', expectedMonth: 'Wolf' },
  { name: 'New Moon', key: 'new', utc: '2026-01-18T19:52:00Z', expectedMonth: 'Snow' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-01-26T04:48:00Z', expectedMonth: 'Snow' },
  { name: 'Full Moon', key: 'full', utc: '2026-02-01T22:09:00Z', expectedMonth: 'Snow' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-02-09T08:33:00Z', expectedMonth: 'Snow' },
  { name: 'New Moon', key: 'new', utc: '2026-02-17T12:01:00Z', expectedMonth: 'Worm' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-02-24T14:28:00Z', expectedMonth: 'Worm' },
  { name: 'Full Moon', key: 'full', utc: '2026-03-03T11:38:00Z', expectedMonth: 'Worm' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-03-11T03:38:00Z', expectedMonth: 'Worm' },
  { name: 'New Moon', key: 'new', utc: '2026-03-19T01:23:00Z', expectedMonth: 'Pink' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-03-25T21:18:00Z', expectedMonth: 'Pink' },
  { name: 'Full Moon', key: 'full', utc: '2026-04-02T02:12:00Z', expectedMonth: 'Pink' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-04-09T23:52:00Z', expectedMonth: 'Pink' },
  { name: 'New Moon', key: 'new', utc: '2026-04-17T11:52:00Z', expectedMonth: 'Flower' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-04-24T02:32:00Z', expectedMonth: 'Flower' },
  { name: 'Full Moon', key: 'full', utc: '2026-05-01T17:23:00Z', expectedMonth: 'Flower' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-05-09T19:09:00Z', expectedMonth: 'Flower' },
  { name: 'New Moon', key: 'new', utc: '2026-05-16T20:01:00Z', expectedMonth: 'Strawberry' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-05-23T07:11:00Z', expectedMonth: 'Strawberry' },
  { name: 'Full Moon', key: 'full', utc: '2026-05-31T08:45:00Z', expectedMonth: 'Strawberry' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-06-08T11:07:00Z', expectedMonth: 'Strawberry' },
  { name: 'New Moon', key: 'new', utc: '2026-06-15T02:54:00Z', expectedMonth: 'Buck' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-06-21T12:56:00Z', expectedMonth: 'Buck' },
  { name: 'Full Moon', key: 'full', utc: '2026-06-29T23:57:00Z', expectedMonth: 'Buck' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-07-07T23:29:00Z', expectedMonth: 'Buck' },
  { name: 'New Moon', key: 'new', utc: '2026-07-14T09:44:00Z', expectedMonth: 'Sturgeon' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-07-20T20:53:00Z', expectedMonth: 'Sturgeon' },
  { name: 'Full Moon', key: 'full', utc: '2026-07-29T14:36:00Z', expectedMonth: 'Sturgeon' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-08-06T08:35:00Z', expectedMonth: 'Sturgeon' },
  { name: 'New Moon', key: 'new', utc: '2026-08-12T17:37:00Z', expectedMonth: 'Harvest' },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-08-19T08:15:00Z', expectedMonth: 'Harvest' },
  { name: 'Full Moon', key: 'full', utc: '2026-08-28T04:18:00Z', expectedMonth: 'Harvest' },
  { name: 'Last Quarter', key: 'last-quarter', utc: '2026-09-04T15:49:00Z', expectedMonth: 'Harvest' },
  { name: 'New Moon', key: 'new', utc: '2026-09-11T03:26:00Z', expectedMonth: "Hunter's" },
  { name: 'First Quarter', key: 'first-quarter', utc: '2026-09-18T00:44:00Z', expectedMonth: "Hunter's" },
  { name: 'Full Moon', key: 'full', utc: '2026-09-26T16:49:00Z', expectedMonth: "Hunter's" }
];

describe('Luna 2026 USNO Astronomical Benchmark Suite (37 Milestones)', () => {
  it('achieves 100% precision across all 37 USNO 2026 lunar milestones', () => {
    let matchCount = 0;

    for (const event of ASTRONOMICAL_2026_EVENTS) {
      const date = new Date(event.utc);
      const data = getLunarData(date);

      expect(
        data.phase.key,
        `Astronomical milestone ${event.name} at ${event.utc} must match key ${event.key}`
      ).toBe(event.key);

      matchCount++;
    }

    expect(matchCount).toBe(37);
  });

  it('correctly maps 100% illumination at Full Moons and 0% at New Moons', () => {
    const fullMoon = new Date('2026-08-28T04:18:00Z');
    const newMoon = new Date('2026-08-12T17:37:00Z');

    expect(getIllumination(fullMoon)).toBeGreaterThanOrEqual(99);
    expect(getIllumination(newMoon)).toBeLessThanOrEqual(1);
  });

  it('verifies seamless boundary transitions without phase gaps or undefined behavior', () => {
    // 1 hour before and 1 hour after New Moon boundary
    const nearNewMoon = new Date('2026-08-12T17:37:00Z');
    const hourBefore = new Date(nearNewMoon.getTime() - 3600000);
    const hourAfter = new Date(nearNewMoon.getTime() + 3600000);

    const dataBefore = getLunarData(hourBefore);
    const dataAfter = getLunarData(hourAfter);

    expect(dataBefore.phase.key).toBe('new');
    expect(dataAfter.phase.key).toBe('new');
  });
});
