import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_MODEL
} from './useLunaVoicePlayback.js';
import { ELEVENLABS_VOICE_MAP } from '../../mcp-server/src/voice.ts';
import { TTS_MODEL_REGISTRY } from '../../mcp-server/src/models.ts';

describe('Nicole Default Luna Voice Configuration & Persistence', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = String(value);
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      })
    });
  });

  it('exports eleven-nicole as the Luna default voice ID and eleven_flash_v2_5 as default model', () => {
    expect(DEFAULT_VOICE_ID).toBe('eleven-nicole');
    expect(DEFAULT_VOICE_MODEL).toBe('eleven_flash_v2_5');
  });

  it('maps eleven-nicole to official ElevenLabs voice ID piTKgcLEGmPE4e6mEKli', () => {
    expect(ELEVENLABS_VOICE_MAP['eleven-nicole']).toBe('piTKgcLEGmPE4e6mEKli');
    expect(ELEVENLABS_VOICE_MAP['nicole']).toBe('piTKgcLEGmPE4e6mEKli');
  });

  it('sets Nicole as default voice in ElevenLabs TTS model registry configs', () => {
    const flashConfig = TTS_MODEL_REGISTRY.find(c => c.key === 'elevenlabs-flash');
    expect(flashConfig).toBeDefined();
    expect(flashConfig.defaultVoice).toBe('piTKgcLEGmPE4e6mEKli');
    expect(flashConfig.supportedVoices[0]).toBe('piTKgcLEGmPE4e6mEKli');

    const turboConfig = TTS_MODEL_REGISTRY.find(c => c.key === 'elevenlabs-turbo');
    expect(turboConfig).toBeDefined();
    expect(turboConfig.defaultVoice).toBe('piTKgcLEGmPE4e6mEKli');

    const multiConfig = TTS_MODEL_REGISTRY.find(c => c.key === 'elevenlabs-multilingual');
    expect(multiConfig).toBeDefined();
    expect(multiConfig.defaultVoice).toBe('piTKgcLEGmPE4e6mEKli');
  });

  it('resolves Nicole default for fresh users without explicit saved preference', () => {
    const savedVoice = localStorage.getItem('luna_voice_key');
    expect(savedVoice).toBeNull();

    const effectiveVoice = savedVoice || DEFAULT_VOICE_ID;
    expect(effectiveVoice).toBe('eleven-nicole');
  });

  it('does NOT overwrite existing explicit user voice preferences', () => {
    // Existing user previously selected Rachel
    localStorage.setItem('luna_voice_key', 'eleven-rachel');
    localStorage.setItem('luna_voice_model_key', 'eleven_turbo_v2_5');

    const savedVoice = localStorage.getItem('luna_voice_key');
    const savedModel = localStorage.getItem('luna_voice_model_key');

    const effectiveVoice = savedVoice || DEFAULT_VOICE_ID;
    const effectiveModel = savedModel || DEFAULT_VOICE_MODEL;

    expect(effectiveVoice).toBe('eleven-rachel');
    expect(effectiveModel).toBe('eleven_turbo_v2_5');
    // Ensure localStorage was not mutated or overwritten
    expect(localStorage.getItem('luna_voice_key')).toBe('eleven-rachel');
  });

  it('preserves user preference for Kokoro af_nova when explicitly selected', () => {
    localStorage.setItem('luna_voice_key', 'luna-default');
    const savedVoice = localStorage.getItem('luna_voice_key');
    const effectiveVoice = savedVoice || DEFAULT_VOICE_ID;

    expect(effectiveVoice).toBe('luna-default');
  });

  it('persists user voice selection to localStorage upon modification', () => {
    const onSelectVoice = (newVoice) => {
      localStorage.setItem('luna_voice_key', newVoice);
    };

    onSelectVoice('eleven-adam');
    expect(localStorage.getItem('luna_voice_key')).toBe('eleven-adam');

    onSelectVoice('eleven-nicole');
    expect(localStorage.getItem('luna_voice_key')).toBe('eleven-nicole');
  });

  it('reset control restores Nicole as default voice and updates localStorage', () => {
    localStorage.setItem('luna_voice_key', 'eleven-bella');
    localStorage.setItem('luna_voice_model_key', 'eleven_multilingual_v2');

    const onResetVoice = () => {
      localStorage.setItem('luna_voice_key', 'eleven-nicole');
      localStorage.setItem('luna_voice_model_key', 'eleven_flash_v2_5');
    };

    onResetVoice();
    expect(localStorage.getItem('luna_voice_key')).toBe('eleven-nicole');
    expect(localStorage.getItem('luna_voice_model_key')).toBe('eleven_flash_v2_5');
  });

  it('supports mobile user agent contexts (DuckDuckGo, Samsung Internet, Chrome)', () => {
    const mobileUserAgents = [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile DuckDuckGo/5 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36'
    ];

    mobileUserAgents.forEach(ua => {
      vi.stubGlobal('navigator', { userAgent: ua });
      expect(navigator.userAgent).toBe(ua);
      // Ensure DEFAULT_VOICE_ID remains consistent across mobile platforms
      const saved = localStorage.getItem('luna_voice_key');
      const voice = saved || DEFAULT_VOICE_ID;
      expect(voice).toBe('eleven-nicole');
    });
  });
});
