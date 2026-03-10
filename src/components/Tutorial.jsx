// Luna Loops — Tutorial System
// Mode 1: App Guide (spotlight walkthrough)
// Mode 2: Phases (phase cards)

import { useState, useEffect, useCallback } from 'react';
import { MoonFace } from './MoonFace.jsx';

// ─── Guide Steps ─────────────────────────────────────────────────────────────

const GUIDE_STEPS = [
  // 0 — Welcome (no spotlight)
  {
    title: 'A different relationship with time',
    body: 'Cosmic Loops replaces the Gregorian calendar with the lunar cycle. You move through eight phases — each with its own quality and invitation. This guide shows you how the app works.',
  },
  // Sky
  {
    targetSelector: '[data-tutorial="tab-sky"]',
    sectionLabel: 'SKY · 1 of 5',
    title: 'Sky',
    body: 'Your cosmic location. Every time you open the app, Sky tells you where you are in the cycle — which phase, how far through it, what the quality is.',
  },
  {
    targetSelector: '[data-tutorial="moon-display"]',
    sectionLabel: 'SKY · 2 of 5',
    title: 'The Moon',
    body: 'Rendered live from astronomical calculations — accurate to the hour. No API, no internet required. The phase is always correct.',
  },
  {
    targetSelector: '[data-tutorial="phase-tide-bar"]',
    sectionLabel: 'SKY · 3 of 5',
    title: 'Phase Tide',
    body: 'Where you are within the current phase: Opening → In Flow → Completing → Closing. The badge shows THR (Threshold) or FLW (Flow) — two distinct rhythmic characters.',
  },
  {
    targetSelector: '[data-tutorial="phase-transition-card"]',
    sectionLabel: 'SKY · 4 of 5',
    title: "What's Coming",
    body: 'Within 24 hours of the next phase, this card appears. It names what\'s coming and gives you its invitation — so you can meet the shift consciously.',
    fallbackBody: 'This card appears within 24 hours of the next phase shift. It names what\'s coming and gives you its invitation — so you can meet the shift consciously.',
  },
  {
    targetSelector: '[data-tutorial="your-sky"]',
    sectionLabel: 'SKY · 5 of 5',
    title: 'Your Sky',
    body: 'Your natal chart layer. When the current sky activates your natal placements, it surfaces here quietly. Astrology as personal weather, not prediction.',
  },
  // Loops
  {
    targetSelector: '[data-tutorial="tab-loops"]',
    tabToActivate: 'loops',
    sectionLabel: 'LOOPS · 1 of 4',
    title: 'Loops',
    body: 'What you are building this cycle. A loop is not a task — it is an intention expressed through a phase.',
  },
  {
    targetSelector: '[data-tutorial="cycle-loop"]',
    tabToActivate: 'loops',
    sectionLabel: 'LOOPS · 2 of 4',
    title: 'Cycle Loop',
    body: 'One intention for the full 29.5 days. Set at the New Moon as a ceremony. Pinned here for the entire arc. This is the north star everything else serves.',
    fallbackBody: 'One intention for the full 29.5 days. Set at the New Moon as a ceremony and pinned for the entire arc. Open at the New Moon to set yours.',
  },
  {
    targetSelector: '[data-tutorial="phase-loops"]',
    tabToActivate: 'loops',
    sectionLabel: 'LOOPS · 3 of 4',
    title: 'Phase Loops',
    body: 'Smaller moves aligned to the energy of each phase. 1–2 per waxing phase. The phase doesn\'t just timestamp the loop — it shapes what the loop is.',
    fallbackBody: 'Smaller moves aligned to the energy of each phase. 1–2 per waxing phase. As you open loops, they appear here sorted by when they were opened.',
  },
  {
    targetSelector: '[data-tutorial="add-loop-btn"]',
    tabToActivate: 'loops',
    sectionLabel: 'LOOPS · 4 of 4',
    title: 'Phase-Aware Adding',
    body: 'The add button changes with the phase. Hidden at Full Moon. Dimmed during waning. At Waning Crescent it disappears entirely. The app guides you — it doesn\'t force.',
  },
  // Echoes
  {
    targetSelector: '[data-tutorial="tab-echoes"]',
    tabToActivate: 'echoes',
    sectionLabel: 'ECHOES · 1 of 4',
    title: 'Echoes',
    body: 'What you are noticing. Every reflection is stamped with the lunar moment — not the calendar date. When you look back, you see the moon you were under.',
  },
  {
    targetSelector: '[data-tutorial="echoes-write-area"]',
    tabToActivate: 'echoes',
    sectionLabel: 'ECHOES · 2 of 4',
    title: 'Write or Speak',
    body: 'Type to compose. Or tap the orb to speak — the transcript forms in real time. Voice captures the stream before the thinking mind edits it.',
  },
  {
    targetSelector: '[data-tutorial="echoes-voice-orb"]',
    tabToActivate: 'echoes',
    sectionLabel: 'ECHOES · 3 of 4',
    title: 'The Orb',
    body: 'Nearly invisible when idle. Alive when listening. Tap to start, tap to stop. What you speak becomes an echo, stamped with the phase and time.',
    fallbackBody: 'Nearly invisible when idle, alive when listening. Tap to start, tap to stop. What you speak becomes an echo stamped with the phase and time.',
  },
  {
    targetSelector: '[data-tutorial="echo-stamp"]',
    tabToActivate: 'echoes',
    sectionLabel: 'ECHOES · 4 of 4',
    title: 'The Lunar Stamp',
    body: 'Phase name, phase type (THR/FLW), moon age in days. The Gregorian date is hidden — tap the stamp to reveal it. Lunar context is always primary.',
    fallbackBody: 'Each echo carries a lunar stamp — phase name, type (THR/FLW), and moon age in days. The calendar date is hidden by default; lunar context is always primary.',
  },
  // 14 — Closing (no spotlight)
  {
    title: "You're oriented",
    body: 'Open Sky each day to locate yourself. Open Loops when you\'re ready to commit. Open Echoes when something arrives. The cycle does the rest.',
    isClosing: true,
  },
];

