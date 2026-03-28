import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OnboardingProvider, useOnboarding, TOUR_DEFINITIONS } from './OnboardingProvider.jsx';
import { WelcomeModal } from './WelcomeModal.jsx';

// Test component to access context
function TestConsumer({ onReady }) {
  const context = useOnboarding();
  if (onReady) onReady(context);
  return (
    <div>
      <span data-testid="show-welcome">{String(context.showWelcome)}</span>
      <span data-testid="active-tour">{context.activeTour || 'none'}</span>
      <span data-testid="step-index">{context.stepIndex}</span>
      <span data-testid="is-first-launch">{String(context.isFirstLaunch)}</span>
      <button data-testid="start-sky" onClick={() => context.startTour('sky')}>Start Sky</button>
      <button data-testid="start-loops" onClick={() => context.startTour('loops')}>Start Loops</button>
      <button data-testid="end-tour" onClick={() => context.endTour(true)}>End Tour</button>
      <button data-testid="reset" onClick={() => context.resetOnboarding()}>Reset</button>
      <button data-testid="dismiss" onClick={() => context.dismissWelcome()}>Dismiss</button>
      <button data-testid="skip" onClick={() => context.skipOnboarding()}>Skip</button>
      <button data-testid="complete" onClick={() => context.completeOnboarding()}>Complete</button>
    </div>
  );
}

