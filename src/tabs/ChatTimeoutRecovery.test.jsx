import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Chat, CHAT_ACTIVITY_PHASES, getActivityPhase } from './Chat.jsx';

// Polyfill scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const mockSessions = [
  { id: 'sess_test_123', title: 'Continuous Reflection', model_key: 'anthropic-fable', updated_at: new Date().toISOString() }
];

// Mock dependencies
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'test-user-123' } }, error: null })),
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'mock-access-token', user: { id: 'test-user-123' } } },
        error: null
      }))
    },
    from: vi.fn((table) => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() => Promise.resolve({ data: table === 'chat_sessions' ? mockSessions : [], error: null })),
        limit: vi.fn().mockResolvedValue({
          data: mockSessions
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

describe('Chat Dynamic Activity Phases & Graceful Timeout Recovery (iss_1789151232812_s2ld)', () => {
  const mockLunarData = {
    age: 14.5,
    phase: { name: 'Full Moon', key: 'full', emoji: '🌕' },
    lunarMonth: 'Harvest',
    dayOfCycle: 15,
    season: 'Late Summer'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dynamic Activity Phase Engine', () => {
    it('returns initial listening phase for immediate requests (0–4s)', () => {
      const phase0 = getActivityPhase(0);
      expect(phase0.text).toBe('✦ Luna is listening...');
      expect(phase0.subtext).toBeNull();

      const phase3s = getActivityPhase(3000);
      expect(phase3s.text).toBe('✦ Luna is listening...');
    });

    it('progresses to cosmic attuning phase after 4s', () => {
      const phase = getActivityPhase(4500);
      expect(phase.text).toBe('✦ Attuning to the cosmic context...');
      expect(phase.subtext).toBeNull();
    });

    it('progresses to contemplation phase after 9s', () => {
      const phase = getActivityPhase(12000);
      expect(phase.text).toBe('✦ Luna is contemplating...');
      expect(phase.subtext).toBeNull();
    });

    it('progresses to contextual threading after 20s', () => {
      const phase = getActivityPhase(25000);
      expect(phase.text).toBe('✦ Gathering threads from the Field...');
    });

    it('progresses to deeper reflection after 38s', () => {
      const phase = getActivityPhase(45000);
      expect(phase.text).toBe('✦ Holding space for a deeper reflection...');
    });

    it('progresses to weaving words after 65s', () => {
      const phase = getActivityPhase(70000);
      expect(phase.text).toBe('✦ Weaving the reflection into words...');
    });

    it('activates extended contemplation with gentle patience subtext beyond 90s', () => {
      const phase95s = getActivityPhase(95000);
      expect(phase95s.text).toBe('✦ Deepening contemplation...');
      expect(phase95s.subtext).toBe('Still listening — Luna is taking time to respond with care.');

      const phase135s = getActivityPhase(135000);
      expect(phase135s.text).toBe('✦ Bringing the reflection into focus...');
      expect(phase135s.subtext).toBe('Still with you — finalizing thoughtful response.');
    });
  });

  describe('Chat Component Timeout & Recovery UX', () => {
    it('preserves user prompt and renders Retry & Refine actions on timeout/network failure', async () => {
      // Simulate network failure / timeout
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      // Wait for session to resolve
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Speak or type to Luna/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Speak or type to Luna/i);
      fireEvent.change(input, { target: { value: 'How can I integrate what I learned this cycle?' } });

      const form = input.closest('form');
      await act(async () => {
        fireEvent.submit(form);
      });

      // 1. User message MUST be preserved in the conversation stream (NOT wiped out)
      expect(screen.getByText('How can I integrate what I learned this cycle?')).toBeInTheDocument();

      // 2. Delivery paused badge must be shown
      expect(await screen.findByTestId('delivery-failed-badge')).toBeInTheDocument();
      expect(screen.getByText(/Delivery paused/i)).toBeInTheDocument();

      // 3. Error banner with recoverable actions must be rendered
      expect(await screen.findByTestId('chat-error-banner')).toBeInTheDocument();
      const retryBtn = screen.getByTestId('chat-retry-btn');
      const refineBtn = screen.getByTestId('chat-refine-btn');
      expect(retryBtn).toBeInTheDocument();
      expect(refineBtn).toBeInTheDocument();
      expect(retryBtn).toHaveTextContent(/Retry Reflection/i);
      expect(refineBtn).toHaveTextContent(/Refine Thought/i);
    });

    it('clicking [Refine Thought] populates input composer and removes failed bubble for editing', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection aborted'));

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Speak or type to Luna/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Speak or type to Luna/i);
      fireEvent.change(input, { target: { value: 'A thought I want to refine' } });

      const form = input.closest('form');
      await act(async () => {
        fireEvent.submit(form);
      });

      // Verify failed state
      const refineBtn = await screen.findByTestId('chat-refine-btn');
      expect(refineBtn).toBeInTheDocument();

      // Click Refine
      act(() => {
        fireEvent.click(refineBtn);
      });

      // Input box should now contain the exact prompt
      expect(input.value).toBe('A thought I want to refine');
      // Error banner should be cleared
      expect(screen.queryByTestId('chat-error-banner')).not.toBeInTheDocument();
    });

    it('clicking [Retry Reflection] idempotently re-submits without duplicate user bubbles', async () => {
      // First attempt fails
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Temporary network drop'));

      render(<Chat userId="test-user-123" lunarData={mockLunarData} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Speak or type to Luna/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Speak or type to Luna/i);
      fireEvent.change(input, { target: { value: 'Reflecting on the harvest moon' } });

      const form = input.closest('form');
      await act(async () => {
        fireEvent.submit(form);
      });

      const retryBtn = await screen.findByTestId('chat-retry-btn');

      // Second attempt succeeds
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userMessageId: 'msg_u1',
          message: { id: 'msg_a1', content: 'The harvest moon invites you to harvest gratitude.' }
        })
      });

      await act(async () => {
        fireEvent.click(retryBtn);
      });

      // Wait for assistant reply
      expect(await screen.findByText('The harvest moon invites you to harvest gratitude.')).toBeInTheDocument();

      // Check that user message appears exactly ONCE (no duplicate user bubbles)
      const userBubbles = screen.getAllByText('Reflecting on the harvest moon');
      expect(userBubbles.length).toBe(1);

      // Delivery failed badge and error banner should be gone
      expect(screen.queryByTestId('delivery-failed-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chat-error-banner')).not.toBeInTheDocument();
    });
  });
});
