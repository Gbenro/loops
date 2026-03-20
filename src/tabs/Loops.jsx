// Luna Loops - Loops Tab
// Cycle loops (29.5 day intentions) and Phase loops (3.5 day actions)

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Ring } from '../components/Ring.jsx';
import { NewMoonRitual } from '../components/NewMoonRitual.jsx';
import { LoopCreationSheet } from '../components/LoopCreationSheet.jsx';
import { getLoops, saveLoop, deleteLoop as deleteLoopFromDb, generateId, saveEcho, getEchoes } from '../lib/storage.js';
import { saveAudio, getAudioUrl } from '../lib/audioStorage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';
import { useEncryption } from '../lib/EncryptionContext.jsx';
import { getLunarMonthInfo } from '../data/lunarMonths.js';

// 8 lunar phase checkpoints pre-populated into every new cycle loop
const PHASE_CHECKPOINTS = [
  { phase: 'new', name: 'New Moon' },
  { phase: 'waxing-crescent', name: 'Waxing Crescent' },
  { phase: 'first-quarter', name: 'First Quarter' },
  { phase: 'waxing-gibbous', name: 'Waxing Gibbous' },
  { phase: 'full', name: 'Full Moon' },
  { phase: 'waning-gibbous', name: 'Waning Gibbous' },
  { phase: 'last-quarter', name: 'Last Quarter' },
  { phase: 'waning-crescent', name: 'Waning Crescent' },
];

