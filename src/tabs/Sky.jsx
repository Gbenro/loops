// Cosmic Loops - Sky Tab
// Main cosmic view with moon, phase info, and deep sheet

import { useState, useMemo } from 'react';
import { MoonFace } from '../components/MoonFace.jsx';
import { StarField } from '../components/StarField.jsx';
import { DeepCosmicSheet } from '../components/DeepCosmicSheet.jsx';
import { getLunarData, getPhaseEmoji, getAllPhases } from '../lib/lunar.js';
import { getSolarData } from '../lib/solar.js';
import { getNatalResonance, getResonanceSummary } from '../lib/natal.js';
import { getPhaseContent } from '../data/phaseContent.js';
import { getZodiacInfo } from '../data/zodiacMeanings.js';

export function Sky({ user, onSignIn, onSignOut }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Calculate all cosmic data
  const now = new Date();
  const lunarData = useMemo(() => getLunarData(now), []);
  const solarData = useMemo(() => getSolarData(now), []);
  const resonances = useMemo(() => getNatalResonance(now), []);
  const resonanceSummary = useMemo(() => getResonanceSummary(now), []);

  const phaseContent = getPhaseContent(lunarData.phase.key);
  const zodiacInfo = getZodiacInfo(lunarData.zodiac.sign);
  const allPhases = getAllPhases();

  // Format current time
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#040810',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <StarField count={50} />

      {/* Time & Location Header */}
      <div style={{
        padding: '16px 20px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          color: 'rgba(245, 230, 200, 0.4)',
        }}>
          {timeStr} · {dateStr.toUpperCase()}
        </div>
        <button
          onClick={user ? onSignOut : onSignIn}
          style={{
            background: 'none',
            border: '1px solid rgba(245, 230, 200, 0.15)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
            color: user ? 'rgba(52, 211, 153, 0.7)' : 'rgba(245, 230, 200, 0.4)',
            cursor: 'pointer',
          }}
        >
          {user ? '● SYNCED' : 'SIGN IN'}
        </button>
      </div>

      {/* Moon Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
      }}>
        {/* Tappable Moon */}
        <div
          onClick={() => setSheetOpen(true)}
          style={{
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <MoonFace
            size={200}
            phase={lunarData.age / 29.53}
            illumination={lunarData.illumination}
          />

          {/* Tap hint */}
          <div style={{
            position: 'absolute',
            bottom: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            color: 'rgba(245, 230, 200, 0.25)',
            whiteSpace: 'nowrap',
            animation: 'breathe 3s ease-in-out infinite',
          }}>
            TAP TO GO DEEPER
          </div>
        </div>
      </div>

      {/* Phase Info */}
      <div style={{
        padding: '0 20px 20px',
        textAlign: 'center',
      }}>
        {/* Phase Name */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 28,
          fontWeight: 600,
          color: '#f5e6c8',
          marginBottom: 8,
        }}>
          {phaseContent.title}
        </div>

        {/* Stats Line */}
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: 'rgba(245, 230, 200, 0.5)',
          marginBottom: 8,
        }}>
          {lunarData.illumination}% · {lunarData.lunarMonth.toUpperCase()} MOON · MOON IN {lunarData.zodiac.sign.toUpperCase()}
        </div>

        {/* Day Line */}
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          color: 'rgba(245, 230, 200, 0.35)',
          marginBottom: 20,
        }}>
          DAY {lunarData.dayOfCycle} OF CYCLE · {lunarData.daysToFull}D TO FULL
        </div>

        {/* Cosmic Energy Card */}
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: 'rgba(245, 230, 200, 0.04)',
          border: '1px solid rgba(245, 230, 200, 0.08)',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.12em',
            color: 'rgba(245, 230, 200, 0.5)',
            marginBottom: 8,
          }}>
            {phaseContent.energy.toUpperCase()}
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 15,
            fontStyle: 'italic',
            color: 'rgba(245, 230, 200, 0.85)',
            lineHeight: 1.5,
          }}>
            "{phaseContent.guidance}"
          </div>
        </div>

        {/* 8-Phase Timeline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 0',
          marginBottom: 12,
        }}>
          {allPhases.map((p) => {
            const isActive = p.key === lunarData.phase.key;
            return (
              <div
                key={p.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  opacity: isActive ? 1 : 0.3,
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 16 }}>{p.emoji}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(245, 230, 200, 0.08)',
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            width: `${(lunarData.age / 29.53) * 100}%`,
            height: '100%',
            background: 'rgba(245, 230, 200, 0.5)',
            borderRadius: 2,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Personal Transit Card (if resonances active) */}
        {resonanceSummary.hasResonance && (
          <div
            onClick={() => setSheetOpen(true)}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
              marginBottom: 16,
              cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: '#A78BFA',
              marginBottom: 4,
            }}>
              {resonanceSummary.intensity === 'active' ? 'ACTIVE TRANSIT' : 'TRANSIT'}
            </div>
            <div style={{
              fontSize: 13,
              color: 'rgba(245, 230, 200, 0.85)',
            }}>
              {resonanceSummary.message}
            </div>
          </div>
        )}

        {/* Go Deeper Button */}
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            background: 'rgba(245, 230, 200, 0.06)',
            border: '1px solid rgba(245, 230, 200, 0.12)',
            color: 'rgba(245, 230, 200, 0.7)',
            fontSize: 12,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          GO DEEPER ↓
        </button>

        {/* Waning Notice */}
        {lunarData.phase.isWaning && (
          <div style={{
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(252, 129, 129, 0.65)',
            lineHeight: 1.5,
          }}>
            The moon is waning. A time for releasing, not starting.
          </div>
        )}
      </div>

      {/* Deep Sheet */}
      <DeepCosmicSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        lunarData={lunarData}
        solarData={solarData}
        resonances={resonances}
      />
    </div>
  );
}