describe('Onboarding', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TOUR_DEFINITIONS', () => {
    it('has definitions for all four tabs', () => {
      expect(TOUR_DEFINITIONS).toHaveProperty('sky');
      expect(TOUR_DEFINITIONS).toHaveProperty('loops');
      expect(TOUR_DEFINITIONS).toHaveProperty('echoes');
      expect(TOUR_DEFINITIONS).toHaveProperty('rhythm');
    });

    it('sky tour has correct structure', () => {
      const skyTour = TOUR_DEFINITIONS.sky;
      expect(skyTour.id).toBe('sky');
      expect(skyTour.name).toBe('Sky Tour');
      expect(skyTour.steps).toHaveLength(3);
      expect(skyTour.steps[0]).toHaveProperty('target');
      expect(skyTour.steps[0]).toHaveProperty('title');
      expect(skyTour.steps[0]).toHaveProperty('content');
      expect(skyTour.steps[0]).toHaveProperty('placement');
    });

    it('loops tour has correct structure', () => {
      const loopsTour = TOUR_DEFINITIONS.loops;
      expect(loopsTour.id).toBe('loops');
      expect(loopsTour.steps).toHaveLength(3);
    });

    it('echoes tour has correct structure', () => {
      const echoesTour = TOUR_DEFINITIONS.echoes;
      expect(echoesTour.id).toBe('echoes');
      expect(echoesTour.steps).toHaveLength(2);
    });

    it('rhythm tour has correct structure', () => {
      const rhythmTour = TOUR_DEFINITIONS.rhythm;
      expect(rhythmTour.id).toBe('rhythm');
      expect(rhythmTour.steps).toHaveLength(4);
    });

    it('all steps have data-tour targets', () => {
      Object.values(TOUR_DEFINITIONS).forEach((tour) => {
        tour.steps.forEach((step) => {
          expect(step.target).toMatch(/\[data-tour=/);
        });
      });
    });
  });

  describe('OnboardingProvider', () => {
    it('shows welcome modal on first launch', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      expect(screen.getByTestId('show-welcome')).toHaveTextContent('true');
      expect(screen.getByTestId('is-first-launch')).toHaveTextContent('true');
    });

    it('does not show welcome modal if already completed', async () => {
      mockStorage['onboardingCompleted'] = 'true';
      mockStorage['lastOnboardingVersion'] = '1.0';
      mockStorage['welcomeModalDismissed'] = 'true';

      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      expect(screen.getByTestId('show-welcome')).toHaveTextContent('false');
    });

    it('startTour sets active tour and resets step index', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByTestId('start-sky'));

      expect(screen.getByTestId('active-tour')).toHaveTextContent('sky');
      expect(screen.getByTestId('step-index')).toHaveTextContent('0');
    });

    it('endTour clears active tour and marks completed', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByTestId('start-sky'));
      expect(screen.getByTestId('active-tour')).toHaveTextContent('sky');

      fireEvent.click(screen.getByTestId('end-tour'));
      expect(screen.getByTestId('active-tour')).toHaveTextContent('none');
      expect(mockStorage['toursCompleted']).toBe('{"sky":true}');
    });

    it('dismissWelcome hides modal and persists', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      expect(screen.getByTestId('show-welcome')).toHaveTextContent('true');

      fireEvent.click(screen.getByTestId('dismiss'));

      expect(screen.getByTestId('show-welcome')).toHaveTextContent('false');
      expect(mockStorage['welcomeModalDismissed']).toBe('true');
    });

    it('skipOnboarding sets all completion flags', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByTestId('skip'));

      expect(mockStorage['onboardingCompleted']).toBe('true');
      expect(mockStorage['lastOnboardingVersion']).toBe('1.0');
      expect(mockStorage['welcomeModalDismissed']).toBe('true');
    });

    it('completeOnboarding marks completed without dismissing welcome', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByTestId('complete'));

      expect(mockStorage['onboardingCompleted']).toBe('true');
      expect(mockStorage['lastOnboardingVersion']).toBe('1.0');
    });

    it('resetOnboarding clears all state and shows welcome', async () => {
      mockStorage['onboardingCompleted'] = 'true';
      mockStorage['lastOnboardingVersion'] = '1.0';
      mockStorage['toursCompleted'] = '{"sky":true}';
      mockStorage['welcomeModalDismissed'] = 'true';

      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByTestId('reset'));

      expect(mockStorage['onboardingCompleted']).toBeUndefined();
      expect(mockStorage['lastOnboardingVersion']).toBeUndefined();
      expect(mockStorage['toursCompleted']).toBeUndefined();
      expect(mockStorage['welcomeModalDismissed']).toBeUndefined();
      expect(screen.getByTestId('show-welcome')).toHaveTextContent('true');
    });

    it('restores tours completed from localStorage', async () => {
      mockStorage['toursCompleted'] = '{"sky":true,"loops":true}';

      let contextRef;
      render(
        <OnboardingProvider>
          <TestConsumer onReady={(ctx) => { contextRef = ctx; }} />
        </OnboardingProvider>
      );

      expect(contextRef.isTourCompleted('sky')).toBe(true);
      expect(contextRef.isTourCompleted('loops')).toBe(true);
      expect(contextRef.isTourCompleted('echoes')).toBe(false);
    });

    it('getActiveTourSteps returns correct steps', async () => {
      let contextRef;
      render(
        <OnboardingProvider>
          <TestConsumer onReady={(ctx) => { contextRef = ctx; }} />
        </OnboardingProvider>
      );

      // No active tour
      expect(contextRef.getActiveTourSteps()).toEqual([]);

      // Start sky tour
      fireEvent.click(screen.getByTestId('start-sky'));

      expect(contextRef.getActiveTourSteps()).toHaveLength(3);
      expect(contextRef.getActiveTourSteps()[0].title).toBe('This is now.');
    });

    it('handles corrupted localStorage gracefully', async () => {
      mockStorage['toursCompleted'] = 'invalid json';

      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      // Should not crash and show welcome
      expect(screen.getByTestId('show-welcome')).toHaveTextContent('true');
    });

    it('startTour ignores invalid tour ID', async () => {
      let contextRef;
      render(
        <OnboardingProvider>
          <TestConsumer onReady={(ctx) => { contextRef = ctx; }} />
        </OnboardingProvider>
      );

      act(() => {
        contextRef.startTour('invalid-tour');
      });

      expect(screen.getByTestId('active-tour')).toHaveTextContent('none');
    });

    it('multiple tours can be completed independently', async () => {
      render(
        <OnboardingProvider>
          <TestConsumer />
        </OnboardingProvider>
      );

      // Complete sky tour
      fireEvent.click(screen.getByTestId('start-sky'));
      fireEvent.click(screen.getByTestId('end-tour'));

      // Complete loops tour
      fireEvent.click(screen.getByTestId('start-loops'));
      fireEvent.click(screen.getByTestId('end-tour'));

      const completed = JSON.parse(mockStorage['toursCompleted']);
      expect(completed.sky).toBe(true);
      expect(completed.loops).toBe(true);
    });
  });

  describe('useOnboarding', () => {
    it('throws error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useOnboarding must be used within an OnboardingProvider');

      consoleError.mockRestore();
    });
  });

  describe('WelcomeModal', () => {
    it('renders welcome modal when showWelcome is true', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('The moon has been keeping time for you.')).toBeInTheDocument();
    });

    it('does not render when showWelcome is false', () => {
      mockStorage['welcomeModalDismissed'] = 'true';
      mockStorage['onboardingCompleted'] = 'true';
      mockStorage['lastOnboardingVersion'] = '1.0';

      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('has accessible dialog structure', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-title');
    });

    it('renders Begin button', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.getByText('Begin')).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    it('Begin button dismisses modal and starts sky tour', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByText('Begin'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('active-tour')).toHaveTextContent('sky');
    });

    it('Skip button dismisses modal and skips onboarding', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
          <TestConsumer />
        </OnboardingProvider>
      );

      fireEvent.click(screen.getByText('Skip for now'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockStorage['onboardingCompleted']).toBe('true');
    });

    it('displays app introduction text', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.getByText(/Luna Loops is a way of living with the lunar cycle/)).toBeInTheDocument();
      expect(screen.getByText(/Four tabs. Eight phases. One cycle at a time./)).toBeInTheDocument();
    });

    it('displays hint for finding guide later', () => {
      render(
        <OnboardingProvider>
          <WelcomeModal />
        </OnboardingProvider>
      );

      expect(screen.getByText('FIND THIS AGAIN')).toBeInTheDocument();
      expect(screen.getByText('Menu → About → How to use')).toBeInTheDocument();
    });
  });
});
