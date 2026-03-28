// Cosmic Loops — Rhythm data layer
// Practice observation: rhythms, cycle instances, observations

import { supabase } from './supabase.js';

const RHYTHMS_KEY      = 'cosmic_rhythms_v1';
const INSTANCES_KEY    = 'cosmic_rhythm_instances_v1';
const OBSERVATIONS_KEY = 'cosmic_rhythm_observations_v1';

const GENERATE_PHRASES_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/generate-phrases';
const SUPABASE_ANON_KEY    = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

// ── Local storage helpers ─────────────────────────────────────────────────────

function getLocal(key, fallback = []) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
}

function setLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch (e) { console.warn('localStorage save failed:', e); }
}

// ── Rhythms ───────────────────────────────────────────────────────────────────

export async function getRhythms(userId) {
  const local = getLocal(RHYTHMS_KEY);
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from('rhythms')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const server = data.map(rowToRhythm);
    const serverIds = new Set(server.map(r => r.id));
    const unsynced = local.filter(r => !serverIds.has(r.id));
    const merged = [...server, ...unsynced];
    setLocal(RHYTHMS_KEY, merged);
    for (const r of unsynced) saveRhythm(r, userId);
    return merged;
  } catch (e) {
    console.warn('Failed to fetch rhythms:', e);
    return local;
  }
}

export async function saveRhythm(rhythm, userId) {
  const all = getLocal(RHYTHMS_KEY);
  const idx = all.findIndex(r => r.id === rhythm.id);
  if (idx >= 0) all[idx] = rhythm; else all.push(rhythm);
  setLocal(RHYTHMS_KEY, all);

  if (!userId) return rhythm;

  try {
    const { error } = await supabase.from('rhythms').upsert({
      id:         rhythm.id,
      user_id:    userId,
      name:       rhythm.name,
      scope:      rhythm.scope,
      active:     rhythm.active !== false,
      created_at: rhythm.createdAt,
    });
    if (error) throw error;
  } catch (e) {
    console.warn('Failed to save rhythm:', e);
  }
  return rhythm;
}

export async function deleteRhythm(rhythmId, userId) {
  const all = getLocal(RHYTHMS_KEY).filter(r => r.id !== rhythmId);
  setLocal(RHYTHMS_KEY, all);

  if (!userId) return;
  try {
    await supabase.from('rhythms').update({ active: false }).eq('id', rhythmId);
  } catch (e) {
    console.warn('Failed to deactivate rhythm:', e);
  }
}

function rowToRhythm(row) {
  return {
    id:        row.id,
    name:      row.name,
    scope:     row.scope,
    active:    row.active,
    createdAt: row.created_at,
  };
}

// ── Cycle instances ───────────────────────────────────────────────────────────

export async function getInstancesForRhythm(rhythmId, userId) {
  const local = getLocal(INSTANCES_KEY).filter(i => i.rhythmId === rhythmId);
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from('rhythm_cycle_instances')
      .select('*')
      .eq('rhythm_id', rhythmId)
      .order('cycle_start', { ascending: false });

    if (error) throw error;

    const server = data.map(rowToInstance);
    const serverIds = new Set(server.map(i => i.id));

    // Merge with all local instances (for all rhythms)
    const allLocal = getLocal(INSTANCES_KEY);
    const otherLocal = allLocal.filter(i => i.rhythmId !== rhythmId);
    const unsyncedThis = local.filter(i => !serverIds.has(i.id));
    setLocal(INSTANCES_KEY, [...otherLocal, ...server, ...unsyncedThis]);
    for (const inst of unsyncedThis) saveInstance(inst, userId);

    return [...server, ...unsyncedThis];
  } catch (e) {
    console.warn('Failed to fetch cycle instances:', e);
    return local;
  }
}

