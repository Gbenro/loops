// Luna Loops - Onboarding Provider
// Context for managing interactive onboarding tours

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ONBOARDING_VERSION = '1.0';
const STORAGE_KEYS = {
  completed: 'onboardingCompleted',
  version: 'lastOnboardingVersion',
  tours: 'toursCompleted',
  welcomeDismissed: 'welcomeModalDismissed',
};

const OnboardingContext = createContext(null);

// Tour definitions with steps for each tab
// Copy from docs/ONBOARDING_COPY.md
export const TOUR_DEFINITIONS = {
  sky: {
    id: 'sky',
    name: 'Sky Tour',
    steps: [
      {
        target: '[data-tour="moon-display"]',
        title: 'This is now.',
        content: 'The moon as it appears tonight, wherever you are. Tap it to go deeper into what this phase is asking.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="phase-info"]',
        title: 'The phase has a quality.',
        content: 'Each of the eight phases carries a different kind of energy — building, questioning, releasing. The text below the moon describes what is live right now.',
        placement: 'top',
      },
      {
        target: '[data-tour="zodiac-transit"]',
        title: 'The moon moves through the zodiac too.',
        content: 'Every few days, it shifts signs. This adds another layer — not rules, just texture. A watery sign feels different from a fiery one.',
        placement: 'top',
      },
      {
        target: '[data-tour="phase-tide-bar"]',
        title: 'Eight stations.',
        content: 'This row shows where you are in the cycle. The current phase is lit. Tap any phase to see what that part of the cycle holds.',
        placement: 'top',
      },
    ],
  },
  loops: {
    id: 'loops',
    name: 'Loops Tour',
    steps: [
      {
        target: '[data-tour="cycle-loop"]',
        title: 'A cycle loop is a seed.',
        content: 'Set it at the New Moon. It holds your intention for the entire cycle — something to carry from dark to light and back to dark.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="phase-loops"]',
        title: 'A phase loop is a container.',
        content: 'Smaller, more immediate. What wants your attention during this specific phase? Steps can live inside it.',
        placement: 'top',
      },
      {
        target: '[data-tour="add-loop-btn"]',
        title: 'Loops can continue or close.',
        content: 'When a cycle ends, you can release the loop completely or continue its intention into the next cycle. The choice is part of the practice.',
        placement: 'top',
      },
    ],
  },
  echoes: {
    id: 'echoes',
    name: 'Echoes Tour',
    steps: [
      {
        target: '[data-tour="echoes-write-area"]',
        title: 'An echo is a reflection.',
        content: 'Write or speak. Tag if you want. Each echo is anchored to the phase when you made it — a breadcrumb through the cycle.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="echoes-voice-orb"]',
        title: 'Your voice carries more than words.',
        content: 'The orb at the bottom records your voice. Speak what is true right now. It will be transcribed and saved.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-tags"]',
        title: 'Find what you left.',
        content: 'Tags help you trace themes — grief, clarity, intention, body. Use the filters to see only echoes from specific phases or with certain tags.',
        placement: 'top',
      },
    ],
  },
  rhythm: {
    id: 'rhythm',
    name: 'Rhythm Tour',
    steps: [
      {
        target: '[data-tour="rhythm-what"]',
        title: 'A rhythm is a named practice.',
        content: 'Not a habit to track. Not a goal to hit. A practice you want to observe as it moves through the phases.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="rhythm-intention"]',
        title: 'Intention is not a promise.',
        content: 'At the start of each cycle, you can set an intention for how you want to engage with this practice. No numbers. No pressure.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="phase-ring"]',
        title: 'Two rings. Two truths.',
        content: 'The outer ring shows your intention. The inner ring shows what actually happened. The gap between them is not failure — it is information.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-checkin"]',
        title: 'The dots are not scores.',
        content: 'Each phase, you note what happened — present, partial, absent. The dots are observations, not judgments.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-history"]',
        title: 'At the end, a report.',
        content: 'When the Waning Crescent arrives, you can see how the whole cycle unfolded. Not to grade yourself — to notice patterns.',
        placement: 'top',
      },
    ],
  },
};

export function OnboardingProvider({ children }) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTour, setActiveTour] = useState(null);
  const [toursCompleted, setToursCompleted] = useState({});
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [onSwitchTab, setOnSwitchTab] = useState(null); // Tab navigation callback

  // Load state from localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEYS.completed);
    const version = localStorage.getItem(STORAGE_KEYS.version);
    const tours = localStorage.getItem(STORAGE_KEYS.tours);
    const welcomeDismissed = localStorage.getItem(STORAGE_KEYS.welcomeDismissed);

    if (tours) {
      try {
        setToursCompleted(JSON.parse(tours));
      } catch {
        setToursCompleted({});
      }
    }

    // Check if this is a first launch or version update
    const isNew = !completed || version !== ONBOARDING_VERSION;
    setIsFirstLaunch(isNew);

    // Show welcome modal if first launch and not previously dismissed
    if (isNew && !welcomeDismissed) {
      setShowWelcome(true);
    }
  }, []);

  // Save tours completed to localStorage
  useEffect(() => {
    if (Object.keys(toursCompleted).length > 0) {
      localStorage.setItem(STORAGE_KEYS.tours, JSON.stringify(toursCompleted));
    }
  }, [toursCompleted]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(STORAGE_KEYS.welcomeDismissed, 'true');
  }, []);

  const startTour = useCallback((tourId) => {
    const tour = TOUR_DEFINITIONS[tourId];
    if (!tour) return;
    // Navigate to the correct tab before starting the tour
    if (onSwitchTab) {
      onSwitchTab(tourId); // tourId matches tab id (sky, loops, echoes, rhythm)
    }
    setActiveTour(tourId);
    setStepIndex(0);
  }, [onSwitchTab]);

  const endTour = useCallback((completed = false) => {
    if (activeTour && completed) {
      setToursCompleted(prev => ({ ...prev, [activeTour]: true }));
    }
    setActiveTour(null);
    setStepIndex(0);
  }, [activeTour]);

  const skipOnboarding = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(STORAGE_KEYS.completed, 'true');
    localStorage.setItem(STORAGE_KEYS.version, ONBOARDING_VERSION);
    localStorage.setItem(STORAGE_KEYS.welcomeDismissed, 'true');
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.completed, 'true');
    localStorage.setItem(STORAGE_KEYS.version, ONBOARDING_VERSION);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.completed);
    localStorage.removeItem(STORAGE_KEYS.version);
    localStorage.removeItem(STORAGE_KEYS.tours);
    localStorage.removeItem(STORAGE_KEYS.welcomeDismissed);
    setToursCompleted({});
    setShowWelcome(true);
    setIsFirstLaunch(true);
  }, []);

  const isTourCompleted = useCallback((tourId) => {
    return !!toursCompleted[tourId];
  }, [toursCompleted]);

  const getActiveTourSteps = useCallback(() => {
    if (!activeTour) return [];
    return TOUR_DEFINITIONS[activeTour]?.steps || [];
  }, [activeTour]);

  // Register tab navigation callback
  const registerTabSwitcher = useCallback((switchFn) => {
    setOnSwitchTab(() => switchFn);
  }, []);

  const value = {
    // State
    showWelcome,
    activeTour,
    toursCompleted,
    isFirstLaunch,
    stepIndex,

    // Actions
    dismissWelcome,
    startTour,
    endTour,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
    setStepIndex,
    registerTabSwitcher, // Register tab navigation from App

    // Helpers
    isTourCompleted,
    getActiveTourSteps,
    tourDefinitions: TOUR_DEFINITIONS,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
