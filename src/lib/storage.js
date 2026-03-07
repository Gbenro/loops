// Luna Loops - Storage with Supabase sync
import { supabase } from './supabase.js';

const LOOPS_KEY = 'cosmic_loops_v1';
const ECHOES_KEY = 'cosmic_echoes_v1';
const PHASE_SUMMARIES_KEY = 'cosmic_phase_summaries_v1';
const CYCLE_SUMMARIES_KEY = 'cosmic_cycle_summaries_v1';

// Generate unique IDs
export function generateId(prefix = 'l') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
}

// Local storage helpers
function getLocal(key, fallback = []) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

// ============ LOOPS ============

export async function getLoops(userId) {
  const localLoops = getLocal(LOOPS_KEY);
  if (!userId) return localLoops;

  try {
    const { data, error } = await supabase
      .from('loops')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase loops fetch error:', error);
      throw error;
    }

    const serverLoops = data.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type || 'phase',
      status: row.status || 'active',
      color: row.color || '#A78BFA',
      subtasks: row.subtasks || [],
      linkedTo: row.linked_to || null,
      phaseOpened: row.phase_opened,
      phaseName: row.phase_name,
      lunarMonthOpened: row.lunar_month_opened,
      moonAgeOpened: row.moon_age_opened,
      zodiacOpened: row.zodiac_opened,
      windowEnd: row.window_end || null,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      releasedAt: row.released_at,
      phaseClosed: row.phase_closed || null,
      phaseNameClosed: row.phase_name_closed || null,
      lunarMonthClosed: row.lunar_month_closed || null,
      isEncrypted: row.is_encrypted || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Merge: keep local loops not on server (failed to sync)
    const serverIds = new Set(serverLoops.map(l => l.id));
    const unsyncedLocal = localLoops.filter(l => !serverIds.has(l.id));
    const merged = [...serverLoops, ...unsyncedLocal];

    setLocal(LOOPS_KEY, merged);

    // Try to sync unsynced local loops to server
    for (const loop of unsyncedLocal) {
      saveLoop(loop, userId);
    }

    return merged;
  } catch (e) {
    console.warn('Failed to fetch loops from server:', e);
    return localLoops;
  }
}

export async function saveLoop(loop, userId) {
  const loops = getLocal(LOOPS_KEY);
  const idx = loops.findIndex(l => l.id === loop.id);
  if (idx >= 0) {
    loops[idx] = loop;
  } else {
    loops.unshift(loop);
  }
  setLocal(LOOPS_KEY, loops);

  if (!userId) return loop;

  try {
    const { data, error } = await supabase
      .from('loops')
      .upsert({
        id: loop.id,
        user_id: userId,
        title: loop.title,
        type: loop.type,
        status: loop.status,
        color: loop.color,
        subtasks: loop.subtasks,
        linked_to: loop.linkedTo,
        phase_opened: loop.phaseOpened,
        phase_name: loop.phaseName,
        lunar_month_opened: loop.lunarMonthOpened,
        moon_age_opened: loop.moonAgeOpened,
        zodiac_opened: loop.zodiacOpened,
        window_end: loop.windowEnd,
        opened_at: loop.openedAt,
        closed_at: loop.closedAt,
        released_at: loop.releasedAt,
        phase_closed: loop.phaseClosed || null,
        phase_name_closed: loop.phaseNameClosed || null,
        lunar_month_closed: loop.lunarMonthClosed || null,
        is_encrypted: loop.isEncrypted || false,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Supabase loops upsert error:', error);
      throw error;
    }
    console.log('Loop saved to Supabase:', data);
  } catch (e) {
    console.error('Failed to save loop to server:', e);
  }

  return loop;
}

export async function deleteLoop(loopId, userId) {
  const loops = getLocal(LOOPS_KEY).filter(l => l.id !== loopId);
  setLocal(LOOPS_KEY, loops);

  if (!userId) return;

  try {
    await supabase.from('loops').delete().eq('id', loopId);
  } catch (e) {
    console.warn('Failed to delete loop from server:', e);
  }
}

// ============ ECHOES ============

export async function getEchoes(userId) {
  if (!userId) return getLocal(ECHOES_KEY);

  try {
    const { data, error } = await supabase
      .from('echoes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const echoes = data.map(row => ({
      id: row.id,
      text: row.text,
      source: row.source || 'text',
      phase: row.phase,
      phaseName: row.phase_name,
      phaseType: row.phase_type || null,
      lunarMonth: row.lunar_month,
      dayOfCycle: row.day_of_cycle,
      zodiac: row.zodiac,
      illumination: row.illumination,
      isEncrypted: row.is_encrypted || false,
      createdAt: row.created_at,
    }));

    setLocal(ECHOES_KEY, echoes);
    return echoes;
  } catch (e) {
    console.warn('Failed to fetch echoes from server:', e);
    return getLocal(ECHOES_KEY);
  }
}

export async function saveEcho(echo, userId) {
  const echoes = getLocal(ECHOES_KEY);
  echoes.unshift(echo);
  setLocal(ECHOES_KEY, echoes);

  if (!userId) return echo;

  try {
    const { error } = await supabase
      .from('echoes')
      .insert({
        id: echo.id,
        user_id: userId,
        text: echo.text,
        source: echo.source || 'text',
        phase: echo.phase,
        phase_name: echo.phaseName,
        phase_type: echo.phaseType,
        lunar_month: echo.lunarMonth,
        day_of_cycle: echo.dayOfCycle,
        zodiac: echo.zodiac,
        illumination: echo.illumination,
        is_encrypted: echo.isEncrypted || false,
        created_at: echo.createdAt,
      });

    if (error) throw error;
  } catch (e) {
    console.warn('Failed to save echo to server:', e);
  }

  return echo;
}