export async function getOrCreateCurrentInstance(rhythm, cycleStart, userId) {
  const cycleStartISO = cycleStart instanceof Date ? cycleStart.toISOString() : cycleStart;

  // Check local storage first
  const allLocal = getLocal(INSTANCES_KEY);
  const existing = allLocal.find(
    i => i.rhythmId === rhythm.id && i.cycleStart === cycleStartISO
  );
  if (existing) return existing;

  // If logged in, check server for existing instance (may exist from another device/session)
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('rhythm_cycle_instances')
        .select('*')
        .eq('rhythm_id', rhythm.id)
        .eq('cycle_start', cycleStartISO)
        .single();

      if (!error && data) {
        const serverInstance = rowToInstance(data);
        // Save to local cache and return
        allLocal.push(serverInstance);
        setLocal(INSTANCES_KEY, allLocal);
        return serverInstance;
      }
    } catch (e) {
      // No server instance found, or error - continue to create new
    }
  }

  // Create new instance
  const instance = {
    id:              crypto.randomUUID(),
    rhythmId:        rhythm.id,
    userId:          userId || null,
    cycleStart:      cycleStartISO,
    intentionType:   null,
    wholeIntention:  null,
    phaseIntentions: {},
    reportGenerated: false,
    createdAt:       new Date().toISOString(),
  };

  allLocal.push(instance);
  setLocal(INSTANCES_KEY, allLocal);

  if (userId) {
    try {
      const { error } = await supabase.from('rhythm_cycle_instances').insert({
        id:               instance.id,
        rhythm_id:        instance.rhythmId,
        user_id:          userId,
        cycle_start:      instance.cycleStart,
        intention_type:   null,
        whole_intention:  null,
        phase_intentions: {},
        report_generated: false,
        created_at:       instance.createdAt,
      });
      if (error) throw error;
    } catch (e) {
      console.warn('Failed to create cycle instance:', e);
    }
  }

  return instance;
}

export async function saveInstance(instance, userId) {
  const all = getLocal(INSTANCES_KEY);
  const idx = all.findIndex(i => i.id === instance.id);
  if (idx >= 0) all[idx] = instance; else all.push(instance);
  setLocal(INSTANCES_KEY, all);

  if (!userId) return instance;

  try {
    const { error } = await supabase.from('rhythm_cycle_instances').upsert({
      id:               instance.id,
      rhythm_id:        instance.rhythmId,
      user_id:          userId,
      cycle_start:      instance.cycleStart,
      intention_type:   instance.intentionType || null,
      whole_intention:  instance.wholeIntention || null,
      phase_intentions: instance.phaseIntentions || {},
      report_generated: instance.reportGenerated || false,
      created_at:       instance.createdAt,
    });
    if (error) throw error;
  } catch (e) {
    console.warn('Failed to save cycle instance:', e);
  }
  return instance;
}

function rowToInstance(row) {
  return {
    id:              row.id,
    rhythmId:        row.rhythm_id,
    userId:          row.user_id,
    cycleStart:      row.cycle_start,
    intentionType:   row.intention_type,
    wholeIntention:  row.whole_intention,
    phaseIntentions: row.phase_intentions || {},
    reportGenerated: row.report_generated,
    createdAt:       row.created_at,
  };
}

// ── Observations ──────────────────────────────────────────────────────────────

export async function getObservationsForInstance(instanceId, userId) {
  const local = getLocal(OBSERVATIONS_KEY).filter(o => o.cycleInstanceId === instanceId);
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from('rhythm_observations')
      .select('*')
      .eq('cycle_instance_id', instanceId)
      .order('logged_at', { ascending: true });

    if (error) throw error;

    const server = data.map(rowToObservation);
    const serverPhases = new Set(server.map(o => o.phase));

    const allLocal = getLocal(OBSERVATIONS_KEY);
    const otherLocal = allLocal.filter(o => o.cycleInstanceId !== instanceId);
    const unsyncedThis = local.filter(o => !serverPhases.has(o.phase));
    setLocal(OBSERVATIONS_KEY, [...otherLocal, ...server, ...unsyncedThis]);
    for (const obs of unsyncedThis) saveObservation(obs, userId);

    return [...server, ...unsyncedThis];
  } catch (e) {
    console.warn('Failed to fetch observations:', e);
    return local;
  }
}

