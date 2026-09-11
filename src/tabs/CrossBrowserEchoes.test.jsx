import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('Cross-Browser Echoes Immediate Rendering (iss_1789072739045_f7vp)', () => {
  const defaultUser = 'user-123';
  let mockStore = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {};

    vi.spyOn(window.localStorage, 'getItem').mockImplementation((k) => mockStore[k] ?? null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((k, v) => {
      mockStore[k] = String(v);
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((k) => {
      delete mockStore[k];
    });
    vi.spyOn(window.localStorage, 'clear').mockImplementation(() => {
      mockStore = {};
    });

    encryptionContext.useEncryption.mockReturnValue({
      encryptField: vi.fn(async (text) => `enc:${text}`),
      decryptField: vi.fn(async (cipher) => cipher.replace('enc:', '')),
      sessionKey: 'valid-session-key',
    });

    audioStorage.getAllDraftAudio.mockResolvedValue([]);
  });

  it('renders tab shell and cached localStorage echoes immediately on initial render without full-screen glyph hang', async () => {
    // Populate cached echoes in localStorage
    const cachedEcho = {
      id: 'echo-cached-1',
      text: 'Persisted local memory',
      phase: 'new',
      phaseName: 'New Moon',
      lunarMonth: 'Harvest',
      dayOfCycle: 1,
      createdAt: new Date().toISOString(),
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
    };
    mockStore['cosmic_echoes_v1'] = JSON.stringify([cachedEcho]);

    // getEchoes returns a pending promise that simulates network delay
    let resolveRemote;
    storage.getEchoes.mockImplementation(
      () =>
        new Promise((res) => {
          resolveRemote = res;
        })
    );

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    // Tab shell header is immediately visible
    expect(screen.getByText('Echoes', { exact: true })).toBeInTheDocument();

    // The cached echo is rendered immediately on frame 0
    expect(screen.getByText('Persisted local memory')).toBeInTheDocument();

    // Full-screen loading screen should NOT block the UI
    expect(screen.queryByTestId('echoes-loading-screen')).toBeNull();

    // Syncing indicator badge is visible in the header while loading
    expect(screen.getByTestId('echoes-sync-badge')).toBeInTheDocument();

    // Resolve remote echoes
    await act(async () => {
      resolveRemote([
        cachedEcho,
        {
          id: 'echo-remote-2',
          text: 'Newly synced cloud echo',
          phase: 'new',
          phaseName: 'New Moon',
          lunarMonth: 'Harvest',
          dayOfCycle: 1,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    // Both echoes are now rendered
    expect(screen.getByText('Persisted local memory')).toBeInTheDocument();
    expect(screen.getByText('Newly synced cloud echo')).toBeInTheDocument();

    // Syncing indicator is removed once loaded
    expect(screen.queryByTestId('echoes-sync-badge')).toBeNull();
  });

  it('renders inline sync message instead of full-screen blocking screen when no echoes exist yet', async () => {
    mockStore = {};

    let resolveRemote;
    storage.getEchoes.mockImplementation(
      () =>
        new Promise((res) => {
          resolveRemote = res;
        })
    );

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    // Header and tab shell are still rendered
    expect(screen.getByText('Echoes', { exact: true })).toBeInTheDocument();

    // Inline sync indicator is shown inside list container
    expect(screen.getByText(/SYNCING ECHOES\.\.\./i)).toBeInTheDocument();

    // Resolving with empty list switches to the empty state
    await act(async () => {
      resolveRemote([]);
    });

    expect(screen.queryByText(/SYNCING ECHOES\.\.\./i)).toBeNull();
    expect(screen.getByText(/No echoes yet\./i)).toBeInTheDocument();
  });
});
