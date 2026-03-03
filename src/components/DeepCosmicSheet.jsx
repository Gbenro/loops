// Cosmic Loops - Deep Cosmic Sheet
// Bottom modal with 6 sections of cosmic wisdom

import { useState } from 'react';
import { MiniMoon } from './MoonFace.jsx';
import { getPhaseContent } from '../data/phaseContent.js';
import { getZodiacInfo } from '../data/zodiacMeanings.js';
import { getLunarMonthInfo } from '../data/lunarMonths.js';
import { NATAL } from '../data/natal.js';
import { getAllPhases, getPhaseEmoji } from '../lib/lunar.js';
import { getSolarThresholds } from '../lib/solar.js';

const SECTIONS = [
  { id: 'phase', label: 'Phase', icon: '☽' },
  { id: 'moon', label: 'Moon', icon: '◐' },
  { id: 'sign', label: 'Sign', icon: '♈' },
  { id: 'season', label: 'Season', icon: '◯' },
  { id: 'weave', label: 'Weave', icon: '✧' },
  { id: 'arcs', label: 'Arcs', icon: '⟳' },
  { id: 'you', label: 'Your Sky', icon: '⚝' },
];

export function DeepCosmicSheet({
  isOpen,
  onClose,
  lunarData,
  solarData,
  resonances = [],
  phrases = {},
  phrasesLoading,
  userProfile,
}) {
  const [activeSection, setActiveSection] = useState('phase');

  if (!isOpen) return null;

  const phaseContent = getPhaseContent(lunarData.phase.key);
  const zodiacInfo = getZodiacInfo(lunarData.zodiac.sign);
  const lunarMonthInfo = getLunarMonthInfo(lunarData.lunarMonth);

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
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '84vh',
        background: '#0a0a12',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Drag handle */}
        <div
          onClick={onClose}
          style={{
            padding: '12px 0',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(245, 230, 200, 0.2)',
          }} />
        </div>

        {/* Section tabs */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '0 16px 16px',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: 'none',
                background: activeSection === s.id
                  ? 'rgba(245, 230, 200, 0.15)'
                  : 'rgba(245, 230, 200, 0.05)',
                color: activeSection === s.id
                  ? '#f5e6c8'
                  : 'rgba(245, 230, 200, 0.4)',
                fontSize: 11,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label.toUpperCase()}</span>
              {s.id === 'you' && resonances.length > 0 && (
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#A78BFA',
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 40px',
        }}>
          {activeSection === 'phase' && (
            <PhaseSection
              phase={lunarData.phase}
              content={phaseContent}
              generatedText={phrases.deepSheetPhase}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'moon' && (
            <MoonSection
              lunarData={lunarData}
              monthInfo={lunarMonthInfo}
              generatedText={phrases.deepSheetMoon}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'sign' && (
            <SignSection
              zodiac={lunarData.zodiac}
              info={zodiacInfo}
              phase={lunarData.phase}
              generatedText={phrases.deepSheetSign}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'season' && (
            <SeasonSection
              solarData={solarData}
              generatedText={phrases.deepSheetSeason}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'weave' && (
            <WeaveSection
              lunarData={lunarData}
              solarData={solarData}
              zodiacInfo={zodiacInfo}
              generatedText={phrases.deepSheetWeave}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'arcs' && (
            <ArcsSection
              solarData={solarData}
              generatedText={phrases.deepSheetArcs}
              phrasesLoading={phrasesLoading}
            />
          )}
          {activeSection === 'you' && (
            <YourSkySection
              resonances={resonances}
              generatedText={phrases.deepSheetNatal}
              phrasesLoading={phrasesLoading}
              userProfile={userProfile}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Phase Section ─────────────────────────────────────────────────────────

function PhaseSection({ phase, content, generatedText, phrasesLoading }) {
  // Use generated deep text or fallback to static content
  const deepText = generatedText || content.deep;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 8,
      }}>
        {content.symbol} {content.title}
      </h2>

      <div style={{
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
        letterSpacing: '0.1em',
        marginBottom: 24,
      }}>
        ENERGY: {content.energy.toUpperCase()}
      </div>

      {phrasesLoading ? (
        <div style={{
          height: 60,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
          opacity: 1,
          transition: 'opacity 0.4s ease',
        }}>
          {deepText}
        </p>
      )}

      {/* Keywords */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {content.keywords.map(kw => (
          <span key={kw} style={{
            padding: '6px 12px',
            borderRadius: 16,
            background: 'rgba(245, 230, 200, 0.08)',
            border: '1px solid rgba(245, 230, 200, 0.1)',
            fontSize: 11,
            color: 'rgba(245, 230, 200, 0.7)',
            fontFamily: 'monospace',
          }}>
            {kw}
          </span>
        ))}
      </div>

      {/* This phase asks */}
      <div style={{
        padding: 20,
        borderRadius: 12,
        background: 'rgba(245, 230, 200, 0.04)',
        border: '1px solid rgba(245, 230, 200, 0.08)',
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.4)',
          fontFamily: 'monospace',
          marginBottom: 8,
        }}>
          THIS PHASE ASKS
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18,
          fontStyle: 'italic',
          color: '#f5e6c8',
        }}>
          "{content.asks}"
        </div>
      </div>
    </div>
  );
}

// ─── Moon Section (Lunar Month) ────────────────────────────────────────────

function MoonSection({ lunarData, monthInfo, generatedText, phrasesLoading }) {
  const allPhases = getAllPhases();
  const displayText = generatedText || monthInfo.meaning;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 8,
      }}>
        {monthInfo.name}
      </h2>

      <div style={{
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
        marginBottom: 24,
      }}>
        {monthInfo.timing.toUpperCase()} · DAY {lunarData.dayOfCycle} OF 29
      </div>

      {phrasesLoading ? (
        <div style={{
          height: 60,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
        }}>
          {displayText}
        </p>
      )}

      {/* 8-phase timeline */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '16px 0',
        marginBottom: 16,
      }}>
        {allPhases.map((p, i) => {
          const isActive = p.key === lunarData.phase.key;
          return (
            <div
              key={p.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                opacity: isActive ? 1 : 0.35,
                transform: isActive ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              {isActive && (
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#f5e6c8',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'rgba(245, 230, 200, 0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(lunarData.age / 29.53) * 100}%`,
          height: '100%',
          background: '#f5e6c8',
          borderRadius: 2,
        }} />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 12,
        fontSize: 10,
        color: 'rgba(245, 230, 200, 0.4)',
        fontFamily: 'monospace',
      }}>
        <span>{lunarData.daysToFull}D TO FULL</span>
        <span>{lunarData.daysToNew}D TO NEW</span>
      </div>
    </div>
  );
}

// ─── Sign Section (Zodiac) ─────────────────────────────────────────────────

function SignSection({ zodiac, info, phase, generatedText, phrasesLoading }) {
  const displayText = generatedText || info.moonIn;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 8,
      }}>
        {info.symbol} Moon in {zodiac.sign}
      </h2>

      <div style={{
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
        marginBottom: 24,
      }}>
        {info.element.toUpperCase()} · {info.quality.toUpperCase()} · {zodiac.degree}°
      </div>

      {phrasesLoading ? (
        <div style={{
          height: 60,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
        }}>
          {displayText}
        </p>
      )}

      {/* Keywords */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        {info.keywords.map(kw => (
          <span key={kw} style={{
            padding: '6px 12px',
            borderRadius: 16,
            background: `${info.color}15`,
            border: `1px solid ${info.color}30`,
            fontSize: 11,
            color: info.color,
            fontFamily: 'monospace',
          }}>
            {kw}
          </span>
        ))}
      </div>

      {/* Combined reading */}
      <div style={{
        padding: 20,
        borderRadius: 12,
        background: 'rgba(245, 230, 200, 0.04)',
        border: '1px solid rgba(245, 230, 200, 0.08)',
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.4)',
          fontFamily: 'monospace',
          marginBottom: 8,
        }}>
          {phase.name.toUpperCase()} × {zodiac.sign.toUpperCase()}
        </div>
        <div style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: 'rgba(245, 230, 200, 0.8)',
        }}>
          The {phase.energy.toLowerCase()} energy of the {phase.name} meets the {info.element.toLowerCase()} nature of {zodiac.sign}. {info.moonIn}
        </div>
      </div>
    </div>
  );
}

