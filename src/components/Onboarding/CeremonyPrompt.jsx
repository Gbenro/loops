// Luna Loops - Ceremony Prompt
// Phase-specific prompts for New Moon and Waning Crescent ceremonies

import { useState, useEffect, useCallback } from 'react';

// Storage keys for tracking ceremony prompts
const STORAGE_KEYS = {
  lastNewMoonCycle: 'ceremonyNewMoonCycle',
  lastWaningCrescentCycle: 'ceremonyWaningCrescentCycle',
};

// Check if a ceremony has been shown for the current cycle
function hasShownCeremony(type, cycleStart) {
  const key = type === 'new-moon' ? STORAGE_KEYS.lastNewMoonCycle : STORAGE_KEYS.lastWaningCrescentCycle;
  const lastCycle = localStorage.getItem(key);
  return lastCycle === cycleStart;
}

// Mark a ceremony as shown for the current cycle
function markCeremonyShown(type, cycleStart) {
  const key = type === 'new-moon' ? STORAGE_KEYS.lastNewMoonCycle : STORAGE_KEYS.lastWaningCrescentCycle;
  localStorage.setItem(key, cycleStart);
}

// Hook to manage ceremony state
export function useCeremonyPrompt(lunarData, hasActiveCycleLoop = false) {
  const [showCeremony, setShowCeremony] = useState(null); // 'new-moon' | 'waning-crescent' | null

  useEffect(() => {
    if (!lunarData) return;

    const { phase, cycleStart } = lunarData;
    const phaseKey = phase?.key;

    // Check for onboarding completion - don't interrupt onboarding flow
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted) return;

    // New Moon ceremony - show if in new moon phase and no cycle loop exists
    if (phaseKey === 'new' && !hasActiveCycleLoop) {
      if (!hasShownCeremony('new-moon', cycleStart)) {
        setShowCeremony('new-moon');
        return;
      }
    }

    // Waning Crescent ceremony - show at end of cycle
    if (phaseKey === 'waning-crescent') {
      if (!hasShownCeremony('waning-crescent', cycleStart)) {
        setShowCeremony('waning-crescent');
        return;
      }
    }
  }, [lunarData, hasActiveCycleLoop]);

  const dismissCeremony = useCallback(() => {
    if (showCeremony && lunarData?.cycleStart) {
      markCeremonyShown(showCeremony, lunarData.cycleStart);
    }
    setShowCeremony(null);
  }, [showCeremony, lunarData?.cycleStart]);

  return { showCeremony, dismissCeremony };
}

// Copy from docs/ONBOARDING_COPY.md Section 3
const CEREMONY_CONTENT = {
  'new-moon': {
    headline: 'The dark is here.',
    body: "This is the most interior moment \u2014 when something can be seeded that will shape the whole cycle. You don't need to know what it is yet. Sometimes the intention finds you.",
    primaryAction: 'Plant an intention',
    dismissText: 'Not now',
  },
  'waning-crescent': {
    headline: 'The cycle is ending.',
    body: "What did this moon hold? You carried something through eight phases. Some of it worked. Some of it didn't. Both are true. The only question now is: what are you willing to release?",
    primaryAction: 'Review cycle',
    dismissText: 'Let it pass',
  },
};

export function CeremonyPrompt({ type, onAction, onDismiss }) {
  const content = CEREMONY_CONTENT[type];

  if (!content) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ceremony-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 8, 16, 0.97)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: 20,
        animation: 'ceremonyFadeIn 0.5s ease-out',
      }}
    >
      <style>{`
        @keyframes ceremonyFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ceremonySlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 340,
          background: '#0a0f18',
          border: '1px solid rgba(245, 230, 200, 0.1)',
          borderRadius: 20,
          padding: '40px 28px 32px',
          textAlign: 'center',
          animation: 'ceremonySlideUp 0.6s ease-out 0.1s both',
        }}
      >
        {/* Phase icon */}
        <div
          style={{
            fontSize: 40,
            marginBottom: 24,
            opacity: 0.8,
          }}
        >
          {type === 'new-moon' ? '\uD83C\uDF11' : '\uD83C\uDF18'}
        </div>

        {/* Headline */}
        <h1
          id="ceremony-title"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24,
            fontWeight: 400,
            color: '#f5e6c8',
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          {content.headline}
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 230, 200, 0.6)',
            lineHeight: 1.75,
            marginBottom: 32,
          }}
        >
          {content.body}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onAction}
            style={{
              padding: '14px 24px',
              borderRadius: 12,
              background: type === 'new-moon'
                ? 'rgba(167, 139, 250, 0.15)'
                : 'rgba(245, 230, 200, 0.1)',
              border: `1px solid ${type === 'new-moon'
                ? 'rgba(167, 139, 250, 0.3)'
                : 'rgba(245, 230, 200, 0.2)'}`,
              color: type === 'new-moon' ? '#c4b5fd' : '#f5e6c8',
              fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {content.primaryAction}
          </button>

          <button
            onClick={onDismiss}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              background: 'transparent',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.35)',
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {content.dismissText}
          </button>
        </div>
      </div>
    </div>
  );
}
