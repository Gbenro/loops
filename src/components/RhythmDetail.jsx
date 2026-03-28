// Cosmic Loops — RhythmDetail
// Full detail view for a single Rhythm: ring, check-in log, intention setter, cycle selector

import { useState, useEffect, useCallback } from 'react';
import { PhaseRing } from './PhaseRing.jsx';
import { CheckInSheet } from './CheckInSheet.jsx';
import {
  // getInstancesForRhythm - available for history view
  getOrCreateCurrentInstance,
  saveInstance,
  getObservationsForInstance,
  saveObservation,
} from '../lib/rhythm.js';

const PHASES_ORDERED = [
  { key: 'new',             label: 'New Moon',        accent: 'rgba(245,230,200,0.75)' },
  { key: 'waxing-crescent', label: 'Waxing Crescent', accent: '#74c69d' },
  { key: 'first-quarter',   label: 'First Quarter',   accent: '#f6ad55' },
  { key: 'waxing-gibbous',  label: 'Waxing Gibbous',  accent: '#81e6d9' },
  { key: 'full',            label: 'Full Moon',        accent: '#fefcbf' },
  { key: 'waning-gibbous',  label: 'Waning Gibbous',  accent: '#b794f4' },
  { key: 'last-quarter',    label: 'Last Quarter',     accent: '#f687b3' },
  { key: 'waning-crescent', label: 'Waning Crescent',  accent: '#718096' },
];

const ALL_PHASE_KEYS = PHASES_ORDERED.map(p => p.key);

const LEVELS = ['none','light','moderate','deep','ceremonial'];

const LEVEL_LABEL = {
  none: 'None', light: 'Light', moderate: 'Moderate',
  deep: 'Deep', ceremonial: 'Ceremonial',
};

// ── Intention setter ──────────────────────────────────────────────────────────

