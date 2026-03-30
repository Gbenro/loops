// Cosmic Loops — RhythmCard
// List card for a single Rhythm on the main Rhythm tab

import { PhaseRingThumb } from './PhaseRing.jsx';

const SCOPE_LABEL = { cycle: 'THIS CYCLE', ongoing: 'ONGOING' };

const LEVEL_DOT = {
  none:       { color: 'rgba(245,230,200,0.12)', label: 'None' },
  light:      { color: 'var(--text-secondary)', label: 'Light' },
  moderate:   { color: 'rgba(245,230,200,0.6)',  label: 'Moderate' },
  deep:       { color: 'rgba(245,230,200,0.85)', label: 'Deep' },
  ceremonial: { color: '#fefcbf',               label: 'Ceremonial' },
};

function LevelPill({ level, accent }) {
  if (!level) return null;
  const dot = LEVEL_DOT[level];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 20,
      background: 'rgba(245,230,200,0.04)',
      border: '1px solid rgba(245,230,200,0.08)',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: level === 'ceremonial' ? accent : dot.color,
        boxShadow: level === 'ceremonial' ? `0 0 4px ${accent}` : 'none',
      }} />
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(245,230,200,0.4)', letterSpacing: '0.08em' }}>
        {dot.label.toUpperCase()}
      </span>
    </div>
  );
}

export function RhythmCard({
  rhythm,
  instance,
  currentPhaseKey,
  pastPhaseKeys = [],
  currentObservation = null,   // level logged for current phase
  currentIntention = null,     // intended level for current phase
  phaseAccent = 'rgba(245,230,200,0.6)',
  onClick,
  tourId,
}) {
  // Build intention/observation maps for thumbnail
  const intentionMap = {};
  const observationMap = {};

  if (instance) {
    if (instance.intentionType === 'whole' && instance.wholeIntention) {
      for (const p of ['new','waxing-crescent','first-quarter','waxing-gibbous','full','waning-gibbous','last-quarter','waning-crescent']) {
        intentionMap[p] = instance.wholeIntention;
      }
    } else if (instance.intentionType === 'phase') {
      Object.assign(intentionMap, instance.phaseIntentions || {});
    }
  }

  return (
    <button
      data-tour={tourId}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        width: '100%', padding: '16px',
        background: 'rgba(245,230,200,0.03)',
        border: '1px solid rgba(245,230,200,0.08)',
        borderRadius: 14,
        cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Phase ring thumbnail */}
      <PhaseRingThumb
        size={56}
        intention={intentionMap}
        observation={observationMap}
        currentPhaseKey={currentPhaseKey}
        pastPhaseKeys={pastPhaseKeys}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18, fontWeight: 300, color: '#f5e6c8',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {rhythm.name}
          </div>
          <div style={{
            fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.12em',
            color: rhythm.scope === 'ongoing' ? '#74c69d' : 'rgba(245,230,200,0.3)',
            padding: '2px 6px', borderRadius: 4,
            border: rhythm.scope === 'ongoing'
              ? '1px solid rgba(116,198,157,0.2)'
              : '1px solid rgba(245,230,200,0.08)',
            flexShrink: 0,
          }}>
            {SCOPE_LABEL[rhythm.scope]}
          </div>
        </div>

        {/* Current phase intention vs observation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {currentIntention ? (
            <>
              <LevelPill level={currentIntention} accent={phaseAccent} />
              <span style={{ fontSize: 10, color: 'rgba(245,230,200,0.2)' }}>→</span>
              <LevelPill level={currentObservation || null} accent={phaseAccent} />
            </>
          ) : currentObservation ? (
            <LevelPill level={currentObservation} accent={phaseAccent} />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>No check-in yet</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <div style={{ color: 'rgba(245,230,200,0.2)', fontSize: 16, flexShrink: 0 }}>›</div>
    </button>
  );
}