// ─── Phase Data ───────────────────────────────────────────────────────────────

const PHASE_DATA = [
  {
    key: 'new',
    label: 'NEW MOON · RITUAL',
    title: 'The Seed',
    age: 0,
    accent: null, // special treatment
    isNew: true,
    question: 'What wants to be born through me this cycle?',
    description: 'The New Moon is not a phase to move through — it is a threshold to cross. The sky goes dark and something new becomes possible. This is the most important moment in the cycle. Everything that follows grows from what is planted here.',
    body2: 'You do not plan at the New Moon. You plant. One intention. No subtasks, no categories, no metadata. The cycle loop opens here as a ceremony, held for the full 29.5 days.',
    loopBehaviour: 'Open 1 cycle loop only. No phase loops. No tasks. The what and why only.',
    entrainment: 'You can sit with blankness without filling it.',
  },
  {
    key: 'waxing-crescent',
    label: 'WAXING CRESCENT',
    title: 'Waxing Crescent',
    age: 3.7,
    accent: '#74c69d',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~25%',
    bodyState: 'Energy rising, momentum building',
    description: 'First light after darkness. The intention you planted is beginning to move. Take small, deliberate steps. This phase rewards momentum — each action compounds. Trust the direction even if you can\'t yet see the destination.',
    loopBehaviour: 'Open 1–2 phase loops. Focus on first steps and building structure.',
    activities: ['First steps', 'Planning', 'Outreach', 'New habits', 'Gathering'],
    entrainment: 'You begin before you feel ready.',
  },
  {
    key: 'first-quarter',
    label: 'FIRST QUARTER',
    title: 'First Quarter',
    age: 7.38,
    accent: '#f6ad55',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '50%',
    bodyState: 'Tension and decisiveness',
    description: 'Half-lit, half-dark. The tension between intention and reality peaks here. Obstacles test what you\'re willing to commit to. This is not the place for reassessment — it\'s the place for decision. Commit fully or let go cleanly.',
    loopBehaviour: 'Face the obstacle in each active loop. Make one clear decision per loop.',
    activities: ['Decisions', 'Commitments', 'Obstacles', 'Pivots', 'Confrontation'],
    entrainment: 'You make the decision before you have certainty.',
  },
  {
    key: 'waxing-gibbous',
    label: 'WAXING GIBBOUS',
    title: 'Waxing Gibbous',
    age: 11.1,
    accent: '#81e6d9',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~75%',
    bodyState: 'Refinement, anticipation',
    description: 'Almost full. The shape of what you\'re building is visible. This is not the time to revolutionise — it\'s the time to refine. Adjust the details. Trust what you\'ve built. The peak is approaching and your work wants to be ready to meet it.',
    loopBehaviour: 'Refine active loops. Adjust details. Do not open new loops — finish existing ones.',
    activities: ['Refinement', 'Review', 'Detail work', 'Final adjustments', 'Practice'],
    entrainment: 'You refine without starting over.',
  },
  {
    key: 'full',
    label: 'FULL MOON',
    title: 'Full Moon',
    age: 14.765,
    accent: '#fefcbf',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '100%',
    bodyState: 'Peak energy, heightened emotion',
    description: 'Maximum light. Everything illuminated. What you built is visible in full — including what didn\'t work. This is the harvest and the revelation simultaneously. Let what is true arrive without editing it. Celebrate completions. See clearly.',
    loopBehaviour: 'No new loops. See what the light reveals. Close loops that have completed.',
    activities: ['Celebration', 'Revelation', 'Harvest', 'Gratitude', 'Visibility'],
    entrainment: 'You receive what the cycle has been building toward.',
  },
  {
    key: 'waning-gibbous',
    label: 'WANING GIBBOUS',
    title: 'Waning Gibbous',
    age: 18.5,
    accent: '#b794f4',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~75%',
    bodyState: 'Integration, generosity',
    description: 'The peak has passed. The energy is full but moving downward. This is the natural phase of sharing and teaching — what you learned wants to be given back. Gratitude flows easily here. Begin the releasing process with active loops.',
    loopBehaviour: 'Share progress. Close loops that served their purpose. Begin releasing.',
    activities: ['Sharing', 'Teaching', 'Gratitude', 'Integration', 'Giving back'],
    entrainment: 'You give without needing to keep.',
  },
  {
    key: 'last-quarter',
    label: 'LAST QUARTER',
    title: 'Last Quarter',
    age: 22.15,
    accent: '#f687b3',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '50%',
    bodyState: 'Release, spaciousness',
    description: 'Half-lit again, but releasing now. What didn\'t complete, didn\'t work, or isn\'t serving you — this is the moment to let it go. Not with force, but with clarity. The field needs to be cleared for what\'s next. Forgiveness is practical here.',
    loopBehaviour: 'Release loops that didn\'t close. Clear incomplete intentions. Forgive.',
    activities: ['Release', 'Forgiveness', 'Clearing', 'Surrender', 'Simplifying'],
    entrainment: 'You release without needing to understand why.',
  },
  {
    key: 'waning-crescent',
    label: 'WANING CRESCENT',
    title: 'Waning Crescent',
    age: 26,
    accent: '#718096',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~10%',
    bodyState: 'Deep rest, dreamlike',
    description: 'The final sliver before darkness. The cycle is completing. Do not begin new things here — let the old cycle finish. Rest is not laziness; it is preparation. The quality of your next New Moon is shaped by how fully you rest now.',
    loopBehaviour: 'Do not open loops. Rest. Let the cycle complete naturally.',
    activities: ['Rest', 'Dreaming', 'Solitude', 'Meditation', 'Surrender'],
    entrainment: 'You rest before you feel the tiredness.',
  },
];

