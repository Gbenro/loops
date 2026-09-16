import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Chat, cleanMessageForCopy, copyMessageText } from './Chat.jsx';

// Polyfill scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const mockSessions = [
  { id: 'sess_copy_123', title: 'Conversation with Luna', model_key: 'anthropic-fable', updated_at: new Date().toISOString() }
];

const mockInitialMessages = [
  {
    id: 'msg_user_1',
    session_id: 'sess_copy_123',
    role: 'user',
    content: 'Can you summarize the lunar tide cycle for me?',
    created_at: new Date(Date.now() - 60000).toISOString()
  },
  {
    id: 'msg_luna_1',
    session_id: 'sess_copy_123',
    role: 'assistant',
    content: 'The lunar tide moves in resonant rhythms with the gravitational pull.\n\nKey phases:\n- New Moon spring tides\n- Quarter neap tides\n\nListen closely to the undertow.',
    created_at: new Date().toISOString()
  }
];

// Mock Supabase
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'test-user-123' } }, error: null })),
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'mock-token', user: { id: 'test-user-123' } } },
        error: null
      }))
    },
    from: vi.fn((table) => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() => Promise.resolve({
          data: table === 'chat_sessions' ? mockSessions : mockInitialMessages,
          error: null
        })),
        limit: vi.fn().mockResolvedValue({
          data: table === 'chat_sessions' ? mockSessions : mockInitialMessages
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockSessions[0]
        }),
        single: vi.fn().mockResolvedValue({
          data: mockSessions[0],
          error: null
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockSessions[0], error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSessions[0], error: null })
          })),
          then: (resolve) => resolve({ data: mockSessions[0], error: null })
        })),
        update: vi.fn().mockReturnThis()
      };
      return mockQueryBuilder;
    })
  }
}));

vi.mock('../lib/useVoiceRecorder.js', () => ({
  useVoiceRecorder: () => ({
    state: 'idle',
    isRecording: false,
    isTranscribing: false,
    recordingDuration: 0,
    errorMessage: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    resetError: vi.fn()
  })
}));

vi.mock('../lib/useLunaVoicePlayback.js', () => ({
  useLunaVoicePlayback: () => ({
    playbackStates: {},
    playMessage: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    stopPlayback: vi.fn(),
    replayPlayback: vi.fn()
  })
}));

