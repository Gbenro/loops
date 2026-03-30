// Cosmic Loops — RhythmReport
// Waning Crescent report: phase ring + AI reflection

import { useState, useEffect } from 'react';
import { PhaseRing } from './PhaseRing.jsx';
import { generateRhythmReport } from '../lib/rhythm.js';

const PHASE_NAMES = {
  'new':             'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter':   'First Quarter',
  'waxing-gibbous':  'Waxing Gibbous',
  'full':            'Full Moon',
  'waning-gibbous':  'Waning Gibbous',
  'last-quarter':    'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

const LEVEL_BADGE = {
  none:       'rgba(245,230,200,0.2)',
  light:      'rgba(245,230,200,0.4)',
  moderate:   'rgba(245,230,200,0.6)',
  deep:       'rgba(245,230,200,0.85)',
  ceremonial: '#fefcbf',
};

// Phase order for pattern analysis
const PHASE_ORDER = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
];

const WAXING_PHASES = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous'];
const WANING_PHASES = ['full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];

// Describe engagement pattern shape (non-judgmental)
function describeEngagementPattern(observations) {
  if (observations.length < 3) return null;

  const engagementValue = { none: 0, light: 1, moderate: 2, deep: 3, ceremonial: 4 };
  const obsMap = {};
  for (const o of observations) obsMap[o.phase] = engagementValue[o.engagement] || 0;

  // Calculate average engagement for waxing vs waning phases
  const waxingObs = WAXING_PHASES.filter(p => obsMap[p] !== undefined);
  const waningObs = WANING_PHASES.filter(p => obsMap[p] !== undefined);

  const waxingAvg = waxingObs.length > 0
    ? waxingObs.reduce((sum, p) => sum + obsMap[p], 0) / waxingObs.length
    : 0;
  const waningAvg = waningObs.length > 0
    ? waningObs.reduce((sum, p) => sum + obsMap[p], 0) / waningObs.length
    : 0;

  // Check if engagement deepened toward Full Moon
  const fullIdx = PHASE_ORDER.indexOf('full');
  const beforeFull = PHASE_ORDER.slice(0, fullIdx + 1).filter(p => obsMap[p] !== undefined);

  if (beforeFull.length >= 2) {
    const trend = beforeFull.reduce((acc, p, i) => {
      if (i === 0) return 0;
      return acc + (obsMap[p] - obsMap[beforeFull[i - 1]]);
    }, 0);
    if (trend > 0) return 'Engagement deepened toward Full Moon';
  }

  // Describe phase concentration
  if (waxingAvg > waningAvg + 0.5 && waxingObs.length >= 2) {
    return 'Most active in waxing phases';
  }
  if (waningAvg > waxingAvg + 0.5 && waningObs.length >= 2) {
    return 'Most active in waning phases';
  }

  // Check for even distribution
  if (Math.abs(waxingAvg - waningAvg) < 0.5 && observations.length >= 4) {
    return 'Practice flowed evenly through the cycle';
  }

  return null;
}

// Count phases where observation matched intention
function countIntentionAlignment(instance, observations) {
  if (!instance.intentionType) return null;

  const obsMap = {};
  for (const o of observations) obsMap[o.phase] = o.engagement;

  let matched = 0;
  const total = observations.length;

  if (instance.intentionType === 'whole' && instance.wholeIntention) {
    // Whole intention: count phases where engagement was 'light' or higher
    for (const o of observations) {
      if (o.engagement !== 'none') matched++;
    }
  } else if (instance.intentionType === 'phase' && instance.phaseIntentions) {
    // Phase intentions: count phases where intention was set and engagement was logged
    for (const o of observations) {
      const intended = instance.phaseIntentions[o.phase];
      if (intended && o.engagement !== 'none') matched++;
    }
  }

  if (total === 0) return null;
  return { matched, total };
}

// Find quietest phase (engagement = 'none')
function findQuietestPhase(observations) {
  const restPhase = observations.find(o => o.engagement === 'none');
  return restPhase ? restPhase.phase : null;
}

export function RhythmReport({ rhythm, instance, observations, cycleLoopTitle }) {
  const [reflection, setReflection] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [tried, setTried]           = useState(false);

  useEffect(() => {
    if (tried || observations.length === 0) return;
    setTried(true);
    setLoading(true);
    generateRhythmReport({ rhythm, instance, observations, cycleLoopTitle })
      .then(text => { setReflection(text); setLoading(false); })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build maps for ring
  const intentionMap = {};
  if (instance.intentionType === 'whole' && instance.wholeIntention) {
    for (const k of Object.keys(PHASE_NAMES)) intentionMap[k] = instance.wholeIntention;
  } else if (instance.intentionType === 'phase') {
    Object.assign(intentionMap, instance.phaseIntentions || {});
  }

  const observationMap = {};
  for (const o of observations) observationMap[o.phase] = o.engagement;

  const allPhaseKeys = Object.keys(PHASE_NAMES);
  const highestPhase = observations.reduce((best, o) => {
    const order = ['light','moderate','deep','ceremonial'];
    const bi = order.indexOf(best?.engagement);
    const oi = order.indexOf(o.engagement);
    return oi > bi ? o : best;
  }, null);

  const ceremonialPhases = observations.filter(o => o.engagement === 'ceremonial');

  // New summary stats
  const engagementPattern = describeEngagementPattern(observations);
  const intentionAlignment = countIntentionAlignment(instance, observations);
  const quietestPhase = findQuietestPhase(observations);

  return (
    <div style={{
      background: 'rgba(245,230,200,0.025)',
      border: '1px solid rgba(245,230,200,0.1)',
      borderRadius: 16, overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(245,230,200,0.06)',
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'monospace',
          letterSpacing: '0.15em', color: 'var(--text-tertiary)',
          marginBottom: 6,
        }}>
          CYCLE COMPLETE · {rhythm.scope === 'ongoing' ? 'ONGOING' : 'THIS CYCLE'}
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 20, fontWeight: 300, color: '#f5e6c8',
        }}>
          {rhythm.name}
        </div>
      </div>

      {/* Phase ring */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <PhaseRing
          size={200}
          intention={intentionMap}
          observation={observationMap}
          currentPhaseKey="waning-crescent"
          pastPhaseKeys={allPhaseKeys.filter(k => k !== 'waning-crescent')}
          showLabels={true}
        />
      </div>

      {/* Stats line */}
      <div style={{
        padding: '0 20px 16px',
        display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {observations.length} / 8 phases logged
        </div>
        {highestPhase && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Peak: <span style={{ color: LEVEL_BADGE[highestPhase.engagement] }}>
              {PHASE_NAMES[highestPhase.phase]}
            </span>
          </div>
        )}
        {ceremonialPhases.length > 0 && (
          <div style={{ fontSize: 11, color: '#fefcbf', opacity: 0.7 }}>
            ✦ {ceremonialPhases.map(o => PHASE_NAMES[o.phase]).join(', ')}
          </div>
        )}
      </div>

      {/* Descriptive summary stats */}
      {(engagementPattern || intentionAlignment || quietestPhase) && (
        <div style={{
          padding: '0 20px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {engagementPattern && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {engagementPattern}
            </div>
          )}
          {intentionAlignment && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Your practice matched intention in {intentionAlignment.matched} phase{intentionAlignment.matched !== 1 ? 's' : ''}
            </div>
          )}
          {quietestPhase && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Rested at {PHASE_NAMES[quietestPhase]}
            </div>
          )}
        </div>
      )}

      {/* AI reflection */}
      <div style={{
        margin: '0 16px 16px',
        padding: '14px 16px',
        background: 'rgba(245,230,200,0.03)',
        border: '1px solid rgba(245,230,200,0.07)',
        borderRadius: 10,
      }}>
        {loading && (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Reading the cycle…
          </div>
        )}
        {!loading && reflection && (
          <div style={{
            fontSize: 13, color: 'rgba(245,230,200,0.7)',
            lineHeight: 1.75,
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
          }}>
            {reflection}
          </div>
        )}
        {!loading && !reflection && observations.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>
            No check-ins logged this cycle — nothing to reflect on yet.
          </div>
        )}
        {!loading && !reflection && observations.length > 0 && tried && (
          <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>
            Reflection unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
