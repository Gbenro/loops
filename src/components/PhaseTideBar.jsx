// Cosmic Loops - Phase Tide Bar
// Shows position within current phase as a tide gauge
// Distinguishes between Threshold (pivotal) and Flow (sustained) phases

import { useMemo } from 'react';

// Design tokens
const THRESHOLD_COLOR = '#F5E6C8'; // brighter cream — pivotal
const FLOW_COLOR = '#C9A84C';      // warm amber — sustained

export function PhaseTideBar({ lunarData }) {
  const {
    phase,
    phaseProgress = 0,
    phaseRemaining = 0,
    isApproaching = false,
    isImminent = false,
    nextPhase,
    nextSymbol,
  } = lunarData;

  const isThreshold = phase?.isThreshold || false;
  const isFlow = phase?.isFlow || false;
  const dayInPhase = phase?.dayInPhase || 0;

  // Calculate actual total phase duration from elapsed + remaining time
  const elapsedDays = dayInPhase;
  const totalDays = dayInPhase + phaseRemaining;
  // Ensure total is always >= elapsed
  const displayTotal = Math.max(totalDays, elapsedDays + 0.1);

  // Clamp progress to max 100%
  const clampedProgress = Math.min(phaseProgress, 1);

  // Status text based on progress
  const status = useMemo(() => {
    if (clampedProgress < 0.20) return 'OPENING';
    if (clampedProgress < 0.62) return 'FLOWING';
    if (clampedProgress < 0.88) return 'COMPLETING';
    return 'CLOSING';
  }, [clampedProgress]);

  // Phase type label
  const phaseTypeLabel = isThreshold ? 'Threshold' : 'In Flow';

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

  // Elapsed time text - pure elapsed/total format
  const dayText = `${elapsedDays.toFixed(1)}d of ${displayTotal.toFixed(1)}d`;

  // Color based on phase type and approach state
  const baseColor = isThreshold ? THRESHOLD_COLOR : FLOW_COLOR;

  const barColor = useMemo(() => {
    if (isImminent) return 'rgba(252, 180, 80, 0.9)';
    if (isApproaching) return 'rgba(252, 200, 120, 0.7)';
    return isThreshold
      ? 'rgba(245, 230, 200, 0.6)'  // brighter for threshold
      : 'rgba(201, 168, 76, 0.5)';   // amber for flow
  }, [isApproaching, isImminent, isThreshold]);

  const dotColor = useMemo(() => {
    if (isImminent) return '#FCB450';
    if (isApproaching) return '#FCC878';
    return baseColor;
  }, [isApproaching, isImminent, baseColor]);

  // Sub-label based on phase type
  const subLabel = isThreshold
    ? 'A turning point. Brief and potent.'
    : 'Time to move with what is already moving.';

  return (
    <div style={{
      padding: '14px 20px',
      background: isThreshold
        ? 'rgba(245, 230, 200, 0.04)'
        : 'rgba(201, 168, 76, 0.03)',
      borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
    }}>
      {/* Phase type and day */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          color: isThreshold
            ? 'rgba(245, 230, 200, 0.7)'
            : 'rgba(201, 168, 76, 0.8)',
          padding: '3px 8px',
          background: isThreshold
            ? 'rgba(245, 230, 200, 0.08)'
            : 'rgba(201, 168, 76, 0.1)',
          borderRadius: 4,
          fontWeight: isThreshold ? 600 : 400,
        }}>
          {phaseTypeLabel.toUpperCase()} · {dayText}
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

      {/* Sub-label */}
      <div style={{
        fontSize: 10,
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: 'italic',
        color: 'rgba(245, 230, 200, 0.4)',
        marginBottom: 10,
      }}>
        {subLabel}
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
          width: `${clampedProgress * 100}%`,
          height: '100%',
          background: `linear-gradient(to right, rgba(245, 230, 200, 0.15), ${barColor})`,
          borderRadius: 2,
          transition: isThreshold ? 'width 0.3s ease' : 'width 0.5s ease',
        }} />

        {/* Travelling dot */}
        <div style={{
          position: 'absolute',
          left: `${clampedProgress * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: isThreshold ? 10 : 8,
          height: isThreshold ? 10 : 8,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: isImminent
            ? `0 0 12px ${dotColor}, 0 0 4px ${dotColor}`
            : isApproaching
              ? `0 0 8px ${dotColor}`
              : isThreshold
                ? `0 0 8px rgba(245, 230, 200, 0.4)`
                : `0 0 4px rgba(245, 230, 200, 0.3)`,
          animation: isImminent ? 'pulse 1.5s ease-in-out infinite' : 'none',
          transition: isThreshold ? 'left 0.3s ease' : 'left 0.5s ease',
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
          {status}
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
