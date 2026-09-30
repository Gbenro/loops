import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_MODEL,
  segmentTextClient
} from './useLunaVoicePlayback.js';

describe('Order 105 — Luna Direct Regressions & Robustness Suite', () => {
  describe('Luna Voice Playback & Historical Message Resilience', () => {
    it('exports authoritative default voice ID and model', () => {
      expect(DEFAULT_VOICE_ID).toBe('eleven-nicole');
      expect(DEFAULT_VOICE_MODEL).toBe('eleven_flash_v2_5');
    });

    it('safely handles non-string and complex historical message text', () => {
      expect(segmentTextClient(null)).toEqual([]);
      expect(segmentTextClient(undefined)).toEqual([]);
      expect(segmentTextClient(12345)).toEqual(['12345']);
      expect(segmentTextClient('## Continuous Reflection\n\n**Hello** world')).toEqual(['Continuous Reflection\n\nHello world']);
    });

    it('segments long historical text into sentence chunks accurately', () => {
      const longText = 'First sentence of the reflection. Second sentence goes here! Third sentence finishes it up nicely?';
      const chunks = segmentTextClient(longText, 40);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join(' ')).toContain('First sentence of the reflection.');
    });
  });
});
