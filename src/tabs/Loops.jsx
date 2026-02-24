// Cosmic Loops - Loops Tab
// Loop management aligned to lunar phases

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ring } from '../components/Ring.jsx';
import { storage } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';

// Color palette
const COLORS = [
  '#FF6B35', '#A78BFA', '#60A5FA', '#34D399',
  '#F472B6', '#FBBF24', '#FB7185', '#38BDF8'
];

export function Loops() {
  const [loops, setLoops] = useState(() => storage.getLoops());
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);

  // Save loops when changed
  useEffect(() => {
    storage.saveLoops(loops);
  }, [loops]);

  // Calculate loop completion percentage
  const getLoopPct = useCallback((loop) => {
    if (!loop.subtasks || loop.subtasks.length === 0) return loop.closed ? 100 : 0;
    const done = loop.subtasks.filter(s => s.done).length;
    return Math.round((done / loop.subtasks.length) * 100);
  }, []);

  // Create new loop
  const createLoop = (loop) => {
    const newLoop = {
      ...loop,
      id: storage.generateId('l'),
      createdAt: new Date().toISOString(),
      phaseOpened: lunarData.phase.key,
      lunarMonthOpened: lunarData.lunarMonth,
      moonAgeOpened: lunarData.age,
      closed: false,
      subtasks: [],
    };
    setLoops(prev => [newLoop, ...prev]);
    setShowCreate(false);
    setSelected(newLoop);
    setShowDetail(true);
  };

  // Toggle loop closed
  const toggleLoop = (id) => {
    setLoops(prev => prev.map(l =>
      l.id === id ? { ...l, closed: !l.closed } : l
    ));
  };

  // Update loop
  const updateLoop = (id, updates) => {
    setLoops(prev => prev.map(l =>
      l.id === id ? { ...l, ...updates } : l
    ));
    if (selected?.id === id) {
      setSelected(prev => ({ ...prev, ...updates }));
    }
  };

  // Delete loop
  const deleteLoop = (id) => {
    setLoops(prev => prev.filter(l => l.id !== id));
    setSelected(null);
    setShowDetail(false);
  };

  // Toggle subtask
  const toggleSubtask = (loopId, subtaskId) => {
    setLoops(prev => prev.map(l => {
      if (l.id !== loopId) return l;
      return {
        ...l,
        subtasks: l.subtasks.map(s =>
          s.id === subtaskId ? { ...s, done: !s.done } : s
        ),
      };
    }));
    // Update selected
    if (selected?.id === loopId) {
      setSelected(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(s =>
          s.id === subtaskId ? { ...s, done: !s.done } : s
        ),
      }));
    }
  };

  // Add subtask
  const addSubtask = (loopId, text) => {
    const newSubtask = {
      id: storage.generateId('s'),
      text,
      done: false,
    };
    setLoops(prev => prev.map(l => {
      if (l.id !== loopId) return l;
      return { ...l, subtasks: [...l.subtasks, newSubtask] };
    }));
    if (selected?.id === loopId) {
      setSelected(prev => ({
        ...prev,
        subtasks: [...prev.subtasks, newSubtask],
      }));
    }
  };

  // Filter active loops
  const activeLoops = loops.filter(l => !l.closed);
  const closedLoops = loops.filter(l => l.closed);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#040810',
    }}>
      {/* Cosmic Guidance Banner */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(245, 230, 200, 0.03)',
        borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 18 }}>{getPhaseEmoji(lunarData.phase.key)}</span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 16,
            color: '#f5e6c8',
          }}>
            {lunarData.phase.name}
          </span>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.4)',
            marginLeft: 'auto',
          }}>
            {phaseContent.energy.toUpperCase()}
          </span>
        </div>
        <div style={{
          fontSize: 13,
          fontStyle: 'italic',
          color: 'rgba(245, 230, 200, 0.6)',
          lineHeight: 1.5,
        }}>
          {phaseContent.loopAdvice}
        </div>
      </div>

      {/* Lunar Cycle Progress */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
            color: 'rgba(245, 230, 200, 0.4)',
          }}>
            {lunarData.lunarMonth.toUpperCase()} MOON CYCLE
          </span>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.35)',
          }}>
            DAY {lunarData.dayOfCycle} OF 29
          </span>
        </div>
        <div style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(245, 230, 200, 0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(lunarData.age / 29.53) * 100}%`,
            height: '100%',
            background: 'rgba(245, 230, 200, 0.4)',
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Waning Banner */}
      {lunarData.phase.isWaning && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(252, 129, 129, 0.06)',
          borderBottom: '1px solid rgba(252, 129, 129, 0.1)',
        }}>
          <div style={{
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(252, 129, 129, 0.65)',
            lineHeight: 1.5,
          }}>
            Waning phase — the cosmos supports closing, not opening. Let loops complete naturally.
          </div>
        </div>
      )}

      {/* Loop List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
      }}>
        {/* Active Loops */}
        {activeLoops.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: 'rgba(245, 230, 200, 0.35)',
              marginBottom: 12,
            }}>
              ACTIVE LOOPS
            </div>
            {activeLoops.map(loop => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={getLoopPct(loop)}
                onSelect={() => {
                  setSelected(loop);
                  setShowDetail(true);
                }}
                onToggle={() => toggleLoop(loop.id)}
              />
            ))}
          </div>
        )}

        {/* Closed Loops */}
        {closedLoops.length > 0 && (
          <div>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: 'rgba(245, 230, 200, 0.25)',
              marginBottom: 12,
            }}>
              CLOSED
            </div>
            {closedLoops.map(loop => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={100}
                closed
                onSelect={() => {
                  setSelected(loop);
                  setShowDetail(true);
                }}
                onToggle={() => toggleLoop(loop.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {loops.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(245, 230, 200, 0.3)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>◯</div>
            <div style={{ fontSize: 14, fontStyle: 'italic' }}>
              No loops yet. What do you want to build?
            </div>
          </div>
        )}
      </div>

      {/* Add Loop Button */}
      <div style={{
        padding: '16px 20px',
        paddingBottom: '20px',
        borderTop: '1px solid rgba(245, 230, 200, 0.06)',
      }}>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            background: lunarData.phase.isWaning
              ? 'transparent'
              : 'rgba(245, 230, 200, 0.06)',
            border: lunarData.phase.isWaning
              ? '1px dashed rgba(245, 230, 200, 0.1)'
              : '1px solid rgba(245, 230, 200, 0.12)',
            color: lunarData.phase.isWaning
              ? 'rgba(245, 230, 200, 0.25)'
              : 'rgba(245, 230, 200, 0.7)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {lunarData.phase.isWaning
            ? '〰 Rest. The cycle is releasing...'
            : '+ open a new loop'
          }
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={createLoop}
          lunarData={lunarData}
        />
      )}

      {/* Detail Panel */}
      {showDetail && selected && (
        <DetailPanel
          loop={selected}
          pct={getLoopPct(selected)}
          onClose={() => {
            setShowDetail(false);
            setSelected(null);
          }}
          onToggle={() => toggleLoop(selected.id)}
          onDelete={() => deleteLoop(selected.id)}
          onToggleSubtask={(subtaskId) => toggleSubtask(selected.id, subtaskId)}
          onAddSubtask={(text) => addSubtask(selected.id, text)}
        />
      )}
    </div>
  );
}

// ─── Loop Card ─────────────────────────────────────────────────────────────

function LoopCard({ loop, pct, closed, onSelect, onToggle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'rgba(245, 230, 200, 0.025)',
        border: '1px solid rgba(245, 230, 200, 0.06)',
        borderRadius: 12,
        marginBottom: 10,
        opacity: closed ? 0.5 : 1,
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <Ring
        pct={pct}
        color={loop.color || '#A78BFA'}
        size={40}
        stroke={3}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 16,
          color: '#f5e6c8',
          marginBottom: 4,
          textDecoration: closed ? 'line-through' : 'none',
          opacity: closed ? 0.6 : 1,
        }}>
          {loop.title}
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          fontSize: 9,
          fontFamily: 'monospace',
          color: 'rgba(245, 230, 200, 0.4)',
        }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(245, 230, 200, 0.06)',
          }}>
            {loop.type === 'windowed' ? '◷' : '∞'} {loop.type?.toUpperCase() || 'OPEN'}
          </span>
          {loop.recurrence && (
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(245, 230, 200, 0.06)',
            }}>
              ↻ {loop.recurrence.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `2px solid ${closed ? '#34D399' : 'rgba(245, 230, 200, 0.2)'}`,
          background: closed ? '#34D399' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: closed ? '#040810' : 'transparent',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {closed && '✓'}
      </button>
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate, lunarData }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('open');
  const [recurrence, setRecurrence] = useState(null);
  const [color, setColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      type,
      recurrence,
      color,
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

      {/* Modal */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0a0a12',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: '24px 20px 40px',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(245, 230, 200, 0.2)',
          margin: '0 auto 24px',
        }} />

        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22,
          color: '#f5e6c8',
          marginBottom: 24,
          textAlign: 'center',
        }}>
          Open a Loop
        </div>

        {/* Title input */}
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What do you want to build?"
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid rgba(245, 230, 200, 0.15)',
            background: 'rgba(245, 230, 200, 0.04)',
            color: '#f5e6c8',
            fontSize: 16,
            fontFamily: "'Cormorant Garamond', serif",
            outline: 'none',
            marginBottom: 20,
          }}
        />

        {/* Type selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.4)',
            marginBottom: 10,
          }}>
            TYPE
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['open', 'windowed'].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  border: `1px solid ${type === t
                    ? 'rgba(245, 230, 200, 0.3)'
                    : 'rgba(245, 230, 200, 0.1)'}`,
                  background: type === t
                    ? 'rgba(245, 230, 200, 0.08)'
                    : 'transparent',
                  color: type === t
                    ? '#f5e6c8'
                    : 'rgba(245, 230, 200, 0.5)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                {t === 'open' ? '∞ OPEN' : '◷ WINDOWED'}
              </button>
            ))}
          </div>
        </div>

        {/* Color selection */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.4)',
            marginBottom: 10,
          }}>
            COLOR
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
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
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 10,
              border: '1px solid rgba(245, 230, 200, 0.15)',
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
              borderRadius: 10,
              border: 'none',
              background: title.trim() ? color : 'rgba(245, 230, 200, 0.1)',
              color: title.trim() ? '#040810' : 'rgba(245, 230, 200, 0.3)',
              fontSize: 13,
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'default',
            }}
          >
            Open Loop
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────

function DetailPanel({ loop, pct, onClose, onToggle, onDelete, onToggleSubtask, onAddSubtask }) {
  const [newSubtask, setNewSubtask] = useState('');

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(newSubtask.trim());
    setNewSubtask('');
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

      {/* Panel */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '85vh',
        background: '#0a0a12',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(245, 230, 200, 0.08)',
        }}>
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(245, 230, 200, 0.2)',
            margin: '0 auto 20px',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <Ring
              pct={pct}
              color={loop.color || '#A78BFA'}
              size={56}
              stroke={4}
            >
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#f5e6c8',
              }}>
                {pct}%
              </span>
            </Ring>

            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22,
                color: '#f5e6c8',
                marginBottom: 4,
              }}>
                {loop.title}
              </div>
              <div style={{
                display: 'flex',
                gap: 8,
                fontSize: 9,
                fontFamily: 'monospace',
                color: 'rgba(245, 230, 200, 0.4)',
              }}>
                <span>{loop.type === 'windowed' ? '◷' : '∞'} {loop.type?.toUpperCase()}</span>
                <span>·</span>
                <span>Opened in {loop.phaseName || 'unknown phase'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            color: 'rgba(245, 230, 200, 0.35)',
            marginBottom: 12,
          }}>
            STEPS
          </div>

          {loop.subtasks?.map(subtask => (
            <div
              key={subtask.id}
              onClick={() => onToggleSubtask(subtask.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `2px solid ${subtask.done ? '#34D399' : 'rgba(245, 230, 200, 0.2)'}`,
                background: subtask.done ? '#34D399' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: subtask.done ? '#040810' : 'transparent',
                fontSize: 12,
                flexShrink: 0,
              }}>
                {subtask.done && '✓'}
              </div>
              <span style={{
                color: subtask.done ? 'rgba(245, 230, 200, 0.4)' : '#f5e6c8',
                textDecoration: subtask.done ? 'line-through' : 'none',
                fontSize: 14,
              }}>
                {subtask.text}
              </span>
            </div>
          ))}

          {/* Add subtask */}
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
          }}>
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add a step..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(245, 230, 200, 0.1)',
                background: 'rgba(245, 230, 200, 0.03)',
                color: '#f5e6c8',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddSubtask}
              disabled={!newSubtask.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: newSubtask.trim()
                  ? 'rgba(245, 230, 200, 0.1)'
                  : 'rgba(245, 230, 200, 0.03)',
                color: newSubtask.trim()
                  ? '#f5e6c8'
                  : 'rgba(245, 230, 200, 0.3)',
                fontSize: 13,
                cursor: newSubtask.trim() ? 'pointer' : 'default',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 20px 24px',
          borderTop: '1px solid rgba(245, 230, 200, 0.08)',
          display: 'flex',
          gap: 12,
        }}>
          <button
            onClick={onDelete}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid rgba(252, 129, 129, 0.3)',
              background: 'transparent',
              color: 'rgba(252, 129, 129, 0.7)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={onToggle}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: loop.closed ? 'rgba(245, 230, 200, 0.1)' : '#34D399',
              color: loop.closed ? '#f5e6c8' : '#040810',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loop.closed ? 'Reopen Loop' : 'Close Loop'}
          </button>
        </div>
      </div>
    </div>
  );
}
