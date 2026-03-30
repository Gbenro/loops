// Luna Loops - Tour Overlay
// React-joyride wrapper with Luna Loops dark cosmic styling

import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useOnboarding, TOUR_DEFINITIONS } from './OnboardingProvider.jsx';

// Custom tooltip component styled for Luna Loops
function Tooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  size,
}) {
  const isLast = index === size - 1;

  return (
    <div
      {...tooltipProps}
      style={{
        background: 'rgba(10, 15, 26, 0.97)',
        border: '1px solid rgba(245, 230, 200, 0.12)',
        borderRadius: 16,
        padding: 20,
        maxWidth: 320,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        animation: 'tourSlideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes tourSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Title */}
      {step.title && (
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20,
            fontWeight: 400,
            color: '#f5e6c8',
            marginBottom: 10,
          }}
        >
          {step.title}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          fontSize: 13,
          color: 'rgba(245, 230, 200, 0.65)',
          lineHeight: 1.65,
          marginBottom: 16,
        }}
      >
        {step.content}
      </div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Back button */}
        {index > 0 && (
          <button
            {...backProps}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(245, 230, 200, 0.06)',
              color: 'rgba(245, 230, 200, 0.5)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Back
          </button>
        )}
        {index === 0 && <div />}

        {/* Progress indicator */}
        <div
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.25)',
            letterSpacing: '0.1em',
          }}
        >
          {index + 1} / {size}
        </div>

        {/* Next/Done button */}
        {continuous && (
          <button
            {...primaryProps}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(245, 230, 200, 0.1)',
              color: '#f5e6c8',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        )}
      </div>

      {/* Skip option */}
      <button
        {...closeProps}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'none',
          border: 'none',
          color: 'rgba(245, 230, 200, 0.3)',
          fontSize: 18,
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
        aria-label="Close tour"
      >
        ×
      </button>
    </div>
  );
}

export function TourOverlay() {
  const { activeTour, endTour, stepIndex, setStepIndex } = useOnboarding();

  if (!activeTour) return null;

  const tourDef = TOUR_DEFINITIONS[activeTour];
  if (!tourDef) return null;

  // Transform steps for react-joyride
  const steps = tourDef.steps.map((step) => ({
    target: step.target,
    content: step.content,
    title: step.title,
    placement: step.placement || 'auto',
    isFixed: step.isFixed || false,
    disableBeacon: true,
    spotlightClicks: false,
    styles: {
      spotlight: {
        borderRadius: 12,
      },
    },
  }));

  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;

    // Debug logging
    console.log('[Tour]', { action, index, status, type, stepIndex });

    // Handle close/skip actions first
    if (action === ACTIONS.CLOSE) {
      endTour(false);
      return;
    }

    // Handle tour completion
    if (status === STATUS.FINISHED) {
      endTour(true);
      return;
    }

    if (status === STATUS.SKIPPED) {
      endTour(false);
      return;
    }

    // Handle step navigation (both after step completes and if target not found)
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Calculate direction based on action
      const isPrev = action === ACTIONS.PREV;
      const nextStepIndex = index + (isPrev ? -1 : 1);

      console.log('[Tour] Navigating to step', nextStepIndex);

      // Check bounds
      if (nextStepIndex < 0) {
        return; // Can't go before first step
      }

      if (nextStepIndex >= steps.length) {
        endTour(true); // Completed all steps
        return;
      }

      // Move to next/previous step
      setStepIndex(nextStepIndex);
    }
  };

  return (
    <Joyride
      steps={steps}
      stepIndex={stepIndex}
      run={true}
      continuous={true}
      spotlightPadding={8}
      onEvent={handleJoyrideCallback}
      tooltipComponent={Tooltip}
      styles={{
        options: {
          arrowColor: 'rgba(10, 15, 26, 0.97)',
          backgroundColor: 'rgba(10, 15, 26, 0.97)',
          overlayColor: 'rgba(4, 8, 16, 0.85)',
          primaryColor: 'rgba(245, 230, 200, 0.1)',
          textColor: '#f5e6c8',
          zIndex: 1050,
        },
        spotlight: {
          borderRadius: 12,
        },
        overlay: {
          mixBlendMode: 'normal',
        },
      }}
    />
  );
}
