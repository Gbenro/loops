// Cosmic Loops — Rhythm Tab (beta only)
// Practice observation layer: track how a named practice moves through the lunar cycle

import { useState, useEffect, useCallback } from 'react';
import { RhythmCard } from '../components/RhythmCard.jsx';
import { RhythmDetail } from '../components/RhythmDetail.jsx';
import { RhythmReport } from '../components/RhythmReport.jsx';
import {
  getRhythms,
  saveRhythm,
  // deleteRhythm - available for rhythm removal feature
  getOrCreateCurrentInstance,
  saveInstance,
  getObservationsForInstance,
} from '../lib/rhythm.js';
import { resolvePhaseText } from '../lib/phaseText.js';
import { PHASE_ACCENTS, PHASE_KEYS as ALL_PHASE_KEYS } from '../lib/phases.js';

// ── Create sheet ──────────────────────────────────────────────────────────────

function CreateSheet({ onSave, onClose }) {
  const [name, setName]     = useState('');
  const [scope, setScope]   = useState('ongoing');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({ name: name.trim(), scope });
    setSaving(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 520,
        background: 'var(--color-surface)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '24px 20px 40px',
        animation: 'slideUp 0.25s ease-out',
      }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--color-border-mid)', margin: '0 auto 20px' }} />

        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: 'var(--color-text)', marginBottom: 20 }}>
          New rhythm
        </div>

        {/* Name */}
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); }}
          placeholder="Name this practice…"
          style={{
            width: '100%', padding: '13px 14px', marginBottom: 16,
            background: 'var(--color-input-bg)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 10, color: 'var(--color-text)', fontSize: 15, outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: 'border-box',
          }}
        />

        {/* Scope */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            SCOPE
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['ongoing','Ongoing','Persists across cycles'],['cycle','This cycle only','Closes at cycle end']].map(([v, l, sub]) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  background: scope === v ? 'var(--color-border-light)' : 'var(--color-input-bg)',
                  border: scope === v ? '1px solid var(--color-border-mid)' : '1px solid var(--color-border-light)',
                }}
              >
                <div style={{ fontSize: 13, color: scope === v ? 'var(--color-text)' : 'var(--color-text-dim)', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>
                  {l}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                  {sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: canSave ? 'var(--color-border-light)' : 'var(--color-input-bg)',
            border: canSave ? '1px solid var(--color-border-mid)' : '1px solid var(--color-border-light)',
            color: canSave ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontSize: 14, cursor: canSave ? 'pointer' : 'default',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {saving ? 'Creating…' : 'Begin observing'}
        </button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function Rhythm({ userId, lunarData, loops = [] }) {
  const [rhythms, setRhythms]               = useState([]);
  const [instanceMap, setInstanceMap]       = useState({});   // rhythmId → instance
  const [observationMap, setObservationMap] = useState({});   // rhythmId → { phaseKey: level }
  const [loading, setLoading]               = useState(true);
  const [showCreate, setShowCreate]         = useState(false);
  const [selectedRhythm, setSelectedRhythm] = useState(null);
  const [reportData, setReportData]         = useState({});   // rhythmId → observations[]

  const currentPhaseKey = lunarData?.phase?.key || null;
  const cycleStart      = lunarData?.cycleStart  || null;
  const isWaningCrescent = currentPhaseKey === 'waning-crescent';

  const currentPhaseIndex = currentPhaseKey ? ALL_PHASE_KEYS.indexOf(currentPhaseKey) : -1;
  const pastPhaseKeys = currentPhaseIndex > 0
    ? ALL_PHASE_KEYS.slice(0, currentPhaseIndex)
    : [];

  const phaseAccent = PHASE_ACCENTS[currentPhaseKey] || 'var(--color-accent)';

  // Cycle loop title for AI context
  const cycleLoop = loops.find(l => l.type === 'cycle' && l.status === 'active');

  const loadRhythms = useCallback(async () => {
    const all = await getRhythms(userId);
    setRhythms(all);

    if (!cycleStart) { setLoading(false); return; }

    // Load instances and current-phase observations for each rhythm
    const instMap = {};
    const obsMap  = {};
    const repData = {};

    await Promise.all(all.map(async r => {
      const inst = await getOrCreateCurrentInstance(r, cycleStart, userId);
      instMap[r.id] = inst;
      const obs = await getObservationsForInstance(inst.id, userId);
      obsMap[r.id] = {};
      for (const o of obs) obsMap[r.id][o.phase] = o.engagement;
      if (isWaningCrescent) repData[r.id] = obs;
    }));

    setInstanceMap(instMap);
    setObservationMap(obsMap);
    if (isWaningCrescent) setReportData(repData);
    setLoading(false);
  }, [userId, cycleStart, isWaningCrescent]);

  useEffect(() => { loadRhythms(); }, [loadRhythms]);

  // New Moon prompt: ongoing rhythms whose instance has no intentionType set
  const newMoonPrompts = lunarData?.phase?.key === 'new'
    ? rhythms.filter(r => r.scope === 'ongoing' && instanceMap[r.id]?.intentionType === null)
    : [];

  const handleCreate = async ({ name, scope }) => {
    const rhythm = {
      id:        crypto.randomUUID(),
      name,
      scope,
      active:    true,
      createdAt: new Date().toISOString(),
    };
    await saveRhythm(rhythm, userId);
    setRhythms(prev => [...prev, rhythm]);
    setShowCreate(false);

    // Auto-create instance for current cycle
    if (cycleStart) {
      const inst = await getOrCreateCurrentInstance(rhythm, cycleStart, userId);
      setInstanceMap(prev => ({ ...prev, [rhythm.id]: inst }));
    }
  };

  const handleContinueIntention = async (rhythm) => {
    const inst = instanceMap[rhythm.id];
    if (!inst) return;
    // Mark intentionType so prompt goes away — carry forward by leaving phaseIntentions unchanged
    const updated = { ...inst, intentionType: inst.intentionType || 'none' };
    await saveInstance(updated, userId);
    setInstanceMap(prev => ({ ...prev, [rhythm.id]: updated }));
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--color-text-faint)', fontSize: 13 }}>·</div>
    </div>
  );

  if (selectedRhythm) return (
    <RhythmDetail
      rhythm={selectedRhythm}
      lunarData={lunarData}
      userId={userId}
      onClose={() => { setSelectedRhythm(null); loadRhythms(); }}
    />
  );

  return (
    <div data-tour="rhythm-what" style={{ padding: '20px 20px 100px' }}>

      {/* New Moon prompts */}
      {newMoonPrompts.map(r => (
        <div key={r.id} data-tour="rhythm-intention" style={{
          marginBottom: 12,
          padding: '14px 16px',
          background: 'var(--color-input-bg)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            NEW MOON · {r.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
            {resolvePhaseText('rhythmContinuePrompt', 'new')}
          </div>
          <div data-tour="rhythm-intention-actions" style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleContinueIntention(r)}
              style={{
                flex: 1, padding: '9px', borderRadius: 8,
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-dim)', fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Continue
            </button>
            <button
              onClick={() => setSelectedRhythm(r)}
              style={{
                flex: 1, padding: '9px', borderRadius: 8,
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Adjust
            </button>
          </div>
        </div>
      ))}

      {/* Waning Crescent reports */}
      {isWaningCrescent && rhythms
        .filter(r => (reportData[r.id]?.length || 0) > 0)
        .map((r, rIndex) => (
          <RhythmReport
            key={r.id}
            rhythm={r}
            instance={instanceMap[r.id]}
            observations={reportData[r.id] || []}
            cycleLoopTitle={cycleLoop?.title || null}
            tourId={rIndex === 0 ? 'rhythm-cycle-report' : undefined}
            currentPhaseKey={currentPhaseKey}
          />
        ))
      }

      {/* Rhythm list */}
      {rhythms.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 300, color: 'var(--color-text-dim)',
            marginBottom: 12,
          }}>
            {resolvePhaseText('noRhythmsMessage', currentPhaseKey)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-disabled)', lineHeight: 1.65, maxWidth: 260, margin: '0 auto' }}>
            {resolvePhaseText('noRhythmsSubtext', currentPhaseKey)}
          </div>
        </div>
      ) : (
        <div data-tour="rhythm-history" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rhythms.map((r, rIndex) => {
            const inst = instanceMap[r.id];
            const obsForRhythm = observationMap[r.id] || {};
            const currentObs = currentPhaseKey ? obsForRhythm[currentPhaseKey] || null : null;

            let currentInt = null;
            if (inst?.intentionType === 'whole') currentInt = inst.wholeIntention;
            else if (inst?.intentionType === 'phase') currentInt = inst.phaseIntentions?.[currentPhaseKey] || null;

            return (
              <RhythmCard
                key={r.id}
                rhythm={r}
                instance={inst}
                currentPhaseKey={currentPhaseKey}
                pastPhaseKeys={pastPhaseKeys}
                currentObservation={currentObs}
                currentIntention={currentInt}
                phaseAccent={phaseAccent}
                onClick={() => setSelectedRhythm(r)}
                tourId={rIndex === 0 ? 'rhythm-card' : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Add button */}
      <button
        data-tour="rhythm-add-btn"
        onClick={() => {
          if (!userId) return; // auth guard handled by parent
          setShowCreate(true);
        }}
        style={{
          position: 'fixed',
          bottom: 88, right: '50%',
          transform: 'translateX(50%)',
          maxWidth: 'calc(520px - 40px)',
          width: 'calc(100% - 40px)',
          padding: '13px',
          borderRadius: 12,
          background: 'var(--color-border-light)',
          border: '1px solid var(--color-border-mid)',
          color: 'var(--color-text-muted)',
          fontSize: 13, cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: '0.04em',
        }}
      >
        + New rhythm
      </button>

      {showCreate && (
        <CreateSheet
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
