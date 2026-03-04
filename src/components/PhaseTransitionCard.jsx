// Cosmic Loops - Phase Transition Card
// Appears when next phase is within 24 hours
// Two parts: Phase Summary (closing) + Transition Preview (opening)

import { useState } from 'react';
import { getPhaseContent } from '../data/phaseContent.js';

// Phase closing summaries
const PHASE_CLOSING_SUMMARIES = {
  'new': 'The stillness gave space for seeds to form.',
  'waxing-crescent': 'First steps were taken. Momentum began.',
  'first-quarter': 'Decisions were made. Direction clarified.',
  'waxing-gibbous': 'Building continued. Refinement happened.',
  'full': 'Illumination arrived. Something was revealed.',
  'waning-gibbous': 'Sharing began. Gratitude flowed.',
  'last-quarter': 'Release happened. Letting go.',
  'waning-crescent': 'Rest restored. Completion neared.',
};

const TRANSITION_INVITATIONS = {
  'Waxing Crescent': 'First movement begins. What is the most natural first step toward your intention?',
  'First Quarter': 'The energy sharpens. A decision is forming. Let it arrive without forcing it.',
  'Waxing Gibbous': 'The building deepens. What needs your most focused attention before the Full Moon?',
  'Full Moon': 'The peak is almost here. Begin to receive rather than create. Something will be revealed.',
  'Waning Gibbous': 'The light has reached its fullness. What wants to be shared from what you\'ve gathered?',
  'Last Quarter': 'The releasing phase arrives. What loops are ready to close — or be consciously let go?',
  'Waning Crescent': 'The cycle moves toward stillness. Begin to slow. Rest is preparing you.',
  'New Moon': 'A new cycle is close. Let the remaining hours be empty. Something is forming in the dark.',
};

// Phase type context for the arriving phase
const THRESHOLD_INTRO = (phaseName) =>
  `A turning point approaches. ${phaseName} is brief — arrive ready to decide.`;

const FLOW_INTRO = (phaseName, duration) =>
  `A flow phase opens. ${phaseName} gives you ${duration}+ days. No rush. Settle in.`;

