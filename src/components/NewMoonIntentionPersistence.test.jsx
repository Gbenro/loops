import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useCeremonyPrompt, CeremonyPrompt } from './Onboarding/CeremonyPrompt.jsx';
import { Loops } from '../tabs/Loops.jsx';

const mockLunarData = {
  age: 28.6,
  phase: { key: 'new', name: 'New Moon' },
  lunarMonth: 'Harvest',
  cycleStart: '2026-09-11T13:28:15.000Z',
  dayOfCycle: 1,
  phaseRemaining: 3.5,
  zodiac: { sign: 'Virgo' },
};

vi.mock('../lib/lunar.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLunarData: vi.fn(() => mockLunarData),
  };
});

// Mock dependencies for Loops tab
vi.mock('../lib/whisper.js', () => ({
  transcribeAudio: vi.fn(),
  isModelLoaded: vi.fn(() => false),
  preloadModel: vi.fn(),
}));

const mockEncryptField = vi.fn(async (t) => t);
const mockDecryptField = vi.fn(async (t) => t);

vi.mock('../lib/EncryptionContext.jsx', () => ({
  useEncryption: () => ({
    encryptField: mockEncryptField,
    decryptField: mockDecryptField,
    sessionKey: null,
  }),
}));

vi.mock('../lib/audioStorage.js', () => ({
  saveAudio: vi.fn(),
  getAudioUrl: vi.fn(),
  deleteAudio: vi.fn(),
}));

