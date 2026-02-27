// Cosmic Loops - Echoes Tab
// Journal entries tied to lunar phases with voice input

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MiniMoon } from '../components/MoonFace.jsx';
import { getEchoes, saveEcho as saveEchoToDb, deleteEcho as deleteEchoFromDb, generateId } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';

// Phase-specific voice prompts
const VOICE_PROMPTS = {
  'new': 'Speak your intention...',
  'waxing-crescent': 'What wants to move?',
  'first-quarter': 'What decision is forming?',
  'waxing-gibbous': 'What do you notice?',
  'full': 'What is being revealed?',
  'waning-gibbous': 'What wants to be shared?',
  'last-quarter': 'What are you releasing?',
  'waning-crescent': 'What needs to rest?',
};

// Phase type lookup - Threshold (pivotal) vs Flow (sustained)
const PHASE_TYPES = {
  'new': 'threshold',
  'waxing-crescent': 'flow',
  'first-quarter': 'threshold',
  'waxing-gibbous': 'flow',
  'full': 'threshold',
  'waning-gibbous': 'flow',
  'last-quarter': 'threshold',
  'waning-crescent': 'flow',
};

// Get phase type from phase key (for echoes that don't have it stored)
function getPhaseType(phaseKey) {
  return PHASE_TYPES[phaseKey] || 'flow';
}

