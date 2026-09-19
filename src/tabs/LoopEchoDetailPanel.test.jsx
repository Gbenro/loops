import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetailPanel } from './Loops.jsx';
import * as storage from '../lib/storage.js';

vi.mock('../lib/whisper.js', () => ({
  transcribeAudio: vi.fn(),
  isModelLoaded: vi.fn(() => false),
  preloadModel: vi.fn(),
}));

vi.mock('../lib/audioStorage.js', () => ({
  saveAudio: vi.fn(async () => 'user_123/e_mock_audio.webm'),
  getAudioUrl: vi.fn(async () => 'https://mock-url.local/audio.webm'),
}));

describe('Loop DetailPanel Echo Creation UI (iss_1789756747974_8rpf)', () => {
  const mockLoop = {
    id: 'l1789152529300e6a0',
    title: 'Demola appointment — Monday 2pm',
    note: 'Initial planning meeting with Demola',
    type: 'phase',
    status: 'active',
    subtasks: [
      { id: 'st_1', text: 'Reflect meeting', done: true },
    ],
  };

  const defaultProps = {
    loop: mockLoop,
    pct: 100,
    userId: 'user_123',
    lunarData: {
      phase: { key: 'first-quarter', name: 'First Quarter' },
      lunarMonth: 'Harvest',
      dayOfCycle: 7,
      zodiac: { sign: 'Aries' },
      illumination: 0.5,
    },
    onClose: vi.fn(),
    onCloseLoop: vi.fn(),
    onReopenLoop: vi.fn(),
    onReleaseLoop: vi.fn(),
    onContinueLoop: vi.fn(),
    onDelete: vi.fn(),
    onToggleSubtask: vi.fn(),
    onDeleteSubtask: vi.fn(),
    onAddSubtask: vi.fn(),
    onReorderSubtask: vi.fn(),
    onUpdateNote: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders existing loop-attached echoes and displays "+ ADD ECHO" button', async () => {
    vi.spyOn(storage, 'getEchoes').mockResolvedValue([
      {
        id: 'e_existing_1',
        text: 'Previous reflection for this loop',
        linkedLoopId: 'l1789152529300e6a0',
        loopIds: ['l1789152529300e6a0'],
        phaseName: 'First Quarter',
        dayOfCycle: 7,
        zodiac: 'Aries',
      },
    ]);

    render(<DetailPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Previous reflection for this loop')).toBeInTheDocument();
    });

    expect(screen.getByText('+ ADD ECHO')).toBeInTheDocument();
  });

  it('opens reflection editor and disables "Save Echo" button when input is empty', async () => {
    vi.spyOn(storage, 'getEchoes').mockResolvedValue([]);
    render(<DetailPanel {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('+ ADD ECHO')).toBeInTheDocument());
    const addEchoBtn = screen.getByText('+ ADD ECHO');
    fireEvent.click(addEchoBtn);

    const textarea = screen.getByPlaceholderText('Write your reflection...');
    expect(textarea).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /save echo/i });
    expect(saveButton).toBeDisabled();
  });

  it('submits non-empty reflection and passes both linkedLoopId and loopIds symmetrically', async () => {
    vi.spyOn(storage, 'getEchoes').mockResolvedValue([]);
    const saveEchoSpy = vi.spyOn(storage, 'saveEcho').mockImplementation(async (echo) => echo);

    render(<DetailPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('+ ADD ECHO'));

    const textarea = screen.getByPlaceholderText('Write your reflection...');
    fireEvent.change(textarea, {
      target: { value: 'Demola meeting went well: approved budget and next milestones' },
    });

    const saveButton = screen.getByRole('button', { name: /save echo/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveEchoSpy).toHaveBeenCalledTimes(1);
    });

    const savedEcho = saveEchoSpy.mock.calls[0][0];
    expect(savedEcho.text).toBe('Demola meeting went well: approved budget and next milestones');
    expect(savedEcho.linkedLoopId).toBe('l1789152529300e6a0');
    expect(savedEcho.loopIds).toEqual(['l1789152529300e6a0']);

    // Check newly submitted echo is rendered in the UI
    await waitFor(() => {
      expect(
        screen.getByText('Demola meeting went well: approved budget and next milestones')
      ).toBeInTheDocument();
    });
  });

  it('alerts user and preserves draft reflection text if saveEcho fails', async () => {
    vi.spyOn(storage, 'getEchoes').mockResolvedValue([]);
    vi.spyOn(storage, 'saveEcho').mockRejectedValue(new Error('Network disconnected'));

    render(<DetailPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('+ ADD ECHO'));

    const textarea = screen.getByPlaceholderText('Write your reflection...');
    fireEvent.change(textarea, {
      target: { value: 'Important notes that must not be lost' },
    });

    const saveButton = screen.getByRole('button', { name: /save echo/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Network disconnected')
      );
    });

    // Form remains open with text intact so the user does not lose their reflection
    expect(textarea.value).toBe('Important notes that must not be lost');
  });

  it('displays echoes linked via loopIds array as well as linkedLoopId', async () => {
    vi.spyOn(storage, 'getEchoes').mockResolvedValue([
      {
        id: 'e_array_linked',
        text: 'Echo attached via loopIds array',
        linkedLoopId: null,
        loopIds: ['l1789152529300e6a0'],
        phaseName: 'First Quarter',
        dayOfCycle: 7,
      },
    ]);

    render(<DetailPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Echo attached via loopIds array')).toBeInTheDocument();
    });
  });
});
