// Luna Loops - New Moon Ritual
// Ceremonial screen for setting cycle intention at New Moon

import { useState } from 'react';
import { getLunarMonthInfo } from '../data/lunarMonths.js';

const FALLBACK_QUESTION = 'What wants to be born through me this cycle?';

export function NewMoonRitual({ lunarData, onSetIntention, onDismiss, newMoonQuestion, phrasesLoading, hemisphere = 'north' }) {
  const [intention, setIntention] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Use generated question if available and not null
  const question = (newMoonQuestion && newMoonQuestion !== 'null')
    ? newMoonQuestion
    : FALLBACK_QUESTION;

  const handleSetIntention = () => {
    if (!intention.trim()) return;
    onSetIntention(intention.trim());
  };

  const handleDismiss = () => {
    setIsClosing(true);
    // Calculate when New Moon ends
    const newMoonEnds = new Date();
    newMoonEnds.setDate(newMoonEnds.getDate() + Math.ceil(1.85 - lunarData.age));
    onDismiss(newMoonEnds);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: '#020408',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Ambient glow behind moon */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(245,230,200,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Moon glyph */}
      <div style={{
        fontSize: 72,
        marginBottom: 16,
        filter: 'drop-shadow(0 0 30px rgba(245,230,200,0.15))',
        animation: 'breathe 4s ease-in-out infinite',
      }}>
        🌑
      </div>

      {/* Label */}
      <div style={{
        fontSize: 10,
        fontFamily: 'monospace',
        letterSpacing: '0.2em',
        color: 'rgba(245, 230, 200, 0.4)',
        marginBottom: 40,
      }}>
        NEW MOON · {getLunarMonthInfo(lunarData.lunarMonth, hemisphere).name.toUpperCase()}
      </div>

      {/* The Question */}
      {phrasesLoading ? (
        <div style={{
          width: '80%',
          maxWidth: 280,
          height: 32,
          background: 'rgba(245, 230, 200, 0.1)',
          borderRadius: 4,
          opacity: 0.3,
          marginBottom: 40,
        }} />
      ) : (
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 24,
          fontStyle: 'italic',
          color: '#f5e6c8',
          textAlign: 'center',
          lineHeight: 1.5,
          marginBottom: 40,
          maxWidth: 320,
          opacity: 1,
          transition: 'opacity 0.4s ease',
        }}>
          {question}
        </div>
      )}

      {/* Intention Input */}
      <textarea
        autoFocus
        value={intention}
        onChange={e => setIntention(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 360,
          minHeight: 120,
          padding: 20,
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(245, 230, 200, 0.1)',
          color: '#f5e6c8',
          fontSize: 18,
          fontFamily: "'Cormorant Garamond', serif",
          lineHeight: 1.6,
          textAlign: 'center',
          outline: 'none',
          resize: 'none',
        }}
        placeholder=""
      />

      {/* Set Intention Button */}
      <button
        onClick={handleSetIntention}
        disabled={!intention.trim()}
        style={{
          marginTop: 40,
          padding: '16px 40px',
          background: intention.trim()
            ? 'rgba(245, 230, 200, 0.08)'
            : 'transparent',
          border: `1px solid ${intention.trim()
            ? 'rgba(245, 230, 200, 0.2)'
            : 'rgba(245, 230, 200, 0.08)'}`,
          borderRadius: 30,
          color: intention.trim()
            ? '#f5e6c8'
            : 'rgba(245, 230, 200, 0.25)',
          fontSize: 12,
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          cursor: intention.trim() ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
        }}
      >
        SET INTENTION
      </button>

      {/* Dismiss option */}
      <button
        onClick={handleDismiss}
        style={{
          marginTop: 24,
          padding: '10px 20px',
          background: 'none',
          border: 'none',
          color: 'rgba(245, 230, 200, 0.2)',
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        NOT NOW
      </button>

      {/* Closing notice */}
      {isClosing && (
        <div style={{
          position: 'absolute',
          bottom: 60,
          left: 20,
          right: 20,
          textAlign: 'center',
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: 14,
          color: 'rgba(245, 230, 200, 0.5)',
          lineHeight: 1.6,
        }}>
          The New Moon lasts until day {Math.ceil(1.85 - lunarData.age + 1)}. You can return.
        </div>
      )}
    </div>
  );
}
