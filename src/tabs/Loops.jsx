// Cosmic Loops - Loops Tab
// Cycle loops (29.5 day intentions) and Phase loops (3.5 day actions)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Ring } from '../components/Ring.jsx';
import { NewMoonRitual } from '../components/NewMoonRitual.jsx';
import { LoopCreationSheet } from '../components/LoopCreationSheet.jsx';
import { getLoops, saveLoop, deleteLoop as deleteLoopFromDb, generateId } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';

export function Loops({ userId, phrases, phrasesLoading }) {
  const [loops, setLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRitual, setShowRitual] = useState(false);
  const [showLoopSheet, setShowLoopSheet] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [ritualDismissedUntil, setRitualDismissedUntil] = useState(null);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);

  // Check if we're in New Moon phase
  const isNewMoon = lunarData.phase.key === 'new';
  const isWaxing = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous'].includes(lunarData.phase.key);
  const isWaning = !isWaxing;
  const isFullMoon = lunarData.phase.key === 'full';
  const isWaningCrescent = lunarData.phase.key === 'waning-crescent';

  // Get current cycle loop (if exists)
  const cycleLoop = useMemo(() =>
    loops.find(l => l.type === 'cycle' && l.status === 'active'),
    [loops]
  );

  // Check if ritual should show
  useEffect(() => {
    if (isNewMoon && !cycleLoop && !loading) {
      // Check if dismissed
      if (ritualDismissedUntil && new Date() < new Date(ritualDismissedUntil)) {
        return;
      }
      setShowRitual(true);
    }
  }, [isNewMoon, cycleLoop, loading, ritualDismissedUntil]);

  // Fetch loops on mount
  useEffect(() => {
    setLoading(true);
    getLoops(userId).then(data => {
      setLoops(data);
      setLoading(false);
    });
  }, [userId]);

  // Calculate loop completion
  const getLoopPct = useCallback((loop) => {
    if (loop.status === 'closed' || loop.status === 'released') return 100;
    if (!loop.subtasks || loop.subtasks.length === 0) return 0;
    const done = loop.subtasks.filter(s => s.done).length;
    return Math.round((done / loop.subtasks.length) * 100);
  }, []);

  // Create cycle loop (from ritual)
  const createCycleLoop = async (intention) => {
    const newLoop = {
      id: generateId('c'),
      title: intention,
      type: 'cycle',
      status: 'active',
      color: '#A78BFA',
      subtasks: [],
      linkedTo: null,
      phaseOpened: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      lunarMonthOpened: lunarData.lunarMonth,
      moonAgeOpened: lunarData.age,
      zodiacOpened: lunarData.zodiac.sign,
      openedAt: new Date().toISOString(),
      closedAt: null,
      releasedAt: null,
      createdAt: new Date().toISOString(),
    };
    setLoops(prev => [newLoop, ...prev]);
    setShowRitual(false);
    await saveLoop(newLoop, userId);
  };

  // Create phase loop
  const createPhaseLoop = async (loopData) => {
    const newLoop = {
      ...loopData,
      id: generateId('p'),
      subtasks: [],
      openedAt: new Date().toISOString(),
      closedAt: null,
      releasedAt: null,
      createdAt: new Date().toISOString(),
    };
    setLoops(prev => [newLoop, ...prev]);
    setShowPhaseSheet(false);
    setSelected(newLoop);
    setShowDetail(true);
    await saveLoop(newLoop, userId);
  };

  // Close loop
  const closeLoop = async (id) => {
    const loop = loops.find(l => l.id === id);
    if (!loop) return;
    const updated = {
      ...loop,
      status: 'closed',
      closedAt: new Date().toISOString(),
    };
    setLoops(prev => prev.map(l => l.id === id ? updated : l));
    if (selected?.id === id) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Reopen loop
  const reopenLoop = async (id) => {
    const loop = loops.find(l => l.id === id);
    if (!loop) return;
    const updated = {
      ...loop,
      status: 'active',
      closedAt: null,
      releasedAt: null,
    };
    setLoops(prev => prev.map(l => l.id === id ? updated : l));
    if (selected?.id === id) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Release loop (let go without completing)
  const releaseLoop = async (id) => {
    const loop = loops.find(l => l.id === id);
    if (!loop) return;
    const updated = {
      ...loop,
      status: 'released',
      releasedAt: new Date().toISOString(),
    };
    setLoops(prev => prev.map(l => l.id === id ? updated : l));
    if (selected?.id === id) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Delete loop
  const deleteLoop = async (id) => {
    setLoops(prev => prev.filter(l => l.id !== id));
    setSelected(null);
    setShowDetail(false);
    await deleteLoopFromDb(id, userId);
  };

  // Toggle subtask
  const toggleSubtask = async (loopId, subtaskId) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;
    const updated = {
      ...loop,
      subtasks: loop.subtasks.map(s =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      ),
    };
    setLoops(prev => prev.map(l => l.id === loopId ? updated : l));
    if (selected?.id === loopId) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Add subtask
  const addSubtask = async (loopId, text) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;
    const newSubtask = { id: generateId('s'), text, done: false };
    const updated = { ...loop, subtasks: [...loop.subtasks, newSubtask] };
    setLoops(prev => prev.map(l => l.id === loopId ? updated : l));
    if (selected?.id === loopId) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Filter loops by type
  const phaseLoops = loops.filter(l => l.type === 'phase' && l.status === 'active');
  const openLoops = loops.filter(l => l.type === 'open' && l.status === 'active');
  const closedLoops = loops.filter(l =>
    (l.type === 'phase' || l.type === 'open') &&
    (l.status === 'closed' || l.status === 'released')
  );

  // Use generated prompt or fallback
  const addButtonLabel = phrasesLoading ? '+ open a loop' : `+ ${phrases.addLoopPrompt?.toLowerCase() || 'open a loop'}`;

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
        ◯
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
      {/* New Moon Ritual */}
      {showRitual && (
        <NewMoonRitual
          lunarData={lunarData}
          onSetIntention={createCycleLoop}
          onDismiss={(until) => {
            setRitualDismissedUntil(until);
            setShowRitual(false);
          }}
          newMoonQuestion={phrases.newMoonQuestion}
          phrasesLoading={phrasesLoading}
        />
      )}

      {/* Loop Creation Sheet */}
      {showLoopSheet && (
        <LoopCreationSheet
          lunarData={lunarData}
          cycleLoopId={cycleLoop?.id}
          onClose={() => setShowLoopSheet(false)}
          onCreate={createPhaseLoop}
        />
      )}

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
        {phrasesLoading ? (
          <div style={{
            height: 18,
            background: 'rgba(245, 230, 200, 0.1)',
            borderRadius: 4,
            opacity: 0.3,
          }} />
        ) : (
          <div style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: 'rgba(245, 230, 200, 0.6)',
            lineHeight: 1.5,
            opacity: 1,
            transition: 'opacity 0.4s ease',
          }}>
            {phrases.phaseBanner}
          </div>
        )}
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
      {isWaning && (
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
            Waning phase — the cosmos supports closing, not opening.
          </div>
        </div>
      )}

      {/* Loop List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
      }}>
        {/* Cycle Loop (pinned at top) */}
        {cycleLoop && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: 'rgba(167, 139, 250, 0.6)',
              marginBottom: 12,
            }}>
              CYCLE INTENTION
            </div>
            <CycleLoopCard
              loop={cycleLoop}
              lunarData={lunarData}
              onSelect={() => {
                setSelected(cycleLoop);
                setShowDetail(true);
              }}
            />
          </div>
        )}

        {/* Phase Loops (Windowed) */}
        {phaseLoops.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <span style={{
                fontSize: 10,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                color: 'rgba(167, 139, 250, 0.6)',
              }}>
                PHASE LOOPS
              </span>
              <span style={{
                fontSize: 8,
                fontFamily: 'monospace',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'rgba(167, 139, 250, 0.1)',
                color: 'rgba(167, 139, 250, 0.7)',
              }}>
                {lunarData.phaseRemaining?.toFixed(1)}D WINDOW
              </span>
            </div>
            {phaseLoops.map(loop => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={getLoopPct(loop)}
                isWindowed
                lunarData={lunarData}
                onSelect={() => {
                  setSelected(loop);
                  setShowDetail(true);
                }}
                onClose={() => closeLoop(loop.id)}
              />
            ))}
          </div>
        )}

        {/* Open Loops (No Window) */}
        {openLoops.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: 'rgba(148, 163, 184, 0.6)',
              marginBottom: 12,
            }}>
              OPEN LOOPS
            </div>
            {openLoops.map(loop => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={getLoopPct(loop)}
                onSelect={() => {
                  setSelected(loop);
                  setShowDetail(true);
                }}
                onClose={() => closeLoop(loop.id)}
              />
            ))}
          </div>
        )}

        {/* Closed / Released Loops */}
        {closedLoops.length > 0 && (
          <div>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              color: 'rgba(245, 230, 200, 0.25)',
              marginBottom: 12,
            }}>
              COMPLETED
            </div>
            {closedLoops.map(loop => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={100}
                closed
                released={loop.status === 'released'}
                onSelect={() => {
                  setSelected(loop);
                  setShowDetail(true);
                }}
                onReopen={() => reopenLoop(loop.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!cycleLoop && phaseLoops.length === 0 && openLoops.length === 0 && !isNewMoon && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(245, 230, 200, 0.3)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>◯</div>
            <div style={{ fontSize: 14, fontStyle: 'italic', marginBottom: 8 }}>
              No loops yet.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(245, 230, 200, 0.25)' }}>
              Open loops for regular tasks, or phase loops to align with the moon.
            </div>
          </div>
        )}

        {/* New Moon prompt */}
        {isNewMoon && !cycleLoop && !showRitual && (
          <div
            onClick={() => setShowRitual(true)}
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'rgba(245, 230, 200, 0.4)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌑</div>
            <div style={{
              fontSize: 16,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
            }}>
              Tap to set your cycle intention
            </div>
          </div>
        )}
      </div>

      {/* Add Loop Button */}
      <div style={{
        padding: '16px 20px 20px',
        borderTop: '1px solid rgba(245, 230, 200, 0.06)',
      }}>
        <button
          onClick={() => setShowLoopSheet(true)}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            background: 'rgba(245, 230, 200, 0.06)',
            border: '1px solid rgba(245, 230, 200, 0.12)',
            color: 'rgba(245, 230, 200, 0.7)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {addButtonLabel}
        </button>
      </div>

      {/* Detail Panel */}
      {showDetail && selected && (
        <DetailPanel
          loop={selected}
          pct={getLoopPct(selected)}
          onClose={() => {
            setShowDetail(false);
            setSelected(null);
          }}
          onCloseLoop={() => closeLoop(selected.id)}
          onReopenLoop={() => reopenLoop(selected.id)}
          onReleaseLoop={() => releaseLoop(selected.id)}
          onDelete={() => deleteLoop(selected.id)}
          onToggleSubtask={(subtaskId) => toggleSubtask(selected.id, subtaskId)}
          onAddSubtask={(text) => addSubtask(selected.id, text)}
        />
      )}
    </div>
  );
}

