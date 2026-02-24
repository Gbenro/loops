// Cosmic Loops - Echoes Tab
// Journal entries tied to lunar phases

import { useState, useEffect, useMemo } from 'react';
import { MiniMoon } from '../components/MoonFace.jsx';
import { getEchoes, saveEcho as saveEchoToDb, deleteEcho as deleteEchoFromDb, generateId } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';

export function Echoes({ userId }) {
  const [echoes, setEchoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);

  // Fetch echoes on mount and when userId changes
  useEffect(() => {
    setLoading(true);
    getEchoes(userId).then(data => {
      setEchoes(data);
      setLoading(false);
    });
  }, [userId]);

  const saveEcho = async () => {
    if (!currentText.trim()) return;

    const newEcho = {
      id: generateId('e'),
      text: currentText.trim(),
      createdAt: new Date().toISOString(),
      phase: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      lunarMonth: lunarData.lunarMonth,
      dayOfCycle: lunarData.dayOfCycle,
      zodiac: lunarData.zodiac.sign,
      illumination: lunarData.illumination,
    };

    setEchoes(prev => [newEcho, ...prev]);
    setCurrentText('');
    setIsWriting(false);
    await saveEchoToDb(newEcho, userId);
  };

  const deleteEcho = async (id) => {
    setEchoes(prev => prev.filter(e => e.id !== id));
    setExpandedId(null);
    await deleteEchoFromDb(id, userId);
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
        ✧
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
            border: '1px solid rgba(245, 230, 200, 0.1)',
            borderRadius: 12,
            padding: 16,
          }}>
            <textarea
              autoFocus
              value={currentText}
              onChange={e => setCurrentText(e.target.value)}
              placeholder="What is alive in you right now? What arrived today? What are you noticing..."
              style={{
                width: '100%',
                minHeight: 120,
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

            {/* Cosmic stamp */}
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'rgba(245, 230, 200, 0.35)',
              marginTop: 12,
              marginBottom: 16,
            }}>
              {getPhaseEmoji(lunarData.phase.key)} {lunarData.phase.name} · {lunarData.zodiac.sign}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setIsWriting(false);
                  setCurrentText('');
                }}
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
                disabled={!currentText.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  background: currentText.trim()
                    ? 'rgba(245, 230, 200, 0.1)'
                    : 'rgba(245, 230, 200, 0.03)',
                  border: '1px solid rgba(245, 230, 200, 0.2)',
                  color: currentText.trim()
                    ? '#f5e6c8'
                    : 'rgba(245, 230, 200, 0.3)',
                  fontSize: 12,
                  cursor: currentText.trim() ? 'pointer' : 'default',
                }}
              >
                ECHO ↩
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsWriting(true)}
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
    </div>
  );
}

function EchoCard({ echo, isExpanded, onToggle, onDelete }) {
  const phaseNum = (echo.phase || 'new').includes('waxing')
    ? echo.illumination / 100 * 0.5
    : echo.phase === 'full'
      ? 0.5
      : 0.5 + (100 - echo.illumination) / 100 * 0.5;

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
        }}>
          {(echo.phaseName || 'MOON').toUpperCase()} · {echo.lunarMonth?.toUpperCase() || ''} · DAY {echo.dayOfCycle || '?'}
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
