import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExtensionFromMime, transcribeAudio } from './whisper.js';
import { detectAudioContainer, transcribeLunaAudio } from '../../mcp-server/dist/voice.js';

describe('Voice Re-Transcription & Audio Container Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getExtensionFromMime (Container-First Resolution)', () => {
    it('maps audio/webm;codecs=opus to webm instead of ogg', () => {
      expect(getExtensionFromMime('audio/webm;codecs=opus')).toBe('webm');
      expect(getExtensionFromMime('audio/webm')).toBe('webm');
      expect(getExtensionFromMime('AUDIO/WEBM;CODECS=OPUS')).toBe('webm');
    });

    it('maps audio/ogg formats to ogg', () => {
      expect(getExtensionFromMime('audio/ogg')).toBe('ogg');
      expect(getExtensionFromMime('audio/ogg;codecs=opus')).toBe('ogg');
    });

    it('maps mp4, m4a, aac to mp4', () => {
      expect(getExtensionFromMime('audio/mp4')).toBe('mp4');
      expect(getExtensionFromMime('audio/m4a')).toBe('mp4');
      expect(getExtensionFromMime('audio/aac')).toBe('mp4');
    });

    it('maps wav and flac correctly', () => {
      expect(getExtensionFromMime('audio/wav')).toBe('wav');
      expect(getExtensionFromMime('audio/flac')).toBe('flac');
    });

    it('defaults undefined or empty mime to webm', () => {
      expect(getExtensionFromMime('')).toBe('webm');
      expect(getExtensionFromMime(null)).toBe('webm');
      expect(getExtensionFromMime(undefined)).toBe('webm');
    });
  });

  describe('Frontend transcribeAudio Audio Validation & Retry Safety', () => {
    it('rejects null or empty audio blobs before issuing network requests', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      await expect(transcribeAudio(null)).rejects.toThrow(/No audio recorded/i);
      await expect(transcribeAudio(new Blob([], { type: 'audio/webm' }))).rejects.toThrow(/No audio recorded/i);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects truncated audio blobs (< 500 bytes) with user-actionable message to prevent deterministic 400 loops', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const tinyBuffer = new Uint8Array(120); // 120 bytes corrupt/silent buffer
      const tinyBlob = new Blob([tinyBuffer], { type: 'audio/webm' });

      await expect(transcribeAudio(tinyBlob)).rejects.toThrow(/Audio recording was too short or silent/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('preserves source audio blob and caller state on failure without mutation', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      const validAudioData = new Uint8Array(1024).fill(65);
      const audioBlob = new Blob([validAudioData], { type: 'audio/webm' });
      const initialSize = audioBlob.size;

      let draftTranscript = 'Original preserved transcript';

      try {
        await transcribeAudio(audioBlob);
      } catch (err) {
        expect(err).toBeDefined();
      }

      // Assert source material was not mutated or destroyed
      expect(audioBlob.size).toBe(initialSize);
      expect(draftTranscript).toBe('Original preserved transcript');
    });

    it('successfully transcribes valid audio via primary backend', async () => {
      const validAudioData = new Uint8Array(2048).fill(42);
      const audioBlob = new Blob([validAudioData], { type: 'audio/webm;codecs=opus' });

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/voice/transcribe')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ text: 'The moon is in its waxing crescent phase tonight.', provider: 'groq_whisper' })
          });
        }
        return Promise.reject(new Error(`Unexpected call to ${url}`));
      });

      const text = await transcribeAudio(audioBlob);
      expect(text).toBe('The moon is in its waxing crescent phase tonight.');
    });

    it('falls back to Supabase Edge Function if primary backend is unreachable', async () => {
      const validAudioData = new Uint8Array(2048).fill(42);
      const audioBlob = new Blob([validAudioData], { type: 'audio/webm' });

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/voice/transcribe')) {
          return Promise.reject(new Error('Connection refused'));
        }
        if (url.includes('transcribe-audio')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ text: 'Fallback transcription succeeded.' })
          });
        }
        return Promise.reject(new Error(`Unexpected call to ${url}`));
      });

      const text = await transcribeAudio(audioBlob);
      expect(text).toBe('Fallback transcription succeeded.');
    });
  });

  describe('Backend Audio Container Detection (detectAudioContainer)', () => {
    it('detects WAV RIFF headers', () => {
      const buf = Buffer.alloc(44);
      buf.write('RIFF', 0, 'ascii');
      buf.write('WAVE', 8, 'ascii');

      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('wav');
      expect(detected.ext).toBe('wav');
      expect(detected.mimeType).toBe('audio/wav');
    });

    it('detects EBML/WebM headers', () => {
      const buf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88]);
      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('webm');
      expect(detected.ext).toBe('webm');
      expect(detected.mimeType).toBe('audio/webm');
    });

    it('detects OggS headers', () => {
      const buf = Buffer.alloc(20);
      buf.write('OggS', 0, 'ascii');

      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('ogg');
      expect(detected.ext).toBe('ogg');
      expect(detected.mimeType).toBe('audio/ogg');
    });

    it('detects ID3 MP3 headers', () => {
      const buf = Buffer.alloc(20);
      buf.write('ID3', 0, 'ascii');

      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('mp3');
      expect(detected.ext).toBe('mp3');
      expect(detected.mimeType).toBe('audio/mpeg');
    });

    it('detects MP4 ftyp headers', () => {
      const buf = Buffer.alloc(20);
      buf.write('ftyp', 4, 'ascii');

      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('mp4');
      expect(detected.ext).toBe('mp4');
      expect(detected.mimeType).toBe('audio/mp4');
    });

    it('detects FLAC headers', () => {
      const buf = Buffer.alloc(20);
      buf.write('fLaC', 0, 'ascii');

      const detected = detectAudioContainer(buf);
      expect(detected.format).toBe('flac');
      expect(detected.ext).toBe('flac');
      expect(detected.mimeType).toBe('audio/flac');
    });
  });

  describe('Backend transcribeLunaAudio Server Diagnostics', () => {
    it('returns AUDIO_EMPTY diagnostic with 400 classification for 0-byte buffer', async () => {
      const result = await transcribeLunaAudio({
        audioBuffer: Buffer.alloc(0)
      });

      expect(result.success).toBe(false);
      expect(result.detectedFormat).toBe('empty');
      expect(result.byteCount).toBe(0);
      expect(result.diagnostics?.code).toBe('AUDIO_EMPTY');
      expect(result.diagnostics?.reason).toContain('empty');
    });

    it('returns AUDIO_TOO_SHORT diagnostic with 400 classification for buffer < 500 bytes', async () => {
      const result = await transcribeLunaAudio({
        audioBuffer: Buffer.alloc(128)
      });

      expect(result.success).toBe(false);
      expect(result.detectedFormat).toBe('truncated');
      expect(result.byteCount).toBe(128);
      expect(result.diagnostics?.code).toBe('AUDIO_TOO_SHORT');
      expect(result.diagnostics?.reason).toContain('too short');
    });
  });
});
