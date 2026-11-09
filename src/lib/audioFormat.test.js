import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectAudioFormat,
  sanitizeTitleForFilename,
  generateAudioDownloadFilename,
  downloadAudioFile,
} from './audioFormat.js';

describe('Audio Format Detection (detectAudioFormat)', () => {
  it('detects WebM / Matroska EBML container magic bytes (0x1A 0x45 0xDF 0xA3)', () => {
    // Standard Android Chrome MediaRecorder header
    const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
    const result = detectAudioFormat(webmHeader.buffer);
    expect(result).toEqual({
      format: 'webm',
      extension: 'webm',
      mimeType: 'audio/webm',
    });
  });

  it('detects M4A / MP4 container with ftyp box at offset 4', () => {
    // Standard iOS Safari / WebKit MediaRecorder MPEG-4 audio header
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, // box size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x4d, 0x34, 0x41, 0x20, // 'M4A '
      0x00, 0x00, 0x02, 0x00,
    ]);
    const result = detectAudioFormat(mp4Header);
    expect(result).toEqual({
      format: 'm4a',
      extension: 'm4a',
      mimeType: 'audio/mp4',
    });
  });

  it('detects Ogg container magic bytes (OggS)', () => {
    const oggHeader = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    const result = detectAudioFormat(oggHeader);
    expect(result).toEqual({
      format: 'ogg',
      extension: 'ogg',
      mimeType: 'audio/ogg',
    });
  });

  it('detects MP3 with ID3v2 header', () => {
    const id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]);
    const result = detectAudioFormat(id3Header);
    expect(result).toEqual({
      format: 'mp3',
      extension: 'mp3',
      mimeType: 'audio/mpeg',
    });
  });

  it('detects MP3 raw frame sync word (0xFF 0xFB)', () => {
    const mp3SyncHeader = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    const result = detectAudioFormat(mp3SyncHeader);
    expect(result).toEqual({
      format: 'mp3',
      extension: 'mp3',
      mimeType: 'audio/mpeg',
    });
  });

  it('detects WAV RIFF WAVE container', () => {
    const wavHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x24, 0x00, 0x00, 0x00, // file size
      0x57, 0x41, 0x56, 0x45, // 'WAVE'
      0x66, 0x6d, 0x74, 0x20, // 'fmt '
    ]);
    const result = detectAudioFormat(wavHeader);
    expect(result).toEqual({
      format: 'wav',
      extension: 'wav',
      mimeType: 'audio/wav',
    });
  });

  it('detects FLAC container magic bytes', () => {
    const flacHeader = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22]);
    const result = detectAudioFormat(flacHeader);
    expect(result).toEqual({
      format: 'flac',
      extension: 'flac',
      mimeType: 'audio/flac',
    });
  });

  it('detects AAC ADTS sync stream', () => {
    const aacHeader = new Uint8Array([0xff, 0xf1, 0x50, 0x80]);
    const result = detectAudioFormat(aacHeader);
    expect(result).toEqual({
      format: 'aac',
      extension: 'm4a',
      mimeType: 'audio/aac',
    });
  });

  it('falls back to valid audio MIME type metadata when magic bytes are absent or truncated', () => {
    const shortBuffer = new Uint8Array([0x00, 0x00]);
    expect(detectAudioFormat(shortBuffer, 'audio/webm;codecs=opus')).toEqual({
      format: 'webm',
      extension: 'webm',
      mimeType: 'audio/webm',
    });
    expect(detectAudioFormat(shortBuffer, 'audio/mp4')).toEqual({
      format: 'm4a',
      extension: 'm4a',
      mimeType: 'audio/mp4',
    });
  });

  it('refuses to falsely label arbitrary binary data or application/octet-stream as audio', () => {
    const arbitraryBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]); // ELF binary
    expect(detectAudioFormat(arbitraryBytes)).toBeNull();
    expect(detectAudioFormat(arbitraryBytes, 'application/octet-stream')).toBeNull();
    expect(detectAudioFormat(null)).toBeNull();
    expect(detectAudioFormat(new Uint8Array(0))).toBeNull();
  });
});

describe('Filename Sanitization & Generation', () => {
  it('sanitizes titles with spaces, special characters, and diacritics', () => {
    expect(sanitizeTitleForFilename('Pointers to the Dark')).toBe('pointers-to-the-dark');
    expect(sanitizeTitleForFilename('Embrace the Darkness!')).toBe('embrace-the-darkness');
    expect(sanitizeTitleForFilename('Écho #42 — Lumière & Étoiles')).toBe('echo-42-lumiere-etoiles');
    expect(sanitizeTitleForFilename('   ---Spaced Out---   ')).toBe('spaced-out');
  });

  it('truncates long titles cleanly without trailing hyphens', () => {
    const longTitle = 'The longer October 31 reflection on darkness, surrender, and wholeness';
    const sanitized = sanitizeTitleForFilename(longTitle, 40);
    expect(sanitized.length).toBeLessThanOrEqual(40);
    expect(sanitized).not.toMatch(/-$/);
    expect(sanitized).toBe('the-longer-october-31-reflection-on-dark');
  });

  it('generates filename for Pointers to the Dark with verified extension', () => {
    const echo = {
      title: 'Pointers to the Dark',
      text: 'Exploration of cyclical shadow work...',
      createdAt: '2026-10-31T20:00:00Z',
    };
    expect(generateAudioDownloadFilename(echo, 'webm')).toBe('pointers-to-the-dark.webm');
    expect(generateAudioDownloadFilename(echo, 'm4a')).toBe('pointers-to-the-dark.m4a');
  });

  it('extracts title from first line of text when explicit title is missing', () => {
    const echo = {
      text: 'Embrace the Darkness\n\nTonight under the new moon, we acknowledge what cannot yet be seen.',
      createdAt: '2026-10-31T20:00:00Z',
    };
    expect(generateAudioDownloadFilename(echo, 'webm')).toBe('embrace-the-darkness.webm');
  });

  it('falls back to astronomical metadata when title and text are generic or missing', () => {
    const echo = {
      text: 'Voice reflection',
      phase: 'full-moon',
      zodiac: 'Leo',
      dayOfCycle: 14,
      createdAt: '2026-10-31T12:00:00Z',
    };
    expect(generateAudioDownloadFilename(echo, 'webm')).toBe('echo_full-moon_leo_day14_2026-10-31.webm');
  });
});

describe('Android-Safe Download Handler (downloadAudioFile)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = () => {};
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = () => {};
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('constructs typed audio Blob, appends anchor to body, clicks, and defers revocation', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-uuid');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let clicked = false;
    let anchorElement = null;
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        anchorElement = el;
        el.click = () => {
          clicked = true;
        };
      }
      return el;
    });

    const rawBlob = new Blob(['mock audio stream'], { type: 'application/octet-stream' });
    downloadAudioFile(rawBlob, 'pointers-to-the-dark.webm', 'audio/webm');

    // 1. Anchor appended to document.body (essential for mobile Chrome / WebKit)
    expect(appendChildSpy).toHaveBeenCalledWith(anchorElement);
    expect(anchorElement.download).toBe('pointers-to-the-dark.webm');
    expect(anchorElement.href).toBe('blob:http://localhost/test-uuid');

    // 2. Click was triggered
    expect(clicked).toBe(true);

    // 3. CRITICAL: URL.revokeObjectURL must NOT be called synchronously (which causes Android .bin bug)
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();

    // 4. After 60-second delay, anchor is cleaned up and URL is revoked
    vi.advanceTimersByTime(60000);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
    expect(removeChildSpy).toHaveBeenCalledWith(anchorElement);
  });
});
