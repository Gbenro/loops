// Cosmic Loops - Phase Tide Bar
// Shows position within current phase as a tide gauge

import { useMemo } from 'react';

export function PhaseTideBar({ lunarData }) {
  const {
    phaseProgress = 0,
    phaseRemaining = 0,
    isApproaching = false,
    isImminent = false,
    nextPhase,
    nextSymbol,
  } = lunarData;

  // Status text based on progress
  const status = useMemo(() => {
    if (phaseProgress < 0.20) return 'OPENING';
    if (phaseProgress < 0.62) return 'IN FLOW';
    if (phaseProgress < 0.88) return 'COMPLETING';
    return 'CLOSING';
  }, [phaseProgress]);

  // Remaining time formatted
  const remainingText = useMemo(() => {
    const hours = phaseRemaining * 24;
    if (hours < 1) {
      const mins = Math.round(hours * 60);
      return `${mins}m remaining`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h remaining`;
    }
    return `${phaseRemaining.toFixed(1)}d remaining`;
  }, [phaseRemaining]);

  // Color based on approach state
  const barColor = useMemo(() => {
    if (isImminent) return 'rgba(252, 180, 80, 0.9)';
    if (isApproaching) return 'rgba(252, 200, 120, 0.7)';
    return 'rgba(245, 230, 200, 0.4)';
  }, [isApproaching, isImminent]);

  const dotColor = useMemo(() => {
    if (isImminent) return '#FCB450';
    if (isApproaching) return '#FCC878';
    return 'rgba(245, 230, 200, 0.6)';
  }, [isApproaching, isImminent]);

  return (
    <div style={{
      padding: '14px 20px',
      background: 'rgba(245, 230, 200, 0.02)',
      borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
    }}>
      {/* Status and remaining */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          color: isImminent
            ? 'rgba(252, 180, 80, 0.9)'
            : 'rgba(245, 230, 200, 0.4)',
          padding: '3px 8px',
          background: isImminent
            ? 'rgba(252, 180, 80, 0.1)'
            : 'rgba(245, 230, 200, 0.04)',
          borderRadius: 4,
        }}>
          {status}
        </span>
        <span style={{
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          color: isApproaching
            ? 'rgba(252, 200, 120, 0.8)'
            : 'rgba(245, 230, 200, 0.35)',
        }}>
          {remainingText}
        </span>
      </div>

      {/* Tide track */}
      <div style={{
        position: 'relative',
        height: 3,
        borderRadius: 2,
        background: 'rgba(245, 230, 200, 0.08)',
        marginBottom: 10,
      }}>
        {/* Tick marks */}
        {[0.25, 0.5, 0.75].map(pos => (
          <div
            key={pos}
            style={{
              position: 'absolute',
              left: `${pos * 100}%`,
              top: -2,
              width: 1,
              height: 7,
              background: 'rgba(245, 230, 200, 0.1)',
            }}
          />
        ))}

        {/* Fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${phaseProgress * 100}%`,
          height: '100%',
          background: `linear-gradient(to right, rgba(245, 230, 200, 0.15), ${barColor})`,
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />

        {/* Travelling dot */}
        <div style={{
          position: 'absolute',
          left: `${phaseProgress * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: isImminent
            ? `0 0 12px ${dotColor}, 0 0 4px ${dotColor}`
            : isApproaching
              ? `0 0 8px ${dotColor}`
              : `0 0 4px rgba(245, 230, 200, 0.3)`,
          animation: isImminent ? 'pulse 1.5s ease-in-out infinite' : 'none',
          transition: 'left 0.5s ease',
        }} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: 'rgba(245, 230, 200, 0.25)',
        }}>
          OPENED
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: isApproaching
            ? 'rgba(252, 200, 120, 0.6)'
            : 'rgba(245, 230, 200, 0.3)',
        }}>
          {nextSymbol} {nextPhase?.toUpperCase()} →
        </span>
      </div>
    </div>
  );
}
