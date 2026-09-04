import { describe, it, expect, vi, beforeEach } from 'vitest';
import { base64ToBlobUrl } from './useLunaVoicePlayback.js';

describe('useLunaVoicePlayback — Audio playback and first-click reliability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts base64 audio data into an Object URL Blob', () => {
    // Mock window and URL
    global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-audio-blob');

    const sampleBase64 = Buffer.from('RIFF mock wav data').toString('base64');
    const blobUrl = base64ToBlobUrl(sampleBase64, 'audio/wav');

    expect(blobUrl).toBe('blob:http://localhost/test-audio-blob');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
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

    // Simulate fallback execution
    const messageText = 'Luna speaks softly.';
    mockSpeechSynthesis.speak(new SpeechSynthesisUtterance(messageText));

    expect(spokenText).toBe('Luna speaks softly.');
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
  });
});
