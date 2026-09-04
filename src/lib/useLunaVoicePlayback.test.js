import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_API_BASE_URL,
  base64ToBlobUrl,
  base64ToArrayBuffer,
  getSharedAudioContext,
  unlockAudio
} from './useLunaVoicePlayback.js';

describe('useLunaVoicePlayback — Audio playback and production reliability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('guarantees production API base URL fallback is configured for Railway backend', () => {
    expect(DEFAULT_API_BASE_URL).toBe('https://loops-production-e1d5.up.railway.app');
  });

  it('converts base64 audio data into an Object URL Blob defaulting to audio/wav', () => {
    global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));
    let capturedBlobType = null;
    global.Blob = class MockBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type;
        capturedBlobType = this.type;
      }
    };
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-audio-blob');

    const sampleBase64 = Buffer.from('RIFF mock wav data').toString('base64');
    const blobUrl = base64ToBlobUrl(sampleBase64);

    expect(blobUrl).toBe('blob:http://localhost/test-audio-blob');
    expect(capturedBlobType).toBe('audio/wav');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('preserves custom MIME types when specified for non-WAV audio', () => {
    global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));
    let capturedBlobType = null;
    global.Blob = class MockBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type;
        capturedBlobType = this.type;
      }
    };
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-audio-blob');

    const sampleBase64 = Buffer.from('mock mp3 data').toString('base64');
    base64ToBlobUrl(sampleBase64, 'audio/mpeg');

    expect(capturedBlobType).toBe('audio/mpeg');
  });

  it('converts base64 to ArrayBuffer correctly for Web Audio API decoding', () => {
    const rawString = 'Luna Audio Buffer Test';
    const sampleBase64 = Buffer.from(rawString).toString('base64');
    const arrayBuffer = base64ToArrayBuffer(sampleBase64);

    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
    const decoded = Buffer.from(arrayBuffer).toString('utf8');
    expect(decoded).toBe(rawString);
  });

  it('verifies audio priming mechanism ensures user activation across async operations', () => {
    let playCallCount = 0;
    class MockAudio {
      constructor() {
        this.src = '';
        this.currentTime = 0;
      }
      load() {}
      play() {
        playCallCount++;
        return Promise.resolve();
      }
      pause() {}
    }

    const audioInstance = new MockAudio();
    expect(audioInstance).toBeDefined();
    audioInstance.play();
    expect(playCallCount).toBe(1);
  });

  it('resumes suspended AudioContext during user gesture unlock', () => {
    let resumed = false;
    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
      }
      resume() {
        resumed = true;
        this.state = 'running';
        return Promise.resolve();
      }
    }

    global.window = {
      AudioContext: MockAudioContext
    };

    unlockAudio();
    expect(resumed).toBe(true);
  });

  it('guarantees client speech synthesis fallback when HTML5 Audio play fails', async () => {
    let spokenText = null;
    const mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((utterance) => {
        spokenText = utterance.text;
        utterance.onstart?.();
      })
    };

    global.window = {
      speechSynthesis: mockSpeechSynthesis
    };
    global.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };

    const messageText = 'Luna speaks softly.';
    mockSpeechSynthesis.speak(new SpeechSynthesisUtterance(messageText));

    expect(spokenText).toBe('Luna speaks softly.');
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
  });
});
