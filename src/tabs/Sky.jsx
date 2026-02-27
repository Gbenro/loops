// Cosmic Loops - Sky Tab
// Main cosmic view with moon, phase info, and deep sheet

import { useState, useMemo } from 'react';
import { MoonFace } from '../components/MoonFace.jsx';
import { StarField } from '../components/StarField.jsx';
import { DeepCosmicSheet } from '../components/DeepCosmicSheet.jsx';
import { PhaseTideBar } from '../components/PhaseTideBar.jsx';
import { PhaseTransitionCard } from '../components/PhaseTransitionCard.jsx';
import { getLunarData, getPhaseEmoji, getAllPhases } from '../lib/lunar.js';
import { getSolarData } from '../lib/solar.js';
import { getNatalResonance, getResonanceSummary } from '../lib/natal.js';
import { getPhaseContent } from '../data/phaseContent.js';
import { getZodiacInfo } from '../data/zodiacMeanings.js';

export function Sky({ user, onSignIn, onSignOut, onSwitchToEchoes }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [transitionDismissed, setTransitionDismissed] = useState(false);

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
    }}>
      <StarField count={50} />

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Time & Location Header */}
        <div style={{
          padding: '18px 24px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
        <div style={{
          fontSize: 'var(--font-xs)',
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
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 'var(--font-xs)',
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
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          flexShrink: 0,
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
            bottom: -32,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'var(--font-xs)',
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
        padding: '0 24px 24px',
        textAlign: 'center',
      }}>
        {/* Phase Name */}
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'var(--font-3xl)',
          fontWeight: 600,
          color: '#f5e6c8',
          marginBottom: 10,
        }}>
          {phaseContent.title}
        </div>

        {/* Stats Line */}
        <div style={{
          fontSize: 'var(--font-sm)',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: 'rgba(245, 230, 200, 0.5)',
          marginBottom: 10,
        }}>
          {lunarData.illumination}% · {lunarData.lunarMonth.toUpperCase()} MOON · MOON IN {lunarData.zodiac.sign.toUpperCase()}
        </div>

        {/* Day Line */}
        <div style={{
          fontSize: 'var(--font-sm)',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          color: 'rgba(245, 230, 200, 0.35)',
          marginBottom: 24,
        }}>
          DAY {lunarData.dayOfCycle} OF CYCLE · {lunarData.daysToFull}D TO FULL
        </div>

        {/* Cosmic Energy Card */}
        <div style={{
          padding: '18px 22px',
          borderRadius: 14,
          background: lunarData.phase.isThreshold
            ? 'rgba(245, 230, 200, 0.05)'
            : 'rgba(201, 168, 76, 0.04)',
          border: `1px solid ${lunarData.phase.isThreshold
            ? 'rgba(245, 230, 200, 0.1)'
            : 'rgba(201, 168, 76, 0.12)'}`,
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}>
            <span style={{
              fontSize: 'var(--font-sm)',
              fontFamily: 'monospace',
              letterSpacing: '0.12em',
              color: 'rgba(245, 230, 200, 0.5)',
            }}>
              {phaseContent.energy.toUpperCase()}
            </span>
            <span style={{
              fontSize: 'var(--font-xs)',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              padding: '3px 8px',
              borderRadius: 4,
              background: lunarData.phase.isThreshold
                ? 'rgba(245, 230, 200, 0.08)'
                : 'rgba(201, 168, 76, 0.1)',
              color: lunarData.phase.isThreshold
                ? 'rgba(245, 230, 200, 0.5)'
                : 'rgba(201, 168, 76, 0.7)',
            }}>
              {lunarData.phase.isThreshold ? 'THRESHOLD' : 'FLOW'}
            </span>
          </div>
          {/* Phase type opening */}
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'var(--font-md)',
            color: lunarData.phase.isThreshold
              ? 'rgba(245, 230, 200, 0.6)'
              : 'rgba(201, 168, 76, 0.65)',
            marginBottom: 10,
            lineHeight: 1.5,
          }}>
            {phaseContent.typeOpening}
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'var(--font-lg)',
            fontStyle: 'italic',
            color: 'rgba(245, 230, 200, 0.85)',
            lineHeight: 1.6,
          }}>
            "{phaseContent.guidance}"
          </div>
        </div>

        {/* 8-Phase Timeline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 0',
          marginBottom: 16,
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
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
              </div>
            );
          })}
        </div>

        {/* Phase Tide Bar */}
        <div style={{ margin: '0 -20px 16px' }}>
          <PhaseTideBar lunarData={lunarData} />
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

        {/* Phase Transition Card (< 24h before shift) */}
        {lunarData.isApproaching && !transitionDismissed && (
          <PhaseTransitionCard
            lunarData={lunarData}
            onDismiss={() => setTransitionDismissed(true)}
            onOpenEchoes={onSwitchToEchoes}
          />
        )}

        {/* Personal Transit Card (if resonances active) */}
        {resonanceSummary.hasResonance && (
          <div
            onClick={() => setSheetOpen(true)}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
              marginBottom: 18,
              cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: 'var(--font-xs)',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: '#A78BFA',
              marginBottom: 6,
            }}>
              {resonanceSummary.intensity === 'active' ? 'ACTIVE TRANSIT' : 'TRANSIT'}
            </div>
            <div style={{
              fontSize: 'var(--font-md)',
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
            padding: '16px 24px',
            borderRadius: 14,
            background: 'rgba(245, 230, 200, 0.06)',
            border: '1px solid rgba(245, 230, 200, 0.12)',
            color: 'rgba(245, 230, 200, 0.7)',
            fontSize: 'var(--font-sm)',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            marginBottom: 18,
          }}
        >
          GO DEEPER ↓
        </button>

        {/* Waning Notice */}
        {lunarData.phase.isWaning && (
          <div style={{
            fontSize: 'var(--font-md)',
            fontStyle: 'italic',
            color: 'rgba(252, 129, 129, 0.65)',
            lineHeight: 1.6,
          }}>
            The moon is waning. A time for releasing, not starting.
          </div>
        )}

        {/* Bottom padding for scroll */}
        <div style={{ height: 20, flexShrink: 0 }} />
      </div>
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