// ─── Season Section (Solar) ────────────────────────────────────────────────

function SeasonSection({ solarData, generatedText, phrasesLoading }) {
  if (!solarData) return null;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 8,
      }}>
        {solarData.season.name}
      </h2>

      <div style={{
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
        marginBottom: 24,
      }}>
        SUN IN {solarData.sunSign.toUpperCase()}
      </div>

      {/* Generated insight */}
      {phrasesLoading ? (
        <div style={{
          height: 40,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : generatedText && (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
          fontStyle: 'italic',
        }}>
          {generatedText}
        </p>
      )}

      {/* Next solar event */}
      <div style={{
        padding: 20,
        borderRadius: 12,
        background: 'rgba(245, 230, 200, 0.04)',
        border: '1px solid rgba(245, 230, 200, 0.08)',
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.4)',
          fontFamily: 'monospace',
          marginBottom: 8,
        }}>
          APPROACHING · {solarData.season.daysToNext} DAYS
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 20,
          color: '#f5e6c8',
          marginBottom: 8,
        }}>
          {solarData.season.nextEvent}
        </div>
        <div style={{
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.7)',
          fontStyle: 'italic',
        }}>
          {solarData.season.meaning}
        </div>
      </div>

      {/* Season progress */}
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'rgba(245, 230, 200, 0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${solarData.season.progress}%`,
          height: '100%',
          background: '#FBBF24',
          borderRadius: 2,
        }} />
      </div>
      <div style={{
        textAlign: 'center',
        marginTop: 8,
        fontSize: 10,
        color: 'rgba(245, 230, 200, 0.4)',
        fontFamily: 'monospace',
      }}>
        {solarData.season.progress}% THROUGH {solarData.season.name.toUpperCase()}
      </div>
    </div>
  );
}

