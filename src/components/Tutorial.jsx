// Luna Loops — Tutorial System
// Mode 1: App Guide (spotlight walkthrough)
// Mode 2: Phases (phase cards)

import { useState, useEffect, useCallback } from 'react';
import { MoonFace } from './MoonFace.jsx';

const IS_V2 = import.meta.env.VITE_APP_VERSION === 'v2';

// ─── Guide Steps ─────────────────────────────────────────────────────────────

const GUIDE_STEPS = [
  // 0 — Welcome (no spotlight)
  {
    title: 'A different relationship with time',
    body: 'Luna Loops replaces the Gregorian calendar with the lunar cycle. You move through eight phases — each with its own quality and invitation.',
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
    image: '/tutorial/phase-loops.png',
  },
  {
    targetSelector: '[data-tutorial="add-loop-btn"]',
    tabToActivate: 'loops',
    sectionLabel: 'LOOPS · 4 of 4',
    title: 'Phase-Aware Adding',
    body: 'The add button changes with the phase. Hidden at Full Moon. Dimmed during waning. At Waning Crescent it disappears entirely. The app guides you — it doesn\'t force.',
    image: '/tutorial/add-loop.png',
    action: 'open-loop-sheet',
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
    image: '/tutorial/echoes-write.png',
    action: 'open-echo-write',
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
    image: '/tutorial/echo-stamp.png',
  },
  // 14 — Closing (no spotlight)
  {
    title: "You're oriented",
    body: 'Open Sky each day to locate yourself. Open Loops when you\'re ready to commit. Open Echoes when something arrives. The cycle does the rest.',
    isClosing: true,
  },
];

// ─── Phase Data ───────────────────────────────────────────────────────────────

