import { describe, it, expect } from 'vitest';
import { getLunarMonthName, getPhaseInfo, getLunarData, SYNODIC, HALF_THRESHOLD } from './lunar.js';
import { getLunarMonthName as getServerLunarMonthName, getLunarData as getServerLunarData } from '../../mcp-server/dist/lunar.js';

describe('Lunar Month Alignment & Threshold Semantics Suite', () => {
  describe('getLunarMonthName (Client & Server Parity)', () => {
    it('anchors pre-conjunction New Moon (age ~29.26) to the arriving Harvest Moon', () => {
      // 2026-09-10 ~17:20 UTC is ~6 hours before exact conjunction
      const preConjunctionDate = new Date('2026-09-10T17:20:00Z');
      const clientMonth = getLunarMonthName(preConjunctionDate);
      const serverMonth = getServerLunarMonthName(preConjunctionDate);

      expect(clientMonth).toBe('Harvest');
      expect(serverMonth).toBe('Harvest');
    });

    it('anchors post-conjunction New Moon (age ~0.20) to Harvest Moon', () => {
      // 2026-09-11 ~04:00 UTC is ~5 hours after exact conjunction
      const postConjunctionDate = new Date('2026-09-11T04:00:00Z');
      const clientMonth = getLunarMonthName(postConjunctionDate);
      const serverMonth = getServerLunarMonthName(postConjunctionDate);

      expect(clientMonth).toBe('Harvest');
      expect(serverMonth).toBe('Harvest');
    });

    it('retains prior cycle month (Sturgeon) during Late Waning Crescent before New Moon threshold begins', () => {
      // 2026-09-09 ~12:00 UTC is >24 hours before conjunction, during Waning Crescent flow
      const waningCrescentDate = new Date('2026-09-09T12:00:00Z');
      const clientMonth = getLunarMonthName(waningCrescentDate);
      const serverMonth = getServerLunarMonthName(waningCrescentDate);

      expect(clientMonth).toBe('Sturgeon');
      expect(serverMonth).toBe('Sturgeon');
    });

    it('consistently labels the entire New Moon threshold window with the same arriving lunar month', () => {
      // From 20h before conjunction to 20h after conjunction
      const conjunctionTime = new Date('2026-09-10T23:17:00Z').getTime();
      const offsetsHours = [-20, -12, -6, -1, 0, 1, 6, 12, 20];

      offsetsHours.forEach((offset) => {
        const testDate = new Date(conjunctionTime + offset * 3600000);
        const data = getLunarData(testDate);
        expect(data.phase.name).toBe('New Moon');
        expect(data.lunarMonth).toBe('Harvest');
      });
    });
  });

  describe('getPhaseInfo Threshold Boundaries', () => {
    it('classifies age near end of cycle (>= SYNODIC - HALF_THRESHOLD) as New Moon threshold', () => {
      const thresholdAge = SYNODIC - HALF_THRESHOLD + 0.1;
      const phase = getPhaseInfo(thresholdAge);
      expect(phase.name).toBe('New Moon');
      expect(phase.isThreshold).toBe(true);
      expect(phase.phaseType).toBe('threshold');
    });

    it('classifies age near start of cycle (< HALF_THRESHOLD) as New Moon threshold', () => {
      const thresholdAge = HALF_THRESHOLD - 0.1;
      const phase = getPhaseInfo(thresholdAge);
      expect(phase.name).toBe('New Moon');
      expect(phase.isThreshold).toBe(true);
      expect(phase.phaseType).toBe('threshold');
    });
  });

  describe('Cycle Day Bounds', () => {
    it('handles day 30 correctly without exceeding 30', () => {
      const preConjunctionDate = new Date('2026-09-10T17:20:00Z');
      const data = getLunarData(preConjunctionDate);
      expect(data.dayOfCycle).toBe(30);
    });
  });
});
