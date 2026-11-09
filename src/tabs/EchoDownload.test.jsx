import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Echoes } from './Echoes.jsx';
import * as storage from '../lib/storage.js';
import * as audioStorage from '../lib/audioStorage.js';
import * as audioFormat from '../lib/audioFormat.js';
import * as encryptionContext from '../lib/EncryptionContext.jsx';

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
  getAllDraftAudio: vi.fn().mockResolvedValue([]),
  saveAudio: vi.fn(),
  getAudioUrl: vi.fn().mockResolvedValue('https://mock-storage.local/audio.webm'),
  getAudio: vi.fn(),
  deleteAudio: vi.fn(),
  saveDraftAudio: vi.fn(),
  updateDraftAudio: vi.fn(),
  deleteDraftAudio: vi.fn(),
  storageExtension: vi.fn((m) => (m?.includes('webm') ? 'webm' : 'm4a')),
}));

vi.mock('../lib/audioFormat.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    downloadAudioFile: vi.fn(),
  };
});

describe('Echo Audio Download Integration & .bin Prevention', () => {
  const defaultUser = 'user-123';
  let mockStore = {};
  let downloadSpy;

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

    encryptionContext.useEncryption.mockReturnValue({
      encryptField: vi.fn(async (text) => text),
      decryptField: vi.fn(async (cipher) => cipher),
      sessionKey: null,
    });

    audioStorage.getAllDraftAudio.mockResolvedValue([]);
    audioStorage.getAudioUrl.mockResolvedValue('https://mock-storage.local/audio.webm');
    downloadSpy = audioFormat.downloadAudioFile;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads "Pointers to the Dark" as pointers-to-the-dark.webm with verified audio/webm MIME type', async () => {
    // Synthetic WebM header bytes (EBML 0x1A 0x45 0xDF 0xA3)
    const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x02]);
    const mockWebmBlob = new Blob([webmBytes], { type: 'application/octet-stream' });

    const echo = {
      id: 'echo-pointers-dark',
      text: 'Pointers to the Dark\nInitial explorations in the shadows.',
      audio_path: 'user-123/echo-pointers-dark.ogg', // Older recording saved with .ogg path
      phase: 'new',
      phaseName: 'New Moon',
      lunarMonth: 'Hunter',
      dayOfCycle: 1,
      createdAt: new Date().toISOString(),
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
    };

    mockStore['cosmic_echoes_v1'] = JSON.stringify([echo]);
    storage.getEchoes.mockResolvedValue([echo]);
    audioStorage.getAudio.mockResolvedValue(mockWebmBlob);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    // Wait for the Echo card to render
    expect(await screen.findByText(/Pointers to the Dark/i)).toBeInTheDocument();

    // Expand the card via the '···' button
    const expandBtn = screen.getByRole('button', { name: '···' });
    fireEvent.click(expandBtn);

    // Click the download button (↓)
    const downloadBtn = await screen.findByRole('button', { name: '↓' });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(audioStorage.getAudio).toHaveBeenCalledWith('user-123/echo-pointers-dark.ogg', 'echo-pointers-dark');
      expect(downloadSpy).toHaveBeenCalledWith(
        mockWebmBlob,
        'pointers-to-the-dark.webm',
        'audio/webm'
      );
    });
  });

  it('downloads iOS M4A recordings as .m4a with audio/mp4 MIME type', async () => {
    // Synthetic MP4/M4A header (ftyp at offset 4)
    const m4aBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x20,
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x4d, 0x34, 0x41, 0x20, // 'M4A '
      0x00, 0x00, 0x00, 0x00,
    ]);
    const mockM4aBlob = new Blob([m4aBytes], { type: '' });

    const echo = {
      id: 'echo-embrace-darkness',
      text: 'Embrace the Darkness!\nSurrender to the unknown.',
      audio_path: 'user-123/echo-embrace-darkness.mp4',
      phase: 'full',
      phaseName: 'Full Moon',
      lunarMonth: 'Hunter',
      dayOfCycle: 14,
      createdAt: new Date().toISOString(),
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
    };

    mockStore['cosmic_echoes_v1'] = JSON.stringify([echo]);
    storage.getEchoes.mockResolvedValue([echo]);
    audioStorage.getAudio.mockResolvedValue(mockM4aBlob);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    expect(await screen.findByText(/Embrace the Darkness!/i)).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: '···' });
    fireEvent.click(expandBtn);

    const downloadBtn = await screen.findByRole('button', { name: '↓' });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        mockM4aBlob,
        'embrace-the-darkness.m4a',
        'audio/mp4'
      );
    });
  });

  it('alerts user gracefully and does not trigger download when audio is missing', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const echo = {
      id: 'echo-missing-audio',
      text: 'Missing audio reflection',
      audio_path: 'user-123/missing.webm',
      createdAt: new Date().toISOString(),
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
    };

    mockStore['cosmic_echoes_v1'] = JSON.stringify([echo]);
    storage.getEchoes.mockResolvedValue([echo]);
    audioStorage.getAudio.mockResolvedValue(null);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    expect(await screen.findByText(/Missing audio reflection/i)).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: '···' });
    fireEvent.click(expandBtn);

    const downloadBtn = await screen.findByRole('button', { name: '↓' });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Could not download audio'));
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });

  it('refuses to download unrecognized binary data as audio', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const randomBinary = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    const mockCorruptBlob = new Blob([randomBinary], { type: 'application/octet-stream' });

    const echo = {
      id: 'echo-corrupt-data',
      text: 'Corrupt binary reflection',
      audio_path: 'user-123/corrupt.bin',
      createdAt: new Date().toISOString(),
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
    };

    mockStore['cosmic_echoes_v1'] = JSON.stringify([echo]);
    storage.getEchoes.mockResolvedValue([echo]);
    audioStorage.getAudio.mockResolvedValue(mockCorruptBlob);

    render(<Echoes userId={defaultUser} phrases={[]} phrasesLoading={false} />);

    expect(await screen.findByText(/Corrupt binary reflection/i)).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: '···' });
    fireEvent.click(expandBtn);

    const downloadBtn = await screen.findByRole('button', { name: '↓' });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Could not identify audio format'));
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });
});
