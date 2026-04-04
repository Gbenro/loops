// Cosmic Loops — CheckInSheet
// Bottom sheet for logging engagement for a phase

import { useState } from 'react';
import { PHASE_LABELS, PHASE_ACCENTS, ENGAGEMENT_LEVELS } from '../lib/phases.js';

// Build phase meta from shared constants
const PHASES_META = Object.fromEntries(
  Object.keys(PHASE_LABELS).map(key => [key, { label: PHASE_LABELS[key], accent: PHASE_ACCENTS[key] }])
);

export function CheckInSheet({ phaseKey, rhythmName, existing = null, dayInPhase = null, phaseDuration = null, onSave, onClose }) {
  const meta = PHASES_META[phaseKey] || { label: phaseKey, accent: 'rgba(245,230,200,0.6)' };
  const [level, setLevel]   = useState(existing?.engagement || null);
  const [note, setNote]     = useState(existing?.note || '');
  const [saving, setSaving] = useState(false);

  // Format day context string
  const dayContext = dayInPhase !== null && phaseDuration !== null
    ? `Day ${Math.floor(dayInPhase) + 1} of ${Math.ceil(phaseDuration)}`
    : null;

  const canSave = level !== null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({ phase: phaseKey, engagement: level, note: note.trim() || null });
    setSaving(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(4,8,16,0.7)', backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 520,
        background: '#070b14',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '24px 20px 40px',
        animation: 'slideUp 0.25s ease-out',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 3, borderRadius: 2,
          background: 'rgba(245,230,200,0.15)',
          margin: '0 auto 20px',
        }} />

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontFamily: 'monospace',
            letterSpacing: '0.15em', color: meta.accent,
            opacity: 0.7, marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{meta.label.toUpperCase()}</span>
            {dayContext && (
              <span style={{ color: 'rgba(245,230,200,0.4)' }}>• {dayContext}</span>
            )}
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 300, color: '#f5e6c8',
          }}>
            {rhythmName}
          </div>
          {existing && (
            <div style={{ fontSize: 11, color: 'rgba(245,230,200,0.3)', marginTop: 4 }}>
              Updating existing check-in
            </div>
          )}
        </div>

        {/* Level selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {ENGAGEMENT_LEVELS.map(l => {
            const isSelected = level === l.value;
            return (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 10,
                  border: isSelected
                    ? `1px solid ${meta.accent}55`
                    : '1px solid rgba(245,230,200,0.07)',
                  background: isSelected
                    ? `${meta.accent}12`
                    : 'rgba(245,230,200,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isSelected ? meta.accent : 'rgba(245,230,200,0.15)',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }} />
                <div>
                  <div style={{
                    fontSize: 14, color: isSelected ? '#f5e6c8' : 'rgba(245,230,200,0.6)',
                    fontWeight: isSelected ? 500 : 400,
                  }}>
                    {l.label}
                  </div>
                  {isSelected && (
                    <div style={{ fontSize: 11, color: 'rgba(245,230,200,0.4)', marginTop: 2 }}>
                      {l.desc}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Optional note */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="A note about this phase... (optional)"
          rows={2}
          style={{
            width: '100%', padding: '12px 14px',
            background: 'rgba(245,230,200,0.03)',
            border: '1px solid rgba(245,230,200,0.08)',
            borderRadius: 10, color: '#f5e6c8',
            fontSize: 13, resize: 'none', outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: 'border-box',
            marginBottom: 16,
          }}
        />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12,
            background: canSave ? `${meta.accent}22` : 'rgba(245,230,200,0.05)',
            color: canSave ? '#f5e6c8' : 'var(--text-disabled)',
            fontSize: 14, cursor: canSave ? 'pointer' : 'default',
            fontFamily: "'DM Sans', sans-serif",
            border: canSave ? `1px solid ${meta.accent}33` : '1px solid rgba(245,230,200,0.05)',
          }}
        >
          {saving ? 'Saving…' : 'Log check-in'}
        </button>
      </div>
    </div>
  );
}
