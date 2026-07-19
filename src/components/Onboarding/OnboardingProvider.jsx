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
  navigation: {
    id: 'navigation',
    name: 'Navigation Tour',
    steps: [
      {
        target: '[data-tour="tab-sky"]',
        title: 'Sky — what is happening now.',
        content: 'The moon, its phase, its sign. Your starting point each time you open the app.',
        placement: 'top',
        isFixed: true,
      },
      {
        target: '[data-tour="tab-loops"]',
        title: 'Loops — your intentions.',
        content: 'Set cycle-wide and phase-specific intentions. Track what you are working with.',
        placement: 'top',
        isFixed: true,
      },
      {
        target: '[data-tour="tab-echoes"]',
        title: 'Echoes — your reflections.',
        content: 'Write or speak. Each echo is timestamped to the lunar phase.',
        placement: 'top',
        isFixed: true,
      },
      {
        target: '[data-tour="tab-rhythm"]',
        title: 'Rhythm — your practices.',
        content: 'Observe how named practices move through the phases over time.',
        placement: 'top',
        isFixed: true,
      },
    ],
  },
  sky: {
    id: 'sky',
    name: 'Sky Tour',
    steps: [
      {
        target: '[data-tour="moon-display"]',
        title: 'This is now.',
        content: 'The moon as it appears tonight, wherever you are. Tap it to open a deeper view of what this phase is asking.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="phase-info"]',
        title: 'The phase has a quality.',
        content: 'Eight phases, each with different energy — building, questioning, releasing. The text below the moon describes what is live right now.',
        placement: 'top',
      },
      {
        target: '[data-tour="zodiac-transit"]',
        title: 'The moon moves through the zodiac too.',
        content: 'Every few days it shifts signs. This adds texture — a watery sign feels different from a fiery one.',
        placement: 'top',
      },
      {
        target: '[data-tour="phase-tide-bar"]',
        title: 'Eight stations.',
        content: 'This row shows where you are in the cycle. The current phase is lit. Tap any phase to preview what that part of the cycle holds.',
        placement: 'top',
      },
      {
        target: '[data-tour="sky-go-deeper"]',
        title: 'Go deeper.',
        content: 'Tap this to open the cosmic detail sheet — extended phase meaning, resonances, and personal transit information.',
        placement: 'top',
      },
      {
        target: '[data-tour="sky-transit-card"]',
        title: 'Your personal transit.',
        content: 'When a notable transit is active, this card appears. It shows what cosmic weather is in play for you right now.',
        placement: 'top',
      },
      {
        target: '[data-tour="sky-phase-transition"]',
        title: 'Phase transitions.',
        content: 'When a new phase is approaching, this alert lets you know what is shifting and when.',
        placement: 'top',
      },
      {
        target: '[data-tour="sky-profile-menu"]',
        title: 'Your menu.',
        content: 'Access your profile, sign in, reset tours, and find the tutorial from here.',
        placement: 'bottom',
        isFixed: true,
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
        content: 'Set it at the New Moon. It holds your intention for the entire cycle — dark to light and back.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="phase-loops"]',
        title: 'Phase loops are containers.',
        content: 'Shorter, more immediate. What wants your attention during this specific phase?',
        placement: 'top',
      },
      {
        target: '[data-tour="add-loop-btn"]',
        title: 'Add a new loop.',
        content: 'Tap here to create a new loop — give it a name, choose its scope, and start tracking.',
        placement: 'top',
      },
      {
        target: '[data-tour="loop-card"]',
        title: 'Tap any loop to open it.',
        content: 'Each loop card opens a detail panel. Inside you can add subtasks, write notes, and manage the loop\'s lifecycle.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="loop-subtasks"]',
        title: 'Break it into steps.',
        content: 'Inside a loop, add subtasks to break your intention into concrete actions. Toggle them as you go.',
        placement: 'top',
      },
      {
        target: '[data-tour="loop-actions"]',
        title: 'Close, release, or continue.',
        content: 'When a loop is done, close it. At cycle\'s end, choose to release it completely or continue its thread into the next cycle.',
        placement: 'top',
      },
      {
        target: '[data-tour="open-loops"]',
        title: 'Open loops persist.',
        content: 'These loops have no phase window — they stay open across phases until you close them.',
        placement: 'top',
      },
      {
        target: '[data-tour="closed-loops"]',
        title: 'Completed this cycle.',
        content: 'Closed and released loops live here. Use the phase arrows to see what was completed in each phase.',
        placement: 'top',
      },
      {
        target: '[data-tour="closed-loops-nav"]',
        title: 'Navigate by phase.',
        content: 'Use these arrows to move through phases and see which loops were completed when.',
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
        content: 'Write what is true right now. Each echo is anchored to the phase when you made it.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="echoes-voice-orb"]',
        title: 'Your voice carries more than words.',
        content: 'Tap the orb to record. Speak freely — it will be transcribed and saved as an echo.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-recording-state"]',
        title: 'Recording in progress.',
        content: 'While recording, you will see a timer and visual pulse. Tap the orb again to stop and save.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-save-controls"]',
        title: 'Save or cancel.',
        content: 'After writing or recording, use these buttons to save your echo or discard it.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-tags"]',
        title: 'Find what you left.',
        content: 'Tags help you trace themes — grief, clarity, intention, body. Tap to filter by tag.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-cycle-nav"]',
        title: 'Navigate across cycles.',
        content: 'Use the arrows to move between lunar cycles and revisit past echoes.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-filter-modes"]',
        title: 'Filter by day, phase, or tag.',
        content: 'Switch between views to see your echoes organized differently — by calendar day, lunar phase, or your custom tags.',
        placement: 'top',
      },
      {
        target: '[data-tour="echoes-card"]',
        title: 'Each echo is a card.',
        content: 'Tap an echo to edit its text or tags. The phase stamp shows when it was captured in the cycle.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="echoes-phase-stamp"]',
        title: 'The phase stamp.',
        content: 'Every echo carries a stamp — the phase, zodiac sign, and day it was recorded. This is your breadcrumb through the cycle.',
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
        target: '[data-tour="rhythm-add-btn"]',
        title: 'Start a new rhythm.',
        content: 'Tap here to create a practice. Give it a name and choose whether it is ongoing or just for this cycle.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-intention"]',
        title: 'Intention is not a promise.',
        content: 'At each New Moon, set an intention for how you want to engage. No numbers. No pressure.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="rhythm-intention-actions"]',
        title: 'Continue or adjust.',
        content: 'For existing rhythms, you can continue last cycle\'s intention or adjust it for the new cycle.',
        placement: 'top',
      },
      {
        target: '[data-tour="phase-ring"]',
        title: 'Two rings. Two truths.',
        content: 'Outer ring = intention. Inner ring = reality. The gap between them is not failure — it is information.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-checkin"]',
        title: 'The dots are not scores.',
        content: 'Each phase, note what happened — present, partial, absent. Observations, not judgments.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-card"]',
        title: 'Tap to see the detail.',
        content: 'Each rhythm card opens a view where you can record observations, review your phase history, and see patterns.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="rhythm-history"]',
        title: 'At the end, a report.',
        content: 'When the Waning Crescent arrives, you can see how the whole cycle unfolded. Not to grade yourself — to notice patterns.',
        placement: 'top',
      },
      {
        target: '[data-tour="rhythm-cycle-report"]',
        title: 'The cycle report.',
        content: 'A summary of your practice across all eight phases. What showed up, what didn\'t, and what you might carry forward.',
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
    // Skip tab switch for 'navigation' tour — tab buttons are always visible
    if (onSwitchTab && tourId !== 'navigation') {
      onSwitchTab(tourId); // tourId matches tab id (sky, loops, echoes, rhythm)
    }
    setActiveTour(tourId);
    setStepIndex(0);
  }, [onSwitchTab]);

  const endTour = useCallback((completed = false) => {
    const completedTourId = activeTour;
    if (activeTour && completed) {
      setToursCompleted(prev => ({ ...prev, [activeTour]: true }));
    }
    setActiveTour(null);
    setStepIndex(0);
    // Auto-advance from navigation tour into the sky tour
    if (completedTourId === 'navigation' && completed) {
      setTimeout(() => {
        if (onSwitchTab) onSwitchTab('sky');
        setActiveTour('sky');
        setStepIndex(0);
      }, 300);
    }
  }, [activeTour, onSwitchTab]);

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
