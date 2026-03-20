// Luna Loops - Loop Creation Sheet
// Unified sheet for creating Open or Windowed (Phase) loops

import { useState } from 'react';
import { getPhaseEmoji } from '../lib/lunar.js';

const PHASE_PROMPTS = {
  'new': 'What seed are you planting?',
  'waxing-crescent': 'What is the first honest move toward your intention?',
  'first-quarter': 'What decision needs to be made?',
  'waxing-gibbous': 'What needs refinement before the Full Moon?',
  'full': 'What has been revealed?',
  'waning-gibbous': 'What wants to be shared or given back?',
  'last-quarter': 'What are you consciously releasing?',
  'waning-crescent': 'What needs to rest?',
};

const COLORS = [
  '#A78BFA', '#60A5FA', '#34D399', '#FBBF24',
  '#FB7185', '#38BDF8', '#F472B6', '#FF6B35'
];

// Neutral color for open loops
const OPEN_LOOP_COLOR = '#94A3B8';

export function LoopCreationSheet({ lunarData, cycleLoopId, onClose, onCreate }) {
  const [loopType, setLoopType] = useState(null); // null = choosing, 'open' | 'phase'
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const phaseEmoji = getPhaseEmoji(lunarData.phase.key);
  const phasePrompt = PHASE_PROMPTS[lunarData.phase.key] || 'What loop are you opening?';
  const remainingDays = lunarData.phaseRemaining?.toFixed(1) || '~3';

  const handleCreate = () => {
    if (!title.trim() || isCreating) return;

    // Prevent double-clicks
    setIsCreating(true);

    if (loopType === 'open') {
      onCreate({
        title: title.trim(),
        type: 'open',
        status: 'active',
        color: OPEN_LOOP_COLOR,
        linkedTo: null,
        phaseOpened: lunarData.phase.key,
        phaseName: lunarData.phase.name,
        lunarMonthOpened: lunarData.lunarMonth,
        moonAgeOpened: lunarData.age,
        zodiacOpened: lunarData.zodiac.sign,
        // No window for open loops
        windowEnd: null,
      });
    } else {
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
        // Window closes when phase ends
        windowEnd: new Date(Date.now() + lunarData.phaseRemaining * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  };

  const handleBack = () => {
    setLoopType(null);
    setTitle('');
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
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 520,
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

        {/* Type Selection View */}
        {loopType === null && (
          <>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'var(--font-2xl)',
              color: '#f5e6c8',
              textAlign: 'center',
              marginBottom: 10,
            }}>
              What kind of loop?
            </div>
            <div style={{
              fontSize: 'var(--font-sm)',
              fontFamily: 'monospace',
              color: 'rgba(245, 230, 200, 0.4)',
              textAlign: 'center',
              marginBottom: 32,
            }}>
              Choose how this loop relates to time
            </div>

            {/* Open Loop Option */}
            <button
              onClick={() => setLoopType('open')}
              style={{
                width: '100%',
                padding: '22px',
                borderRadius: 14,
                background: 'rgba(148, 163, 184, 0.06)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                marginBottom: 14,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 24 }}>◯</span>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'var(--font-xl)',
                  color: '#f5e6c8',
                }}>
                  Open Loop
                </span>
              </div>
              <div style={{
                fontSize: 'var(--font-md)',
                color: 'rgba(245, 230, 200, 0.5)',
                lineHeight: 1.6,
                paddingLeft: 38,
              }}>
                No time window. A task or intention that stays open until you close it.
                Good for transitioning from regular task management.
              </div>
            </button>

            {/* Phase Loop Option */}
            <button
              onClick={() => setLoopType('phase')}
              style={{
                width: '100%',
                padding: '22px',
                borderRadius: 14,
                background: 'rgba(167, 139, 250, 0.06)',
                border: '1px solid rgba(167, 139, 250, 0.15)',
                marginBottom: 14,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 24 }}>{phaseEmoji}</span>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'var(--font-xl)',
                  color: '#f5e6c8',
                }}>
                  Phase Loop
                </span>
                <span style={{
                  fontSize: 'var(--font-xs)',
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  borderRadius: 5,
                  background: 'rgba(167, 139, 250, 0.15)',
                  color: '#A78BFA',
                }}>
                  {remainingDays}D WINDOW
                </span>
              </div>
              <div style={{
                fontSize: 'var(--font-md)',
                color: 'rgba(245, 230, 200, 0.5)',
                lineHeight: 1.6,
                paddingLeft: 38,
              }}>
                Tied to {lunarData.phase.name}. You'll be nudged to close or release
                this loop when the phase shifts.
              </div>
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: '1px solid rgba(245, 230, 200, 0.1)',
                background: 'transparent',
                color: 'rgba(245, 230, 200, 0.4)',
                fontSize: 'var(--font-md)',
                cursor: 'pointer',
                marginTop: 10,
              }}
            >
              Cancel
            </button>
          </>
        )}

        {/* Open Loop Creation View */}
        {loopType === 'open' && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 24 }}>◯</span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                color: '#f5e6c8',
              }}>
                Open Loop
              </span>
            </div>

            <div style={{
              textAlign: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.15em',
              color: 'rgba(148, 163, 184, 0.6)',
              marginBottom: 28,
            }}>
              NO TIME WINDOW
            </div>

            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              fontStyle: 'italic',
              color: 'rgba(245, 230, 200, 0.7)',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 1.5,
            }}>
              What do you want to track?
            </div>

            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: '1px solid rgba(148, 163, 184, 0.15)',
                background: 'rgba(148, 163, 184, 0.03)',
                color: '#f5e6c8',
                fontSize: 16,
                fontFamily: "'Cormorant Garamond', serif",
                outline: 'none',
                marginBottom: 28,
              }}
              placeholder=""
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleBack}
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
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || isCreating}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 12,
                  border: 'none',
                  background: (title.trim() && !isCreating) ? OPEN_LOOP_COLOR : 'rgba(245, 230, 200, 0.08)',
                  color: (title.trim() && !isCreating) ? '#040810' : 'rgba(245, 230, 200, 0.3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (title.trim() && !isCreating) ? 'pointer' : 'default',
                }}
              >
                {isCreating ? 'CREATING...' : 'OPEN LOOP'}
              </button>
            </div>
          </>
        )}

        {/* Phase Loop Creation View */}
        {loopType === 'phase' && (
          <>
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

            <div style={{
              textAlign: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.15em',
              color: 'rgba(167, 139, 250, 0.7)',
              marginBottom: 28,
            }}>
              {lunarData.phase.energy?.toUpperCase()} · {remainingDays}D REMAINING
            </div>

            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              fontStyle: 'italic',
              color: 'rgba(245, 230, 200, 0.7)',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 1.5,
            }}>
              {phasePrompt}
            </div>

            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: '1px solid rgba(167, 139, 250, 0.15)',
                background: 'rgba(167, 139, 250, 0.03)',
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

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleBack}
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
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || isCreating}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: 12,
                  border: 'none',
                  background: (title.trim() && !isCreating) ? color : 'rgba(245, 230, 200, 0.08)',
                  color: (title.trim() && !isCreating) ? '#040810' : 'rgba(245, 230, 200, 0.3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (title.trim() && !isCreating) ? 'pointer' : 'default',
                }}
              >
                {isCreating ? 'CREATING...' : 'OPEN LOOP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