// ─── Tutorial Component ───────────────────────────────────────────────────────

export function Tutorial({ onClose, activeTab, onSwitchTab, initialMode = 'guide' }) {
  const [mode, setMode] = useState(initialMode);
  const [guideStep, setGuideStep] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const measureStep = useCallback((stepIdx) => {
    const step = GUIDE_STEPS[stepIdx];
    if (!step?.targetSelector) {
      setSpotlightRect(null);
      return;
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(step.targetSelector);
      if (!el) { setSpotlightRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { setSpotlightRect(null); return; }
      setSpotlightRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    });
  }, []);

  useEffect(() => {
    if (mode !== 'guide') return;
    const step = GUIDE_STEPS[guideStep];
    if (step?.tabToActivate && activeTab !== step.tabToActivate) {
      onSwitchTab(step.tabToActivate);
      setTimeout(() => measureStep(guideStep), 200);
    } else {
      measureStep(guideStep);
    }
  }, [guideStep, mode, activeTab, measureStep, onSwitchTab]);

  const currentStep = GUIDE_STEPS[guideStep];
  const isWelcome = guideStep === 0;
  const isClosing = currentStep?.isClosing;
  const isFullScreen = isWelcome || isClosing;

  const goNext = () => {
    if (guideStep < GUIDE_STEPS.length - 1) setGuideStep(g => g + 1);
    else onClose();
  };
  const goPrev = () => { if (guideStep > 0) setGuideStep(g => g - 1); };

  // Callout card position logic
  const vhMid = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
  const cardBelow = spotlightRect ? (spotlightRect.top + spotlightRect.height / 2) < vhMid : false;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes tutFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tutSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {mode === 'guide' ? (
        <GuideMode
          step={currentStep}
          guideStep={guideStep}
          totalSteps={GUIDE_STEPS.length}
          spotlightRect={spotlightRect}
          isFullScreen={isFullScreen}
          isWelcome={isWelcome}
          isClosing={isClosing}
          cardBelow={cardBelow}
          onNext={goNext}
          onPrev={goPrev}
          onClose={onClose}
        />
      ) : (
        <PhasesMode
          phaseIdx={phaseIdx}
          setPhaseIdx={setPhaseIdx}
          onClose={onClose}
        />
      )}

      {/* Top bar — always visible */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 1003,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'linear-gradient(to bottom, rgba(4,8,16,0.9) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 11, fontFamily: 'monospace',
          letterSpacing: '0.2em', color: 'rgba(245,230,200,0.35)',
        }}>
          COSMIC LOOPS · GUIDE
        </div>
        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(245,230,200,0.06)',
          borderRadius: 20, padding: 3,
          pointerEvents: 'all',
        }}>
          {['guide', 'phases'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '5px 14px', borderRadius: 16, border: 'none',
              background: mode === m ? 'rgba(245,230,200,0.12)' : 'transparent',
              color: mode === m ? '#f5e6c8' : 'rgba(245,230,200,0.4)',
              fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em',
              textTransform: 'uppercase', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {m === 'guide' ? 'App Guide' : 'Phases'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Guide Mode ───────────────────────────────────────────────────────────────

function GuideMode({ step, guideStep, totalSteps, spotlightRect, isFullScreen, isWelcome, isClosing, cardBelow, onNext, onPrev, onClose }) {
  const pad = 12;
  const hasSpotlight = !isFullScreen && spotlightRect;

  return (
    <>
      {/* Full-screen dim backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: isFullScreen ? 'rgba(4,8,16,0.95)' : 'transparent',
        zIndex: 1000,
        animation: 'tutFadeIn 0.3s ease',
        pointerEvents: isFullScreen ? 'all' : 'none',
      }} />

      {/* Spotlight box-shadow overlay (when not full-screen) */}
      {hasSpotlight && (
        <div style={{
          position: 'fixed',
          left: spotlightRect.left - pad,
          top: spotlightRect.top - pad,
          width: spotlightRect.width + pad * 2,
          height: spotlightRect.height + pad * 2,
          borderRadius: 16,
          boxShadow: '0 0 0 100vmax rgba(4,8,16,0.85)',
          transition: 'left 0.4s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1), width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 1001,
          pointerEvents: 'none',
        }} />
      )}

      {/* Dim backdrop when no spotlight and not full-screen (element not found) */}
      {!isFullScreen && !spotlightRect && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(4,8,16,0.85)',
          zIndex: 1000,
        }} />
      )}

      {/* Click interceptor — blocks app interaction */}
      {!isFullScreen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      )}

      {/* Full-screen intro / closing */}
      {isFullScreen ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '60px 32px 40px',
          animation: 'tutSlideUp 0.4s ease',
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32, fontWeight: 300,
            color: '#f5e6c8', marginBottom: 20,
            textAlign: 'center', lineHeight: 1.2,
          }}>
            {step?.title}
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(245,230,200,0.65)',
            lineHeight: 1.75, textAlign: 'center',
            maxWidth: 340,
          }}>
            {step?.body}
          </div>

          {isClosing ? (
            <button
              onClick={onClose}
              style={{
                marginTop: 48, padding: '14px 32px',
                borderRadius: 24,
                background: 'rgba(245,230,200,0.1)',
                border: '1px solid rgba(245,230,200,0.2)',
                color: '#f5e6c8', fontSize: 15,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              Enter the app ✦
            </button>
          ) : (
            <button
              onClick={onNext}
              style={{
                marginTop: 48, padding: '14px 32px',
                borderRadius: 24,
                background: 'rgba(245,230,200,0.1)',
                border: '1px solid rgba(245,230,200,0.2)',
                color: '#f5e6c8', fontSize: 15,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
            >
              Show me around
            </button>
          )}
        </div>
      ) : (
        /* Callout card */
        <div style={{
          position: 'fixed',
          zIndex: 1002,
          left: '50%',
          transform: 'translateX(-50%)',
          ...(spotlightRect
            ? (cardBelow
              ? { top: spotlightRect.top + spotlightRect.height + pad + 16 }
              : { bottom: window.innerHeight - spotlightRect.top + pad + 16 })
            : { top: '50%', transform: 'translate(-50%, -50%)' }
          ),
          width: 'calc(100% - 32px)',
          maxWidth: 320,
          background: 'rgba(10,15,26,0.97)',
          border: '1px solid rgba(245,230,200,0.12)',
          borderRadius: 16,
          padding: 20,
          backdropFilter: 'blur(12px)',
          animation: 'tutSlideUp 0.3s ease',
        }}>
          {step?.sectionLabel && (
            <div style={{
              fontSize: 10, fontFamily: 'monospace',
              letterSpacing: '0.18em', color: 'rgba(245,230,200,0.3)',
              marginBottom: 10, textTransform: 'uppercase',
            }}>
              {step.sectionLabel}
            </div>
          )}
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 300,
            color: '#f5e6c8', marginBottom: 10,
          }}>
            {step?.title}
          </div>
          <div style={{
            fontSize: 13, color: 'rgba(245,230,200,0.65)',
            lineHeight: 1.65,
          }}>
            {spotlightRect ? step?.body : (step?.fallbackBody || step?.body)}
          </div>

          {/* Prev / Next */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: 20,
          }}>
            <button
              onClick={onPrev}
              disabled={guideStep <= 1}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: guideStep > 1 ? 'rgba(245,230,200,0.08)' : 'transparent',
                color: guideStep > 1 ? 'rgba(245,230,200,0.6)' : 'rgba(245,230,200,0.2)',
                fontSize: 13, cursor: guideStep > 1 ? 'pointer' : 'default',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ‹ Prev
            </button>
            <div style={{
              fontSize: 9, fontFamily: 'monospace',
              color: 'rgba(245,230,200,0.2)', letterSpacing: '0.1em',
            }}>
              {guideStep} / {totalSteps - 2}
            </div>
            <button
              onClick={onNext}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'rgba(245,230,200,0.1)',
                color: '#f5e6c8', fontSize: 13, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Phases Mode ─────────────────────────────────────────────────────────────

function PhasesMode({ phaseIdx, setPhaseIdx, onClose }) {
  const phase = PHASE_DATA[phaseIdx];
  const moonAge = phase.age / 29.53;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      background: '#040810',
      display: 'flex', flexDirection: 'column',
      paddingTop: 56, // below top bar
      overflow: 'hidden',
    }}>
      {/* Mini-moon strip */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        gap: 6, padding: '12px 16px',
        borderBottom: '1px solid rgba(245,230,200,0.06)',
        flexShrink: 0,
      }}>
        {PHASE_DATA.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPhaseIdx(i)}
            style={{
              width: 36, height: 36,
              borderRadius: '50%', border: 'none',
              background: i === phaseIdx ? 'rgba(245,230,200,0.1)' : 'transparent',
              cursor: 'pointer', padding: 4,
              opacity: i === phaseIdx ? 1 : 0.5,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {p.isNew ? (
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="#040810" stroke="rgba(245,230,200,0.25)" strokeWidth="1" />
              </svg>
            ) : (
              <MoonFace size={24} phase={p.age / 29.53} illumination={parseFloat(p.illumination) || 50} />
            )}
          </button>
        ))}
      </div>

      {/* Phase card */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0 20px 100px',
      }}>
        {phase.isNew ? (
          <NewMoonCard phase={phase} />
        ) : (
          <PhaseCard phase={phase} moonAge={moonAge} />
        )}
      </div>

      {/* Prev / Next / Close */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(to top, #040810 60%, transparent)',
        zIndex: 10,
      }}>
        <button
          onClick={() => setPhaseIdx(i => Math.max(0, i - 1))}
          disabled={phaseIdx === 0}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: phaseIdx > 0 ? 'rgba(245,230,200,0.08)' : 'transparent',
            color: phaseIdx > 0 ? 'rgba(245,230,200,0.7)' : 'rgba(245,230,200,0.2)',
            fontSize: 14, cursor: phaseIdx > 0 ? 'pointer' : 'default',
          }}
        >
          ‹ Prev
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          {PHASE_DATA.map((_, i) => (
            <div key={i} onClick={() => setPhaseIdx(i)} style={{
              width: i === phaseIdx ? 16 : 6,
              height: 6, borderRadius: 3,
              background: i === phaseIdx ? 'rgba(245,230,200,0.6)' : 'rgba(245,230,200,0.15)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {phaseIdx < PHASE_DATA.length - 1 ? (
          <button
            onClick={() => setPhaseIdx(i => Math.min(PHASE_DATA.length - 1, i + 1))}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'rgba(245,230,200,0.1)',
              color: '#f5e6c8', fontSize: 14, cursor: 'pointer',
            }}
          >
            Next ›
          </button>
        ) : (
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'rgba(245,230,200,0.1)',
              color: '#f5e6c8', fontSize: 14, cursor: 'pointer',
            }}
          >
            Done ✦
          </button>
        )}
      </div>
    </div>
  );
}