export function Echoes({ userId }) {
  const [echoes, setEchoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [source, setSource] = useState('text'); // 'text' | 'voice'

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);
  const voicePrompt = VOICE_PROMPTS[lunarData.phase.key] || 'Speak your reflection...';

  // Check for Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          setCurrentText(prev => prev + final);
        }
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'aborted') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Only stop if not manually stopping
        if (isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Toggle voice listening
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
    } else {
      setSource('voice');
      setIsWriting(true);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Could not start recognition:', e);
      }
    }
  }, [isListening]);

  // Fetch echoes on mount
  useEffect(() => {
    setLoading(true);
    getEchoes(userId).then(data => {
      setEchoes(data);
      setLoading(false);
    });
  }, [userId]);

  const saveEcho = async () => {
    if (!currentText.trim()) return;

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const newEcho = {
      id: generateId('e'),
      text: currentText.trim(),
      source,
      createdAt: new Date().toISOString(),
      phase: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      phaseType: lunarData.phase.phaseType, // 'threshold' | 'flow'
      lunarMonth: lunarData.lunarMonth,
      dayOfCycle: lunarData.dayOfCycle,
      zodiac: lunarData.zodiac.sign,
      illumination: lunarData.illumination,
    };

    setEchoes(prev => [newEcho, ...prev]);
    setCurrentText('');
    setInterimText('');
    setIsWriting(false);
    setSource('text');
    await saveEchoToDb(newEcho, userId);
  };

  const deleteEcho = async (id) => {
    setEchoes(prev => prev.filter(e => e.id !== id));
    setExpandedId(null);
    await deleteEchoFromDb(id, userId);
  };

  const cancelWriting = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    setIsWriting(false);
    setCurrentText('');
    setInterimText('');
    setSource('text');
  };

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040810',
        color: 'rgba(245, 230, 200, 0.4)',
        fontSize: 18,
      }}>
        〜
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#040810',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26,
          color: '#f5e6c8',
          marginBottom: 8,
        }}>
          Echoes
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: 'rgba(245, 230, 200, 0.4)',
        }}>
          {getPhaseEmoji(lunarData.phase.key)} {lunarData.phase.name.toUpperCase()} · DAY {lunarData.dayOfCycle}
        </div>
      </div>

      {/* Write Area */}
      <div style={{ padding: '0 20px 20px' }}>
        {isWriting ? (
          <div style={{
            background: 'rgba(245, 230, 200, 0.03)',
            border: `1px solid ${isListening ? 'rgba(167, 139, 250, 0.3)' : 'rgba(245, 230, 200, 0.1)'}`,
            borderRadius: 12,
            padding: 16,
            transition: 'border-color 0.3s',
          }}>
            {/* Listening indicator */}
            {isListening && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: '#A78BFA',
              }}>
                <div style={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  height: 16,
                }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 2,
                        height: 8,
                        background: '#A78BFA',
                        borderRadius: 1,
                        animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                }}>
                  LISTENING · TAP ORB TO FINISH
                </span>
              </div>
            )}

            {/* Voice prompt when listening with no text */}
            {isListening && !currentText && !interimText && (
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                fontStyle: 'italic',
                color: 'rgba(167, 139, 250, 0.5)',
                marginBottom: 12,
              }}>
                {voicePrompt}
              </div>
            )}

            <textarea
              autoFocus={!isListening}
              value={currentText}
              onChange={e => {
                setCurrentText(e.target.value);
                setSource('text');
              }}
              readOnly={isListening}
              placeholder={isListening ? '' : "What is alive in you right now? What arrived today? What are you noticing..."}
              style={{
                width: '100%',
                minHeight: 100,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f5e6c8',
                fontSize: 15,
                fontFamily: "'Cormorant Garamond', serif",
                lineHeight: 1.7,
                resize: 'none',
              }}
            />

            {/* Interim text (live transcription) */}
            {interimText && (
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
                fontStyle: 'italic',
                color: 'rgba(167, 139, 250, 0.5)',
                lineHeight: 1.7,
              }}>
                {interimText}
              </div>
            )}

            {/* Cosmic stamp with phase type */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'rgba(245, 230, 200, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>{getPhaseEmoji(lunarData.phase.key)} {lunarData.phase.name}</span>
                <span style={{
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: lunarData.phase.isThreshold
                    ? 'rgba(245, 230, 200, 0.08)'
                    : 'rgba(201, 168, 76, 0.1)',
                  color: lunarData.phase.isThreshold
                    ? 'rgba(245, 230, 200, 0.5)'
                    : 'rgba(201, 168, 76, 0.7)',
                  fontSize: 7,
                  letterSpacing: '0.05em',
                }}>
                  {lunarData.phase.isThreshold ? 'THRESHOLD' : 'FLOW'}
                </span>
                <span>· {lunarData.zodiac.sign} · Day {lunarData.dayOfCycle}</span>
              </div>

              {/* Voice orb */}
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: 'none',
                    background: isListening
                      ? 'rgba(167, 139, 250, 0.2)'
                      : 'rgba(245, 230, 200, 0.08)',
                    color: isListening ? '#A78BFA' : 'rgba(245, 230, 200, 0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    position: 'relative',
                    animation: isListening ? 'voiceOrb 2s ease-in-out infinite' : 'none',
                    boxShadow: isListening
                      ? '0 0 20px rgba(167, 139, 250, 0.3)'
                      : 'none',
                    transition: 'all 0.3s',
                  }}
                >
                  {isListening ? '◉' : '◎'}
                  {/* Ripple effect when listening */}
                  {isListening && (
                    <div style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      border: '2px solid rgba(167, 139, 250, 0.3)',
                      animation: 'ripple 1.5s ease-out infinite',
                    }} />
                  )}
                </button>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={cancelWriting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(245, 230, 200, 0.15)',
                  color: 'rgba(245, 230, 200, 0.5)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEcho}
                disabled={!currentText.trim() && !interimText.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  background: (currentText.trim() || interimText.trim())
                    ? 'rgba(245, 230, 200, 0.1)'
                    : 'rgba(245, 230, 200, 0.03)',
                  border: '1px solid rgba(245, 230, 200, 0.2)',
                  color: (currentText.trim() || interimText.trim())
                    ? '#f5e6c8'
                    : 'rgba(245, 230, 200, 0.3)',
                  fontSize: 12,
                  cursor: (currentText.trim() || interimText.trim()) ? 'pointer' : 'default',
                }}
              >
                ECHO ↩
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsWriting(true);
              setSource('text');
            }}
            style={{
              width: '100%',
              padding: '20px',
              borderRadius: 12,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px dashed rgba(245, 230, 200, 0.15)',
              color: 'rgba(245, 230, 200, 0.4)',
              fontSize: 14,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            "{phaseContent.asks}"
          </button>
        )}
      </div>

      {/* Echoes List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px 40px',
      }}>
        {echoes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(245, 230, 200, 0.3)',
            fontSize: 14,
            fontStyle: 'italic',
          }}>
            No echoes yet. What is alive in you?
          </div>
        ) : (
          echoes.map(echo => (
            <EchoCard
              key={echo.id}
              echo={echo}
              isExpanded={expandedId === echo.id}
              onToggle={() => setExpandedId(expandedId === echo.id ? null : echo.id)}
              onDelete={() => deleteEcho(echo.id)}
            />
          ))
        )}
      </div>

      {/* Voice animations */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(2.2); }
        }
        @keyframes voiceOrb {
          0%, 100% { box-shadow: 0 0 15px rgba(167, 139, 250, 0.3); }
          50% { box-shadow: 0 0 25px rgba(167, 139, 250, 0.5); }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function EchoCard({ echo, isExpanded, onToggle, onDelete }) {
  const phaseNum = (echo.phase || 'new').includes('waxing')
    ? echo.illumination / 100 * 0.5
    : echo.phase === 'full'
      ? 0.5
      : 0.5 + (100 - echo.illumination) / 100 * 0.5;

  // Derive phase type from stored value or phase key
  const phaseType = echo.phaseType || getPhaseType(echo.phase);
  const isThreshold = phaseType === 'threshold';

  return (
    <div style={{
      background: 'rgba(245, 230, 200, 0.025)',
      border: '1px solid rgba(245, 230, 200, 0.06)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
      }}>
        <MiniMoon size={20} phase={phaseNum} />
        <div style={{
          flex: 1,
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          color: 'rgba(245, 230, 200, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{(echo.phaseName || 'MOON').toUpperCase()} · {isThreshold ? 'THR' : 'FLW'} · {echo.zodiac || ''} · DAY {echo.dayOfCycle || '?'}</span>
          {echo.source === 'voice' && (
            <span style={{
              padding: '1px 4px',
              borderRadius: 3,
              background: 'rgba(167, 139, 250, 0.15)',
              color: 'rgba(167, 139, 250, 0.7)',
              fontSize: 7,
              letterSpacing: '0.05em',
            }}>
              VOICE
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245, 230, 200, 0.3)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 8px',
          }}
        >
          ···
        </button>
      </div>

      {/* Text */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 15,
        lineHeight: 1.76,
        color: 'rgba(245, 230, 200, 0.85)',
      }}>
        {echo.text}
      </div>

      {/* Expanded info */}
      {isExpanded && (
        <div style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid rgba(245, 230, 200, 0.06)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'rgba(245, 230, 200, 0.3)',
            }}>
              {new Date(echo.createdAt).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {' · '}
              {echo.zodiac}
            </div>
            <button
              onClick={onDelete}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(252, 129, 129, 0.6)',
                fontSize: 10,
                fontFamily: 'monospace',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              DELETE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
