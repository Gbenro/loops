// Cosmic Loops - Phase Transition Card
// Appears when next phase is within 24 hours

import { useState } from 'react';

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

export function PhaseTransitionCard({ lunarData, onDismiss, onOpenEchoes }) {
  const {
    isApproaching,
    isImminent,
    nextPhase,
    nextSymbol,
    nextEnergy,
    remainingHours,
  } = lunarData;

  if (!isApproaching) return null;

  const invitation = TRANSITION_INVITATIONS[nextPhase] || 'A shift is approaching.';

  // Time remaining text
  const timeText = remainingHours < 1
    ? `${Math.round(remainingHours * 60)}m`
    : `${remainingHours.toFixed(1)}h`;

  return (
    <div style={{
      margin: '0 20px 16px',
      padding: '16px',
      borderRadius: 14,
      background: isImminent
        ? 'rgba(252, 180, 80, 0.08)'
        : 'rgba(245, 230, 200, 0.03)',
      border: `1px solid ${isImminent
        ? 'rgba(252, 180, 80, 0.2)'
        : 'rgba(245, 230, 200, 0.08)'}`,
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

      {/* Status label */}
      <div style={{
        fontSize: 9,
        fontFamily: 'monospace',
        letterSpacing: '0.12em',
        color: isImminent
          ? 'rgba(252, 180, 80, 0.9)'
          : 'rgba(245, 230, 200, 0.4)',
        marginBottom: 12,
      }}>
        {isImminent ? 'SHIFTING NOW' : 'APPROACHING'} · {timeText}
      </div>

      {/* Next phase info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 28,
          filter: isImminent
            ? 'drop-shadow(0 0 8px rgba(252, 180, 80, 0.4))'
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
            {nextEnergy?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Invitation text */}
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
  );
}