function IntentionSetter({ instance, onSave, onClose }) {
  const [mode, setMode] = useState(instance.intentionType || 'whole');
  const [whole, setWhole] = useState(instance.wholeIntention || null);
  const [byPhase, setByPhase] = useState({ ...instance.phaseIntentions });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated = {
      ...instance,
      intentionType:   mode,
      wholeIntention:  mode === 'whole' ? whole : null,
      phaseIntentions: mode === 'phase' ? byPhase : {},
    };
    await onSave(updated);
    setSaving(false);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 520,
        background: '#070b14',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '24px 20px 40px',
        maxHeight: '85vh', overflowY: 'auto',
        animation: 'slideUp 0.25s ease-out',
      }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: 'rgba(245,230,200,0.15)', margin: '0 auto 20px' }} />

        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: '#f5e6c8', marginBottom: 20 }}>
          Set intention
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['whole','Whole cycle'],['phase','Phase by phase'],['none','No intention']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 8,
                background: mode === v ? 'rgba(245,230,200,0.1)' : 'rgba(245,230,200,0.03)',
                color: mode === v ? '#f5e6c8' : 'rgba(245,230,200,0.35)',
                fontSize: 11, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                border: mode === v ? '1px solid rgba(245,230,200,0.15)' : '1px solid rgba(245,230,200,0.05)',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {mode === 'whole' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {LEVELS.map(lv => (
              <button
                key={lv}
                onClick={() => setWhole(lv)}
                style={{
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  background: whole === lv ? 'rgba(245,230,200,0.08)' : 'rgba(245,230,200,0.02)',
                  color: whole === lv ? '#f5e6c8' : 'rgba(245,230,200,0.5)',
                  fontSize: 14, textAlign: 'left',
                  border: whole === lv ? '1px solid rgba(245,230,200,0.15)' : '1px solid rgba(245,230,200,0.06)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {LEVEL_LABEL[lv]}
              </button>
            ))}
          </div>
        )}

        {mode === 'phase' && (
          <div style={{ marginBottom: 20 }}>
            {PHASES_ORDERED.map(ph => (
              <div key={ph.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid rgba(245,230,200,0.05)',
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: ph.accent, flexShrink: 0,
                }} />
                <div style={{
                  fontSize: 12, color: 'rgba(245,230,200,0.6)',
                  width: 110, flexShrink: 0,
                }}>
                  {ph.label}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {LEVELS.map(lv => {
                    const sel = byPhase[ph.key] === lv;
                    return (
                      <button
                        key={lv}
                        onClick={() => setByPhase(prev => ({ ...prev, [ph.key]: sel ? null : lv }))}
                        style={{
                          padding: '4px 8px', borderRadius: 6,
                          fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                          background: sel ? `${ph.accent}22` : 'transparent',
                          border: sel ? `1px solid ${ph.accent}44` : '1px solid rgba(245,230,200,0.08)',
                          color: sel ? ph.accent : 'rgba(245,230,200,0.35)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {lv.toUpperCase().slice(0,3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'none' && (
          <div style={{ fontSize: 13, color: 'rgba(245,230,200,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
            Pure observation mode — just log what actually happens. Intention can be set any time.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'rgba(245,230,200,0.08)',
            border: '1px solid rgba(245,230,200,0.15)',
            color: '#f5e6c8', fontSize: 14, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {saving ? 'Saving…' : 'Save intention'}
        </button>
      </div>
    </div>
  );
}

// ── RhythmDetail ──────────────────────────────────────────────────────────────

export function RhythmDetail({ rhythm, lunarData, userId, onClose }) {
  const currentPhaseKey = lunarData?.phase?.key || null;
  const cycleStart      = lunarData?.cycleStart  || null;

  const [instance, setInstance]         = useState(null);
  const [observations, setObservations] = useState([]);
  const [checkInPhase, setCheckInPhase] = useState(null);
  const [showIntention, setShowIntention] = useState(false);
  const [loading, setLoading]           = useState(true);

  const pastPhaseKeys = currentPhaseKey
    ? ALL_PHASE_KEYS.slice(0, ALL_PHASE_KEYS.indexOf(currentPhaseKey))
    : [];

  const loadData = useCallback(async () => {
    if (!cycleStart) { setLoading(false); return; }
    setLoading(true);
    const inst = await getOrCreateCurrentInstance(rhythm, cycleStart, userId);
    setInstance(inst);
    const obs = await getObservationsForInstance(inst.id, userId);
    setObservations(obs);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rhythm.id, cycleStart, userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const intentionMap = {};
  if (instance?.intentionType === 'whole' && instance.wholeIntention) {
    for (const k of ALL_PHASE_KEYS) intentionMap[k] = instance.wholeIntention;
  } else if (instance?.intentionType === 'phase') {
    Object.assign(intentionMap, instance.phaseIntentions || {});
  }

  const observationMap = {};
  for (const o of observations) observationMap[o.phase] = o.engagement;

  const handleCheckIn = async ({ phase, engagement, note }) => {
    if (!instance) return;
    const obs = {
      id:              crypto.randomUUID(),
      cycleInstanceId: instance.id,
      phase,
      engagement,
      note:    note || null,
      loggedAt: new Date().toISOString(),
    };
    await saveObservation(obs, userId);
    setObservations(prev => {
      const filtered = prev.filter(o => o.phase !== phase);
      return [...filtered, obs];
    });
  };

  const handleSaveIntention = async (updated) => {
    await saveInstance(updated, userId);
    setInstance(updated);
  };

  // Determine which phases are available to log (current + recent past with no check-in)
  const loggablePhases = currentPhaseKey
    ? [currentPhaseKey, ...pastPhaseKeys.slice(-2)].filter(k => !observationMap[k])
    : [];

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#040810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(245,230,200,0.3)', fontSize: 13 }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#040810', overflowY: 'auto' }}>
      {/* Nav */}
      <div style={{
        position: 'sticky', top: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'rgba(4,8,16,0.9)', backdropFilter: 'blur(8px)',
        zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(245,230,200,0.4)', fontSize: 14, cursor: 'pointer', padding: 0 }}
        >
          ← Back
        </button>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(245,230,200,0.3)', letterSpacing: '0.08em' }}>
          {rhythm.scope === 'ongoing' ? 'ONGOING' : 'THIS CYCLE'}
        </div>
      </div>

      <div style={{ padding: '0 20px 60px', maxWidth: 520, margin: '0 auto' }}>
        {/* Title */}
        <div style={{ padding: '16px 0 24px' }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28, fontWeight: 300, color: '#f5e6c8',
            marginBottom: 8,
          }}>
            {rhythm.name}
          </div>
          <button
            onClick={() => instance && setShowIntention(true)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 11, fontFamily: 'monospace',
              color: instance ? 'rgba(245,230,200,0.3)' : 'rgba(245,230,200,0.15)',
              letterSpacing: '0.1em',
              cursor: instance ? 'pointer' : 'default',
            }}
          >
            {!instance
              ? '◌ LOADING…'
              : instance.intentionType && instance.intentionType !== 'none'
                ? '◎ INTENTION SET — TAP TO EDIT'
                : '◌ SET INTENTION'}
          </button>
        </div>

        {/* Phase ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <PhaseRing
            size={220}
            intention={intentionMap}
            observation={observationMap}
            currentPhaseKey={currentPhaseKey}
            pastPhaseKeys={pastPhaseKeys}
            showLabels={true}
            onPhaseClick={phaseKey => {
              // Allow logging for current phase or recently missed phases
              if (loggablePhases.includes(phaseKey) || observationMap[phaseKey]) {
                setCheckInPhase(phaseKey);
              }
            }}
          />
        </div>

        {/* Quick log prompt for current phase */}
        {currentPhaseKey && !observationMap[currentPhaseKey] && (
          <button
            onClick={() => setCheckInPhase(currentPhaseKey)}
            style={{
              display: 'block', width: '100%',
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(245,230,200,0.04)',
              border: '1px solid rgba(245,230,200,0.1)',
              color: 'rgba(245,230,200,0.6)', fontSize: 13,
              cursor: 'pointer', marginBottom: 24,
              fontFamily: "'DM Sans', sans-serif",
              textAlign: 'center',
            }}
          >
            Log {PHASES_ORDERED.find(p => p.key === currentPhaseKey)?.label || currentPhaseKey} check-in
          </button>
        )}

        {/* Check-in log */}
        {observations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.15em',
              color: 'rgba(245,230,200,0.25)', marginBottom: 12,
            }}>
              THIS CYCLE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ALL_PHASE_KEYS
                .filter(k => observationMap[k])
                .map(k => {
                  const obs = observations.find(o => o.phase === k);
                  const ph = PHASES_ORDERED.find(p => p.key === k);
                  return (
                    <button
                      key={k}
                      onClick={() => setCheckInPhase(k)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 0',
                        borderBottom: '1px solid rgba(245,230,200,0.05)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ph.accent, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: obs.note ? 3 : 0 }}>
                          <span style={{ fontSize: 12, color: 'rgba(245,230,200,0.5)' }}>{ph.label}</span>
                          <span style={{
                            fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em',
                            color: obs.engagement === 'ceremonial' ? '#fefcbf' : 'rgba(245,230,200,0.4)',
                          }}>
                            {obs.engagement.toUpperCase()}
                          </span>
                        </div>
                        {obs.note && (
                          <div style={{ fontSize: 12, color: 'rgba(245,230,200,0.35)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            &ldquo;{obs.note}&rdquo;
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              }
            </div>
          </div>
        )}
      </div>

      {/* Sheets */}
      {checkInPhase && (
        <CheckInSheet
          phaseKey={checkInPhase}
          rhythmName={rhythm.name}
          existing={observations.find(o => o.phase === checkInPhase) || null}
          onSave={handleCheckIn}
          onClose={() => setCheckInPhase(null)}
        />
      )}

      {showIntention && instance && (
        <IntentionSetter
          instance={instance}
          onSave={handleSaveIntention}
          onClose={() => setShowIntention(false)}
        />
      )}
    </div>
  );
}
