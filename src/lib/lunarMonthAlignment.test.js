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

  describe('Option A: Unified Cycle Gate Semantics', () => {
    it('initializes Day 1 of arriving Harvest Moon during pre-conjunction New Moon threshold', () => {
      // 2026-09-10 ~17:20 UTC is ~6 hours before exact conjunction
      const preConjunctionDate = new Date('2026-09-10T17:20:00Z');
      const clientData = getLunarData(preConjunctionDate);
      const serverData = getServerLunarData(preConjunctionDate);

      expect(clientData.phase.name).toBe('New Moon');
      expect(clientData.lunarMonth).toBe('Harvest');
      expect(clientData.dayOfCycle).toBe(1);

      expect(serverData.phase.name).toBe('New Moon');
      expect(serverData.lunarMonth).toBe('Harvest');
      expect(serverData.dayOfCycle).toBe(1);
    });

    it('maintains Day 1 of Harvest Moon immediately after exact conjunction', () => {
      // 2026-09-11 ~04:00 UTC is ~5 hours after exact conjunction
      const postConjunctionDate = new Date('2026-09-11T04:00:00Z');
      const clientData = getLunarData(postConjunctionDate);
      const serverData = getServerLunarData(postConjunctionDate);

      expect(clientData.phase.name).toBe('New Moon');
      expect(clientData.lunarMonth).toBe('Harvest');
      expect(clientData.dayOfCycle).toBe(1);

      expect(serverData.phase.name).toBe('New Moon');
      expect(serverData.lunarMonth).toBe('Harvest');
      expect(serverData.dayOfCycle).toBe(1);
    });

    it('anchors pre-conjunction and post-conjunction cycleStart to the exact conjunction timestamp (continuity)', () => {
      const preDate = new Date('2026-09-10T17:20:00Z');
      const postDate = new Date('2026-09-11T04:00:00Z');

      const preStart = new Date(getLunarData(preDate).cycleStart).getTime();
      const postStart = new Date(getLunarData(postDate).cycleStart).getTime();

      // Both anchor to the exact conjunction moment (~2026-09-10T23:17:00Z)
      // Difference between the two computed cycleStart moments is within orbital velocity variation (< 1 hour),
      // in contrast to a 29.5-day jump without Option A.
      expect(Math.abs(preStart - postStart)).toBeLessThan(60 * 60 * 1000);
    });

    it('retains Day 29/30 of prior cycle (Sturgeon) during Late Waning Crescent before threshold', () => {
      // 2026-09-09 ~12:00 UTC is >24 hours before conjunction, during Waning Crescent flow
      const waningCrescentDate = new Date('2026-09-09T12:00:00Z');
      const clientData = getLunarData(waningCrescentDate);
      const serverData = getServerLunarData(waningCrescentDate);

      expect(clientData.phase.name).toBe('Waning Crescent');
      expect(clientData.lunarMonth).toBe('Sturgeon');
      expect(clientData.dayOfCycle).toBeGreaterThanOrEqual(28);
      expect(clientData.dayOfCycle).toBeLessThanOrEqual(30);

      expect(serverData.phase.name).toBe('Waning Crescent');
      expect(serverData.lunarMonth).toBe('Sturgeon');
      expect(serverData.dayOfCycle).toBeGreaterThanOrEqual(28);
      expect(serverData.dayOfCycle).toBeLessThanOrEqual(30);
    });
  });
});