describe('New Moon Intention Persistence & Gating (iss_1789150464646_wtyc)', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = String(value);
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
    vi.spyOn(window.localStorage, 'clear').mockImplementation(() => {
      mockStorage = {};
    });

    mockStorage['onboardingCompleted'] = 'true';
    mockStorage['cosmic_loops_v1'] = '[]';
    mockStorage['cosmic_echoes_v1'] = '[]';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useCeremonyPrompt & CeremonyPrompt', () => {
    it('does not show ceremony prompt if user already has an active cycle loop', () => {
      const { result } = renderHook(() =>
        useCeremonyPrompt(mockLunarData, true /* hasActiveCycleLoop */)
      );
      expect(result.current.showCeremony).toBeNull();
    });

    it('shows ceremony prompt on New Moon when no active cycle loop exists and not yet shown/dismissed', () => {
      const { result } = renderHook(() =>
        useCeremonyPrompt(mockLunarData, false /* hasActiveCycleLoop */)
      );
      expect(result.current.showCeremony).toBe('new-moon');
    });

    it('persists 12-hour cooldown across refresh when ceremony is dismissed', () => {
      const { result } = renderHook(() =>
        useCeremonyPrompt(mockLunarData, false)
      );

      expect(result.current.showCeremony).toBe('new-moon');

      // Dismiss ceremony with 12h cooldown
      act(() => {
        result.current.dismissCeremony(12);
      });

      expect(result.current.showCeremony).toBeNull();

      // Verify cooldown timestamp saved in mockStorage
      const ceremonyCooldown = mockStorage['ceremony_dismissed_until_new-moon'];
      expect(ceremonyCooldown).toBeTruthy();
      expect(new Date(ceremonyCooldown).getTime()).toBeGreaterThan(Date.now());

      const ritualStableDismissed = mockStorage['luna_ritual_dismissed_Harvest_2026'];
      expect(ritualStableDismissed).toBeTruthy();

      // Simulate page refresh by re-mounting the hook
      const { result: refreshedResult } = renderHook(() =>
        useCeremonyPrompt(mockLunarData, false)
      );
      expect(refreshedResult.current.showCeremony).toBeNull();
    });

    it('handles cycleStart timestamp drift across conjunction (< 5 days) without re-prompting', () => {
      // Suppose ceremony was marked shown with a slightly drifted cycleStart timestamp
      const driftCycleStart = '2026-09-11T14:15:30.000Z'; // 47 minutes later
      mockStorage['ceremonyNewMoonCycle'] = driftCycleStart;

      // Current evaluation with original cycleStart
      const { result } = renderHook(() =>
        useCeremonyPrompt(mockLunarData, false)
      );
      expect(result.current.showCeremony).toBeNull();
    });

    it('clears active ceremony prompt immediately if an active cycle loop is detected', () => {
      let hasActive = false;
      const { result, rerender } = renderHook(
        () => useCeremonyPrompt(mockLunarData, hasActive)
      );

      expect(result.current.showCeremony).toBe('new-moon');

      // Loop hydration / creation occurs
      hasActive = true;
      rerender();

      expect(result.current.showCeremony).toBeNull();
    });
  });

  describe('Loops Tab Integration & Frame-0 Synchronous Hydration', () => {
    it('synchronously recognizes active cycle loop from localStorage on frame 0 and suppresses ritual modal', async () => {
      const existingCycleLoop = {
        id: 'c123',
        title: 'Walk with the harvest moon',
        type: 'cycle',
        status: 'active',
        lunarMonthOpened: 'Harvest',
        cycleStart: '2026-09-11T13:28:15.000Z',
        openedAt: new Date().toISOString(),
      };
      mockStorage['cosmic_loops_v1'] = JSON.stringify([existingCycleLoop]);

      render(
        <Loops
          userId={null}
          phrases={{ newMoonQuestion: 'What wants to emerge?' }}
          phrasesLoading={false}
          hemisphere="north"
        />
      );

      // Auto NewMoonRitual modal should NOT be displayed
      expect(screen.queryByText(/What wants to emerge\?/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /set intention/i })).not.toBeInTheDocument();
    });

    it('persists "Not Now" dismissal across refresh and provides manual ritual entry point', async () => {
      mockStorage['cosmic_loops_v1'] = JSON.stringify([]);

      const { unmount } = render(
        <Loops
          userId={null}
          phrases={{ newMoonQuestion: 'What is your harvest wish?' }}
          phrasesLoading={false}
          hemisphere="north"
        />
      );

      // Wait for ritual modal to appear
      expect(await screen.findByText('What is your harvest wish?')).toBeInTheDocument();
      const notNowBtn = screen.getByRole('button', { name: /not now/i });

      // User clicks "Not Now"
      await act(async () => {
        fireEvent.click(notNowBtn);
      });

      // Modal closes
      expect(screen.queryByText('What is your harvest wish?')).not.toBeInTheDocument();

      // Verify cooldown storage keys
      expect(mockStorage['luna_ritual_dismissed_Harvest_2026']).toBeTruthy();
      expect(mockStorage['ceremony_dismissed_until_new-moon']).toBeTruthy();

      // Manual ritual entry prompt MUST be visible in Loops tab
      expect(screen.getByText(/Tap to set your cycle intention/i)).toBeInTheDocument();

      unmount();

      // Simulate page refresh (re-mounting Loops tab)
      render(
        <Loops
          userId={null}
          phrases={{ newMoonQuestion: 'What is your harvest wish?' }}
          phrasesLoading={false}
          hemisphere="north"
        />
      );

      // On refresh, auto-ritual modal MUST NOT open
      expect(screen.queryByText('What is your harvest wish?')).not.toBeInTheDocument();

      // But manual trigger remains available
      const manualTrigger = await screen.findByText(/Tap to set your cycle intention/i);
      expect(manualTrigger).toBeInTheDocument();

      // User can open it on demand by tapping
      await act(async () => {
        fireEvent.click(manualTrigger);
      });
      expect(screen.getByText('What is your harvest wish?')).toBeInTheDocument();
    });

    it('setting an intention creates active cycle loop and permanently suppresses ritual prompt for cycle', async () => {
      mockStorage['cosmic_loops_v1'] = JSON.stringify([]);

      const { unmount } = render(
        <Loops
          userId={null}
          phrases={{ newMoonQuestion: 'Plant your seeds' }}
          phrasesLoading={false}
          hemisphere="north"
        />
      );

      expect(await screen.findByText('Plant your seeds')).toBeInTheDocument();

      // Fill intention
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Nurture creative focus' } });

      const setBtn = screen.getByRole('button', { name: /set intention/i });
      await act(async () => {
        fireEvent.click(setBtn);
      });

      // Ritual modal closes
      expect(screen.queryByText('Plant your seeds')).not.toBeInTheDocument();

      // Verify saved to localStorage
      const saved = JSON.parse(mockStorage['cosmic_loops_v1'] || '[]');
      expect(saved.some((l) => l.title === 'Nurture creative focus' && l.type === 'cycle')).toBe(true);

      unmount();

      // Refresh page
      render(
        <Loops
          userId={null}
          phrases={{ newMoonQuestion: 'Plant your seeds' }}
          phrasesLoading={false}
          hemisphere="north"
        />
      );

      // Wait for render to settle
      await waitFor(() => {
        expect(screen.queryByText('Plant your seeds')).not.toBeInTheDocument();
        expect(screen.queryByText(/Tap to set your cycle intention/i)).not.toBeInTheDocument();
      });
    });
  });
});
