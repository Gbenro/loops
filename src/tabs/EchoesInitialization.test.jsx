import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { Echoes } from './Echoes.jsx';
import * as storage from '../lib/storage.js';
import * as audioStorage from '../lib/audioStorage.js';
import * as encryptionContext from '../lib/EncryptionContext.jsx';

// Mock dependencies
vi.mock('../lib/whisper.js', () => ({
  transcribeAudio: vi.fn(),
  isModelLoaded: vi.fn(() => false),
  preloadModel: vi.fn(),
}));

vi.mock('../lib/EncryptionContext.jsx', () => ({
  useEncryption: vi.fn(),
}));

vi.mock('../lib/storage.js', () => ({
  getEchoes: vi.fn(),
  saveEcho: vi.fn(),
  deleteEcho: vi.fn(),
  updateEchoText: vi.fn(),
  updateEchoAudioPath: vi.fn(),
  updateEchoTags: vi.fn(),
  generateId: vi.fn(() => 'mock-id-123'),
}));

vi.mock('../lib/audioStorage.js', () => ({
  getAllDraftAudio: vi.fn(),
  saveAudio: vi.fn(),
  getAudioUrl: vi.fn(),
  getAudio: vi.fn(),
  deleteAudio: vi.fn(),
  saveDraftAudio: vi.fn(),
  updateDraftAudio: vi.fn(),
  deleteDraftAudio: vi.fn(),
}));

describe('Echoes Tab Initialization & Bounded Loading (iss_1789071105763_6j8k)', () => {
  const defaultUser = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    encryptionContext.useEncryption.mockReturnValue({
      encryptField: vi.fn(async (text) => `enc:${text}`),
      decryptField: vi.fn(async (cipher) => cipher.replace('enc:', '')),
      sessionKey: 'valid-session-key',
    });

    audioStorage.getAllDraftAudio.mockResolvedValue([]);
    storage.getEchoes.mockResolvedValue([
      {
        id: 'echo-1',
        text: 'First valid echo',
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        createdAt: '2026-09-08T12:00:00.000Z',
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially displays the centered logo glyph (◎) and transitions to rendered tab without hanging', async () => {
    let resolveEchoes;
    storage.getEchoes.mockImplementation(
      () =>
        new Promise((res) => {
          resolveEchoes = res;
        })
    );

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    // Initially loading
    expect(screen.getByTestId('echoes-loading-screen')).toBeInTheDocument();

    // Resolve echoes
    await act(async () => {
      resolveEchoes([
        {
          id: 'echo-1',
          text: 'First valid echo',
          phase: 'new',
          phaseName: 'New Moon',
          lunarMonth: 'Harvest',
          dayOfCycle: 1,
          createdAt: '2026-09-08T12:00:00.000Z',
        },
      ]);
    });

    // Loading should be resolved and header displayed
    expect(screen.queryByTestId('echoes-loading-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Echoes')).toBeInTheDocument();
  });

  it('does NOT trigger an infinite re-fetch loop when setting echoes', async () => {
    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    // Advance time to verify no runaway re-render loops occur
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // getEchoes should only be called once on mount
    expect(storage.getEchoes).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Echoes')).toBeInTheDocument();
  });

  it('safely isolates corrupted/null records and decryption errors without crashing the tab', async () => {
    const faultyDecrypt = vi.fn().mockImplementation(async (text) => {
      if (text === 'corrupted-cipher') {
        throw new Error('Decryption failure: MAC mismatch');
      }
      return text;
    });

    encryptionContext.useEncryption.mockReturnValue({
      encryptField: vi.fn(),
      decryptField: faultyDecrypt,
      sessionKey: 'valid-session-key',
    });

    // Array containing a null element, a corrupted ciphertext echo, and a healthy echo
    storage.getEchoes.mockResolvedValue([
      null,
      undefined,
      {
        id: 'echo-corrupt',
        text: 'corrupted-cipher',
        isEncrypted: true,
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        createdAt: '2026-09-08T12:00:00.000Z',
      },
      {
        id: 'echo-healthy',
        text: 'Healthy entry',
        isEncrypted: false,
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        createdAt: '2026-09-08T12:00:00.000Z',
      },
    ]);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('echoes-loading-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Echoes')).toBeInTheDocument();
  });

  it('activates bounded loading watchdog after 5000ms if getEchoes hangs indefinitely', async () => {
    // Unresolved promise simulates hung network or blocked storage
    storage.getEchoes.mockImplementation(() => new Promise(() => {}));

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    expect(screen.getByTestId('echoes-loading-screen')).toBeInTheDocument();

    // Advance timers by 5000ms
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Watchdog must force loading to false so user is never stuck on blank screen
    expect(screen.queryByTestId('echoes-loading-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Echoes')).toBeInTheDocument();
  });

  it('displays recoverable error banner with [↻ Retry] button when loadEchoes throws an error', async () => {
    storage.getEchoes.mockRejectedValue(new Error('Network connection aborted'));

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('echoes-loading-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Echoes')).toBeInTheDocument();
    expect(screen.getByTestId('echoes-load-error-banner')).toBeInTheDocument();
    expect(screen.getByText(/Preserved local entries remain available/i)).toBeInTheDocument();

    // Clicking retry attempts to re-fetch
    storage.getEchoes.mockResolvedValueOnce([
      {
        id: 'echo-recovered',
        text: 'Recovered Echo',
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        createdAt: '2026-09-08T12:00:00.000Z',
      },
    ]);

    const retryBtn = screen.getByRole('button', { name: /↻ Retry/i });
    await act(async () => {
      fireEvent.click(retryBtn);
      await Promise.resolve();
    });

    expect(storage.getEchoes).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('echoes-load-error-banner')).not.toBeInTheDocument();
  });

  it('preserves and surfaces offline IndexedDB audio drafts in recovery banner without blocking', async () => {
    audioStorage.getAllDraftAudio.mockResolvedValue([
      {
        id: 'draft-offline-1',
        blob: new Blob(['audio data'], { type: 'audio/webm' }),
        text: 'Pending transcription voice note',
        createdAt: Date.now(),
      },
    ]);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('recovered-drafts-banner')).toBeInTheDocument();
    expect(screen.getByText(/UN-SYNCED DRAFT RECOVERED/i)).toBeInTheDocument();
    expect(screen.getByText(/1 preserved on device/i)).toBeInTheDocument();
  });
});