const PHASE_DATA_ORIGINAL = [
  {
    key: 'new',
    label: 'NEW MOON',
    title: 'New Moon',
    plantStage: 'The Seed',
    age: 0,
    accent: 'rgba(245,230,200,0.6)',
    isNew: true,
    type: 'Threshold',
    duration: '1.85 days',
    illumination: '0%',
    question: 'What wants to be born through me this cycle?',
    description: 'The New Moon is not a phase to move through — it is a threshold to cross. The sky goes dark and something new becomes possible. This is the most important moment in the cycle. Everything that follows grows from what is planted here.',
    body2: 'You do not plan at the New Moon. You plant. One intention. No subtasks, no categories, no metadata. The cycle loop opens here as a ceremony, held for the full 29.5 days.',
    bodyState: 'Still, empty, quietly receptive',
    loopBehaviour: 'Open 1 cycle loop only. No phase loops. No tasks. The what and why only.',
    activities: ['Ceremony', 'Intention', 'Stillness', 'Planting', 'Void Energy'],
    entrainment: 'You can sit with the void without filling it.',
  },
  {
    key: 'waxing-crescent',
    label: 'WAXING CRESCENT',
    title: 'Waxing Crescent',
    plantStage: 'The Sprout',
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
    plantStage: 'The Stem',
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
    plantStage: 'The Growth',
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
    plantStage: 'The Bloom',
    age: 14.765,
    accent: '#fefcbf',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '100%',
    bodyState: 'Peak energy, heightened emotion',
    description: 'Maximum light. Everything illuminated. What you built is visible in full — including what didn\'t work. This is the harvest and the revelation simultaneously. Let what is true arrive without editing it. Celebrate completions. See clearly.',
    loopBehaviour: 'No new loops. See what the light reveals. Close loops that have completed.',
    activities: ['Celebration', 'Revelation', 'Completion', 'Gratitude', 'Visibility'],
    entrainment: 'You receive what the cycle has been building toward.',
  },
  {
    key: 'waning-gibbous',
    label: 'WANING GIBBOUS',
    title: 'Waning Gibbous',
    plantStage: 'The Harvest',
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
    plantStage: 'The Shedding',
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
    plantStage: 'The Dormancy',
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

const PHASE_DATA_V2 = [
  {
    key: 'new',
    label: 'NEW MOON',
    title: 'New Moon',
    plantStage: 'The Seed in Darkness',
    age: 0,
    accent: 'rgba(245,230,200,0.6)',
    isNew: true,
    type: 'Threshold',
    duration: '1.85 days',
    illumination: '0%',
    question: 'What do you want to plant this cycle?',
    description: 'A quiet darkness surrounds you. Something subtle stirs within — a seed of intention waiting to emerge. There is no need to act yet. Sit with the stillness, notice your inner stirrings, and honor what wants to grow.',
    body2: 'You do not plan at the New Moon. You plant. One intention. No subtasks, no categories, no metadata. The cycle loop opens here as a ceremony, held for the full 29.5 days.',
    bodyState: 'Still, empty, quietly receptive',
    loopBehaviour: 'Open 1 cycle loop only. No phase loops. No tasks. The what and why only.',
    voidTag: 'Void Energy',
    activities: ['Reflect on your intention', 'Choose one small intention', 'Rest and allow the seed to form'],
    entrainment: 'You can sit with the void without filling it.',
  },
  {
    key: 'waxing-crescent',
    label: 'WAXING CRESCENT',
    title: 'Waxing Crescent',
    plantStage: 'The First Light of Possibility',
    age: 3.7,
    accent: '#74c69d',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~25%',
    bodyState: 'Energy rising, momentum building',
    description: "The moon's first sliver appears. Energy rises. Ideas spark and possibilities abound. Curiosity and excitement guide your exploration. This is a time to gather, imagine, and dream around your intention, without committing to everything that arises.",
    loopBehaviour: 'Open 1–2 phase loops. Focus on first steps and building structure.',
    activities: ['Capture ideas and thoughts', 'Notice what resonates', 'Explore freely, stay close to your seed'],
    entrainment: 'You begin before you feel ready.',
  },
  {
    key: 'first-quarter',
    label: 'FIRST QUARTER',
    title: 'First Quarter',
    plantStage: 'Choosing the Path',
    age: 7.38,
    accent: '#f6ad55',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '50%',
    bodyState: 'Tension and decisiveness',
    description: 'Half light, half dark. The cycle asks for a decision. Some ideas move forward; others return to rest. Focus your energy on the path that will allow your intention to grow. Choosing clarity now gives momentum to the next phases.',
    loopBehaviour: 'Face the obstacle in each active loop. Make one clear decision per loop.',
    activities: ['Place ideas in light or dark', 'Commit to one clear direction', 'Release distractions'],
    entrainment: 'You make the decision before you have certainty.',
  },
  {
    key: 'waxing-gibbous',
    label: 'WAXING GIBBOUS',
    title: 'Waxing Gibbous',
    plantStage: 'Momentum in Motion',
    age: 11.1,
    accent: '#81e6d9',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~75%',
    bodyState: 'Refinement, anticipation',
    description: 'The moon grows almost full. Energy surges. The chosen path now demands creation. Build, shape, and refine your work. Focused action transforms the seed into something tangible. This is a phase of energy, momentum, and dedication.',
    loopBehaviour: 'Refine active loops. Adjust details. Do not open new loops — finish existing ones.',
    activities: ['Develop your chosen idea', 'Notice what strengthens or weakens', 'Keep work aligned and intentional'],
    entrainment: 'You refine without starting over.',
  },
  {
    key: 'full',
    label: 'FULL MOON',
    title: 'Full Moon',
    plantStage: 'The Light Revealed',
    age: 14.765,
    accent: '#fefcbf',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '100%',
    bodyState: 'Peak energy, heightened emotion',
    description: 'The moon is fully illuminated. The work of the cycle shines clearly. Celebrate what has grown. Witness your progress, honor your achievements, and share the joy. The Full Moon reveals the tangible outcome of your intentions.',
    loopBehaviour: 'No new loops. See what the light reveals. Close loops that have completed.',
    activities: ['Observe what you have built', 'Celebrate accomplishments', 'Share insights or results'],
    entrainment: 'You receive what the cycle has been building toward.',
  },
  {
    key: 'waning-gibbous',
    label: 'WANING GIBBOUS',
    title: 'Waning Gibbous',
    plantStage: 'The Harvest Shared',
    age: 18.5,
    accent: '#b794f4',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~75%',
    bodyState: 'Integration, generosity',
    description: 'The light begins to wane, flowing outward. This is the phase of giving and connecting. Share your creations and gather feedback. Reflect on lessons and insights, while connecting with others and the energy that comes from sharing your harvest.',
    loopBehaviour: 'Share progress. Close loops that served their purpose. Begin releasing.',
    activities: ['Share work or insights', 'Collect feedback', 'Connect with people around your work'],
    entrainment: 'You give without needing to keep.',
  },
  {
    key: 'last-quarter',
    label: 'LAST QUARTER',
    title: 'Last Quarter',
    plantStage: 'Reflection and Realignment',
    age: 22.15,
    accent: '#f687b3',
    type: 'Threshold',
    duration: '~1.85 days',
    illumination: '50%',
    bodyState: 'Release, spaciousness',
    description: "Half-dark, half-light. Momentum inward. Energy quiets. This is a phase of reflection, evaluation, and alignment. Observe what worked, release what didn't, and prepare for the next cycle. Minimal action, maximum insight.",
    loopBehaviour: 'Release loops that didn\'t close. Clear incomplete intentions. Forgive.',
    activities: ['Review work from this cycle', 'Adjust what needs refining', 'Step back and observe'],
    entrainment: 'You release without needing to understand why.',
  },
  {
    key: 'waning-crescent',
    label: 'WANING CRESCENT',
    title: 'Waning Crescent',
    plantStage: 'Rest Before the New',
    age: 26,
    accent: '#718096',
    type: 'Flow',
    duration: '~5.55 days',
    illumination: '~10%',
    bodyState: 'Deep rest, dreamlike',
    description: 'Darkness deepens. Energy slows. Fully release the cycle\'s work and rest deeply. Integrate the lessons, honor the journey, and prepare for the next New Moon. This phase is a quiet pause before the next beginning.',
    loopBehaviour: 'Do not open loops. Rest. Let the cycle complete naturally.',
    activities: ['Rest physically and mentally', 'Reflect on lessons and growth', 'Release fully and prepare'],
    entrainment: 'You rest before you feel the tiredness.',
  },
];

const PHASE_DATA = IS_V2 ? PHASE_DATA_V2 : PHASE_DATA_ORIGINAL;

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

      // Scroll the element into view so it's visible on mobile.
      // Use instant (no animation) to avoid timing races — the spotlight
      // itself animates smoothly regardless.
      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      } catch {
        // Fallback for browsers that don't support 'instant'
        el.scrollIntoView(false);
      }

      // One frame to let the browser apply the scroll before measuring
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) { setSpotlightRect(null); return; }
        setSpotlightRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    });
  }, []);

  useEffect(() => {
    if (mode !== 'guide') return;
    const step = GUIDE_STEPS[guideStep];
    const dispatchAction = () => {
      if (IS_V2 && step?.action) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('luna-tutorial-action', { detail: { action: step.action } }));
        }, 250);
      }
    };
    if (step?.tabToActivate && activeTab !== step.tabToActivate) {
      onSwitchTab(step.tabToActivate);
      setTimeout(() => { measureStep(guideStep); dispatchAction(); }, 150);
    } else {
      measureStep(guideStep);
      dispatchAction();
    }
  }, [guideStep, mode, activeTab, measureStep, onSwitchTab]);

  const currentStep = GUIDE_STEPS[guideStep];
  const isWelcome = guideStep === 0;
  const isClosing = currentStep?.isClosing;
  const isFullScreen = isWelcome || isClosing;

  const goNext = () => {
    if (guideStep === 0) { setMode('phases'); return; }
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
        @keyframes tutTap {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
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
          onDone={onClose}
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
        {/* Exit button */}
        <button
          onClick={onClose}
          style={{
            pointerEvents: 'all',
            background: 'none', border: 'none',
            color: 'rgba(245,230,200,0.35)',
            fontSize: 20, cursor: 'pointer',
            padding: '2px 6px', lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ×
        </button>
        <div />
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

      {/* Tap indicator — v2 only, pulses on the spotlight target */}
      {IS_V2 && hasSpotlight && (
        <div style={{
          position: 'fixed',
          left: spotlightRect.left + spotlightRect.width / 2,
          top: spotlightRect.top + spotlightRect.height / 2,
          zIndex: 1002,
          pointerEvents: 'none',
        }}>
          {[0, 0.5, 1].map(delay => (
            <div key={delay} style={{
              position: 'absolute',
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2px solid rgba(245, 230, 200, 0.55)',
              animation: `tutTap 1.8s ease-out ${delay}s infinite`,
            }} />
          ))}
        </div>
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
            <>
              <button
                onClick={onClose}
                style={{
                  marginTop: 40, padding: '14px 32px',
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
              {/* Where to find it again */}
              <div style={{
                marginTop: 32,
                padding: '14px 20px',
                borderRadius: 12,
                background: 'rgba(245,230,200,0.03)',
                border: '1px solid rgba(245,230,200,0.08)',
                maxWidth: 300, textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace',
                  letterSpacing: '0.15em', color: 'rgba(245,230,200,0.25)',
                  marginBottom: 8,
                }}>
                  FIND THIS AGAIN
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(245,230,200,0.45)',
                  lineHeight: 1.7,
                }}>
                  Menu → About → Phase Guide
                </div>
              </div>
            </>
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

          {step?.image && (
            <div style={{
              marginTop: 14,
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid rgba(245,230,200,0.08)',
            }}>
              <img
                src={step.image}
                alt=""
                style={{
                  display: 'block',
                  width: '100%',
                  maxHeight: 160,
                  objectFit: 'cover',
                  objectPosition: 'top',
                }}
              />
            </div>
          )}

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

function PhasesMode({ phaseIdx, setPhaseIdx, onClose, onDone }) {
  const [started, setStarted] = useState(false);
  const phase = PHASE_DATA[phaseIdx];
  const moonAge = phase.age / 29.53;

  if (!started) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        background: '#040810',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 32px 40px',
        animation: 'tutSlideUp 0.4s ease',
      }}>
        {/* 8 mini moons in a circle-ish arc */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 36, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240 }}>
          {PHASE_DATA.map((p, i) => (
            <div key={p.key} style={{ opacity: 0.4 + i * 0.075 }}>
              {p.isNew ? (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" fill="#040810" stroke="rgba(245,230,200,0.4)" strokeWidth="1.5" />
                </svg>
              ) : (
                <MoonFace size={20} phase={p.age / 29.53} illumination={parseFloat(p.illumination) || 50} />
              )}
            </div>
          ))}
        </div>

        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 32, fontWeight: 300,
          color: '#f5e6c8', marginBottom: 16,
          textAlign: 'center', lineHeight: 1.2,
        }}>
          The eight phases
        </div>

        <div style={{
          fontSize: 15, color: 'rgba(245,230,200,0.6)',
          lineHeight: 1.75, textAlign: 'center',
          maxWidth: 300, marginBottom: 48,
        }}>
          The lunar cycle is not a clock — it is a living rhythm. Each phase has its own quality, invitation, and way of moving. Understanding them changes how you work with time.
        </div>

        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '14px 32px', borderRadius: 24,
            background: 'rgba(245,230,200,0.1)',
            border: '1px solid rgba(245,230,200,0.2)',
            color: '#f5e6c8', fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer', letterSpacing: '0.05em',
          }}
        >
          Explore the phases
        </button>
      </div>
    );
  }

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
            onClick={onDone || onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'rgba(245,230,200,0.1)',
              color: '#f5e6c8', fontSize: 14, cursor: 'pointer',
            }}
          >
            Enter the app ✦
          </button>
        )}
      </div>
    </div>
  );
}