export async function deleteEcho(echoId, userId) {
  const echoes = getLocal(ECHOES_KEY).filter(e => e.id !== echoId);
  setLocal(ECHOES_KEY, echoes);

  if (!userId) return;

  try {
    await supabase.from('echoes').delete().eq('id', echoId);
  } catch (e) {
    console.warn('Failed to delete echo from server:', e);
  }
}

// ============ MIGRATION ============

export async function migrateLocalToServer(userId) {
  if (!userId) return;

  const localLoops = getLocal(LOOPS_KEY);
  for (const loop of localLoops) {
    await saveLoop(loop, userId);
  }

  const localEchoes = getLocal(ECHOES_KEY);
  for (const echo of localEchoes) {
    // Check if echo already exists
    const { data } = await supabase
      .from('echoes')
      .select('id')
      .eq('id', echo.id)
      .single();

    if (!data) {
      await saveEcho(echo, userId);
    }
  }
}

// ============ PHASE SUMMARIES ============

export function getPhaseSummaries() {
  return getLocal(PHASE_SUMMARIES_KEY);
}

export function savePhaseSummary(summary) {
  const summaries = getLocal(PHASE_SUMMARIES_KEY);
  // Check if summary for this phase/cycle already exists
  const existingIdx = summaries.findIndex(s =>
    s.phaseKey === summary.phaseKey && s.lunarMonth === summary.lunarMonth
  );
  if (existingIdx >= 0) {
    summaries[existingIdx] = summary;
  } else {
    summaries.unshift(summary);
  }
  // Keep only last 30 phase summaries (roughly 4 cycles)
  setLocal(PHASE_SUMMARIES_KEY, summaries.slice(0, 30));
  return summary;
}

// Generate a phase summary from echoes and loops
export function generatePhaseSummary(phaseKey, phaseName, lunarMonth, echoes, loops) {
  // Filter echoes from this phase
  const phaseEchoes = echoes.filter(e =>
    e.phase === phaseKey && e.lunarMonth === lunarMonth
  );

  // Filter loops opened or closed in this phase
  const loopsOpened = loops.filter(l =>
    l.phaseOpened === phaseKey && l.lunarMonthOpened === lunarMonth
  );
  const loopsClosed = loops.filter(l =>
    l.phaseClosed === phaseKey && l.status === 'closed'
  );
  const loopsReleased = loops.filter(l =>
    l.phaseClosed === phaseKey && l.status === 'released'
  );

  return {
    id: generateId('ps'),
    phaseKey,
    phaseName,
    lunarMonth,
    createdAt: new Date().toISOString(),
    echoes: phaseEchoes.map(e => ({
      id: e.id,
      text: e.text,
      source: e.source,
    })),
    loopsOpened: loopsOpened.map(l => ({
      id: l.id,
      title: l.title,
      type: l.type,
    })),
    loopsClosed: loopsClosed.map(l => ({
      id: l.id,
      title: l.title,
      type: l.type,
    })),
    loopsReleased: loopsReleased.map(l => ({
      id: l.id,
      title: l.title,
      type: l.type,
    })),
    stats: {
      echoCount: phaseEchoes.length,
      loopsOpenedCount: loopsOpened.length,
      loopsClosedCount: loopsClosed.length,
      loopsReleasedCount: loopsReleased.length,
    },
  };
}

// ============ CYCLE SUMMARIES ============

export function getCycleSummaries() {
  return getLocal(CYCLE_SUMMARIES_KEY);
}

export function saveCycleSummary(summary) {
  const summaries = getLocal(CYCLE_SUMMARIES_KEY);
  summaries.unshift(summary);
  // Keep only last 6 cycle summaries
  setLocal(CYCLE_SUMMARIES_KEY, summaries.slice(0, 6));
  return summary;
}

// Generate a lunar cycle summary from phase summaries
export function generateCycleSummary(lunarMonth, phaseSummaries) {
  const cyclePhaseSummaries = phaseSummaries.filter(s => s.lunarMonth === lunarMonth);

  // Aggregate stats
  const totalEchoes = cyclePhaseSummaries.reduce((sum, s) => sum + s.stats.echoCount, 0);
  const totalLoopsOpened = cyclePhaseSummaries.reduce((sum, s) => sum + s.stats.loopsOpenedCount, 0);
  const totalLoopsClosed = cyclePhaseSummaries.reduce((sum, s) => sum + s.stats.loopsClosedCount, 0);
  const totalLoopsReleased = cyclePhaseSummaries.reduce((sum, s) => sum + s.stats.loopsReleasedCount, 0);

  return {
    id: generateId('cs'),
    lunarMonth,
    createdAt: new Date().toISOString(),
    phaseSummaries: cyclePhaseSummaries,
    stats: {
      totalEchoes,
      totalLoopsOpened,
      totalLoopsClosed,
      totalLoopsReleased,
      phasesWithActivity: cyclePhaseSummaries.filter(s =>
        s.stats.echoCount > 0 || s.stats.loopsOpenedCount > 0
      ).length,
    },
  };
}

// Get phase summaries for current lunar month
export function getCurrentCyclePhaseSummaries(lunarMonth) {
  const summaries = getLocal(PHASE_SUMMARIES_KEY);
  return summaries.filter(s => s.lunarMonth === lunarMonth);
}

// Legacy exports for compatibility
export const storage = {
  generateId,
  getLoops: () => getLocal(LOOPS_KEY),
  saveLoops: (loops) => setLocal(LOOPS_KEY, loops),
  getEchoes: () => getLocal(ECHOES_KEY),
  saveEchoes: (echoes) => setLocal(ECHOES_KEY, echoes),
};