export async function saveObservation(obs, userId) {
  // Enforce one per phase per instance — replace existing
  const all = getLocal(OBSERVATIONS_KEY);
  const idx = all.findIndex(
    o => o.cycleInstanceId === obs.cycleInstanceId && o.phase === obs.phase
  );
  if (idx >= 0) all[idx] = obs; else all.push(obs);
  setLocal(OBSERVATIONS_KEY, all);

  if (!userId) return obs;

  try {
    const { error } = await supabase.from('rhythm_observations').upsert(
      {
        id:                obs.id,
        cycle_instance_id: obs.cycleInstanceId,
        user_id:           userId,
        phase:             obs.phase,
        engagement:        obs.engagement,
        note:              obs.note || null,
        logged_at:         obs.loggedAt,
      },
      { onConflict: 'cycle_instance_id,phase' }
    );
    if (error) throw error;
  } catch (e) {
    console.warn('Failed to save observation:', e);
  }
  return obs;
}

function rowToObservation(row) {
  return {
    id:              row.id,
    cycleInstanceId: row.cycle_instance_id,
    userId:          row.user_id,
    phase:           row.phase,
    engagement:      row.engagement,
    note:            row.note,
    loggedAt:        row.logged_at,
  };
}

// ── AI reflection (Waning Crescent report) ────────────────────────────────────

const RHYTHM_SYSTEM_PROMPT = `You are reading someone's engagement record with a named personal practice across a lunar cycle. You have their intended pattern and what actually happened.

Do not frame misalignment as failure or success. Notice the shape of what actually moved — where the practice deepened, where it receded, what the cycle revealed about this person's relationship to this practice.

3–4 sentences. Warm, precise, honest. Not therapeutic. Not congratulatory.
Speak directly to the person — use "you", not "they".
Never use the words "embrace", "journey", or "beautiful".`;

export async function generateRhythmReport({ rhythm, instance, observations, cycleLoopTitle }) {
  const PHASE_NAMES = {
    'new':             'New Moon',
    'waxing-crescent': 'Waxing Crescent',
    'first-quarter':   'First Quarter',
    'waxing-gibbous':  'Waxing Gibbous',
    'full':            'Full Moon',
    'waning-gibbous':  'Waning Gibbous',
    'last-quarter':    'Last Quarter',
    'waning-crescent': 'Waning Crescent',
  };

  const obsMap = {};
  for (const o of observations) obsMap[o.phase] = o;

  const allPhases = Object.keys(PHASE_NAMES);
  const observed = allPhases.filter(p => obsMap[p]);
  const missing  = allPhases.filter(p => !obsMap[p]);

  let intentionText = 'No intention set — pure observation mode.';
  if (instance.intentionType === 'whole' && instance.wholeIntention) {
    intentionText = `Whole-circle: ${instance.wholeIntention}`;
  } else if (instance.intentionType === 'phase') {
    const lines = allPhases.map(p => {
      const val = instance.phaseIntentions?.[p];
      return `  ${PHASE_NAMES[p]}: ${val || 'not set'}`;
    });
    intentionText = `Phase-by-phase:\n${lines.join('\n')}`;
  }

  const observedLines = observed.map(p => {
    const o = obsMap[p];
    return `  ${PHASE_NAMES[p]}: ${o.engagement}${o.note ? ` — "${o.note}"` : ''}`;
  }).join('\n');

  const contextPayload = [
    `Rhythm: ${rhythm.name}`,
    `Scope: ${rhythm.scope === 'ongoing' ? 'ongoing' : 'this cycle only'}`,
    cycleLoopTitle ? `Cycle intention: ${cycleLoopTitle}` : '',
    `Intended pattern:\n${intentionText}`,
    observed.length > 0 ? `Observed:\n${observedLines}` : 'Observed: nothing logged',
    missing.length > 0 ? `Phases with no observation: ${missing.map(p => PHASE_NAMES[p]).join(', ')}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const response = await fetch(GENERATE_PHRASES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: 'rhythm_report',
        systemPrompt: RHYTHM_SYSTEM_PROMPT,
        userMessage: contextPayload,
      }),
    });

    if (!response.ok) throw new Error(`Report generation failed: ${response.status}`);
    const result = await response.json();
    return result.text || result.reflection || null;
  } catch (e) {
    console.warn('Failed to generate rhythm report:', e);
    return null;
  }
}

// ── Cache cleanup (called on user change) ────────────────────────────────────

export function clearRhythmCache() {
  [RHYTHMS_KEY, INSTANCES_KEY, OBSERVATIONS_KEY].forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
}