// ─── New Moon Card ────────────────────────────────────────────────────────────

function NewMoonCard({ phase }) {
  return (
    <div style={{ paddingTop: 32, animation: 'tutSlideUp 0.35s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontSize: 10, fontFamily: 'monospace',
          letterSpacing: '0.2em', color: 'rgba(245,230,200,0.35)',
          marginBottom: 20,
        }}>
          {phase.label}
        </div>

        {/* Dark moon with ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="rgba(245,230,200,0.08)" stroke="rgba(245,230,200,0.08)" strokeWidth="1" />
            <circle cx="40" cy="40" r="28" fill="#04080e" />
          </svg>
        </div>

        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 28, fontWeight: 300,
          color: 'rgba(245,230,200,0.7)',
          marginBottom: 28,
        }}>
          {phase.title}
        </div>

        {/* Central question */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 20, fontStyle: 'italic',
          color: 'rgba(245,230,200,0.85)',
          lineHeight: 1.5,
          padding: '0 16px',
          marginBottom: 32,
        }}>
          "{phase.question}"
        </div>
      </div>

      <div style={{
        fontSize: 14, color: 'rgba(245,230,200,0.6)',
        lineHeight: 1.8, marginBottom: 20,
      }}>
        {phase.description}
      </div>
      <div style={{
        fontSize: 14, color: 'rgba(245,230,200,0.6)',
        lineHeight: 1.8, marginBottom: 28,
      }}>
        {phase.body2}
      </div>

      {/* Loop behaviour */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 10,
        background: 'rgba(245,230,200,0.03)',
        border: '1px solid rgba(245,230,200,0.08)',
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace',
          letterSpacing: '0.1em', color: 'rgba(245,230,200,0.3)',
          marginBottom: 8,
        }}>
          LOOP BEHAVIOUR
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,230,200,0.55)', lineHeight: 1.6 }}>
          {phase.loopBehaviour}
        </div>
      </div>

      {/* Entrainment sign */}
      <div style={{
        borderLeft: '2px solid rgba(245,230,200,0.12)',
        paddingLeft: 14,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace',
          letterSpacing: '0.1em', color: 'rgba(245,230,200,0.25)',
          marginBottom: 6,
        }}>
          ENTRAINMENT SIGN
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 15, fontStyle: 'italic',
          color: 'rgba(245,230,200,0.5)', lineHeight: 1.6,
        }}>
          "{phase.entrainment}"
        </div>
      </div>
    </div>
  );
}