// ─── Weave Section (Synthesis) ─────────────────────────────────────────────

function WeaveSection({ lunarData, solarData, zodiacInfo, generatedText, phrasesLoading }) {
  const fallbackText = `The ${lunarData.phase.name} arrives in ${lunarData.zodiac.sign}, carrying ${zodiacInfo?.element || 'cosmic'} energy into the ${lunarData.lunarMonth} Moon cycle. ${lunarData.phase.isWaning
    ? 'This is a time for release, reflection, and completion. Let what needs to end, end.'
    : 'This is a time for building, creating, and moving forward. Energy supports action.'}${solarData ? ` The ${solarData.season.name} season deepens this ${lunarData.phase.energy.toLowerCase()} energy.` : ''}`;

  const displayText = generatedText || fallbackText;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 24,
      }}>
        The Weave
      </h2>

      {/* All circles as pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <Pill>{lunarData.phase.name}</Pill>
        <Pill>{lunarData.zodiac.sign}</Pill>
        <Pill>{lunarData.lunarMonth} Moon</Pill>
        {solarData && <Pill>{solarData.season.name}</Pill>}
      </div>

      {/* The Reading */}
      <div style={{
        padding: 24,
        borderRadius: 16,
        background: 'rgba(167, 139, 250, 0.06)',
        border: '1px solid rgba(167, 139, 250, 0.15)',
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.4)',
          fontFamily: 'monospace',
          marginBottom: 12,
        }}>
          THE READING FOR NOW
        </div>
        {phrasesLoading ? (
          <div style={{
            height: 80,
            background: 'rgba(245, 230, 200, 0.1)',
            borderRadius: 4,
            opacity: 0.3,
          }} />
        ) : (
          <p style={{
            fontSize: 15,
            lineHeight: 1.9,
            color: 'rgba(245, 230, 200, 0.9)',
            fontFamily: "'Cormorant Garamond', serif",
          }}>
            {displayText}
          </p>
        )}
      </div>

      {/* Larger Horizon */}
      <div style={{
        display: 'flex',
        gap: 16,
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
      }}>
        <div>{lunarData.daysToNew}D TO NEW MOON</div>
        {solarData && <div>{solarData.season.daysToNext}D TO {solarData.season.nextEvent.toUpperCase()}</div>}
      </div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span style={{
      padding: '6px 14px',
      borderRadius: 20,
      background: 'rgba(245, 230, 200, 0.08)',
      border: '1px solid rgba(245, 230, 200, 0.12)',
      fontSize: 12,
      color: '#f5e6c8',
    }}>
      {children}
    </span>
  );
}

// ─── Your Sky Section (Natal) ──────────────────────────────────────────────

const SIGN_SYMBOLS = {
  'Aries': '♈', 'Taurus': '♉', 'Gemini': '♊', 'Cancer': '♋',
  'Leo': '♌', 'Virgo': '♍', 'Libra': '♎', 'Scorpio': '♏',
  'Sagittarius': '♐', 'Capricorn': '♑', 'Aquarius': '♒', 'Pisces': '♓',
};