describe('Chat UX Message Copy Feature (iss_1789516484316_mxb2)', () => {
  const mockLunarData = {
    age: 14.5,
    phase: { name: 'Full Moon', key: 'full', emoji: '🌕' },
    lunarMonth: 'Harvest',
    dayOfCycle: 15,
    season: 'Late Summer'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('cleanMessageForCopy helper', () => {
    it('returns empty string on null, undefined, or empty input', () => {
      expect(cleanMessageForCopy(null)).toBe('');
      expect(cleanMessageForCopy(undefined)).toBe('');
      expect(cleanMessageForCopy('')).toBe('');
    });

    it('preserves clean multi-paragraph text and list formatting', () => {
      const text = 'Paragraph 1\n\nParagraph 2 with lines:\n- Item A\n- Item B\n1. First\n2. Second';
      expect(cleanMessageForCopy(text)).toBe(text);
    });

    it('strips internal tool syntax, thought tags, and DSML metadata', () => {
      const raw = '<thought>Consider user context carefully.</thought>Here is the reflection.<tool_call>{"name":"fetch"}</tool_call>[tool_result]done[/tool_result]';
      expect(cleanMessageForCopy(raw)).toBe('Here is the reflection.');
    });

    it('strips hidden telemetry markers and internal trace IDs', () => {
      const raw = '<!-- telemetry: elapsed=120ms -->[trace_id:abc-999][internal_id:turn-123]Luna response text.[telemetry:ok]';
      expect(cleanMessageForCopy(raw)).toBe('Luna response text.');
    });

    it('converts basic HTML paragraph and line breaks into clean plain text and decodes entities', () => {
      const htmlText = '<p>Hello &amp; welcome!</p><p>Line 1<br/>Line 2 &quot;quoted&quot;</p>';
      expect(cleanMessageForCopy(htmlText)).toBe('Hello & welcome!\n\nLine 1\nLine 2 "quoted"');
    });

    it('safely preserves mathematical inequalities', () => {
      const mathText = 'Condition where x < y and y > z holds true.';
      expect(cleanMessageForCopy(mathText)).toBe('Condition where x < y and y > z holds true.');
    });

    it('normalizes CRLF line endings and collapses excessive linebreaks', () => {
      const messy = 'Line 1\r\n\r\n\r\n\r\nLine 2\r\n';
      expect(cleanMessageForCopy(messy)).toBe('Line 1\n\nLine 2');
    });
  });

  describe('copyMessageText helper', () => {
    it('uses navigator.clipboard.writeText when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      const success = await copyMessageText('Test copy content');
      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('Test copy content');
    });

    it('falls back to document.execCommand when navigator.clipboard fails', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
        }
      });

      const execMock = vi.fn().mockReturnValue(true);
      document.execCommand = execMock;

      const success = await copyMessageText('Fallback copy content');
      expect(success).toBe(true);
      expect(execMock).toHaveBeenCalledWith('copy');
    });

    it('returns false gracefully when both modern and fallback methods fail', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Not supported'))
        }
      });

      document.execCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand restricted');
      });

      const success = await copyMessageText('Will fail');
      expect(success).toBe(false);
    });
  });

  describe('Chat Component Copy UI & Accessibility', () => {
    it('renders copy buttons on both user and Luna messages with proper accessibility labels', async () => {
      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-message-btn-msg_user_1')).toBeInTheDocument();
        expect(screen.getByTestId('copy-message-btn-msg_luna_1')).toBeInTheDocument();
      });

      const userBtn = screen.getByTestId('copy-message-btn-msg_user_1');
      expect(userBtn).toHaveAttribute('aria-label', 'Copy user message');
      expect(userBtn).toHaveAttribute('data-copy-role', 'user');

      const lunaBtn = screen.getByTestId('copy-message-btn-msg_luna_1');
      expect(lunaBtn).toHaveAttribute('aria-label', 'Copy Luna message');
      expect(lunaBtn).toHaveAttribute('data-copy-role', 'assistant');
    });

    it('copies clean user message and displays temporary "Copied" feedback state', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-message-btn-msg_user_1')).toBeInTheDocument();
      });

      const userBtn = screen.getByTestId('copy-message-btn-msg_user_1');
      await act(async () => {
        fireEvent.click(userBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith('Can you summarize the lunar tide cycle for me?');
      expect(userBtn).toHaveTextContent('Copied');
      expect(userBtn).toHaveAttribute('aria-label', 'Copied user message to clipboard');
    });

    it('copies clean Luna message with paragraphs and lists preserved', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-message-btn-msg_luna_1')).toBeInTheDocument();
      });

      const lunaBtn = screen.getByTestId('copy-message-btn-msg_luna_1');
      await act(async () => {
        fireEvent.click(lunaBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith(
        'The lunar tide moves in resonant rhythms with the gravitational pull.\n\nKey phases:\n- New Moon spring tides\n- Quarter neap tides\n\nListen closely to the undertow.'
      );
      expect(lunaBtn).toHaveTextContent('Copied');
      expect(lunaBtn).toHaveAttribute('aria-label', 'Copied Luna response to clipboard');
    });

    it('shows recoverable "Failed" feedback if clipboard write fails', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Blocked'))
        }
      });
      document.execCommand = vi.fn().mockReturnValue(false);

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByTestId('copy-message-btn-msg_user_1')).toBeInTheDocument();
      });

      const userBtn = screen.getByTestId('copy-message-btn-msg_user_1');
      await act(async () => {
        fireEvent.click(userBtn);
      });

      expect(userBtn).toHaveTextContent('Failed');
      expect(userBtn).toHaveAttribute('aria-label', 'Failed to copy message');
    });

    it('ensures text selection is preserved on user and Luna messages', async () => {
      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByText('Can you summarize the lunar tide cycle for me?')).toBeInTheDocument();
      });

      const userTextEl = screen.getByText('Can you summarize the lunar tide cycle for me?');
      expect(userTextEl.style.userSelect).toBe('text');

      const lunaTextEl = screen.getByText(/The lunar tide moves in resonant rhythms/);
      expect(lunaTextEl.style.userSelect).toBe('text');
    });
  });
});
