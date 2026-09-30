import { describe, it, expect } from 'vitest';
import {
  normalizeThemeTag,
  inferThematicTagsFromText,
  auditThematicTagging,
  THEME_CANONICAL_MAP
} from './thematicTagging.js';

describe('Order 106 — Thematic Tagging Pipeline Audit & Evidence Layer', () => {
  describe('Tag Normalization & Synonyms', () => {
    it('normalizes spaces, hyphens, and casing to canonical snake_case themes', () => {
      expect(normalizeThemeTag('Creative Writing')).toBe('creative_writing');
      expect(normalizeThemeTag('creative-writing')).toBe('creative_writing');
      expect(normalizeThemeTag('  REST  ')).toBe('rest');
      expect(normalizeThemeTag('wind-down')).toBe('rest');
      expect(normalizeThemeTag('sleep')).toBe('rest');
    });

    it('preserves custom user tags while lowercasing and trimming', () => {
      expect(normalizeThemeTag('Custom Tag Name')).toBe('custom_tag_name');
    });
  });

  describe('Thematic Signal Inference', () => {
    it('extracts thematic tags from reflection prose', () => {
      const text = 'I noticed a lot of friction and tension in the studio today, but taking a pause brought clarity.';
      const tags = inferThematicTagsFromText(text);
      expect(tags).toContain('friction');
      expect(tags).toContain('clarity');
    });

    it('detects recurrence and boundary signals', () => {
      const text = 'This pattern keeps happening again. I need to protect my boundaries.';
      const tags = inferThematicTagsFromText(text);
      expect(tags).toContain('recurrence');
      expect(tags).toContain('boundaries');
    });

    it('returns empty array for empty or invalid input', () => {
      expect(inferThematicTagsFromText(null)).toEqual([]);
      expect(inferThematicTagsFromText(123)).toEqual([]);
    });
  });

  describe('Thematic Audit Diagnostic Reporter', () => {
    it('produces an accurate telemetry report across historical records', () => {
      const sampleRecords = [
        { id: 'e1', text: 'Morning reflection', tags: ['intention', 'stillness'] },
        { id: 'e2', text: 'Voice note', tags: ['original-voice-echo'] },
        { id: 'e3', text: 'Legacy note', tags: [] },
        { id: 'e4', text: 'Writing progress', tags: ['Creative Writing'] }
      ];

      const audit = auditThematicTagging(sampleRecords);
      expect(audit.totalRecords).toBe(4);
      expect(audit.untaggedCount).toBe(1);
      expect(audit.systemOnlyCount).toBe(1);
      expect(audit.hasThematicCount).toBe(2);
      expect(audit.inconsistentNamingCount).toBe(1);
      expect(audit.healthStatus).toBe('moderate_gaps');
    });
  });
});
