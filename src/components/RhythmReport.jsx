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
          letterSpacing: '0.15em', color: 'rgba(245,230,200,0.3)',
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
        <div style={{ fontSize: 11, color: 'rgba(245,230,200,0.35)' }}>
          {observations.length} / 8 phases logged
        </div>
        {highestPhase && (
          <div style={{ fontSize: 11, color: 'rgba(245,230,200,0.35)' }}>
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

      {/* AI reflection */}
      <div style={{
        margin: '0 16px 16px',
        padding: '14px 16px',
        background: 'rgba(245,230,200,0.03)',
        border: '1px solid rgba(245,230,200,0.07)',
        borderRadius: 10,
      }}>
        {loading && (
          <div style={{ fontSize: 13, color: 'rgba(245,230,200,0.3)', fontStyle: 'italic' }}>
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
          <div style={{ fontSize: 12, color: 'rgba(245,230,200,0.25)' }}>
            No check-ins logged this cycle — nothing to reflect on yet.
          </div>
        )}
        {!loading && !reflection && observations.length > 0 && tried && (
          <div style={{ fontSize: 12, color: 'rgba(245,230,200,0.25)' }}>
            Reflection unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