const SIGN_DESCRIPTIONS = {
  'Aries': 'Bold, pioneering energy. You initiate and lead.',
  'Taurus': 'Grounded, sensual nature. You build and sustain.',
  'Gemini': 'Curious, communicative spirit. You connect and explore.',
  'Cancer': 'Nurturing, intuitive depth. You protect and feel.',
  'Leo': 'Creative, radiant presence. You shine and inspire.',
  'Virgo': 'Analytical, devoted care. You refine and serve.',
  'Libra': 'Harmonious, diplomatic grace. You balance and relate.',
  'Scorpio': 'Intense, transformative power. You probe and regenerate.',
  'Sagittarius': 'Expansive, philosophical vision. You seek and teach.',
  'Capricorn': 'Ambitious, structured wisdom. You build and achieve.',
  'Aquarius': 'Innovative, humanitarian spirit. You envision and liberate.',
  'Pisces': 'Mystical, compassionate soul. You dissolve and transcend.',
};

function YourSkySection({ resonances = [], generatedText, phrasesLoading, userProfile }) {
  // Use user's profile signs or fall back to defaults from NATAL
  const sunSign = userProfile?.sun_sign || NATAL.sun.sign;
  const moonSign = userProfile?.moon_sign || NATAL.moon.sign;
  const risingSign = userProfile?.rising_sign || NATAL.rising.sign;

  const placements = [
    { key: 'sun', label: 'Sun', sign: sunSign, role: 'Identity', symbol: '☉' },
    { key: 'moon', label: 'Moon', sign: moonSign, role: 'Inner World', symbol: '☽' },
    { key: 'rising', label: 'Rising', sign: risingSign, role: 'First Impression', symbol: '↑' },
  ];

  const hasProfile = userProfile?.sun_sign || userProfile?.moon_sign || userProfile?.rising_sign;

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 16,
      }}>
        Your Sky
      </h2>

      {/* Generated insight */}
      {phrasesLoading ? (
        <div style={{
          height: 40,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : generatedText && (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
          fontStyle: 'italic',
        }}>
          {generatedText}
        </p>
      )}

      {/* Big Three */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {placements.map(p => (
          <div
            key={p.key}
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(245, 230, 200, 0.04)',
              border: '1px solid rgba(245, 230, 200, 0.08)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 20 }}>{SIGN_SYMBOLS[p.sign] || p.symbol}</span>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 18,
                color: '#f5e6c8',
              }}>
                {p.sign} {p.label}
              </span>
              <span style={{
                fontSize: 10,
                color: 'rgba(245, 230, 200, 0.4)',
                fontFamily: 'monospace',
                marginLeft: 'auto',
              }}>
                {p.role.toUpperCase()}
              </span>
            </div>
            <p style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'rgba(245, 230, 200, 0.7)',
              margin: 0,
            }}>
              {SIGN_DESCRIPTIONS[p.sign] || 'Your cosmic placement.'}
            </p>
          </div>
        ))}
      </div>

      {/* Active Resonances */}
      <div style={{
        fontSize: 10,
        color: 'rgba(245, 230, 200, 0.4)',
        fontFamily: 'monospace',
        marginBottom: 12,
      }}>
        THE SKY & YOU · RIGHT NOW
      </div>

      {resonances.length === 0 ? (
        <p style={{
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.6)',
          fontStyle: 'italic',
        }}>
          A quiet cosmic day. The sky makes no strong aspects to your chart.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resonances.map((r, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: 12,
                background: r.strength === 'HIGH'
                  ? 'rgba(167, 139, 250, 0.1)'
                  : 'rgba(245, 230, 200, 0.04)',
                border: `1px solid ${r.strength === 'HIGH'
                  ? 'rgba(167, 139, 250, 0.25)'
                  : 'rgba(245, 230, 200, 0.08)'}`,
              }}
            >
              {r.strength === 'HIGH' && (
                <div style={{
                  fontSize: 9,
                  color: '#A78BFA',
                  fontFamily: 'monospace',
                  marginBottom: 6,
                }}>
                  STRONG TRANSIT
                </div>
              )}
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                color: '#f5e6c8',
                marginBottom: 4,
              }}>
                {r.description}
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(245, 230, 200, 0.6)',
                fontStyle: 'italic',
              }}>
                {r.meaning}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!hasProfile && (
        <div style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid rgba(245, 230, 200, 0.08)',
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.3)',
          fontFamily: 'monospace',
          textAlign: 'center',
        }}>
          Set your signs in Settings → Your Sky for personalized transits
        </div>
      )}
    </div>
  );
}