// ─── New Moon Card ────────────────────────────────────────────────────────────

function NewMoonCard({ phase }) {
  return (
    <div style={{ paddingTop: 0, animation: 'tutSlideUp 0.35s ease' }}>
      {/* Top glow */}
      <div style={{
        height: 140,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245,230,200,0.07) 0%, transparent 65%)',
        marginLeft: -20, marginRight: -20,
        marginBottom: -60,
        pointerEvents: 'none',
      }} />

      {/* Dark moon */}
      <div style={{ textAlign: 'center', marginBottom: 8, paddingTop: 20 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="rgba(245,230,200,0.06)" stroke="rgba(245,230,200,0.1)" strokeWidth="1" />
          <circle cx="40" cy="40" r="28" fill="#04080e" />
        </svg>
      </div>

      <PlantIllustration phaseKey="new" accent={null} />

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26, color: 'rgba(245,230,200,0.75)',
          marginBottom: 4,
        }}>
          {phase.title}
        </div>

        {phase.plantStage && (
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 14, fontStyle: 'italic',
            color: 'rgba(245,230,200,0.38)',
            marginBottom: 8,
          }}>
            {phase.plantStage}
          </div>
        )}

        <div style={{
          fontSize: 11, fontFamily: 'monospace',
          letterSpacing: '0.2em', color: 'rgba(245,230,200,0.4)',
          marginBottom: 12,
        }}>
          {phase.label}
        </div>

        {/* Type pill + optional void tag */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(245,230,200,0.06)',
            border: '1px solid rgba(245,230,200,0.15)',
            color: 'rgba(245,230,200,0.5)', fontSize: 10,
            fontFamily: 'monospace', letterSpacing: '0.1em',
          }}>
            {phase.type.toUpperCase()} · {phase.duration}
          </span>
          {phase.voidTag && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(120,100,180,0.1)',
              border: '1px solid rgba(120,100,180,0.3)',
              color: 'rgba(180,160,230,0.7)', fontSize: 10,
              fontFamily: 'monospace', letterSpacing: '0.1em',
            }}>
              {phase.voidTag.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 16, fontStyle: 'italic',
        color: 'rgba(245,230,200,0.75)',
        lineHeight: 1.75, marginBottom: 16,
      }}>
        {phase.description}
      </div>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 16, fontStyle: 'italic',
        color: 'rgba(245,230,200,0.6)',
        lineHeight: 1.75, marginBottom: 20,
      }}>
        {phase.question && `"${phase.question}"`}
      </div>

      {/* 2-col meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
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
              background: 'rgba(245,230,200,0.05)',
              border: '1px solid rgba(245,230,200,0.12)',
              color: 'rgba(245,230,200,0.45)', fontSize: 11,
              fontFamily: 'monospace', letterSpacing: '0.05em',
            }}>
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Entrainment sign */}
      <div style={{
        borderLeft: '2px solid rgba(245,230,200,0.18)',
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

// ─── Plant Illustration ───────────────────────────────────────────────────────

function PlantIllustration({ phaseKey, accent }) {
  const c = accent || '#f5e6c8';
  const s = (op) => `${c}${Math.round(op * 255).toString(16).padStart(2, '0')}`;

  const groundLine = (y) => (
    <line x1="10" y1={y} x2="130" y2={y} stroke={s(0.22)} strokeWidth="1" />
  );

  const illustrations = {
    'new': (
      // Seed in dark earth
      <>
        {groundLine(68)}
        {/* soil texture */}
        <circle cx="28" cy="78" r="1.5" fill={s(0.12)} />
        <circle cx="50" cy="83" r="1" fill={s(0.1)} />
        <circle cx="92" cy="76" r="1.5" fill={s(0.1)} />
        <circle cx="112" cy="82" r="1" fill={s(0.09)} />
        {/* seed glow */}
        <ellipse cx="70" cy="86" rx="20" ry="14" fill={s(0.05)} />
        {/* seed */}
        <ellipse cx="70" cy="87" rx="11" ry="8" fill={s(0.14)} stroke={s(0.45)} strokeWidth="1.2" />
        <path d="M68 95 Q60 102 57 108" stroke={s(0.2)} strokeWidth="0.8" fill="none" />
        <path d="M72 95 Q80 102 83 108" stroke={s(0.2)} strokeWidth="0.8" fill="none" />
        <path d="M70 96 Q70 104 70 108" stroke={s(0.18)} strokeWidth="0.8" fill="none" />
        {/* quiet dark sky */}
        <circle cx="35" cy="22" r="1" fill={s(0.07)} />
        <circle cx="70" cy="15" r="1.2" fill={s(0.06)} />
        <circle cx="108" cy="28" r="0.8" fill={s(0.07)} />
        <circle cx="90" cy="10" r="1" fill={s(0.05)} />
      </>
    ),
    'waxing-crescent': (
      // Sprout breaking through soil
      <>
        {groundLine(75)}
        {/* soil mound */}
        <path d="M56 75 Q70 68 84 75" stroke={s(0.18)} strokeWidth="1" fill="none" />
        {/* stem */}
        <path d="M70 75 Q70 62 71 48" stroke={s(0.7)} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* left cotyledon */}
        <path d="M71 54 Q56 44 50 52 Q56 62 71 58 Z" fill={s(0.16)} stroke={s(0.5)} strokeWidth="0.9" />
        {/* right cotyledon */}
        <path d="M71 54 Q86 44 92 52 Q86 62 71 58 Z" fill={s(0.16)} stroke={s(0.5)} strokeWidth="0.9" />
        {/* tiny new tip */}
        <circle cx="71" cy="47" r="2" fill={s(0.65)} />
        {/* soil dots */}
        <circle cx="40" cy="82" r="1.2" fill={s(0.1)} />
        <circle cx="100" cy="80" r="1" fill={s(0.1)} />
      </>
    ),
    'first-quarter': (
      // Young plant, sturdy, growing
      <>
        {groundLine(80)}
        {/* stem */}
        <path d="M70 80 Q68 62 70 30" stroke={s(0.68)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* leaf low-left */}
        <path d="M69 70 Q50 60 44 66 Q52 74 69 72 Z" fill={s(0.16)} stroke={s(0.45)} strokeWidth="0.9" />
        {/* leaf low-right */}
        <path d="M70 62 Q90 52 94 59 Q87 67 70 65 Z" fill={s(0.16)} stroke={s(0.45)} strokeWidth="0.9" />
        {/* leaf mid-left */}
        <path d="M69 50 Q54 40 50 47 Q56 55 69 53 Z" fill={s(0.13)} stroke={s(0.4)} strokeWidth="0.9" />
        {/* top bud */}
        <path d="M70 30 Q66 22 70 16 Q74 22 70 30" fill={s(0.22)} stroke={s(0.55)} strokeWidth="0.9" />
      </>
    ),
    'waxing-gibbous': (
      // Mature plant, lush, budding
      <>
        {groundLine(82)}
        {/* main stem */}
        <path d="M70 82 Q67 62 69 18" stroke={s(0.65)} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* side branches */}
        <path d="M69 62 Q52 54 44 57" stroke={s(0.5)} strokeWidth="1.2" fill="none" />
        <path d="M70 48 Q87 40 96 44" stroke={s(0.5)} strokeWidth="1.2" fill="none" />
        {/* lower-left leaf */}
        <path d="M69 66 Q44 55 38 62 Q48 72 69 69 Z" fill={s(0.17)} stroke={s(0.42)} strokeWidth="0.9" />
        {/* lower-right leaf */}
        <path d="M70 58 Q95 47 99 55 Q90 63 70 62 Z" fill={s(0.17)} stroke={s(0.42)} strokeWidth="0.9" />
        {/* mid-left leaf */}
        <path d="M69 50 Q52 42 48 48 Q55 56 69 53 Z" fill={s(0.14)} stroke={s(0.38)} strokeWidth="0.9" />
        {/* bud */}
        <ellipse cx="69" cy="16" rx="5" ry="7" fill={s(0.2)} stroke={s(0.55)} strokeWidth="1" />
        <path d="M69 9 Q67 6 69 3 Q71 6 69 9" fill={s(0.32)} stroke={s(0.6)} strokeWidth="0.8" />
      </>
    ),
    'full': (
      // Full bloom — flower open
      <>
        {groundLine(84)}
        {/* stem */}
        <path d="M70 84 Q68 65 70 42" stroke={s(0.62)} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* branches */}
        <path d="M69 65 Q50 56 42 60" stroke={s(0.5)} strokeWidth="1.2" fill="none" />
        <path d="M70 52 Q88 44 97 48" stroke={s(0.5)} strokeWidth="1.2" fill="none" />
        {/* leaves */}
        <path d="M69 68 Q44 57 38 65 Q50 75 69 72 Z" fill={s(0.18)} stroke={s(0.45)} strokeWidth="0.9" />
        <path d="M70 56 Q96 45 100 54 Q89 63 70 60 Z" fill={s(0.18)} stroke={s(0.45)} strokeWidth="0.9" />
        {/* petals (8-petal flower at top) */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
          const rad = (angle * Math.PI) / 180;
          const px = 70 + Math.cos(rad) * 10;
          const py = 22 + Math.sin(rad) * 10;
          return (
            <ellipse
              key={angle}
              cx={px} cy={py}
              rx="4.5" ry="7"
              transform={`rotate(${angle} ${px} ${py})`}
              fill={s(0.2)} stroke={s(0.48)} strokeWidth="0.8"
            />
          );
        })}
        {/* flower center */}
        <circle cx="70" cy="22" r="5.5" fill={s(0.35)} stroke={s(0.7)} strokeWidth="1" />
        {/* radiance */}
        <line x1="70" y1="10" x2="70" y2="6" stroke={s(0.28)} strokeWidth="0.8" />
        <line x1="58" y1="13" x2="55" y2="10" stroke={s(0.22)} strokeWidth="0.8" />
        <line x1="82" y1="13" x2="85" y2="10" stroke={s(0.22)} strokeWidth="0.8" />
      </>
    ),
    'waning-gibbous': (
      // Leaves turning, some falling
      <>
        {groundLine(84)}
        {/* stem */}
        <path d="M70 84 Q68 64 70 26" stroke={s(0.55)} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* branches */}
        <path d="M69 64 Q50 55 42 58" stroke={s(0.45)} strokeWidth="1.2" fill="none" />
        <path d="M70 50 Q88 42 97 46" stroke={s(0.45)} strokeWidth="1.2" fill="none" />
        {/* still-attached leaves */}
        <path d="M69 68 Q46 57 40 64 Q50 73 69 71 Z" fill={s(0.17)} stroke={s(0.4)} strokeWidth="0.9" />
        <path d="M70 55 Q95 44 99 52 Q88 61 70 58 Z" fill={s(0.15)} stroke={s(0.38)} strokeWidth="0.9" />
        <path d="M69 44 Q55 36 51 42 Q57 50 69 47 Z" fill={s(0.12)} stroke={s(0.32)} strokeWidth="0.9" />
        {/* spent seedhead */}
        <circle cx="70" cy="23" r="5" fill="none" stroke={s(0.42)} strokeWidth="0.9" />
        <line x1="67" y1="18" x2="65" y2="14" stroke={s(0.3)} strokeWidth="0.8" />
        <line x1="70" y1="18" x2="70" y2="14" stroke={s(0.3)} strokeWidth="0.8" />
        <line x1="73" y1="18" x2="75" y2="14" stroke={s(0.3)} strokeWidth="0.8" />
        {/* falling leaf 1 */}
        <path d="M52 66 Q44 72 46 79 Q53 76 55 70 Z"
          fill={s(0.14)} stroke={s(0.28)} strokeWidth="0.8"
          transform="rotate(-15 50 73)" />
        {/* falling leaf 2 */}
        <path d="M90 72 Q98 67 96 60 Q89 62 90 70 Z"
          fill={s(0.12)} stroke={s(0.24)} strokeWidth="0.8"
          transform="rotate(12 93 66)" />
      </>
    ),
    'last-quarter': (
      // Mostly bare, seed pods, a few fallen leaves on ground
      <>
        {groundLine(86)}
        {/* main stem */}
        <path d="M70 86 Q68 68 70 24" stroke={s(0.5)} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* bare branches */}
        <path d="M69 68 Q48 57 34 60" stroke={s(0.45)} strokeWidth="1.3" fill="none" />
        <path d="M70 52 Q90 42 104 46" stroke={s(0.45)} strokeWidth="1.3" fill="none" />
        <path d="M70 36 Q57 28 50 30" stroke={s(0.4)} strokeWidth="1" fill="none" />
        {/* sub-branches */}
        <path d="M34 60 Q28 55 24 56" stroke={s(0.3)} strokeWidth="0.8" fill="none" />
        <path d="M34 60 Q30 65 27 65" stroke={s(0.3)} strokeWidth="0.8" fill="none" />
        {/* one last leaf */}
        <path d="M69 55 Q53 46 50 52 Q56 60 69 58 Z" fill={s(0.13)} stroke={s(0.35)} strokeWidth="0.9" />
        {/* seed pods */}
        <ellipse cx="38" cy="58" rx="4" ry="6" fill={s(0.1)} stroke={s(0.35)} strokeWidth="0.8" />
        <ellipse cx="100" cy="44" rx="3.5" ry="5.5" fill={s(0.1)} stroke={s(0.35)} strokeWidth="0.8" />
        {/* leaves on ground */}
        <path d="M42 86 Q36 83 33 88 Q39 90 43 87 Z" fill={s(0.1)} stroke={s(0.2)} strokeWidth="0.8" />
        <path d="M95 86 Q101 82 105 87 Q99 90 96 87 Z" fill={s(0.1)} stroke={s(0.2)} strokeWidth="0.8" />
        <path d="M62 86 Q57 83 54 87 Q59 90 63 87 Z" fill={s(0.08)} stroke={s(0.16)} strokeWidth="0.8" />
      </>
    ),
    'waning-crescent': (
      // Bare winter branches — skeletal, still, beautiful
      <>
        {groundLine(90)}
        {/* trunk */}
        <path d="M70 90 Q68 74 70 55 Q71 40 70 18" stroke={s(0.48)} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* main branches */}
        <path d="M70 58 Q48 47 30 50" stroke={s(0.42)} strokeWidth="1.6" fill="none" />
        <path d="M70 44 Q92 34 112 38" stroke={s(0.42)} strokeWidth="1.6" fill="none" />
        <path d="M70 32 Q58 24 50 26" stroke={s(0.36)} strokeWidth="1.1" fill="none" />
        {/* sub-branches left */}
        <path d="M30 50 Q24 45 20 46" stroke={s(0.28)} strokeWidth="0.9" fill="none" />
        <path d="M30 50 Q26 55 23 56" stroke={s(0.28)} strokeWidth="0.9" fill="none" />
        <path d="M50 26 Q45 20 42 22" stroke={s(0.24)} strokeWidth="0.8" fill="none" />
        {/* sub-branches right */}
        <path d="M112 38 Q118 33 121 34" stroke={s(0.28)} strokeWidth="0.9" fill="none" />
        <path d="M112 38 Q116 43 119 44" stroke={s(0.28)} strokeWidth="0.9" fill="none" />
        {/* snow/frost dots on ground */}
        <circle cx="44" cy="90" r="1.5" fill={s(0.14)} />
        <circle cx="58" cy="90" r="1" fill={s(0.12)} />
        <circle cx="84" cy="90" r="1.5" fill={s(0.14)} />
        <circle cx="98" cy="90" r="1" fill={s(0.1)} />
        {/* quiet stars */}
        <circle cx="28" cy="18" r="1" fill={s(0.1)} />
        <circle cx="112" cy="12" r="0.8" fill={s(0.1)} />
        <circle cx="90" cy="22" r="0.8" fill={s(0.08)} />
      </>
    ),
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px' }}>
      <svg width="140" height="110" viewBox="0 0 140 110" style={{ overflow: 'visible' }}>
        {illustrations[phaseKey] || null}
      </svg>
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

      <div style={{ textAlign: 'center', marginBottom: 8, paddingTop: 20 }}>
        <MoonFace
          size={80}
          phase={moonAge}
          illumination={parseFloat(phase.illumination) || 50}
        />
      </div>

      <PlantIllustration phaseKey={phase.key} accent={phase.accent} />

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26, color: phase.accent,
          marginBottom: 4,
        }}>
          {phase.title}
        </div>

        {phase.plantStage && (
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 14, fontStyle: 'italic',
            color: 'rgba(245,230,200,0.38)',
            marginBottom: 8,
          }}>
            {phase.plantStage}
          </div>
        )}

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