export function Loops({ userId, phrases, phrasesLoading, hemisphere = 'north' }) {
  const [loops, setLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRitual, setShowRitual] = useState(false);
  const [showLoopSheet, setShowLoopSheet] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [ritualDismissedUntil, setRitualDismissedUntil] = useState(null);
  const [closedViewMode, setClosedViewMode] = useState('cycle'); // 'all' | 'phase' | 'cycle'
  const [closedNavIndex, setClosedNavIndex] = useState(0); // 0 = current, 1 = previous, etc.
  const justCreatedCycleRef = useRef(false); // prevent ritual re-showing after creation

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);
  const { encryptField, decryptField, sessionKey } = useEncryption();

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
  // Tutorial action listener
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.action === 'open-loop-sheet') setShowLoopSheet(true);
    };
    window.addEventListener('luna-tutorial-action', handler);
    return () => window.removeEventListener('luna-tutorial-action', handler);
  }, []);

  useEffect(() => {
    if (isNewMoon && !cycleLoop && !loading) {
      if (justCreatedCycleRef.current) return; // just set intention this session
      if (ritualDismissedUntil && new Date() < new Date(ritualDismissedUntil)) {
        return;
      }
      setShowRitual(true);
    }
  }, [isNewMoon, cycleLoop, loading, ritualDismissedUntil]);

  // Fetch loops on mount; decrypt encrypted titles if key is available
  useEffect(() => {
    setLoading(true);
    getLoops(userId).then(async (data) => {
      const decrypted = await Promise.all(data.map(async (loop) => {
        if (loop.isEncrypted && sessionKey) {
          return { ...loop, title: await decryptField(loop.title) };
        }
        return loop;
      }));
      // Merge: keep any loops added to state since fetch started (e.g. just-created cycle loop)
      setLoops(prev => {
        const fetchedIds = new Set(decrypted.map(l => l.id));
        const justAdded = prev.filter(l => !fetchedIds.has(l.id));
        return [...decrypted, ...justAdded];
      });
    }).catch(err => {
      console.error('Failed to load loops:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [userId, sessionKey, decryptField]);

  // Auto-populate phase checkpoints on existing cycle loops that predate the feature
  useEffect(() => {
    if (loading) return;
    loops.forEach(async (loop) => {
      if (loop.type !== 'cycle') return;
      if (loop.subtasks?.some(s => s.isPhaseCheckpoint)) return; // already has checkpoints
      const updated = {
        ...loop,
        subtasks: [
          ...PHASE_CHECKPOINTS.map(cp => ({
            id: generateId('pc'),
            text: cp.name,
            phase: cp.phase,
            done: false,
            isPhaseCheckpoint: true,
          })),
          ...(loop.subtasks || []),
        ],
      };
      setLoops(prev => prev.map(l => l.id === loop.id ? updated : l));
      setSelected(prev => prev?.id === loop.id ? updated : prev);
      await saveLoop(updated, userId);
    });
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close phase loops when their phase has ended
  useEffect(() => {
    if (loading || loops.length === 0) return;

    const currentPhase = lunarData.phase.key;
    const phaseLoopsToClose = loops.filter(l => {
      if (l.type !== 'phase' || l.status !== 'active' || !l.phaseOpened) return false;
      if (l.phaseOpened === currentPhase) return false;
      // New moon loops stay open through last-quarter (for releasing in waning-gibbous)
      // Only auto-close when waning-crescent begins
      if (l.phaseOpened === 'new' && currentPhase !== 'waning-crescent') return false;
      return true;
    });

    // Auto-close each expired phase loop
    phaseLoopsToClose.forEach(async (loop) => {
      const updated = {
        ...loop,
        status: 'closed',
        closedAt: new Date().toISOString(),
        // Register closure in the phase the loop lived in, not the new phase that triggered it
        phaseClosed: loop.phaseOpened,
        phaseNameClosed: loop.phaseName,
        lunarMonthClosed: loop.lunarMonthOpened,
        autoClosedReason: 'phase_ended',
      };
      setLoops(prev => prev.map(l => l.id === loop.id ? updated : l));
      await saveLoop(updated, userId);
    });
  }, [loops, lunarData.phase.key, loading, userId]);

  // Calculate loop completion
  const getLoopPct = useCallback((loop) => {
    if (loop.status === 'closed' || loop.status === 'released') return 100;
    if (!loop.subtasks || loop.subtasks.length === 0) return 0;
    const done = loop.subtasks.filter(s => s.done).length;
    return Math.round((done / loop.subtasks.length) * 100);
  }, []);

  // Create cycle loop (from ritual)
  const createCycleLoop = async (intention) => {
    const isEncrypted = !!sessionKey;
    const storedTitle = isEncrypted ? await encryptField(intention) : intention;
    const newLoop = {
      id: generateId('c'),
      title: intention, // plaintext in state
      type: 'cycle',
      status: 'active',
      color: '#A78BFA',
      subtasks: PHASE_CHECKPOINTS.map(cp => ({
        id: generateId('pc'),
        text: cp.name,
        phase: cp.phase,
        done: false,
        isPhaseCheckpoint: true,
      })),
      linkedTo: null,
      phaseOpened: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      lunarMonthOpened: lunarData.lunarMonth,
      moonAgeOpened: lunarData.age,
      zodiacOpened: lunarData.zodiac.sign,
      openedAt: new Date().toISOString(),
      closedAt: null,
      releasedAt: null,
      isEncrypted,
      createdAt: new Date().toISOString(),
    };
    justCreatedCycleRef.current = true;
    setLoops(prev => [newLoop, ...prev]);
    setShowRitual(false);
    await saveLoop({ ...newLoop, title: storedTitle }, userId);
  };

  // Create phase loop
  const createPhaseLoop = async (loopData) => {
    // Close the sheet immediately to prevent double-clicks
    setShowLoopSheet(false);

    const isEncrypted = !!sessionKey;
    const storedTitle = isEncrypted ? await encryptField(loopData.title) : loopData.title;
    const newLoop = {
      ...loopData,
      id: generateId('p'),
      subtasks: [],
      openedAt: new Date().toISOString(),
      closedAt: null,
      releasedAt: null,
      isEncrypted,
      createdAt: new Date().toISOString(),
    };
    setLoops(prev => [newLoop, ...prev]);
    setSelected(newLoop);
    setShowDetail(true);
    await saveLoop({ ...newLoop, title: storedTitle }, userId);
  };

  // Close loop
  const closeLoop = async (id) => {
    const loop = loops.find(l => l.id === id);
    if (!loop) return;
    const updated = {
      ...loop,
      status: 'closed',
      closedAt: new Date().toISOString(),
      phaseClosed: lunarData.phase.key,
      phaseNameClosed: lunarData.phase.name,
      lunarMonthClosed: lunarData.lunarMonth,
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
      phaseClosed: null,
      phaseNameClosed: null,
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
      phaseClosed: lunarData.phase.key,
      phaseNameClosed: lunarData.phase.name,
      lunarMonthClosed: lunarData.lunarMonth,
    };
    setLoops(prev => prev.map(l => l.id === id ? updated : l));
    if (selected?.id === id) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Update loop note
  const updateLoopNote = async (loopId, note) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;
    const updated = { ...loop, note };
    setLoops(prev => prev.map(l => l.id === loopId ? updated : l));
    if (selected?.id === loopId) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // Delete loop
  const deleteLoop = async (id) => {
    if (!window.confirm('Delete this loop? This cannot be undone.')) return;
    setLoops(prev => prev.filter(l => l.id !== id));
    setSelected(null);
    setShowDetail(false);
    await deleteLoopFromDb(id, userId);
  };

  // Delete subtask
  const deleteSubtask = async (loopId, subtaskId) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;
    const updated = { ...loop, subtasks: loop.subtasks.filter(s => s.id !== subtaskId) };
    setLoops(prev => prev.map(l => l.id === loopId ? updated : l));
    if (selected?.id === loopId) setSelected(updated);
    await saveLoop(updated, userId);
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

  // Reorder subtask (move up or down)
  const reorderSubtask = async (loopId, subtaskId, direction) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop || !loop.subtasks) return;

    const subtasks = [...loop.subtasks];
    const currentIndex = subtasks.findIndex(s => s.id === subtaskId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= subtasks.length) return;

    // Swap positions
    [subtasks[currentIndex], subtasks[newIndex]] = [subtasks[newIndex], subtasks[currentIndex]];

    const updated = { ...loop, subtasks };
    setLoops(prev => prev.map(l => l.id === loopId ? updated : l));
    if (selected?.id === loopId) setSelected(updated);
    await saveLoop(updated, userId);
  };

  // ─── Active loop ordering (localStorage, per-device) ───────────────────────
  const [activeLoopsOrder, setActiveLoopsOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('loops_active_order_v1') || '[]'); } catch { return []; }
  });

  const persistLoopsOrder = (order) => {
    try { localStorage.setItem('loops_active_order_v1', JSON.stringify(order)); } catch {}
  };

  const sortByOrder = (list, order) => {
    if (!order.length) return list;
    return [...list].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  };

  const reorderActiveLoop = (loopId, direction, sectionLoops) => {
    const sectionIds = sectionLoops.map(l => l.id);
    const base = [...activeLoopsOrder.filter(id => sectionIds.includes(id))];
    // ensure all section IDs present
    for (const id of sectionIds) if (!base.includes(id)) base.push(id);
    const idx = base.indexOf(loopId);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= base.length) return;
    [base[idx], base[newIdx]] = [base[newIdx], base[idx]];
    const merged = [...activeLoopsOrder.filter(id => !sectionIds.includes(id)), ...base];
    setActiveLoopsOrder(merged);
    persistLoopsOrder(merged);
  };

  // ─── Focus: ongoing / paused ────────────────────────────────────────────────
  const toggleLoopFocus = async (loopId) => {
    const loop = loops.find(l => l.id === loopId);
    if (!loop) return;
    const isOngoing = loop.focus === 'ongoing';
    const updatedLoops = loops.map(l => {
      if (l.type === 'cycle' || l.status !== 'active') return l;
      if (l.id === loopId) return { ...l, focus: isOngoing ? null : 'ongoing' };
      // when setting one as ongoing, pause all others; when clearing, leave as-is
      if (!isOngoing) return { ...l, focus: 'paused' };
      return l;
    });
    setLoops(updatedLoops);
    if (selected?.id === loopId) setSelected(updatedLoops.find(l => l.id === loopId));
    for (const updated of updatedLoops) {
      const original = loops.find(l => l.id === updated.id);
      if (original?.focus !== updated.focus) await saveLoop(updated, userId);
    }
  };

  // Filter loops by type
  const phaseLoops = sortByOrder(
    loops.filter(l => l.type === 'phase' && l.status === 'active'),
    activeLoopsOrder
  );
  const openLoops = sortByOrder(
    loops.filter(l => l.type === 'open' && l.status === 'active'),
    activeLoopsOrder
  );

  // All closed phase/open loops (for phase mode)
  const allClosedLoops = loops
    .filter(l =>
      (l.type === 'phase' || l.type === 'open') &&
      (l.status === 'closed' || l.status === 'released')
    )
    .sort((a, b) => new Date(b.closedAt || b.updatedAt || 0).getTime() - new Date(a.closedAt || a.updatedAt || 0).getTime());

  // All closed loops INCLUDING cycle intentions (for cycle mode)
  const allClosedWithCycles = loops
    .filter(l =>
      (l.type === 'phase' || l.type === 'open' || l.type === 'cycle') &&
      (l.status === 'closed' || l.status === 'released')
    )
    .sort((a, b) => new Date(b.closedAt || b.updatedAt || 0).getTime() - new Date(a.closedAt || a.updatedAt || 0).getTime());

  // Phase order for proper sequencing
  const PHASE_ORDER = [
    'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
    'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'
  ];

  // Get unique phases from closed loops, sorted in lunar cycle order
  const uniquePhases = useMemo(() => {
    const phaseMap = new Map();
    // Current phase
    phaseMap.set(lunarData.phase.key, { key: lunarData.phase.key, name: lunarData.phase.name, isCurrent: true });

    // Phases from closed loops
    for (const loop of allClosedLoops) {
      const phaseKey = loop.phaseClosed;
      if (phaseKey && !phaseMap.has(phaseKey)) {
        phaseMap.set(phaseKey, { key: phaseKey, name: loop.phaseNameClosed || phaseKey, isCurrent: false });
      }
    }

    // Sort by lunar cycle order
    return Array.from(phaseMap.values()).sort((a, b) => {
      const ai = PHASE_ORDER.indexOf(a.key);
      const bi = PHASE_ORDER.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [allClosedLoops, lunarData.phase.key, lunarData.phase.name]);

  // Get unique cycles (lunar months) from all closed loops including cycle intentions
  const uniqueCycles = useMemo(() => {
    const seen = new Set();
    const cycles = [];
    // Add current cycle first
    cycles.push({ name: lunarData.lunarMonth, isCurrent: true });
    seen.add(lunarData.lunarMonth);

    // Add previous cycles from all closed loops (by the cycle they were closed in)
    for (const loop of allClosedWithCycles) {
      const cycleName = loop.lunarMonthClosed || loop.lunarMonthOpened;
      if (cycleName && !seen.has(cycleName)) {
        seen.add(cycleName);
        cycles.push({ name: cycleName, isCurrent: false });
      }
    }
    return cycles;
  }, [allClosedWithCycles, lunarData.lunarMonth]);

  // Filter closed loops based on view mode and navigation
  const closedLoops = useMemo(() => {
    if (closedViewMode === 'phase') {
      const targetPhase = uniquePhases[closedNavIndex];
      if (!targetPhase) return [];
      return allClosedLoops.filter(l => l.phaseClosed === targetPhase.key);
    } else {
      const targetCycle = uniqueCycles[closedNavIndex];
      if (!targetCycle) return [];
      return allClosedWithCycles.filter(l => {
        const loopCycle = l.lunarMonthClosed || l.lunarMonthOpened;
        return loopCycle === targetCycle.name;
      });
    }
  }, [allClosedLoops, allClosedWithCycles, closedViewMode, closedNavIndex, uniquePhases, uniqueCycles]);

  // Navigation helpers
  // Phase: natural cycle order (‹ = earlier, › = later in cycle)
  // Cycle: newest-first (‹ = older cycle, › = newer cycle)
  const isPhaseView = closedViewMode === 'phase';
  const canNavPrev = isPhaseView ? closedNavIndex > 0 : closedNavIndex < uniqueCycles.length - 1;
  const canNavNext = isPhaseView ? closedNavIndex < uniquePhases.length - 1 : closedNavIndex > 0;
  const onNavPrev = () => setClosedNavIndex(i => isPhaseView ? i - 1 : i + 1);
  const onNavNext = () => setClosedNavIndex(i => isPhaseView ? i + 1 : i - 1);

  const currentNavLabel = closedViewMode === 'phase'
    ? uniquePhases[closedNavIndex]?.name || ''
    : `${uniqueCycles[closedNavIndex]?.name || ''} Moon`;

  const isCurrentNav = closedViewMode === 'phase'
    ? uniquePhases[closedNavIndex]?.isCurrent
    : uniqueCycles[closedNavIndex]?.isCurrent;

  // Switch view mode — phase defaults to current phase, cycle defaults to current
  const switchViewMode = (mode) => {
    setClosedViewMode(mode);
    if (mode === 'phase') {
      const idx = uniquePhases.findIndex(p => p.isCurrent);
      setClosedNavIndex(idx >= 0 ? idx : 0);
    } else {
      setClosedNavIndex(0);
    }
  };

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
          hemisphere={hemisphere}
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
            {getLunarMonthInfo(lunarData.lunarMonth, hemisphere).name.toUpperCase()} CYCLE
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
          <div data-tutorial="cycle-loop" style={{ marginBottom: 24 }}>
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
              hemisphere={hemisphere}
              pct={getLoopPct(cycleLoop)}
              onSelect={() => {
                setSelected(cycleLoop);
                setShowDetail(true);
              }}
            />
          </div>
        )}

        {/* Phase Loops (Windowed) */}
        {phaseLoops.length > 0 && (
          <div data-tutorial="phase-loops" style={{ marginBottom: 24 }}>
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
            {phaseLoops.map((loop, i) => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={getLoopPct(loop)}
                isWindowed
                lunarData={lunarData}
                focus={loop.focus || null}
                onToggleFocus={() => toggleLoopFocus(loop.id)}
                canMoveUp={i > 0}
                canMoveDown={i < phaseLoops.length - 1}
                onMoveUp={() => reorderActiveLoop(loop.id, 'up', phaseLoops)}
                onMoveDown={() => reorderActiveLoop(loop.id, 'down', phaseLoops)}
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
            {openLoops.map((loop, i) => (
              <LoopCard
                key={loop.id}
                loop={loop}
                pct={getLoopPct(loop)}
                focus={loop.focus || null}
                onToggleFocus={() => toggleLoopFocus(loop.id)}
                canMoveUp={i > 0}
                canMoveDown={i < openLoops.length - 1}
                onMoveUp={() => reorderActiveLoop(loop.id, 'up', openLoops)}
                onMoveDown={() => reorderActiveLoop(loop.id, 'down', openLoops)}
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
        {allClosedLoops.length > 0 && (
          <div>
            {/* Header with view mode toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <div style={{
                fontSize: 10,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                color: 'rgba(245, 230, 200, 0.25)',
              }}>
                COMPLETED
              </div>
              <div style={{
                display: 'flex',
                gap: 4,
              }}>
                {['phase', 'cycle'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => switchViewMode(mode)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: closedViewMode === mode
                        ? 'rgba(245, 230, 200, 0.1)'
                        : 'transparent',
                      color: closedViewMode === mode
                        ? 'rgba(245, 230, 200, 0.6)'
                        : 'rgba(245, 230, 200, 0.25)',
                      fontSize: 9,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 16,
              padding: '10px 0',
            }}>
              <button
                onClick={onNavPrev}
                disabled={!canNavPrev}
                style={{
                  background: 'none',
                  border: 'none',
                  color: canNavPrev ? 'rgba(245, 230, 200, 0.5)' : 'rgba(245, 230, 200, 0.15)',
                  fontSize: 16,
                  cursor: canNavPrev ? 'pointer' : 'default',
                  padding: '4px 8px',
                }}
              >
                ‹
              </button>
              <div style={{
                textAlign: 'center',
                minWidth: 140,
              }}>
                <div style={{
                  fontSize: 13,
                  color: isCurrentNav ? 'rgba(167, 139, 250, 0.8)' : 'rgba(245, 230, 200, 0.7)',
                  fontFamily: "'Cormorant Garamond', serif",
                }}>
                  {currentNavLabel}
                </div>
                {isCurrentNav && (
                  <div style={{
                    fontSize: 8,
                    fontFamily: 'monospace',
                    color: 'rgba(167, 139, 250, 0.5)',
                    letterSpacing: '0.1em',
                    marginTop: 2,
                  }}>
                    CURRENT
                  </div>
                )}
              </div>
              <button
                onClick={onNavNext}
                disabled={!canNavNext}
                style={{
                  background: 'none',
                  border: 'none',
                  color: canNavNext ? 'rgba(245, 230, 200, 0.5)' : 'rgba(245, 230, 200, 0.15)',
                  fontSize: 16,
                  cursor: canNavNext ? 'pointer' : 'default',
                  padding: '4px 8px',
                }}
              >
                ›
              </button>
            </div>

            {/* Loops for selected phase/cycle */}
            {closedLoops.length > 0 ? (
              closedViewMode === 'cycle' ? (
                <>
                  {/* Cycle intention at top */}
                  {closedLoops.filter(l => l.type === 'cycle').map(loop => (
                    <div key={loop.id} style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em',
                        color: 'rgba(245, 230, 200, 0.3)',
                        marginBottom: 8,
                      }}>
                        CYCLE INTENTION
                      </div>
                      <LoopCard
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
                    </div>
                  ))}
                  {/* Phase loops grouped */}
                  {closedLoops.filter(l => l.type !== 'cycle').length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em',
                        color: 'rgba(245, 230, 200, 0.3)',
                        marginBottom: 8,
                      }}>
                        PHASE LOOPS
                      </div>
                      {closedLoops.filter(l => l.type !== 'cycle').map(loop => (
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
                </>
              ) : (
                closedLoops.map(loop => (
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
                ))
              )
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px',
                color: 'rgba(245, 230, 200, 0.3)',
                fontSize: 12,
                fontStyle: 'italic',
              }}>
                No completed loops in this {closedViewMode}
              </div>
            )}
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
          data-tutorial="add-loop-btn"
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
          userId={userId}
          onClose={() => {
            setShowDetail(false);
            setSelected(null);
          }}
          onCloseLoop={() => closeLoop(selected.id)}
          onReopenLoop={() => reopenLoop(selected.id)}
          onReleaseLoop={() => releaseLoop(selected.id)}
          onDelete={() => deleteLoop(selected.id)}
          onToggleSubtask={(subtaskId) => toggleSubtask(selected.id, subtaskId)}
          onDeleteSubtask={(subtaskId) => deleteSubtask(selected.id, subtaskId)}
          onAddSubtask={(text) => addSubtask(selected.id, text)}
          onReorderSubtask={(subtaskId, direction) => reorderSubtask(selected.id, subtaskId, direction)}
          onUpdateNote={(note) => updateLoopNote(selected.id, note)}
        />
      )}
    </div>
  );
}

// ─── Cycle Loop Card ─────────────────────────────────────────────────────────

function CycleLoopCard({ loop, lunarData, onSelect, hemisphere = 'north', pct }) {
  const checkpoints = loop.subtasks?.filter(s => s.isPhaseCheckpoint) || [];
  const cycleProgress = checkpoints.length > 0
    ? (checkpoints.filter(s => s.done).length / checkpoints.length) * 100
    : pct != null ? pct : (lunarData.age / 29.53) * 100;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '20px',
        background: 'rgba(167, 139, 250, 0.04)',
        border: '1px solid rgba(167, 139, 250, 0.15)',
        borderRadius: 16,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle lunar glow effect */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        background: 'radial-gradient(circle, rgba(167, 139, 250, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        position: 'relative',
      }}>
        <Ring
          pct={cycleProgress}
          color="#A78BFA"
          size={48}
          stroke={3}
          variant="cycle"
          glow
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
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(245, 230, 200, 0.06)',
              color: 'rgba(245, 230, 200, 0.6)',
            }}>
              ☽ CYCLE
            </span>
            <span>{getLunarMonthInfo(loop.lunarMonthOpened, hemisphere).name.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loop Card ───────────────────────────────────────────────────────────────

function LoopCard({ loop, pct, closed, released, isWindowed, lunarData, onSelect, onClose, onReopen, focus, onToggleFocus, canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  const isOpen = loop.type === 'open';
  const isPhase = loop.type === 'phase';
  const isCycle = loop.type === 'cycle';
  const isAutoReleased = loop.autoClosedReason === 'phase_ended';
  const isOngoing = focus === 'ongoing';
  const isPaused = focus === 'paused';

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
        gap: 10,
        padding: '14px 12px 14px 14px',
        background: isOpen
          ? 'rgba(148, 163, 184, 0.03)'
          : 'rgba(245, 230, 200, 0.025)',
        border: `1px solid ${isOpen ? 'rgba(148, 163, 184, 0.08)' : 'rgba(245, 230, 200, 0.06)'}`,
        borderLeft: !closed ? `3px solid ${isOngoing ? '#34D399' : isPaused ? 'rgba(251, 191, 36, 0.45)' : 'transparent'}` : undefined,
        borderRadius: 12,
        marginBottom: 10,
        opacity: closed ? 0.5 : isPaused ? 0.55 : 1,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
      }}
      onClick={onSelect}
    >
      {/* Reorder buttons — active non-cycle only */}
      {!closed && (onMoveUp || onMoveDown) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!canMoveUp}
            style={{ width: 14, height: 12, padding: 0, background: 'none', border: 'none', color: canMoveUp ? 'rgba(245, 230, 200, 0.35)' : 'rgba(245, 230, 200, 0.1)', cursor: canMoveUp ? 'pointer' : 'default', fontSize: 8, lineHeight: 1 }}
          >▲</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!canMoveDown}
            style={{ width: 14, height: 12, padding: 0, background: 'none', border: 'none', color: canMoveDown ? 'rgba(245, 230, 200, 0.35)' : 'rgba(245, 230, 200, 0.1)', cursor: canMoveDown ? 'pointer' : 'default', fontSize: 8, lineHeight: 1 }}
          >▼</button>
        </div>
      )}

      <Ring
        pct={pct}
        color={isAutoReleased ? 'rgba(251, 191, 36, 0.5)' : released ? 'rgba(245, 230, 200, 0.3)' : (loop.color || '#A78BFA')}
        size={40}
        stroke={3}
        variant={isCycle ? 'cycle' : 'default'}
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 9, fontFamily: 'monospace', color: 'rgba(245, 230, 200, 0.4)' }}>
          {/* Phase badge */}
          <span style={{
            padding: '2px 6px', borderRadius: 4,
            background: isCycle ? 'rgba(245, 230, 200, 0.08)' : isOpen ? 'rgba(148, 163, 184, 0.1)' : 'rgba(167, 139, 250, 0.1)',
            color: isCycle ? 'rgba(245, 230, 200, 0.7)' : isOpen ? 'rgba(148, 163, 184, 0.7)' : 'rgba(167, 139, 250, 0.7)',
          }}>
            {isCycle ? '☽ CYCLE' : isOpen ? 'OPEN' : loop.phaseName?.toUpperCase()}
          </span>
          {/* Status badge for closed/released */}
          {(isAutoReleased || released) && (
            <span style={{
              padding: '2px 6px', borderRadius: 4,
              background: isAutoReleased ? 'rgba(251, 191, 36, 0.1)' : 'rgba(252, 129, 129, 0.1)',
              color: isAutoReleased ? 'rgba(251, 191, 36, 0.7)' : 'rgba(252, 129, 129, 0.6)',
            }}>
              {isAutoReleased ? 'PHASE ENDED' : 'RELEASED'}
            </span>
          )}
          {isOngoing && <span style={{ color: '#34D399', letterSpacing: '0.08em' }}>▶ ONGOING</span>}
          {isOpen && loop.phaseName && !closed && <span style={{ color: 'rgba(148, 163, 184, 0.5)' }}>↑ {loop.phaseName}</span>}
          {isOpen && closed && <span style={{ color: 'rgba(52, 211, 153, 0.6)' }}>↓ {loop.phaseNameClosed || '?'}</span>}
          {windowText && <span style={{ color: 'rgba(167, 139, 250, 0.5)' }}>{windowText}</span>}
        </div>
      </div>

      {/* Focus toggle button */}
      {!closed && onToggleFocus && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFocus(); }}
          title={isOngoing ? 'Clear ongoing' : 'Set as ongoing'}
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            border: `1px solid ${isOngoing ? 'rgba(52,211,153,0.5)' : isPaused ? 'rgba(251,191,36,0.3)' : 'rgba(245,230,200,0.15)'}`,
            background: isOngoing ? 'rgba(52,211,153,0.12)' : 'transparent',
            color: isOngoing ? '#34D399' : isPaused ? 'rgba(251,191,36,0.5)' : 'rgba(245,230,200,0.2)',
            fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isOngoing ? '▶' : isPaused ? '⏸' : '◎'}
        </button>
      )}

      {/* Close / reopen button */}
      <button
        onClick={(e) => { e.stopPropagation(); closed ? onReopen?.() : onClose?.(); }}
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${closed ? '#34D399' : 'rgba(245, 230, 200, 0.2)'}`,
          background: closed ? '#34D399' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: closed ? '#040810' : 'transparent', fontSize: 14,
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
  userId,
  onClose,
  onCloseLoop,
  onReopenLoop,
  onReleaseLoop,
  onDelete,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
  onReorderSubtask,
  onUpdateNote,
}) {
  const [newSubtask, setNewSubtask] = useState('');
  const [noteText, setNoteText] = useState(loop.note || '');
  const [linkedEchoes, setLinkedEchoes] = useState([]);
  const [showEchoInput, setShowEchoInput] = useState(false);
  const [newEchoText, setNewEchoText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [echoAudioBlob, setEchoAudioBlob] = useState(null);
  const [echoModal, setEchoModal] = useState(null);
  const [modalAudioUrl, setModalAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const isCycle = loop.type === 'cycle';
  const isClosed = loop.status === 'closed';
  const isReleased = loop.status === 'released';
  const isActive = loop.status === 'active';

  const phaseCheckpoints = isCycle
    ? (loop.subtasks?.filter(s => s.isPhaseCheckpoint) || [])
    : [];
  const regularSubtasks = loop.subtasks?.filter(s => !s.isPhaseCheckpoint) || [];

  const lunarData = useMemo(() => getLunarData(), []);

  // Load echoes linked to this loop
  useEffect(() => {
    getEchoes(userId).then(all => {
      setLinkedEchoes(all.filter(e => e.linkedLoopId === loop.id));
    }).catch(() => {});
  }, [loop.id, userId]);

  // Get signed URL when echo modal opens
  useEffect(() => {
    if (!echoModal?.audio_path) { setModalAudioUrl(null); return; }
    getAudioUrl(echoModal.audio_path).then(url => setModalAudioUrl(url)).catch(() => {});
  }, [echoModal]);

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(newSubtask.trim());
    setNewSubtask('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        setEchoAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e) {
      console.warn('Mic access denied:', e);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const submitEcho = async () => {
    if (!newEchoText.trim() && !echoAudioBlob) return;
    const echoId = generateId('e');
    const echo = {
      id: echoId,
      text: newEchoText.trim(),
      source: echoAudioBlob ? 'voice' : 'text',
      phase: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      phaseType: null,
      lunarMonth: lunarData.lunarMonth,
      dayOfCycle: lunarData.dayOfCycle,
      zodiac: lunarData.zodiac.sign,
      illumination: lunarData.illumination,
      linkedLoopId: loop.id,
      createdAt: new Date().toISOString(),
    };
    await saveEcho(echo, userId);
    if (echoAudioBlob) {
      const path = await saveAudio(echoId, echoAudioBlob, userId);
      if (path && path !== 'TOO_LARGE') echo.audio_path = path;
    }
    setLinkedEchoes(prev => [echo, ...prev]);
    setNewEchoText('');
    setEchoAudioBlob(null);
    setShowEchoInput(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 520,
        maxHeight: '85vh',
        background: '#0a0a12',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(245, 230, 200, 0.08)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(245, 230, 200, 0.2)', margin: '0 auto 20px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring
              pct={pct}
              color={isReleased ? 'rgba(245,230,200,0.3)' : (loop.color || '#A78BFA')}
              size={56}
              stroke={4}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f5e6c8' }}>{pct}%</span>
            </Ring>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#f5e6c8', marginBottom: 4 }}>
                {loop.title}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 9, fontFamily: 'monospace', color: 'rgba(245, 230, 200, 0.4)' }}>
                <span>{isCycle ? '◐ CYCLE' : loop.type === 'open' ? '◯ OPEN' : '◯ PHASE'}</span>
                <span>·</span>
                {loop.type === 'open' ? (
                  <>
                    <span>↑ {loop.phaseName || '?'}</span>
                    {(isClosed || isReleased) && (
                      <><span>·</span><span style={{ color: 'rgba(52, 211, 153, 0.6)' }}>↓ {loop.phaseNameClosed || '?'}</span></>
                    )}
                  </>
                ) : (
                  <span>{loop.phaseName || 'unknown'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Phase Journey — cycle loops only */}
          {isCycle && phaseCheckpoints.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(167, 139, 250, 0.5)', marginBottom: 12 }}>
                PHASE JOURNEY
              </div>
              {phaseCheckpoints.map(cp => (
                <div
                  key={cp.id}
                  onClick={() => onToggleSubtask(cp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    marginBottom: 6,
                    borderRadius: 8,
                    background: cp.done ? 'rgba(167, 139, 250, 0.08)' : 'rgba(245, 230, 200, 0.02)',
                    border: `1px solid ${cp.done ? 'rgba(167, 139, 250, 0.2)' : 'rgba(245, 230, 200, 0.06)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `2px solid ${cp.done ? '#A78BFA' : 'rgba(245, 230, 200, 0.2)'}`,
                    background: cp.done ? '#A78BFA' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 10,
                    color: cp.done ? '#040810' : 'transparent',
                  }}>
                    {cp.done && '✓'}
                  </div>
                  <span style={{ fontSize: 13, color: cp.done ? 'rgba(167, 139, 250, 0.9)' : 'rgba(245, 230, 200, 0.5)' }}>
                    {getPhaseEmoji(cp.phase)} {cp.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Regular Steps — not shown for cycle loops */}
          {!isCycle && (regularSubtasks.length > 0 || isActive) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(245, 230, 200, 0.35)', marginBottom: 12 }}>
                STEPS
              </div>
              {regularSubtasks.map((subtask, index) => (
                <div
                  key={subtask.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(245, 230, 200, 0.06)' }}
                >
                  {/* Reorder buttons — only for non-cycle loops */}
                  {!isCycle && isActive && regularSubtasks.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onReorderSubtask(subtask.id, 'up'); }}
                        disabled={index === 0}
                        style={{ width: 18, height: 14, padding: 0, background: 'none', border: 'none', color: index === 0 ? 'rgba(245, 230, 200, 0.15)' : 'rgba(245, 230, 200, 0.4)', cursor: index === 0 ? 'default' : 'pointer', fontSize: 10 }}
                      >▲</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onReorderSubtask(subtask.id, 'down'); }}
                        disabled={index === regularSubtasks.length - 1}
                        style={{ width: 18, height: 14, padding: 0, background: 'none', border: 'none', color: index === regularSubtasks.length - 1 ? 'rgba(245, 230, 200, 0.15)' : 'rgba(245, 230, 200, 0.4)', cursor: index === regularSubtasks.length - 1 ? 'default' : 'pointer', fontSize: 10 }}
                      >▼</button>
                    </div>
                  )}
                  <div
                    onClick={() => onToggleSubtask(subtask.id)}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${subtask.done ? '#34D399' : 'rgba(245, 230, 200, 0.2)'}`, background: subtask.done ? '#34D399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: subtask.done ? '#040810' : 'transparent', fontSize: 12, flexShrink: 0, cursor: 'pointer' }}
                  >
                    {subtask.done && '✓'}
                  </div>
                  <span
                    onClick={() => onToggleSubtask(subtask.id)}
                    style={{ flex: 1, color: subtask.done ? 'rgba(245, 230, 200, 0.4)' : '#f5e6c8', textDecoration: subtask.done ? 'line-through' : 'none', fontSize: 14, cursor: 'pointer' }}
                  >
                    {subtask.text}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(subtask.id)}
                    style={{ background: 'none', border: 'none', color: 'rgba(252, 129, 129, 0.4)', fontSize: 14, cursor: 'pointer', padding: '4px 6px', lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
              {isActive && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <input
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a step..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(245, 230, 200, 0.1)', background: 'rgba(245, 230, 200, 0.03)', color: '#f5e6c8', fontSize: 13, outline: 'none' }}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                    style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: newSubtask.trim() ? 'rgba(245, 230, 200, 0.1)' : 'rgba(245, 230, 200, 0.03)', color: newSubtask.trim() ? '#f5e6c8' : 'rgba(245, 230, 200, 0.3)', fontSize: 13, cursor: newSubtask.trim() ? 'pointer' : 'default' }}
                  >Add</button>
                </div>
              )}
            </div>
          )}

          {/* Echoes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(245, 230, 200, 0.35)' }}>
                ECHOES{linkedEchoes.length > 0 ? ` (${linkedEchoes.length})` : ''}
              </div>
              {!showEchoInput && (
                <button
                  onClick={() => setShowEchoInput(true)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(245, 230, 200, 0.15)', background: 'transparent', color: 'rgba(245, 230, 200, 0.5)', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' }}
                >
                  + ADD ECHO
                </button>
              )}
            </div>

            {/* Echo input form */}
            {showEchoInput && (
              <div style={{ background: 'rgba(245, 230, 200, 0.03)', border: '1px solid rgba(245, 230, 200, 0.08)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <textarea
                  value={newEchoText}
                  onChange={e => setNewEchoText(e.target.value)}
                  placeholder="Write your reflection..."
                  rows={3}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'rgba(245, 230, 200, 0.9)', fontSize: 13, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                />
                {echoAudioBlob && (
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(52, 211, 153, 0.7)', marginTop: 4 }}>
                    ● voice recorded
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${isRecording ? 'rgba(252, 129, 129, 0.5)' : 'rgba(245, 230, 200, 0.15)'}`, background: isRecording ? 'rgba(252, 129, 129, 0.1)' : 'transparent', color: isRecording ? 'rgba(252, 129, 129, 0.9)' : 'rgba(245, 230, 200, 0.5)', fontSize: 11, cursor: 'pointer' }}
                    >
                      {isRecording ? '◼ Stop' : '🎙 Record'}
                    </button>
                    <button
                      onClick={() => { setShowEchoInput(false); setNewEchoText(''); setEchoAudioBlob(null); if (isRecording) stopRecording(); }}
                      style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(245, 230, 200, 0.3)', fontSize: 11, cursor: 'pointer' }}
                    >Cancel</button>
                  </div>
                  <button
                    onClick={submitEcho}
                    disabled={!newEchoText.trim() && !echoAudioBlob}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (newEchoText.trim() || echoAudioBlob) ? 'rgba(245, 230, 200, 0.1)' : 'rgba(245, 230, 200, 0.03)', color: (newEchoText.trim() || echoAudioBlob) ? '#f5e6c8' : 'rgba(245, 230, 200, 0.3)', fontSize: 12, cursor: (newEchoText.trim() || echoAudioBlob) ? 'pointer' : 'default' }}
                  >Save Echo</button>
                </div>
              </div>
            )}

            {/* Linked echoes list */}
            {linkedEchoes.length > 0 ? (
              linkedEchoes.map(echo => (
                <div
                  key={echo.id}
                  onClick={() => setEchoModal(echo)}
                  style={{ padding: '12px 14px', background: 'rgba(245, 230, 200, 0.02)', border: '1px solid rgba(245, 230, 200, 0.06)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 12, color: 'rgba(245, 230, 200, 0.7)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {echo.text || (echo.audio_path ? '🎙 voice echo' : '')}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245, 230, 200, 0.3)', marginTop: 6, display: 'flex', gap: 8 }}>
                    <span>{getPhaseEmoji(echo.phase)} {echo.phaseName}</span>
                    {echo.audio_path && <span>· 🎙</span>}
                  </div>
                </div>
              ))
            ) : (
              !showEchoInput && (
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(245, 230, 200, 0.2)', textAlign: 'center', padding: '12px 0' }}>
                  No echoes yet
                </div>
              )
            )}
          </div>

          {/* Note */}
          <div style={{ borderTop: '1px solid rgba(245, 230, 200, 0.06)', paddingTop: 16, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(245, 230, 200, 0.35)', marginBottom: 8 }}>
              NOTE
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={() => onUpdateNote(noteText.trim() || null)}
              placeholder="A note to yourself... (saves when you stop writing)"
              rows={3}
              style={{ width: '100%', background: 'rgba(245, 230, 200, 0.03)', border: '1px solid rgba(245, 230, 200, 0.08)', borderRadius: 8, padding: '10px 12px', color: 'rgba(245, 230, 200, 0.8)', fontSize: 13, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px 24px', borderTop: '1px solid rgba(245, 230, 200, 0.08)', display: 'flex', gap: 10 }}>
          {!isCycle && (
            <button
              onClick={onDelete}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(252, 129, 129, 0.3)', background: 'transparent', color: 'rgba(252, 129, 129, 0.7)', fontSize: 11, cursor: 'pointer' }}
            >Delete</button>
          )}
          {isActive && (
            <button
              onClick={onReleaseLoop}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(245, 230, 200, 0.15)', background: 'transparent', color: 'rgba(245, 230, 200, 0.5)', fontSize: 11, cursor: 'pointer' }}
            >Release</button>
          )}
          <button
            onClick={isActive ? onCloseLoop : onReopenLoop}
            style={{ flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none', background: isActive ? '#34D399' : 'rgba(245, 230, 200, 0.1)', color: isActive ? '#040810' : '#f5e6c8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {isActive ? 'Close Loop' : (isReleased ? 'Reopen' : 'Reopen Loop')}
          </button>
        </div>
      </div>

      {/* Echo detail modal */}
      {echoModal && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setEchoModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, background: '#0a0a12', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '24px 20px 40px', maxHeight: '70vh', overflowY: 'auto', boxSizing: 'border-box' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(245, 230, 200, 0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245, 230, 200, 0.3)', marginBottom: 12, display: 'flex', gap: 8 }}>
              <span>{getPhaseEmoji(echoModal.phase)} {echoModal.phaseName}</span>
              <span>· {echoModal.zodiac}</span>
              <span>· day {echoModal.dayOfCycle}</span>
            </div>
            {echoModal.text && (
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'rgba(245, 230, 200, 0.85)', lineHeight: 1.7, marginBottom: 16 }}>
                {echoModal.text}
              </div>
            )}
            {modalAudioUrl && (
              <audio controls src={modalAudioUrl} style={{ width: '100%', marginTop: 12 }} />
            )}
            {echoModal.audio_path && !modalAudioUrl && (
              <div style={{ fontSize: 11, color: 'rgba(245, 230, 200, 0.3)', fontStyle: 'italic' }}>Loading audio...</div>
            )}
            <button
              onClick={() => setEchoModal(null)}
              style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(245, 230, 200, 0.15)', background: 'transparent', color: 'rgba(245, 230, 200, 0.5)', fontSize: 12, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
