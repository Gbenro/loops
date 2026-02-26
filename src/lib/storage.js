// Cosmic Loops - Storage with Supabase sync
import { supabase } from './supabase.js';

const LOOPS_KEY = 'cosmic_loops_v1';
const ECHOES_KEY = 'cosmic_echoes_v1';

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
      type: row.type || 'open',
      color: row.color || '#A78BFA',
      recurrence: row.recurrence,
      subtasks: row.subtasks || [],
      closed: row.closed || false,
      phaseOpened: row.phase_opened,
      phaseName: row.phase_name,
      lunarMonthOpened: row.lunar_month_opened,
      moonAgeOpened: row.moon_age_opened,
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
        color: loop.color,
        recurrence: loop.recurrence,
        subtasks: loop.subtasks,
        closed: loop.closed,
        phase_opened: loop.phaseOpened,
        phase_name: loop.phaseName,
        lunar_month_opened: loop.lunarMonthOpened,
        moon_age_opened: loop.moonAgeOpened,
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
      phase: row.phase,
      phaseName: row.phase_name,
      lunarMonth: row.lunar_month,
      dayOfCycle: row.day_of_cycle,
      zodiac: row.zodiac,
      illumination: row.illumination,
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
        phase: echo.phase,
        phase_name: echo.phaseName,
        lunar_month: echo.lunarMonth,
        day_of_cycle: echo.dayOfCycle,
        zodiac: echo.zodiac,
        illumination: echo.illumination,
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

// Legacy exports for compatibility
export const storage = {
  generateId,
  getLoops: () => getLocal(LOOPS_KEY),
  saveLoops: (loops) => setLocal(LOOPS_KEY, loops),
  getEchoes: () => getLocal(ECHOES_KEY),
  saveEchoes: (echoes) => setLocal(ECHOES_KEY, echoes),
};