// ─── Arcs Section (Larger Cycles) ───────────────────────────────────────────

function ArcsSection({ solarData, generatedText, phrasesLoading }) {
  const thresholds = getSolarThresholds();
  // Use solar day of year (Winter Solstice = Day 1)
  const solarDay = solarData?.solarDayOfYear || 1;
  const daysInYear = 365;

  // Find which thresholds are passed (using solarDay)
  const passedThresholds = thresholds.filter(t => t.solarDay <= solarDay);

  return (
    <div>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28,
        fontWeight: 600,
        color: '#f5e6c8',
        marginBottom: 8,
      }}>
        Background Arcs
      </h2>

      <div style={{
        fontSize: 11,
        color: 'rgba(245, 230, 200, 0.5)',
        fontFamily: 'monospace',
        marginBottom: 16,
      }}>
        THE LARGER CYCLES BEHIND YOUR DAYS
      </div>

      {/* Generated insight */}
      {phrasesLoading ? (
        <div style={{
          height: 40,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 24,
        }} />
      ) : generatedText && (
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 24,
          fontStyle: 'italic',
        }}>
          {generatedText}
        </p>
      )}

      {/* Solar Year Card */}
      <div style={{
        padding: 20,
        borderRadius: 14,
        background: 'rgba(251, 191, 36, 0.04)',
        border: '1px solid rgba(251, 191, 36, 0.12)',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 22 }}>☀</span>
          <span style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(251, 191, 36, 0.8)',
          }}>
            SOLAR YEAR · 365 DAYS · 8 THRESHOLDS
          </span>
        </div>

        <div style={{
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.85)',
          marginBottom: 14,
          lineHeight: 1.5,
        }}>
          Between {solarData?.lastThresholdName || 'threshold'} and {solarData?.nextThresholdName || 'threshold'} — Day {solarDay} of 365
        </div>

        {/* Progress bar */}
        <div style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(245, 230, 200, 0.1)',
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <div style={{
            width: `${(solarData?.solarYearPct || 0) * 100}%`,
            height: '100%',
            background: '#FBBF24',
            borderRadius: 2,
          }} />
        </div>

        {/* Threshold pills */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {thresholds.map((t, i) => {
            const isPassed = passedThresholds.includes(t);
            const isCurrent = t.name === solarData?.lastThresholdName;
            const isNext = t.name === solarData?.nextThresholdName;
            return (
              <span
                key={t.name}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontFamily: 'monospace',
                  background: isCurrent
                    ? 'rgba(251, 191, 36, 0.15)'
                    : isPassed
                      ? 'rgba(245, 230, 200, 0.08)'
                      : 'transparent',
                  border: isNext
                    ? '1px dashed rgba(251, 191, 36, 0.4)'
                    : '1px solid transparent',
                  color: isCurrent
                    ? '#FBBF24'
                    : isPassed
                      ? 'rgba(245, 230, 200, 0.5)'
                      : 'rgba(245, 230, 200, 0.25)',
                }}
              >
                {isPassed && !isCurrent && '✓ '}
                {isCurrent && '● '}
                {isNext && '→ '}
                {t.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Solar Cycle Card */}
      <div style={{
        padding: 20,
        borderRadius: 14,
        background: 'rgba(96, 165, 250, 0.04)',
        border: '1px solid rgba(96, 165, 250, 0.12)',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(96, 165, 250, 0.8)',
          }}>
            SOLAR CYCLE 25 · ~11 YEARS
          </span>
        </div>

        <div style={{
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.85)',
          lineHeight: 1.7,
        }}>
          Near maximum. Peak electromagnetic output. The collective nervous system is measurably more activated than usual.
        </div>
      </div>

      {/* Precessional Age Card */}
      <div style={{
        padding: 20,
        borderRadius: 14,
        background: 'rgba(167, 139, 250, 0.04)',
        border: '1px solid rgba(167, 139, 250, 0.12)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 22 }}>♒</span>
          <span style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(167, 139, 250, 0.8)',
          }}>
            PRECESSIONAL AGE · ~2,160 YEARS
          </span>
        </div>

        <div style={{
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.85)',
          lineHeight: 1.7,
        }}>
          Pisces → Aquarius transition. Seed moment of an age organised around individual sovereignty and conscious relationship with time.
        </div>
      </div>
    </div>
  );
}