// ─── Cycle Loop Card ─────────────────────────────────────────────────────────

function CycleLoopCard({ loop, lunarData, onSelect }) {
  const cycleProgress = (lunarData.age / 29.53) * 100;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '20px',
        background: 'rgba(167, 139, 250, 0.06)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        borderRadius: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}>
        <Ring
          pct={cycleProgress}
          color="#A78BFA"
          size={48}
          stroke={3}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18,
            color: '#f5e6c8',
            lineHeight: 1.4,
            marginBottom: 8,
          }}>
            {loop.title}
          </div>
          <div style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'rgba(167, 139, 250, 0.6)',
            letterSpacing: '0.08em',
          }}>
            {loop.lunarMonthOpened?.toUpperCase()} MOON · OPENED AT {loop.phaseName?.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loop Card ───────────────────────────────────────────────────────────────

function LoopCard({ loop, pct, closed, released, isWindowed, lunarData, onSelect, onClose, onReopen }) {
  const isOpen = loop.type === 'open';
  const isPhase = loop.type === 'phase';

  // Calculate window remaining for phase loops
  let windowText = null;
  if (isPhase && !closed && lunarData) {
    const remaining = lunarData.phaseRemaining;
    if (remaining < 1) {
      windowText = `${Math.round(remaining * 24)}h left`;
    } else {
      windowText = `${remaining.toFixed(1)}d left`;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: isOpen
          ? 'rgba(148, 163, 184, 0.03)'
          : 'rgba(245, 230, 200, 0.025)',
        border: `1px solid ${isOpen
          ? 'rgba(148, 163, 184, 0.08)'
          : 'rgba(245, 230, 200, 0.06)'}`,
        borderRadius: 12,
        marginBottom: 10,
        opacity: closed ? 0.5 : 1,
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <Ring
        pct={pct}
        color={released ? 'rgba(245, 230, 200, 0.3)' : (loop.color || '#A78BFA')}
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
          alignItems: 'center',
          fontSize: 9,
          fontFamily: 'monospace',
          color: 'rgba(245, 230, 200, 0.4)',
        }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: released
              ? 'rgba(252, 129, 129, 0.1)'
              : isOpen
                ? 'rgba(148, 163, 184, 0.1)'
                : 'rgba(167, 139, 250, 0.1)',
            color: released
              ? 'rgba(252, 129, 129, 0.6)'
              : isOpen
                ? 'rgba(148, 163, 184, 0.7)'
                : 'rgba(167, 139, 250, 0.7)',
          }}>
            {released ? 'RELEASED' : isOpen ? 'OPEN' : loop.phaseName?.toUpperCase()}
          </span>
          {windowText && (
            <span style={{
              color: 'rgba(167, 139, 250, 0.5)',
            }}>
              {windowText}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          closed ? onReopen?.() : onClose?.();
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

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({
  loop,
  pct,
  onClose,
  onCloseLoop,
  onReopenLoop,
  onReleaseLoop,
  onDelete,
  onToggleSubtask,
  onAddSubtask
}) {
  const [newSubtask, setNewSubtask] = useState('');
  const isCycle = loop.type === 'cycle';
  const isClosed = loop.status === 'closed';
  const isReleased = loop.status === 'released';
  const isActive = loop.status === 'active';

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
              color={isReleased ? 'rgba(245,230,200,0.3)' : (loop.color || '#A78BFA')}
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
                <span>{isCycle ? '◐ CYCLE' : loop.type === 'open' ? '◯ OPEN' : '◯ PHASE'}</span>
                <span>·</span>
                <span>{loop.type === 'open' ? 'NO WINDOW' : (loop.phaseName || 'unknown')}</span>
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
          {isActive && (
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
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 20px 24px',
          borderTop: '1px solid rgba(245, 230, 200, 0.08)',
          display: 'flex',
          gap: 10,
        }}>
          {!isCycle && (
            <button
              onClick={onDelete}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(252, 129, 129, 0.3)',
                background: 'transparent',
                color: 'rgba(252, 129, 129, 0.7)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}

          {isActive && (
            <button
              onClick={onReleaseLoop}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(245, 230, 200, 0.15)',
                background: 'transparent',
                color: 'rgba(245, 230, 200, 0.5)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Release
            </button>
          )}

          <button
            onClick={isActive ? onCloseLoop : onReopenLoop}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: isActive ? '#34D399' : 'rgba(245, 230, 200, 0.1)',
              color: isActive ? '#040810' : '#f5e6c8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isActive ? 'Close Loop' : (isReleased ? 'Reopen' : 'Reopen Loop')}
          </button>
        </div>
      </div>
    </div>
  );
}