export function PhaseTransitionCard({ lunarData, onDismiss, onOpenEchoes, transitionInvitation, phrasesLoading }) {
  const {
    isApproaching,
    isImminent,
    nextPhase,
    nextSymbol,
    nextEnergy,
    remainingHours,
    nextPhaseType,
    nextPhaseDuration,
    phase,
  } = lunarData;

  if (!isApproaching) return null;

  // Current (closing) phase info
  const currentPhaseContent = getPhaseContent(phase.key);
  const closingSummary = PHASE_CLOSING_SUMMARIES[phase.key] || 'This phase is completing.';

  // Use generated phrase if available, fall back to static
  const invitation = transitionInvitation || TRANSITION_INVITATIONS[nextPhase] || 'A shift is approaching.';
  const isNextThreshold = nextPhaseType === 'threshold';
  const isNextFlow = nextPhaseType === 'flow';

  // Phase type intro
  const typeIntro = isNextThreshold
    ? THRESHOLD_INTRO(nextPhase)
    : FLOW_INTRO(nextPhase, Math.floor(nextPhaseDuration));

  // Time remaining text
  const timeText = remainingHours < 1
    ? `${Math.round(remainingHours * 60)}m`
    : `${remainingHours.toFixed(1)}h`;

  return (
    <div style={{ margin: '0 20px 16px' }}>
      {/* Part 1: Phase Closing Summary */}
      <div style={{
        padding: '14px 16px',
        borderRadius: '14px 14px 0 0',
        background: 'rgba(245, 230, 200, 0.03)',
        border: '1px solid rgba(245, 230, 200, 0.08)',
        borderBottom: 'none',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 16 }}>{currentPhaseContent.symbol}</span>
          <span style={{
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(245, 230, 200, 0.5)',
          }}>
            {phase.name.toUpperCase()} CLOSING
          </span>
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 13,
          fontStyle: 'italic',
          color: 'rgba(245, 230, 200, 0.6)',
          lineHeight: 1.5,
        }}>
          {closingSummary}
        </div>
      </div>

      {/* Part 2: Transition Preview */}
      <div style={{
        padding: '16px',
        borderRadius: '0 0 14px 14px',
        background: isImminent
          ? 'rgba(252, 180, 80, 0.08)'
          : isNextThreshold
            ? 'rgba(245, 230, 200, 0.05)'
            : 'rgba(201, 168, 76, 0.04)',
        border: `1px solid ${isImminent
          ? 'rgba(252, 180, 80, 0.2)'
          : isNextThreshold
            ? 'rgba(245, 230, 200, 0.12)'
            : 'rgba(201, 168, 76, 0.15)'}`,
        position: 'relative',
      }}>
    <div style={{
      margin: '0 20px 16px',
      padding: '16px',
      borderRadius: 14,
      background: isImminent
        ? 'rgba(252, 180, 80, 0.08)'
        : isNextThreshold
          ? 'rgba(245, 230, 200, 0.05)'
          : 'rgba(201, 168, 76, 0.04)',
      border: `1px solid ${isImminent
        ? 'rgba(252, 180, 80, 0.2)'
        : isNextThreshold
          ? 'rgba(245, 230, 200, 0.12)'
          : 'rgba(201, 168, 76, 0.15)'}`,
      position: 'relative',
      animation: 'breatheIn 0.4s ease-out',
    }}>
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          color: 'rgba(245, 230, 200, 0.3)',
          fontSize: 16,
          cursor: 'pointer',
          padding: 4,
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Status label with phase type */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          color: isImminent
            ? 'rgba(252, 180, 80, 0.9)'
            : 'rgba(245, 230, 200, 0.4)',
        }}>
          {isImminent ? 'SHIFTING NOW' : 'APPROACHING'} · {timeText}
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          padding: '2px 6px',
          borderRadius: 3,
          background: isNextThreshold
            ? 'rgba(245, 230, 200, 0.1)'
            : 'rgba(201, 168, 76, 0.12)',
          color: isNextThreshold
            ? 'rgba(245, 230, 200, 0.6)'
            : 'rgba(201, 168, 76, 0.8)',
        }}>
          {isNextThreshold ? 'THRESHOLD' : 'FLOW'}
        </span>
      </div>

      {/* Next phase info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 28,
          filter: isImminent
            ? 'drop-shadow(0 0 8px rgba(252, 180, 80, 0.4))'
            : isNextThreshold
              ? 'drop-shadow(0 0 6px rgba(245, 230, 200, 0.3))'
              : 'none',
        }}>
          {nextSymbol}
        </span>
        <div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18,
            color: '#f5e6c8',
          }}>
            {nextPhase}
          </div>
          <div style={{
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(245, 230, 200, 0.4)',
          }}>
            {nextEnergy?.toUpperCase()} · {nextPhaseDuration} DAYS
          </div>
        </div>
      </div>

      {/* Phase type intro */}
      <div style={{
        fontSize: 12,
        fontFamily: "'Cormorant Garamond', serif",
        color: isNextThreshold
          ? 'rgba(245, 230, 200, 0.65)'
          : 'rgba(201, 168, 76, 0.7)',
        marginBottom: 10,
        lineHeight: 1.5,
      }}>
        {typeIntro}
      </div>

      {/* Phase-specific invitation */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 14,
        fontStyle: 'italic',
        color: 'rgba(245, 230, 200, 0.7)',
        lineHeight: 1.6,
        marginBottom: 14,
      }}>
        {invitation}
      </div>

      {/* Echoes nudge */}
      <button
        onClick={onOpenEchoes}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: 8,
          background: 'rgba(245, 230, 200, 0.04)',
          border: '1px dashed rgba(245, 230, 200, 0.1)',
          color: 'rgba(245, 230, 200, 0.4)',
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        〜 OPEN ECHOES — CAPTURE THIS MOMENT
      </button>
      </div>
    </div>
  );
}
