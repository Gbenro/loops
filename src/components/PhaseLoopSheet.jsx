// Luna Loops - Phase Loop Creation Sheet
// Phase-specific prompts for creating phase loops

import { useState } from 'react';
import { getPhaseEmoji } from '../lib/lunar.js';

const PHASE_PROMPTS = {
  'New Moon': 'What seed are you planting?',
  'Waxing Crescent': 'What is the first honest move toward your intention?',
  'First Quarter': 'What decision needs to be made?',
  'Waxing Gibbous': 'What needs refinement before the Full Moon?',
  'Full Moon': 'What has been revealed?',
  'Waning Gibbous': 'What wants to be shared or given back?',
  'Last Quarter': 'What are you consciously releasing?',
  'Waning Crescent': 'What needs to rest?',
};

const COLORS = [
  '#A78BFA', '#60A5FA', '#34D399', '#FBBF24',
  '#FB7185', '#38BDF8', '#F472B6', '#FF6B35'
];

export function PhaseLoopSheet({ lunarData, cycleLoopId, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const prompt = PHASE_PROMPTS[lunarData.phase.name] || 'What loop are you opening?';
  const phaseEmoji = getPhaseEmoji(lunarData.phase.key);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      type: 'phase',
      status: 'active',
      color,
      linkedTo: cycleLoopId,
      phaseOpened: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      lunarMonthOpened: lunarData.lunarMonth,
      moonAgeOpened: lunarData.age,
      zodiacOpened: lunarData.zodiac.sign,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0a0a12',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: '20px 20px 40px',
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(245, 230, 200, 0.2)',
          margin: '0 auto 24px',
        }} />

        {/* Phase Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 24 }}>{phaseEmoji}</span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20,
            color: '#f5e6c8',
          }}>
            {lunarData.phase.name}
          </span>
        </div>

        {/* Energy word */}
        <div style={{
          textAlign: 'center',
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          color: 'rgba(245, 230, 200, 0.4)',
          marginBottom: 28,
        }}>
          {lunarData.phase.energy?.toUpperCase() || 'PHASE LOOP'}
        </div>

        {/* Prompt */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18,
          fontStyle: 'italic',
          color: 'rgba(245, 230, 200, 0.7)',
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 1.5,
        }}>
          {prompt}
        </div>

        {/* Title input */}
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 12,
            border: '1px solid rgba(245, 230, 200, 0.12)',
            background: 'rgba(245, 230, 200, 0.03)',
            color: '#f5e6c8',
            fontSize: 16,
            fontFamily: "'Cormorant Garamond', serif",
            outline: 'none',
            marginBottom: 20,
          }}
          placeholder=""
        />

        {/* Color selection */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          marginBottom: 28,
        }}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: c,
                border: color === c
                  ? '3px solid #f5e6c8'
                  : '3px solid transparent',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                transform: color === c ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 12,
              border: '1px solid rgba(245, 230, 200, 0.12)',
              background: 'transparent',
              color: 'rgba(245, 230, 200, 0.5)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: title.trim() ? color : 'rgba(245, 230, 200, 0.08)',
              color: title.trim() ? '#040810' : 'rgba(245, 230, 200, 0.3)',
              fontSize: 13,
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            OPEN LOOP
          </button>
        </div>
      </div>
    </div>
  );
}