// ─── Phase Card (7 phases) ────────────────────────────────────────────────────

function PhaseCard({ phase, moonAge }) {
  const isThreshold = phase.type === 'Threshold';
  const typeColor = isThreshold ? '#f6ad55' : '#74c69d';

  return (
    <div style={{ paddingTop: 0, animation: 'tutSlideUp 0.35s ease' }}>
      {/* Top glow */}
      <div style={{
        height: 140,
        background: `radial-gradient(ellipse at 50% 0%, ${phase.accent}20 0%, transparent 65%)`,
        marginLeft: -20, marginRight: -20,
        marginBottom: -60,
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 20 }}>
        <MoonFace
          size={80}
          phase={moonAge}
          illumination={parseFloat(phase.illumination) || 50}
        />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26, color: phase.accent,
          marginBottom: 6,
        }}>
          {phase.title}
        </div>

        <div style={{
          fontSize: 11, fontFamily: 'monospace',
          letterSpacing: '0.2em', color: 'rgba(245,230,200,0.4)',
          marginBottom: 12,
        }}>
          {phase.label}
        </div>

        {/* Type pill */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          background: isThreshold ? 'rgba(246,173,85,0.1)' : 'rgba(116,198,157,0.1)',
          border: `1px solid ${isThreshold ? 'rgba(246,173,85,0.25)' : 'rgba(116,198,157,0.25)'}`,
          color: typeColor, fontSize: 10,
          fontFamily: 'monospace', letterSpacing: '0.1em',
        }}>
          {phase.type.toUpperCase()} · {phase.duration}
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 16, fontStyle: 'italic',
        color: 'rgba(245,230,200,0.75)',
        lineHeight: 1.75, marginBottom: 24,
      }}>
        {phase.description}
      </div>

      {/* 2-col meta */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 10, marginBottom: 20,
      }}>
        {[
          { label: 'ILLUMINATION', value: phase.illumination },
          { label: 'BODY STATE', value: phase.bodyState },
        ].map(m => (
          <div key={m.label} style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(245,230,200,0.03)',
            border: '1px solid rgba(245,230,200,0.06)',
          }}>
            <div style={{
              fontSize: 8, fontFamily: 'monospace',
              letterSpacing: '0.1em', color: 'rgba(245,230,200,0.28)',
              marginBottom: 6,
            }}>
              {m.label}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(245,230,200,0.6)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Loop behaviour */}
      <div style={{
        padding: '14px 16px', borderRadius: 10,
        background: 'rgba(245,230,200,0.03)',
        border: '1px solid rgba(245,230,200,0.08)',
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace',
          letterSpacing: '0.1em', color: 'rgba(245,230,200,0.3)',
          marginBottom: 8,
        }}>
          LOOP BEHAVIOUR
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,230,200,0.55)', lineHeight: 1.6 }}>
          {phase.loopBehaviour}
        </div>
      </div>

      {/* Activities */}
      {phase.activities && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {phase.activities.map(a => (
            <span key={a} style={{
              padding: '4px 10px', borderRadius: 14,
              background: `${phase.accent}12`,
              border: `1px solid ${phase.accent}25`,
              color: phase.accent, fontSize: 11,
              fontFamily: 'monospace', letterSpacing: '0.05em',
            }}>
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Entrainment sign */}
      <div style={{
        borderLeft: `2px solid ${phase.accent}30`,
        paddingLeft: 14, marginBottom: 8,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace',
          letterSpacing: '0.1em', color: 'rgba(245,230,200,0.25)',
          marginBottom: 6,
        }}>
          ENTRAINMENT SIGN
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 15, fontStyle: 'italic',
          color: 'rgba(245,230,200,0.5)', lineHeight: 1.6,
        }}>
          "{phase.entrainment}"
        </div>
      </div>
    </div>
  );
}
