import type {
  LunaServices,
  FieldSnapshot,
  Echo,
  Loop,
  Thread,
  Reflection,
  Cycle,
  Phase,
  PhaseId,
  EchoQuery,
  CaptureInput,
  LoopStatus,
  LunarContext,
  ChatMessage,
  AuthUser,
  SyncStatus
} from './contracts.ts';
import { FIXTURES } from './fixtures.ts';
import { cleanText, makeId, filterEchoes, LOOP_STATUSES } from './mock-services.ts';
import { getLiveLunarData, type LiveLunarBundle } from './lunar-engine.ts';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';
const LOOPS_KEY = 'cosmic_loops_v1';
const ECHOES_KEY = 'cosmic_echoes_v1';
const REFLECTIONS_KEY = 'cosmic_reflections_v1';
const AUTH_KEY = 'sb-eyxvsbqyzeodsjajfqsj-auth-token';
const SAMPLE_MODE_KEY = 'luna_beta_sample_mode';
const DRAFT_AUDIO_DB = 'luna_draft_audio_db';
const DRAFT_AUDIO_STORE = 'draft_recordings';

// In-memory fallback if IndexedDB is unavailable (e.g. test environments)
const memoryDraftAudio = new Map<string, { blob: Blob; duration?: number; status?: string; userId?: string | null; updatedAt?: string; echoId?: string }>();

function openDraftDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DRAFT_AUDIO_DB, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DRAFT_AUDIO_STORE)) {
          db.createObjectStore(DRAFT_AUDIO_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open draft audio IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveDraftAudio(
  id: string,
  blob: Blob,
  meta: { echoId?: string; duration?: number; status?: string; userId?: string | null } = {},
  ownerId?: string | null
): Promise<void> {
  const currentUserId = ownerId || meta.userId || getAuthSession()?.userId || null;
  const record = {
    id,
    echoId: meta.echoId || id,
    userId: currentUserId,
    blob,
    duration: meta.duration || 0,
    status: meta.status || 'draft',
    updatedAt: new Date().toISOString()
  };

  memoryDraftAudio.set(id, record);
  if (meta.echoId && meta.echoId !== id) {
    memoryDraftAudio.set(meta.echoId, record);
  }

  // If IndexedDB is not defined in the environment, memory fallback completes successfully
  if (typeof indexedDB === 'undefined') {
    return;
  }

  const db = await openDraftDB();
  if (!db) {
    throw new Error('IndexedDB unavailable or failed to open');
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DRAFT_AUDIO_STORE, 'readwrite');
      const store = tx.objectStore(DRAFT_AUDIO_STORE);
      store.put(record);
      if (meta.echoId && meta.echoId !== id) {
        store.put({ ...record, id: meta.echoId });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Draft audio transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Draft audio transaction aborted'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function getDraftAudio(
  idOrEchoId: string,
  expectedUserId?: string | null
): Promise<{ blob: Blob; duration?: number; status?: string; userId?: string | null } | null> {
  const mem = memoryDraftAudio.get(idOrEchoId);
  if (mem) {
    if (expectedUserId && mem.userId !== expectedUserId) {
      return null;
    }
    return mem;
  }

  if (typeof indexedDB === 'undefined') return null;

  try {
    const db = await openDraftDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(DRAFT_AUDIO_STORE, 'readonly');
        const store = tx.objectStore(DRAFT_AUDIO_STORE);
        const req = store.get(idOrEchoId);
        req.onsuccess = () => {
          const res = req.result;
          if (res && res.blob) {
            if (expectedUserId && res.userId !== expectedUserId) {
              resolve(null);
            } else {
              resolve({
                blob: res.blob,
                duration: res.duration,
                status: res.status,
                userId: res.userId
              });
            }
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function listDraftRecordings(
  userId?: string | null
): Promise<Array<{ id: string; echoId?: string; duration?: number; status?: string; updatedAt?: string }>> {
  const list: Array<{ id: string; echoId?: string; duration?: number; status?: string; updatedAt?: string }> = [];
  const seenIds = new Set<string>();

  for (const [id, item] of memoryDraftAudio.entries()) {
    if (seenIds.has(id)) continue;
    if (userId && item.userId !== userId) continue;
    seenIds.add(id);
    list.push({
      id,
      echoId: item.echoId,
      duration: item.duration,
      status: item.status,
      updatedAt: item.updatedAt
    });
  }

  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openDraftDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(DRAFT_AUDIO_STORE, 'readonly');
            const store = tx.objectStore(DRAFT_AUDIO_STORE);
            const req = store.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                const val = cursor.value;
                if (!seenIds.has(val.id) && (!userId || val.userId === userId)) {
                  seenIds.add(val.id);
                  list.push({
                    id: val.id,
                    echoId: val.echoId,
                    duration: val.duration,
                    status: val.status,
                    updatedAt: val.updatedAt
                  });
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch {}
  }

  return list;
}

interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: { id: string; email?: string };
}

function getStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Storage save error:', err);
  }
}

let authGeneration = 0;
let inFlightRefresh: Promise<{ token: string | null; userId: string | null }> | null = null;

export function getAuthSession(): { token: string | null; userId: string | null; expiresAt?: number; refreshToken?: string | null } {
  try {
    const session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
    if (session && session.access_token) {
      return {
        token: session.access_token,
        userId: session.user?.id || null,
        expiresAt: session.expires_at,
        refreshToken: session.refresh_token || null
      };
    }
  } catch {}
  return { token: null, userId: null, refreshToken: null };
}

export async function refreshAuthSession(): Promise<{ token: string | null; userId: string | null }> {
  if (inFlightRefresh) return inFlightRefresh;

  const currentGen = authGeneration;
  inFlightRefresh = (async () => {
    try {
      const session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
      if (!session || !session.refresh_token) {
        return { token: null, userId: null };
      }

      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      // If user signed out or account switched during fetch, drop the response
      if (currentGen !== authGeneration) {
        return { token: null, userId: null };
      }
      const activeSession = getAuthSession();
      if (!activeSession.userId || (session.user?.id && activeSession.userId !== session.user.id)) {
        return { token: null, userId: null };
      }

      if (!res.ok) {
        console.warn('Token refresh failed (' + res.status + ')');
        return { token: null, userId: null };
      }

      const data = await res.json();
      if (currentGen !== authGeneration) {
        return { token: null, userId: null };
      }

      const updatedSession: SupabaseSession = {
        access_token: data.access_token,
        token_type: data.token_type || 'bearer',
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        refresh_token: data.refresh_token || session.refresh_token,
        user: data.user || session.user
      };

      setStoredJson(AUTH_KEY, updatedSession);

      try {
        if (typeof indexedDB !== 'undefined') {
          const req = indexedDB.open('luna_auth_db', 1);
          req.onsuccess = (e: any) => {
            const idb = e.target.result;
            if (idb?.objectStoreNames?.contains('auth')) {
              const tx = idb.transaction('auth', 'readwrite');
              tx.objectStore('auth').put(JSON.stringify(updatedSession), AUTH_KEY);
            }
          };
        }
      } catch {}

      return {
        token: updatedSession.access_token,
        userId: updatedSession.user?.id || null
      };
    } catch (err) {
      console.warn('Error during token refresh:', err);
      return { token: null, userId: null };
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  let session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
  const nowSec = Math.floor(Date.now() / 1000);

  // Proactive refresh if token expires within 60 seconds
  if (session?.refresh_token && session?.expires_at && session.expires_at - nowSec < 60) {
    const refreshed = await refreshAuthSession();
    if (refreshed.token) {
      session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
    }
  }

  const doRequest = async (token: string | null) => {
    const headers: Record<string, string> = {
      'apikey': SUPABASE_ANON_KEY,
      ...(options.headers as Record<string, string> || {})
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    } else {
      headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
    }
    const url = endpoint.startsWith('http') ? endpoint : SUPABASE_URL + endpoint;
    return await fetch(url, { ...options, headers });
  };

  let res = await doRequest(session?.access_token || null);

  // If 401 Unauthorized and refresh token exists, attempt token refresh and retry request once
  if (res.status === 401 && session?.refresh_token) {
    const refreshed = await refreshAuthSession();
    if (refreshed.token) {
      res = await doRequest(refreshed.token);
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error('Supabase request failed (' + res.status + '): ' + errorText);
  }
  const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : '';
  if (contentType.includes('application/json') || (!contentType && typeof res.json === 'function')) {
    return await res.json();
  }
  return await res.text();
}

function mapClassicStatusToBeta(status: string, hasHistory = false): LoopStatus {
  switch (status) {
    case 'closed': return 'closed';
    case 'carried': return 'carried-forward';
    case 'released': return 'completed';
    case 'active':
    default:
      return hasHistory ? 'evolving' : 'open';
  }
}

function mapBetaStatusToClassic(status: LoopStatus): string {
  switch (status) {
    case 'closed': return 'closed';
    case 'carried-forward': return 'carried';
    case 'completed': return 'released';
    case 'open':
    case 'evolving':
    default:
      return 'active';
  }
}

function mapClassicEchoToBeta(raw: any, lunar: LiveLunarBundle): Echo {
  const id = String(raw.id || makeId('echo'));
  const text = String(raw.text || '').trim();
  const title = String(raw.title || (text ? text.split(/[.\n!?]/)[0].slice(0, 50) : 'A spoken moment'));
  const audio_path = raw.audio_path || raw.audioPath || undefined;
  const isVoice = Boolean(audio_path) || raw.source === 'voice' || raw.kind === 'voice';

  const phaseId = (raw.phase || lunar.phaseId) as PhaseId;
  const phaseName = raw.phaseName || raw.phase_name || lunar.phaseName;
  const cycleId = 'cycle-' + (raw.lunarMonth || raw.lunar_month || lunar.lunarMonth).toLowerCase().replace(/[^a-z0-9]/g, '-');

  const context: LunarContext = {
    cycleId,
    phaseId,
    label: phaseName,
    source: 'backend'
  };

  return {
    id,
    title,
    body: text,
    occurredAt: raw.created_at || raw.createdAt || raw.occurredAt || new Date().toISOString(),
    kind: isVoice ? 'voice' : 'text',
    audio_path,
    audioUrl: raw.audioUrl || undefined,
    duration: raw.duration || undefined,
    waveform: Array.isArray(raw.waveform) ? raw.waveform : undefined,
    waveformSource: isVoice ? (raw.waveform ? 'decoded-audio' : 'unavailable') : undefined,
    context,
    threadIds: Array.isArray(raw.tags) ? raw.tags : [],
    provenance: 'local-session',
    user_id: raw.user_id || raw.userId || undefined,
    syncStatus: raw.syncStatus || (audio_path || !isVoice ? 'synced' : 'local-only'),
    audioSyncStatus: raw.audioSyncStatus || (isVoice ? (audio_path ? 'synced' : 'local-only') : undefined)
  };
}

function mapClassicLoopToBeta(raw: any): Loop {
  const id = String(raw.id || makeId('loop'));
  const title = String(raw.title || '').trim() || 'Untitled intention';
  const note = String(raw.note || '');
  const history: { status: LoopStatus; at: string }[] = Array.isArray(raw.history) ? raw.history : [];
  const status = mapClassicStatusToBeta(raw.status || 'active', history.length > 0);

  const echoId = raw.linkedTo || raw.related_echo_ids?.[0] || raw.relatedEchoIds?.[0] || undefined;

  return {
    id,
    title,
    note,
    status,
    echoId,
    history,
    provenance: 'local-session',
    user_id: raw.user_id || raw.userId || undefined,
    syncStatus: raw.syncStatus || 'synced'
  };
}

export function createLiveLunaServices(audioAssets: Record<string, string> = {}): LunaServices {
  let sampleMode = localStorage.getItem(SAMPLE_MODE_KEY) === 'true';
  let memorySnapshot: FieldSnapshot | null = null;
  const signedUrlCache = new Map<string, { url: string; expires: number }>();

  function computeLiveCycles(lunar: LiveLunarBundle): Cycle[] {
    const cycleRange = lunar.cycleStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' — ' + lunar.cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const currentCycle: Cycle = {
      id: lunar.cycleId,
      name: lunar.cycleName,
      world: 'ocean',
      range: cycleRange + ' · Astronomical ephemeris',
      phases: lunar.phases
    };

    return [currentCycle];
  }

  function getLocalEchoes(lunar: LiveLunarBundle): Echo[] {
    const raw = getStoredJson<any[]>(ECHOES_KEY, []);
    const { userId } = getAuthSession();
    return raw
      .filter(e => {
        if (!e || typeof e !== 'object' || e.provenance === 'synthetic' || String(e.id || '').startsWith('echo-demo') || e.id === 'echo-return' || e.id === 'echo-water') return false;
        // Account isolation: when authenticated, show records for this user or unassigned local offline drafts
        if (userId) {
          return (!e.user_id && !e.userId) || e.user_id === userId || e.userId === userId;
        }
        return !e.user_id && !e.userId;
      })
      .map(e => mapClassicEchoToBeta(e, lunar));
  }

  function getLocalLoops(): Loop[] {
    const raw = getStoredJson<any[]>(LOOPS_KEY, []);
    const { userId } = getAuthSession();
    return raw
      .filter(l => {
        if (!l || typeof l !== 'object' || l.provenance === 'synthetic' || String(l.id || '').startsWith('loop-demo')) return false;
        if (userId) {
          return (!l.user_id && !l.userId) || l.user_id === userId || l.userId === userId;
        }
        return !l.user_id && !l.userId;
      })
      .map(mapClassicLoopToBeta);
  }

  function getLocalReflections(): Reflection[] {
    const raw = getStoredJson<any[]>(REFLECTIONS_KEY, []);
    const { userId } = getAuthSession();
    return raw
      .filter(r => {
        if (!r || typeof r !== 'object' || r.provenance === 'synthetic') return false;
        if (userId) {
          return (!r.user_id && !r.userId) || r.user_id === userId || r.userId === userId;
        }
        return !r.user_id && !r.userId;
      })
      .map(r => ({
        id: r.id || makeId('ref'),
        echoId: r.echo_id || r.echoId,
        author: r.author || 'person',
        body: r.body || '',
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        provenance: 'local-session' as const,
        user_id: r.user_id || r.userId || undefined
      }));
  }

  function assembleSnapshot(): FieldSnapshot {
    const lunar = getLiveLunarData(new Date());
    const cycles = computeLiveCycles(lunar);

    if (sampleMode) {
      const snap = structuredClone(FIXTURES);
      snap.current = lunar.context;
      snap.cycles = cycles;
      return snap;
    }

    const echoes = getLocalEchoes(lunar);
    const loops = getLocalLoops();
    const reflections = getLocalReflections();

    const threadMap = new Map<string, { id: string; title: string; echoIds: string[]; loopIds: string[] }>();
    for (const e of echoes) {
      for (const tag of e.threadIds) {
        if (!threadMap.has(tag)) {
          threadMap.set(tag, { id: tag, title: tag, echoIds: [], loopIds: [] });
        }
        threadMap.get(tag)!.echoIds.push(e.id);
      }
    }
    const threads: Thread[] = Array.from(threadMap.values()).map(t => ({
      id: t.id,
      title: t.title,
      description: 'Connected in your personal field.',
      echoIds: t.echoIds,
      loopIds: t.loopIds
    }));

    return {
      echoes,
      loops,
      threads,
      reflections,
      cycles,
      current: lunar.context
    };
  }

  memorySnapshot = assembleSnapshot();

  let activeSyncPromise: Promise<void> | null = null;
  let pendingSyncRequested = false;

  async function syncServer(): Promise<void> {
    if (activeSyncPromise) {
      pendingSyncRequested = true;
      return activeSyncPromise;
    }

    const { token, userId } = getAuthSession();
    if (!token || !userId) return;

    activeSyncPromise = (async () => {
      try {
        await doSyncServer(token, userId);
      } finally {
        activeSyncPromise = null;
        if (pendingSyncRequested) {
          pendingSyncRequested = false;
          void syncServer();
        }
      }
    })();

    return activeSyncPromise;
  }

  async function doSyncServer(token: string, userId: string): Promise<void> {
    try {
      const lunar = getLiveLunarData(new Date());

      // 1. Scope deletion tombstones by authenticated user with pagination
      const deletedLoopIds = new Set<string>();
      const userDeletedLoopKey = 'luna_deleted_loop_ids_' + userId;
      const storedDeletedLoops = getStoredJson<string[]>(userDeletedLoopKey, []);
      storedDeletedLoops.forEach(id => deletedLoopIds.add(id));

      let loopOffset = 0;
      while (loopOffset < 500) {
        const deletedBatch = await supabaseFetch(
          '/rest/v1/loops?select=id,deleted_at,updated_at&user_id=eq.' + encodeURIComponent(userId) +
          '&deleted_at=not.is.null&order=deleted_at.desc&limit=100&offset=' + loopOffset
        ).catch(() => []);
        if (Array.isArray(deletedBatch) && deletedBatch.length > 0) {
          for (const d of deletedBatch) {
            if (d.id) deletedLoopIds.add(d.id);
          }
          if (deletedBatch.length < 100) break;
          loopOffset += 100;
        } else {
          break;
        }
      }
      setStoredJson(userDeletedLoopKey, Array.from(deletedLoopIds));

      const deletedEchoIds = new Set<string>();
      const userDeletedEchoKey = 'luna_deleted_echo_ids_' + userId;
      const storedDeletedEchoes = getStoredJson<string[]>(userDeletedEchoKey, []);
      storedDeletedEchoes.forEach(id => deletedEchoIds.add(id));

      let echoOffset = 0;
      while (echoOffset < 500) {
        const deletedBatch = await supabaseFetch(
          '/rest/v1/echoes?select=id,deleted_at,updated_at&user_id=eq.' + encodeURIComponent(userId) +
          '&deleted_at=not.is.null&order=deleted_at.desc&limit=100&offset=' + echoOffset
        ).catch(() => []);
        if (Array.isArray(deletedBatch) && deletedBatch.length > 0) {
          for (const d of deletedBatch) {
            if (d.id) deletedEchoIds.add(d.id);
          }
          if (deletedBatch.length < 100) break;
          echoOffset += 100;
        } else {
          break;
        }
      }
      setStoredJson(userDeletedEchoKey, Array.from(deletedEchoIds));

      // 2. Fetch server loops (active)
      const serverLoops = await supabaseFetch(
        '/rest/v1/loops?select=*&user_id=eq.' + encodeURIComponent(userId) + '&deleted_at=is.null&order=created_at.desc'
      ).catch(() => null);

      if (Array.isArray(serverLoops)) {
        // Tombstones win over server responses
        const activeServerLoops = serverLoops.filter(sl => !deletedLoopIds.has(sl.id));

        const rawLocal = getStoredJson<any[]>(LOOPS_KEY, []);
        // Strict account scoping: only reconcile records explicitly belonging to this user
        const currentUserLoops = rawLocal.filter(l => l && (l.user_id === userId || l.userId === userId));
        const pruned = currentUserLoops.filter(l => !deletedLoopIds.has(l.id));

        const localMap = new Map(pruned.map(l => [l.id, l]));
        const serverIds = new Set(activeServerLoops.map(sl => sl.id));
        const reconciled: any[] = [];

        // Reconcile server loops
        for (const sl of activeServerLoops) {
          const localItem = localMap.get(sl.id);
          if (localItem) {
            const serverUpdated = new Date(sl.updated_at || sl.created_at || 0).getTime();
            const localUpdated = new Date(localItem.updated_at || localItem.updatedAt || 0).getTime();

            // Conflict-safe reconciliation: protect newer local edits
            if (localUpdated > serverUpdated && (localItem.syncStatus === 'local-only' || localItem.syncStatus === 'failed')) {
              try {
                await supabaseFetch('/rest/v1/loops?id=eq.' + encodeURIComponent(sl.id), {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: localItem.status,
                    note: localItem.note,
                    title: localItem.title,
                    updated_at: localItem.updated_at || new Date().toISOString()
                  })
                });
                reconciled.push({ ...localItem, user_id: userId, syncStatus: 'synced' as SyncStatus });
              } catch {
                reconciled.push({ ...localItem, user_id: userId, syncStatus: 'failed' as SyncStatus });
              }
            } else {
              reconciled.push({
                ...localItem,
                ...sl,
                user_id: userId,
                syncStatus: 'synced' as SyncStatus
              });
            }
          } else {
            reconciled.push({
              ...sl,
              user_id: userId,
              syncStatus: 'synced' as SyncStatus
            });
          }
        }

        // Preserve local unsynced loops that are NOT on server (e.g. created offline)
        // AND preserve existing synced loops that may have been omitted due to pagination
        for (const localItem of pruned) {
          if (!serverIds.has(localItem.id)) {
            if (localItem.syncStatus === 'local-only' || localItem.syncStatus === 'failed' || !localItem.syncStatus) {
              try {
                await supabaseFetch('/rest/v1/loops', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: localItem.id,
                    user_id: userId,
                    title: localItem.title,
                    note: localItem.note,
                    status: localItem.status || 'active',
                    created_at: localItem.created_at || localItem.createdAt || new Date().toISOString(),
                    updated_at: localItem.updated_at || localItem.updatedAt || new Date().toISOString()
                  })
                });
                reconciled.push({ ...localItem, user_id: userId, syncStatus: 'synced' as SyncStatus });
              } catch {
                reconciled.push({ ...localItem, user_id: userId, syncStatus: 'failed' as SyncStatus });
              }
            } else {
              // Previously synced: SAFE RECONCILIATION - DO NOT PURGE
              reconciled.push(localItem);
            }
          }
        }

        // Transactionally merge into the LATEST local array so intervening offline creates/edits are never lost
        const latestAllLoops = getStoredJson<any[]>(LOOPS_KEY, []);
        const reconciledMap = new Map(reconciled.map(l => [l.id, l]));
        const finalLoops: any[] = [];
        const seenIds = new Set<string>();

        for (const item of latestAllLoops) {
          if (!item || !item.id) continue;
          if (deletedLoopIds.has(item.id)) continue;
          seenIds.add(item.id);
          const rec = reconciledMap.get(item.id);
          if (rec) {
            const itemUpdated = new Date(item.updated_at || item.updatedAt || item.created_at || item.createdAt || 0).getTime();
            const recUpdated = new Date(rec.updated_at || rec.updatedAt || rec.created_at || rec.createdAt || 0).getTime();
            if (itemUpdated > recUpdated) {
              finalLoops.push(item);
            } else {
              finalLoops.push(rec);
            }
          } else {
            // Created or unmodified while sync was in flight: PRESERVE!
            finalLoops.push(item);
          }
        }

        for (const rec of reconciled) {
          if (!seenIds.has(rec.id) && !deletedLoopIds.has(rec.id)) {
            finalLoops.push(rec);
            seenIds.add(rec.id);
          }
        }

        setStoredJson(LOOPS_KEY, finalLoops);
      }

      // 3. Fetch server echoes (active)
      const serverEchoes = await supabaseFetch(
        '/rest/v1/echoes?select=*&user_id=eq.' + encodeURIComponent(userId) + '&deleted_at=is.null&order=created_at.desc'
      ).catch(() => null);

      if (Array.isArray(serverEchoes)) {
        // Tombstones win over server responses
        const activeServerEchoes = serverEchoes.filter(se => !deletedEchoIds.has(se.id));

        const rawLocal = getStoredJson<any[]>(ECHOES_KEY, []);
        // Strict account scoping: only reconcile records explicitly belonging to this user (never claim unassigned guest records)
        const currentUserEchoes = rawLocal.filter(e => e && (e.user_id === userId || e.userId === userId));
        const pruned = currentUserEchoes.filter(e => !deletedEchoIds.has(e.id));

        const localMap = new Map(pruned.map(e => [e.id, e]));
        const serverIds = new Set(activeServerEchoes.map(se => se.id));
        const reconciled: any[] = [];

        for (const se of activeServerEchoes) {
          const localItem = localMap.get(se.id);
          if (localItem) {
            let audioPath = se.audio_path || se.audioPath || localItem.audio_path || localItem.audioPath || undefined;
            let audioSyncStatus: SyncStatus = (se.source === 'voice' || se.kind === 'voice') ? (audioPath ? 'synced' : 'local-only') : 'synced';

            // Check if audio file needs upload/repair even though metadata row exists on server
            if ((se.source === 'voice' || se.kind === 'voice') && !audioPath) {
              const draft = await getDraftAudio(localItem.id, userId);
              if (draft && draft.blob) {
                try {
                  const ext = draft.blob.type.includes('mp4') ? 'mp4' : draft.blob.type.includes('ogg') ? 'ogg' : 'webm';
                  const targetAudioPath = userId + '/' + localItem.id + '.' + ext;
                  await supabaseFetch('/storage/v1/object/echo-audio/' + targetAudioPath, {
                    method: 'POST',
                    headers: { 'Content-Type': draft.blob.type || 'audio/webm', 'x-upsert': 'true' },
                    body: draft.blob
                  });
                  audioPath = targetAudioPath;
                  audioSyncStatus = 'synced';
                  await supabaseFetch('/rest/v1/echoes?id=eq.' + encodeURIComponent(se.id), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audio_path: audioPath, updated_at: new Date().toISOString() })
                  });
                } catch (uploadErr) {
                  audioSyncStatus = 'failed';
                  console.warn('Audio repair upload failed during sync:', uploadErr);
                }
              }
            }

            const serverUpdated = new Date(se.updated_at || se.created_at || 0).getTime();
            const localUpdated = new Date(localItem.updated_at || localItem.updatedAt || localItem.created_at || localItem.createdAt || 0).getTime();

            if (localUpdated > serverUpdated && localItem.syncStatus !== 'synced') {
              reconciled.push({
                ...se,
                ...localItem,
                user_id: userId,
                audio_path: audioPath,
                audioPath: audioPath,
                audioSyncStatus,
                syncStatus: (audioSyncStatus === 'failed') ? ('failed' as SyncStatus) : ('synced' as SyncStatus)
              });
            } else {
              reconciled.push({
                ...localItem,
                ...se,
                audio_path: audioPath,
                audioPath: audioPath,
                audioUrl: localItem.audioUrl || se.audioUrl,
                waveform: localItem.waveform || se.waveform,
                duration: localItem.duration || se.duration,
                user_id: userId,
                audioSyncStatus,
                syncStatus: (audioSyncStatus === 'failed') ? ('failed' as SyncStatus) : ('synced' as SyncStatus)
              });
            }
          } else {
            const hasAudio = Boolean(se.audio_path || se.audioPath);
            const isVoice = se.source === 'voice' || se.kind === 'voice';
            reconciled.push({
              ...se,
              user_id: userId,
              audioSyncStatus: isVoice ? (hasAudio ? 'synced' : 'failed') : 'synced',
              syncStatus: (isVoice && !hasAudio) ? ('failed' as SyncStatus) : ('synced' as SyncStatus)
            });
          }
        }

        // Preserve local unsynced echoes that are NOT on server (e.g. created offline)
        // AND preserve existing synced echoes that may have been omitted due to pagination
        for (const localItem of pruned) {
          if (!serverIds.has(localItem.id)) {
            if (localItem.syncStatus === 'local-only' || localItem.syncStatus === 'failed' || !localItem.syncStatus) {
              try {
                let audioPath = localItem.audio_path || localItem.audioPath || null;
                let audioSyncStatus: SyncStatus = (localItem.source === 'voice' || localItem.kind === 'voice') ? (audioPath ? 'synced' : 'local-only') : 'synced';

                if ((localItem.source === 'voice' || localItem.kind === 'voice') && !audioPath) {
                  const draft = await getDraftAudio(localItem.id, userId);
                  if (draft && draft.blob) {
                    try {
                      const ext = draft.blob.type.includes('mp4') ? 'mp4' : draft.blob.type.includes('ogg') ? 'ogg' : 'webm';
                      audioPath = userId + '/' + localItem.id + '.' + ext;
                      await supabaseFetch('/storage/v1/object/echo-audio/' + audioPath, {
                        method: 'POST',
                        headers: { 'Content-Type': draft.blob.type || 'audio/webm', 'x-upsert': 'true' },
                        body: draft.blob
                      });
                      localItem.audio_path = audioPath;
                      localItem.audioPath = audioPath;
                      audioSyncStatus = 'synced';
                    } catch (uploadErr) {
                      audioSyncStatus = 'failed';
                      audioPath = null;
                      console.warn('Sync audio upload failed for offline echo:', localItem.id, uploadErr);
                    }
                  }
                }

                await supabaseFetch('/rest/v1/echoes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: localItem.id,
                    user_id: userId,
                    text: localItem.text || localItem.body || '',
                    title: localItem.title || 'A spoken moment',
                    source: localItem.source || localItem.kind || 'voice',
                    phase: localItem.phase || lunar.phaseId,
                    phase_name: localItem.phaseName || lunar.phaseName,
                    audio_path: audioPath,
                    created_at: localItem.created_at || localItem.createdAt || new Date().toISOString(),
                    updated_at: localItem.updated_at || localItem.updatedAt || new Date().toISOString()
                  })
                });

                const isVoice = (localItem.source === 'voice' || localItem.kind === 'voice');
                const finalSyncStatus: SyncStatus = (isVoice && audioSyncStatus !== 'synced') ? 'failed' : 'synced';

                reconciled.push({
                  ...localItem,
                  user_id: userId,
                  audio_path: audioPath,
                  audioPath: audioPath,
                  audioSyncStatus,
                  syncStatus: finalSyncStatus
                });
              } catch {
                reconciled.push({ ...localItem, user_id: userId, syncStatus: 'failed' as SyncStatus });
              }
            } else {
              // Previously synced: SAFE RECONCILIATION - DO NOT PURGE
              reconciled.push(localItem);
            }
          }
        }

        // Transactionally merge into the LATEST local array so intervening offline creates/edits are never lost
        const latestAllEchoes = getStoredJson<any[]>(ECHOES_KEY, []);
        const reconciledMap = new Map(reconciled.map(e => [e.id, e]));
        const finalEchoes: any[] = [];
        const seenIds = new Set<string>();

        for (const item of latestAllEchoes) {
          if (!item || !item.id) continue;
          if (deletedEchoIds.has(item.id)) continue;
          seenIds.add(item.id);
          const rec = reconciledMap.get(item.id);
          if (rec) {
            const itemUpdated = new Date(item.updated_at || item.updatedAt || item.created_at || item.createdAt || 0).getTime();
            const recUpdated = new Date(rec.updated_at || rec.updatedAt || rec.created_at || rec.createdAt || 0).getTime();
            if (itemUpdated > recUpdated) {
              finalEchoes.push(item);
            } else {
              finalEchoes.push(rec);
            }
          } else {
            // Created or unmodified while sync was in flight: PRESERVE!
            finalEchoes.push(item);
          }
        }

        for (const rec of reconciled) {
          if (!seenIds.has(rec.id) && !deletedEchoIds.has(rec.id)) {
            finalEchoes.push(rec);
            seenIds.add(rec.id);
          }
        }

        finalEchoes.sort((a, b) => (b.created_at || b.createdAt || '').localeCompare(a.created_at || a.createdAt || ''));
        setStoredJson(ECHOES_KEY, finalEchoes);
      }

      // 4. Fetch reflections
      const serverRefs = await supabaseFetch(
        '/rest/v1/echo_reflections?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.desc'
      ).catch(() => null);

      if (Array.isArray(serverRefs)) {
        const latestRefs = getStoredJson<any[]>(REFLECTIONS_KEY, []);
        const localIds = new Set(latestRefs.map(r => r.id));
        const merged = [...latestRefs];
        for (const sr of serverRefs) {
          if (!localIds.has(sr.id)) merged.push({ ...sr, user_id: userId });
        }
        setStoredJson(REFLECTIONS_KEY, merged);
      }

      memorySnapshot = assembleSnapshot();
    } catch (err) {
      console.warn('Sync failed (will use offline local data):', err);
    }
  }

  // Check IndexedDB if localStorage has no active session
  try {
    if (!getAuthSession().token && typeof indexedDB !== 'undefined') {
      const req = indexedDB.open('luna_auth_db', 1);
      req.onsuccess = (e: any) => {
        const idb = e.target.result;
        if (idb?.objectStoreNames?.contains('auth')) {
          const tx = idb.transaction('auth', 'readonly');
          const getReq = tx.objectStore('auth').get(AUTH_KEY);
          getReq.onsuccess = () => {
            if (getReq.result) {
              try {
                const raw = typeof getReq.result === 'string' ? JSON.parse(getReq.result) : getReq.result;
                if (raw?.access_token) {
                  setStoredJson(AUTH_KEY, raw);
                  void syncServer();
                }
              } catch {}
            }
          };
        }
      };
    }
  } catch {}

  // Initial async sync without blocking instant render
  void syncServer();

  return {
    mode: sampleMode ? 'sample' : 'live',
    isSampleMode: () => sampleMode,
    setSampleMode: (enabled: boolean) => {
      sampleMode = enabled;
      localStorage.setItem(SAMPLE_MODE_KEY, String(enabled));
      memorySnapshot = assembleSnapshot();
    },
    sync: syncServer,

    auth: {
      async getSession() {
        const { token, userId } = getAuthSession();
        return {
          mode: token && userId ? 'authenticated' : 'demo',
          subject: userId || undefined
        };
      },

      getUser(): AuthUser | null {
        try {
          const session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
          if (session?.user?.id) {
            return {
              id: session.user.id,
              email: session.user.email
            };
          }
        } catch {}
        return null;
      },

      async signIn(email: string, password: string): Promise<AuthUser> {
        authGeneration++;
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) throw new Error('Enter your email and password.');

        const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: cleanEmail, password })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.msg || errData.error_description || errData.message || 'Invalid email or password.');
        }

        const data = await res.json();
        const sessionRecord: SupabaseSession = {
          access_token: data.access_token,
          token_type: data.token_type || 'bearer',
          expires_in: data.expires_in,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          refresh_token: data.refresh_token,
          user: data.user
        };

        setStoredJson(AUTH_KEY, sessionRecord);

        // Also persist to IndexedDB so Classic Luna inherits the session immediately
        try {
          const req = indexedDB.open('luna_auth_db', 1);
          req.onsuccess = (e: any) => {
            const idb = e.target.result;
            if (idb?.objectStoreNames?.contains('auth')) {
              const tx = idb.transaction('auth', 'readwrite');
              tx.objectStore('auth').put(JSON.stringify(sessionRecord), AUTH_KEY);
            }
          };
        } catch {}

        sampleMode = false;
        localStorage.setItem(SAMPLE_MODE_KEY, 'false');

        await syncServer();
        memorySnapshot = assembleSnapshot();

        return { id: data.user.id, email: data.user.email };
      },

      async signOut(): Promise<void> {
        authGeneration++;
        inFlightRefresh = null;
        signedUrlCache.clear();
        memoryDraftAudio.clear();
        localStorage.removeItem(AUTH_KEY);
        try {
          if (typeof indexedDB !== 'undefined') {
            const req = indexedDB.open('luna_auth_db', 1);
            req.onsuccess = (e: any) => {
              const idb = e.target.result;
              if (idb?.objectStoreNames?.contains('auth')) {
                const tx = idb.transaction('auth', 'readwrite');
                tx.objectStore('auth').delete(AUTH_KEY);
              }
            };
          }
        } catch {}
        memorySnapshot = assembleSnapshot();
      }
    },

    echoes: {
      async list(query = {}) {
        const db = assembleSnapshot();
        const all = filterEchoes(db.echoes, query);
        const offset = Math.max(0, Number(query.cursor) || 0);
        const limit = Math.min(100, Math.max(1, query.limit || 30));
        return {
          items: structuredClone(all.slice(offset, offset + limit)),
          nextCursor: offset + limit < all.length ? String(offset + limit) : undefined
        };
      },

      async get(id: string) {
        const db = assembleSnapshot();
        const found = db.echoes.find(e => e.id === id);
        if (!found) throw new Error('This Echo is no longer available.');
        return structuredClone(found);
      },

      async create(input: CaptureInput) {
        const body = cleanText(input.body);
        if (input.kind === 'text' && !body) {
          throw new Error('Add a few words before keeping this Echo.');
        }
        if (input.kind === 'voice' && !input.audioUrl && !(input as any).audioBlob) {
          throw new Error('Record a little audio before keeping this Echo.');
        }

        const lunar = getLiveLunarData(new Date());
        const echoId = 'e' + Date.now() + Math.random().toString(36).substr(2, 4);
        const { token, userId } = getAuthSession();

        let audioPath: string | null = null;
        const audioBlob = (input as any).audioBlob as Blob | undefined;

        // Persist audio blob to durable IndexedDB immediately (local-first outbox)
        if (input.kind === 'voice' && audioBlob) {
          try {
            await saveDraftAudio(echoId, audioBlob, {
              echoId,
              duration: input.duration,
              status: 'local-only',
              userId: userId || null
            });
          } catch (err) {
            console.warn('IndexedDB audio save failed:', err);
          }
        }

        let syncStatus: SyncStatus = 'local-only';
        let audioSyncStatus: SyncStatus = (input.kind === 'voice') ? 'local-only' : 'synced';

        const title = cleanText(input.title, 120) || (body ? body.split(/[.\n!?]/)[0].slice(0, 50) : 'A spoken moment');

        // Canonical Classic Luna Echo schema with explicit SyncStatus typing
        const classicRecord: Record<string, any> & { syncStatus: SyncStatus; audioSyncStatus?: SyncStatus } = {
          id: echoId,
          text: body,
          title,
          source: input.kind,
          phase: lunar.phaseId,
          phaseName: lunar.phaseName,
          phaseType: 'flow',
          lunarMonth: lunar.lunarMonth,
          dayOfCycle: lunar.dayOfCycle,
          zodiac: typeof lunar.zodiac === 'object' && lunar.zodiac ? lunar.zodiac.sign : String(lunar.zodiac || ''),
          illumination: lunar.illumination,
          audio_path: undefined,
          audioPath: undefined,
          audioUrl: input.audioUrl,
          waveform: input.waveform,
          duration: input.duration,
          tags: [],
          loopIds: [],
          linkedLoopId: null,
          created_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          provenance_author: 'user',
          provenance_kind: 'original_echo',
          provenanceAuthor: 'user',
          provenanceKind: 'original_echo',
          user_id: userId || undefined,
          userId: userId || undefined,
          syncStatus,
          audioSyncStatus
        };

        // Persist locally FIRST (outbox pattern)
        const local = getStoredJson<any[]>(ECHOES_KEY, []);
        local.unshift(classicRecord);
        setStoredJson(ECHOES_KEY, local);

        // Upload and sync to Supabase if authenticated
        if (userId && token) {
          if (input.kind === 'voice' && audioBlob) {
            classicRecord.syncStatus = 'syncing';
            classicRecord.audioSyncStatus = 'syncing';
            try {
              const ext = audioBlob.type.includes('mp4') ? 'mp4' :
                          audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
              const targetAudioPath = userId + '/' + echoId + '.' + ext;

              await supabaseFetch('/storage/v1/object/echo-audio/' + targetAudioPath, {
                method: 'POST',
                headers: {
                  'Content-Type': audioBlob.type || 'audio/webm',
                  'x-upsert': 'true'
                },
                body: audioBlob
              });

              audioPath = targetAudioPath;
              classicRecord.audio_path = targetAudioPath;
              classicRecord.audioPath = targetAudioPath;
              classicRecord.audioSyncStatus = 'synced';
            } catch (err) {
              classicRecord.audioSyncStatus = 'failed';
              audioPath = null;
              classicRecord.audio_path = undefined;
              classicRecord.audioPath = undefined;
              console.warn('Audio upload to Supabase Storage failed, saved locally in IndexedDB:', err);
            }
          }

          try {
            await supabaseFetch('/rest/v1/echoes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({
                id: echoId,
                user_id: userId,
                text: body,
                title,
                source: input.kind,
                phase: lunar.phaseId,
                phase_name: lunar.phaseName,
                phase_type: 'flow',
                lunar_month: lunar.lunarMonth,
                day_of_cycle: lunar.dayOfCycle,
                zodiac: typeof lunar.zodiac === 'object' && lunar.zodiac ? lunar.zodiac.sign : String(lunar.zodiac || ''),
                illumination: lunar.illumination,
                audio_path: audioPath,
                tags: [],
                loop_ids: [],
                provenance_author: 'user',
                provenance_kind: 'original_echo',
                created_at: classicRecord.created_at,
                updated_at: classicRecord.updated_at
              })
            });

            // Echo is only marked synced if voice audio is also confirmed uploaded
            if (input.kind === 'voice' && classicRecord.audioSyncStatus !== 'synced') {
              classicRecord.syncStatus = 'failed';
            } else {
              classicRecord.syncStatus = 'synced';
            }
          } catch (err) {
            classicRecord.syncStatus = 'failed';
            console.warn('Server echo save failed, kept locally:', err);
          }

          // Transactionally update record in latest storage (preserving intervening records)
          const latestEchoes = getStoredJson<any[]>(ECHOES_KEY, []);
          const idx = latestEchoes.findIndex(e => e.id === echoId);
          if (idx !== -1) {
            latestEchoes[idx] = { ...latestEchoes[idx], ...classicRecord };
            setStoredJson(ECHOES_KEY, latestEchoes);
          }
        }

        memorySnapshot = assembleSnapshot();
        const mapped = mapClassicEchoToBeta(classicRecord, lunar);
        if (input.audioUrl) mapped.audioUrl = input.audioUrl;
        return mapped;
      }
    },

    loops: {
      async list() {
        const db = assembleSnapshot();
        return structuredClone(db.loops);
      },

      async create(title: string, note = '') {
        const t = cleanText(title, 120);
        if (!t) throw new Error('Give this intention a few words.');

        const loopId = 'l' + Date.now() + Math.random().toString(36).substr(2, 4);
        const { token, userId } = getAuthSession();
        const lunar = getLiveLunarData(new Date());
        const nowIso = new Date().toISOString();
        const windowEnd = new Date(Date.now() + lunar.phaseRemaining * 24 * 60 * 60 * 1000).toISOString();

        let syncStatus: SyncStatus = 'local-only';
        if (userId && token) syncStatus = 'syncing';

        const classicLoop: Record<string, any> & { syncStatus: SyncStatus } = {
          id: loopId,
          title: t,
          note: cleanText(note, 600),
          status: 'active',
          type: 'phase',
          color: '#A78BFA',
          subtasks: [],
          linkedTo: null,
          history: [],
          phaseOpened: lunar.phaseId,
          phaseName: lunar.phaseName,
          lunarMonthOpened: lunar.lunarMonth,
          moonAgeOpened: lunar.age,
          zodiacOpened: lunar.zodiac.sign,
          windowEnd: windowEnd,
          openedAt: nowIso,
          closedAt: null,
          releasedAt: null,
          isEncrypted: false,
          tags: [],
          focus: null,
          autoClosedReason: null,
          relatedEchoIds: [],
          createdAt: nowIso,
          updatedAt: nowIso,
          phase_opened: lunar.phaseId,
          phase_name: lunar.phaseName,
          lunar_month_opened: lunar.lunarMonth,
          moon_age_opened: lunar.age,
          zodiac_opened: lunar.zodiac.sign,
          window_end: windowEnd,
          opened_at: nowIso,
          closed_at: null,
          released_at: null,
          created_at: nowIso,
          updated_at: nowIso,
          user_id: userId || undefined,
          userId: userId || undefined,
          syncStatus
        };

        const local = getStoredJson<any[]>(LOOPS_KEY, []);
        local.unshift(classicLoop);
        setStoredJson(LOOPS_KEY, local);

        if (userId && token) {
          try {
            await supabaseFetch('/rest/v1/loops', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: loopId,
                user_id: userId,
                title: t,
                note: classicLoop.note,
                status: 'active',
                type: 'phase',
                color: '#A78BFA',
                subtasks: [],
                phase_opened: lunar.phaseId,
                phase_name: lunar.phaseName,
                lunar_month_opened: lunar.lunarMonth,
                moon_age_opened: lunar.age,
                zodiac_opened: lunar.zodiac.sign,
                window_end: windowEnd,
                opened_at: nowIso,
                created_at: nowIso,
                updated_at: nowIso
              })
            });
            classicLoop.syncStatus = 'synced';
          } catch (err) {
            classicLoop.syncStatus = 'failed';
            console.warn('Server loop save failed, kept locally:', err);
          }

          // Transactionally update record in latest storage (preserving intervening records)
          const latestLoops = getStoredJson<any[]>(LOOPS_KEY, []);
          const idx = latestLoops.findIndex(l => l.id === loopId);
          if (idx !== -1) {
            latestLoops[idx] = { ...latestLoops[idx], ...classicLoop };
            setStoredJson(LOOPS_KEY, latestLoops);
          }
        }

        memorySnapshot = assembleSnapshot();
        return mapClassicLoopToBeta(classicLoop);
      },

      async transition(id: string, status: LoopStatus) {
        if (!LOOP_STATUSES.includes(status)) throw new Error('Choose a recognized intention state.');

        const local = getStoredJson<any[]>(LOOPS_KEY, []);
        const loop = local.find(l => l.id === id);
        if (!loop) throw new Error('This Loop is no longer available.');

        if (!Array.isArray(loop.history)) loop.history = [];
        loop.history.push({
          status: mapClassicStatusToBeta(loop.status || 'active', loop.history.length > 0),
          at: new Date().toISOString()
        });

        const classicStatus = mapBetaStatusToClassic(status);
        const nowIso = new Date().toISOString();
        const lunar = getLiveLunarData(new Date());

        loop.status = classicStatus;
        loop.updatedAt = nowIso;
        loop.updated_at = nowIso;

        if (classicStatus === 'closed') {
          loop.closedAt = nowIso;
          loop.closed_at = nowIso;
          loop.phaseClosed = lunar.phaseId;
          loop.phase_closed = lunar.phaseId;
          loop.phaseNameClosed = lunar.phaseName;
          loop.phase_name_closed = lunar.phaseName;
          loop.lunarMonthClosed = lunar.lunarMonth;
          loop.lunar_month_closed = lunar.lunarMonth;
        } else if (classicStatus === 'released') {
          loop.releasedAt = nowIso;
          loop.released_at = nowIso;
          loop.phaseClosed = lunar.phaseId;
          loop.phase_closed = lunar.phaseId;
          loop.phaseNameClosed = lunar.phaseName;
          loop.phase_name_closed = lunar.phaseName;
          loop.lunarMonthClosed = lunar.lunarMonth;
          loop.lunar_month_closed = lunar.lunarMonth;
        }

        const { token, userId } = getAuthSession();
        loop.syncStatus = (userId && token) ? 'syncing' : 'local-only';
        setStoredJson(LOOPS_KEY, local);

        if (userId && token) {
          try {
            await supabaseFetch('/rest/v1/loops?id=eq.' + encodeURIComponent(id), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: classicStatus,
                closed_at: loop.closed_at,
                released_at: loop.released_at,
                phase_closed: loop.phase_closed,
                phase_name_closed: loop.phase_name_closed,
                lunar_month_closed: loop.lunar_month_closed,
                updated_at: nowIso
              })
            });
            loop.syncStatus = 'synced';
            setStoredJson(LOOPS_KEY, local);
          } catch (err) {
            loop.syncStatus = 'failed';
            setStoredJson(LOOPS_KEY, local);
            console.warn('Server loop transition sync failed:', err);
          }
        }

        memorySnapshot = assembleSnapshot();
        return mapClassicLoopToBeta(loop);
      }
    },

    cycles: {
      async list() {
        const db = assembleSnapshot();
        return structuredClone(db.cycles);
      },
      async current() {
        const db = assembleSnapshot();
        return structuredClone(db.current);
      }
    },

    threads: {
      async list() {
        const db = assembleSnapshot();
        return structuredClone(db.threads);
      },
      async linkEcho(threadId: string, echoId: string) {
        const local = getStoredJson<any[]>(ECHOES_KEY, []);
        const echo = local.find(e => e.id === echoId);
        if (!echo) throw new Error('Echo not found.');
        if (!Array.isArray(echo.tags)) echo.tags = [];
        if (!echo.tags.includes(threadId)) {
          echo.tags.push(threadId);
          setStoredJson(ECHOES_KEY, local);
        }
        memorySnapshot = assembleSnapshot();
        const foundThread = memorySnapshot.threads.find(t => t.id === threadId);
        return foundThread || { id: threadId, title: threadId, description: '', echoIds: [echoId], loopIds: [] };
      }
    },

    reflections: {
      async list(echoId?: string) {
        const db = assembleSnapshot();
        return structuredClone(db.reflections.filter(r => !echoId || r.echoId === echoId));
      },
      async add(echoId: string, body: string) {
        const text = cleanText(body);
        if (!text) throw new Error('Add your reflection first.');

        const refId = makeId('ref');
        const { token, userId } = getAuthSession();

        const record = {
          id: refId,
          echo_id: echoId,
          echoId,
          body: text,
          author: 'person',
          created_at: new Date().toISOString()
        };

        const local = getStoredJson<any[]>(REFLECTIONS_KEY, []);
        local.push(record);
        setStoredJson(REFLECTIONS_KEY, local);

        if (userId && token) {
          try {
            await supabaseFetch('/rest/v1/echo_reflections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: refId,
                user_id: userId,
                echo_id: echoId,
                body: text,
                author: 'person',
                created_at: record.created_at
              })
            });
          } catch (err) {
            console.warn('Server reflection sync failed:', err);
          }
        }

        memorySnapshot = assembleSnapshot();
        return {
          id: refId,
          echoId,
          body: text,
          author: 'person' as const,
          createdAt: record.created_at,
          provenance: 'local-session' as const
        };
      }
    },

    chat: {
      async respond(message: string, echoIds: string[]): Promise<ChatMessage> {
        if (!cleanText(message)) throw new Error('Write a message first.');
        const db = assembleSnapshot();
        const selected = echoIds.map(id => db.echoes.find(e => e.id === id)).filter(Boolean) as Echo[];

        return {
          id: makeId('chat'),
          role: 'luna',
          echoIds: selected.map(e => e.id),
          content: selected.length
            ? 'You have brought ' + selected.map(e => '“' + e.title + '”').join(' and ') + ' into this conversation. What feels the same when you return to ' + (selected.length === 1 ? 'this moment' : 'these moments') + ', and what feels different? This is a scripted demonstration prompt; no model has read or interpreted your message.'
            : 'What would you like to look at together? You can bring an Echo into this conversation using the context picker. This is a scripted demonstration; I do not have an active model connection in this beta.'
        };
      }
    },

    audio: {
      async resolve(echo: Echo): Promise<string | null> {
        const currentUserId = getAuthSession().userId;
        // Account isolation: User B cannot resolve User A's private draft audio
        if (echo.user_id && currentUserId && echo.user_id !== currentUserId) {
          return null;
        }

        // 1. Resolve from local durable IndexedDB cache first (avoids stale/revoked blob URL masking durable audio)
        try {
          const draft = await getDraftAudio(echo.id, currentUserId);
          if (draft && draft.blob) {
            const localUrl = URL.createObjectURL(draft.blob);
            return localUrl;
          }
        } catch {}

        if (echo.audioKey && audioAssets[echo.audioKey]) return audioAssets[echo.audioKey];

        // 2. Only use echo.audioUrl if it is a remote/data URL or if no durable draft was found
        if (echo.audioUrl) {
          if (echo.audioUrl.startsWith('http://') || echo.audioUrl.startsWith('https://') || echo.audioUrl.startsWith('data:')) {
            return echo.audioUrl;
          }
        }

        const path = (echo as any).audio_path || (echo as any).audioPath;
        if (!path) {
          if (echo.audioUrl) return echo.audioUrl;
          return null;
        }

        // 3. Check in-memory signed URL cache (avoid spamming Supabase for same path within 50 minutes)
        const cached = signedUrlCache.get(path);
        if (cached && cached.expires > Date.now()) {
          return cached.url;
        }

        // 4. Resolve from Supabase Storage
        try {
          const res = await supabaseFetch('/storage/v1/object/sign/echo-audio/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresIn: 3600 })
          });

          if (res && res.signedURL) {
            const fullUrl = SUPABASE_URL + '/storage/v1' + res.signedURL;
            signedUrlCache.set(path, { url: fullUrl, expires: Date.now() + 3000 * 1000 });
            return fullUrl;
          }
        } catch (err) {
          console.warn('Failed to resolve signed audio URL for path:', path, err);
        }

        return null;
      }
    },

    snapshot(): FieldSnapshot {
      return memorySnapshot || assembleSnapshot();
    },

    reset(): void {
      localStorage.removeItem(ECHOES_KEY);
      localStorage.removeItem(LOOPS_KEY);
      localStorage.removeItem(REFLECTIONS_KEY);
      memorySnapshot = assembleSnapshot();
    }
  };
}
