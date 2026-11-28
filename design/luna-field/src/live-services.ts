import { makeThreadIndex } from './thread-browse.ts';
import { ECHO_PAGE_SIZE, echoCycleOptions, echoTimeQuery, echoPageEndpoint, echoPageCursor, matchesEchoQuery } from './echo-browse.ts';
import { unlockWithPassphrase, encryptText, decryptText } from '../../../src/lib/encryption.js';
import { idbStorage } from '../../../src/lib/authStorage.js';
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
  SyncStatus,
  SpeechSynthesisResult
} from './contracts.ts';
import { FIXTURES, PHASES } from './fixtures.ts';
import { cleanText, makeId, filterEchoes, LOOP_STATUSES } from './mock-services.ts';
import { getLiveLunarData, type LiveLunarBundle } from './lunar-engine.ts';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';
const LOOPS_KEY = 'cosmic_loops_v1';
export const ECHOES_KEY = 'cosmic_echoes_v1';
const REFLECTIONS_KEY = 'cosmic_reflections_v1';
const AUTH_KEY = 'sb-eyxvsbqyzeodsjajfqsj-auth-token';
const SAMPLE_MODE_KEY = 'luna_beta_sample_mode';
const DRAFT_AUDIO_DB = 'luna_draft_audio_db';
const DRAFT_AUDIO_STORE = 'draft_recordings';

// Recovery copy remains available while this page is open; it is never a durable-save acknowledgement.
const memoryDraftAudio = new Map<string, { blob: Blob; duration?: number; status?: string; userId?: string | null; updatedAt?: string; startedAt?: string; echoId?: string }>();

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
  meta: { echoId?: string; duration?: number; status?: string; userId?: string | null; startedAt?: string } = {},
  ownerId?: string | null
): Promise<void> {
  const currentUserId = ownerId !== undefined ? ownerId : meta.userId !== undefined ? meta.userId : getAuthSession().userId;
  const record = {
    id,
    echoId: meta.echoId || id,
    userId: currentUserId,
    blob,
    duration: meta.duration || 0,
    status: meta.status || 'draft',
    startedAt: meta.startedAt || memoryDraftAudio.get(id)?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  memoryDraftAudio.set(id, record);
  if (meta.echoId && meta.echoId !== id) {
    memoryDraftAudio.set(meta.echoId, record);
  }

  if (typeof indexedDB === 'undefined') throw new Error('Audio is only in memory. Device storage is unavailable; keep this page open and download or retry.');

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
      tx.oncomplete = () => { db.close?.(); resolve(); };
      tx.onerror = () => { db.close?.(); reject(tx.error || new Error('Draft audio transaction failed')); };
      tx.onabort = () => { db.close?.(); reject(tx.error || new Error('Draft audio transaction aborted')); };
    } catch (err) {
      reject(err);
    }
  });
}

export async function getDraftAudio(
  idOrEchoId: string,
  expectedUserId?: string | null
): Promise<{ blob: Blob; duration?: number; status?: string; userId?: string | null } | null> {
  expectedUserId = expectedUserId === undefined ? getAuthSession().userId : expectedUserId;
  if (expectedUserId !== getAuthSession().userId) return null;
  const mem = memoryDraftAudio.get(idOrEchoId);
  if (mem) {
    if ((mem.userId ?? null) !== expectedUserId) {
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
            if ((res.userId ?? null) !== expectedUserId || getAuthSession().userId !== expectedUserId) {
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
): Promise<Array<{ id: string; echoId?: string; duration?: number; status?: string; updatedAt?: string; startedAt?: string }>> {
  const list: Array<{ id: string; echoId?: string; duration?: number; status?: string; updatedAt?: string; startedAt?: string }> = [];
  userId = userId === undefined ? getAuthSession().userId : userId;
  if (userId !== getAuthSession().userId) return [];
  const seenIds = new Set<string>();

  for (const [id, item] of memoryDraftAudio.entries()) {
    if (seenIds.has(id)) continue;
    if ((item.userId ?? null) !== userId) continue;
    seenIds.add(id);
    list.push({
      id,
      echoId: item.echoId,
      duration: item.duration,
      status: item.status,
      startedAt: item.startedAt, updatedAt: item.updatedAt
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
                if (!seenIds.has(val.id) && ((val.userId ?? null) === userId && getAuthSession().userId === userId)) {
                  seenIds.add(val.id);
                  list.push({
                    id: val.id,
                    echoId: val.echoId,
                    duration: val.duration,
                    status: val.status,
                    startedAt: val.startedAt, updatedAt: val.updatedAt
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

  return getAuthSession().userId === userId ? list : [];
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

async function refreshAuthSessionUnlocked(): Promise<{ token: string | null; userId: string | null }> {
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
      if (currentGen !== authGeneration || getAuthSession().token !== session.access_token || getAuthSession().refreshToken !== session.refresh_token || getAuthSession().userId !== session.user?.id || (data.user?.id && data.user.id !== session.user?.id)) {
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

      await idbStorage.setItem(AUTH_KEY, JSON.stringify(updatedSession));

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

export async function refreshAuthSession(): Promise<{token:string|null;userId:string|null}> {
  const before = getAuthSession();
  const run = async () => {
    const now = getAuthSession();
    if (now.userId !== before.userId) return {token:null,userId:null};
    if (now.token !== before.token) return now; // another tab already refreshed
    return refreshAuthSessionUnlocked();
  };
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('lock:' + AUTH_KEY, run) : run();
}

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const owner = getAuthSession().userId, gen = authGeneration;
  const check = () => { if (owner !== getAuthSession().userId || gen !== authGeneration) throw new Error('Account changed; request cancelled.'); };
  check();
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

  check();
  let res = await doRequest(session?.access_token || null);
  check();

  // If 401 Unauthorized and refresh token exists, attempt token refresh and retry request once
  if (res.status === 401 && session?.refresh_token) {
    const refreshed = await refreshAuthSession();
    if (refreshed.token) {
      check();
      res = await doRequest(refreshed.token);
      check();
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error('Supabase request failed (' + res.status + '): ' + errorText);
  }
  const contentType = res.headers?.get ? (res.headers.get('content-type') || '') : '';
  if (contentType.includes('application/json') || (!contentType && typeof res.json === 'function')) {
    const data = await res.json(); check(); return data;
  }
  const data = await res.text(); check(); return data;
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
    case 'carried-forward': return 'active';
    case 'completed': return 'released';
    case 'open':
    case 'evolving':
    default:
      return 'active';
  }
}

function mapClassicEchoToBeta(raw: any, lunar: LiveLunarBundle): Echo {
  const id = String(raw.id || makeId('echo'));
  const encrypted = Boolean(raw.is_encrypted || raw.isEncrypted);
  const text = encrypted ? 'Unlock your private Echo to read it.' : String(raw.text || '').trim();
  const title = String(raw.title || (text ? text.split(/[.\n!?]/)[0].slice(0, 50) : 'A spoken moment'));
  const audio_path = raw.audio_path || raw.audioPath || undefined;
  const isVoice = Boolean(audio_path) || raw.source === 'voice' || raw.kind === 'voice';

  const historical = getLiveLunarData(new Date(raw.created_at || raw.createdAt || raw.occurredAt || new Date()));
  const phaseId = (raw.phase || historical.phaseId) as PhaseId;
  const phaseName = raw.phaseName || raw.phase_name || PHASES.find(p=>p.id===phaseId)?.name || historical.phaseName;
  const cycleId = 'cycle-' + (raw.lunarMonth || raw.lunar_month || historical.lunarMonth).toLowerCase().replace(/[^a-z0-9]/g, '-');

  const context: LunarContext = {
    cycleId,
    phaseId,
    label: phaseName,
    cycleLabel: raw.lunarMonth || raw.lunar_month || historical.cycleName,
    source: 'backend'
  };

  return {
    id,
    title: encrypted ? 'Private Echo' : title,
    isEncrypted: encrypted, locked: encrypted,
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
  const lifecycle = raw.metadata?.luna_beta_lifecycle;
  const history: { status: LoopStatus; at: string }[] = Array.isArray(lifecycle?.history) ? lifecycle.history : Array.isArray(raw.history) ? raw.history : [];
  const currentMarker = lifecycle && lifecycle.classicStatus === raw.status &&
    Date.parse(lifecycle.updatedAt) === Date.parse(raw.updated_at || raw.updatedAt) && LOOP_STATUSES.includes(lifecycle.status);
  const status = currentMarker ? lifecycle.status : mapClassicStatusToBeta(raw.status || 'active');

  const echoId = raw.linkedTo || raw.related_echo_ids?.[0] || raw.relatedEchoIds?.[0] || undefined;

  return {
    id,
    title: (raw.is_encrypted || raw.isEncrypted) ? 'Private intention' : title,
    isEncrypted: Boolean(raw.is_encrypted || raw.isEncrypted), locked: Boolean(raw.is_encrypted || raw.isEncrypted),
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.map((item:any) => ({...item, id:String(item.id),text:String(item.text || item.title || ''),done:Boolean(item.done ?? item.completed)})) : [],
    note,
    status,
    echoId,
    history,
    provenance: 'local-session',
    user_id: raw.user_id || raw.userId || undefined,
    syncStatus: raw.syncStatus || 'synced'
  };
}

export function composeTimeoutSignal(callerSignal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException(`Operation timed out after ${timeoutMs}ms.`, 'TimeoutError'));
  }, timeoutMs);

  let onCallerAbort: (() => void) | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) {
      timeoutController.abort(callerSignal.reason);
    } else {
      onCallerAbort = () => timeoutController.abort(callerSignal.reason);
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  };

  return { signal: timeoutController.signal, cleanup };
}

export function createLiveLunaServices(audioAssets: Record<string, string> = {}): LunaServices {
  let sampleMode = localStorage.getItem(SAMPLE_MODE_KEY) === 'true';
  let memorySnapshot: FieldSnapshot | null = null;
  const loadedEchoIds=new Set<string>();
  let threadMetadata:any[]|null=null;
  let echoMapCache:{key:string;items:Echo[]}|null=null;
  const signedUrlCache = new Map<string, { url: string; expires: number }>();

  const objectUrls = new Set<string>();
  let privacyKey: CryptoKey | null = null;
  let privacyEpoch = 0;
  const decrypted = new Map<string,string>();
  function lockPrivate() { privacyKey = null; privacyEpoch++; decrypted.clear(); memorySnapshot = null; }
  async function decryptPrivateRecords() {
    const key = privacyKey, epoch = privacyEpoch, owner = getAuthSession().userId;
    if (!key || !owner) return;
    const values = [
      ...getStoredJson<any[]>(ECHOES_KEY, []).filter(r => (r.user_id || r.userId) === owner && (r.is_encrypted || r.isEncrypted)).map(r => r.text),
      ...getStoredJson<any[]>(LOOPS_KEY, []).filter(r => (r.user_id || r.userId) === owner && (r.is_encrypted || r.isEncrypted)).map(r => r.title)
    ];
    for (const cipher of values) {
      if (typeof cipher !== 'string' || decrypted.has(cipher)) continue;
      const plain = await decryptText(cipher, key);
      if (privacyEpoch !== epoch || privacyKey !== key || getAuthSession().userId !== owner) return;
      if (plain !== '[encrypted]') decrypted.set(cipher, plain);
    }
  }
  let observedUser = getAuthSession().userId;
  const accountChanged = () => {
    const next = getAuthSession().userId;
    if (next === observedUser) return;
    lockPrivate();loadedEchoIds.clear();echoMapCache=null;threadMetadata=null;
    observedUser = next; authGeneration++; inFlightRefresh = null;
    signedUrlCache.clear(); objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear();
    memorySnapshot = null;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('luna-account-changed'));
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (event.key === AUTH_KEY || event.key === null) accountChanged();
  });

  async function restoreSession(): Promise<void> {
    if (!getAuthSession().token) {
      await idbStorage.getItem(AUTH_KEY);
      accountChanged();
    }
  }

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

    return [currentCycle,...echoCycleOptions().slice(1).map(c=>({id:c.id,name:c.label,world:'ocean' as const,range:c.range,phases:lunar.phases}))];
  }

  function getLocalEchoes(lunar: LiveLunarBundle): Echo[] {
    const rawText=localStorage.getItem(ECHOES_KEY)||'[]';
    const key=rawText+'|'+getAuthSession().userId+'|'+privacyEpoch+'|'+decrypted.size+'|'+[...loadedEchoIds].join(',');
    if(echoMapCache?.key===key)return structuredClone(echoMapCache.items);
    const raw = getStoredJson<any[]>(ECHOES_KEY, []);
    const { userId } = getAuthSession();
    const recentIds=new Set([...raw].filter(e=>e&&(!(e.user_id||e.userId)||(e.user_id||e.userId)===getAuthSession().userId)).sort((a,b)=>String(b.created_at||b.createdAt||b.occurredAt||'').localeCompare(String(a.created_at||a.createdAt||a.occurredAt||''))).slice(0,ECHO_PAGE_SIZE).map(e=>e.id));
    const items=raw
      .filter(e => {
        if (!e || typeof e !== 'object' || e.provenance === 'synthetic' || String(e.id || '').startsWith('echo-demo') || e.id === 'echo-return' || e.id === 'echo-water') return false;
        // Account isolation: when authenticated, show records for this user or unassigned local offline drafts
        if (userId) {
          return (!e.user_id && !e.userId) || e.user_id === userId || e.userId === userId;
        }
        return !e.user_id && !e.userId;
      })
      .filter(e=>recentIds.has(e.id)||loadedEchoIds.has(e.id)||['local-only','failed'].includes(e.syncStatus))
      .map(e => {
        const mapped = mapClassicEchoToBeta(e, lunar);
        const plain = mapped.isEncrypted && privacyKey && decrypted.get(e.text);
        if (typeof plain === 'string') {
          mapped.body = plain; mapped.title = plain.split(/[.\n!?]/)[0].slice(0,50) || 'Private Echo'; mapped.locked = false;
        }
        return mapped;
      });
    echoMapCache={key,items};return structuredClone(items);
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
      .map(l => {
        const mapped = mapClassicLoopToBeta(l);
        const plain = mapped.isEncrypted && privacyKey && decrypted.get(l.title);
        if (typeof plain === 'string') { mapped.title = plain; mapped.locked = false; }
        return mapped;
      });
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

    // Discover older Threads using only owner-scoped tag metadata. Echo bodies
    // and audio remain paged separately when the user opens a Thread.
    const tagged=new Map((threadMetadata||[]).map(row=>[row.id,row]));
    for(const e of echoes){
      if(!threadMetadata||e.syncStatus!=='synced')tagged.set(e.id,{id:e.id,tags:e.threadIds,created_at:e.occurredAt});
    }
    const removed=new Set(getStoredJson<string[]>('luna_deleted_echo_ids_'+getAuthSession().userId,[]));
    const threads=makeThreadIndex([...tagged.values()].filter(row=>!removed.has(row.id)));

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
    await restoreSession();
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
          void syncServer().catch(() => {});
        }
      }
    })();

    return activeSyncPromise;
  }

  async function readAllRows(table:string,userId:string,request:(url:string)=>Promise<any>):Promise<any[]> {
    const rows:any[]=[];
    for(let offset=0;;offset+=100){
      const page=await request('/rest/v1/'+table+'?select=*&user_id=eq.'+encodeURIComponent(userId)+'&deleted_at=is.null&order=created_at.asc,id.asc&limit=100&offset='+offset);
      if(!Array.isArray(page))throw new Error('Invalid synchronization page.');
      rows.push(...page);if(page.length<100)return rows;
    }
  }

  async function doSyncServer(token: string, userId: string): Promise<void> {
    const syncGen = authGeneration;
    const checkOwner = () => { if (getAuthSession().userId !== userId || syncGen !== authGeneration) throw new Error('Account changed during synchronization.'); };
    const request = async (endpoint:string, options:RequestInit = {}) => { checkOwner(); const value = await supabaseFetch(endpoint, options); checkOwner(); return value; };
    try {
      const lunar = getLiveLunarData(new Date());

      // 1. Scope deletion tombstones by authenticated user with pagination
      const deletedLoopIds = new Set<string>();
      const userDeletedLoopKey = 'luna_deleted_loop_ids_' + userId;
      const storedDeletedLoops = getStoredJson<string[]>(userDeletedLoopKey, []);
      storedDeletedLoops.forEach(id => deletedLoopIds.add(id));

      let loopOffset = 0;
      while (true) {
        const deletedBatch = await request(
          '/rest/v1/loops?select=id,deleted_at,updated_at&user_id=eq.' + encodeURIComponent(userId) +
          '&deleted_at=not.is.null&order=id.asc&limit=100&offset=' + loopOffset
        );
        if (!Array.isArray(deletedBatch)) throw new Error('Invalid deletion page; reconciliation stopped.');
        if (deletedBatch.length > 0) {
          for (const d of deletedBatch) {
            if (d.id) deletedLoopIds.add(d.id);
          }
          if (deletedBatch.length < 100) break;
          loopOffset += 100;
        } else {
          break;
        }
      }
      checkOwner(); setStoredJson(userDeletedLoopKey, Array.from(deletedLoopIds));

      const deletedEchoIds = new Set<string>();
      const userDeletedEchoKey = 'luna_deleted_echo_ids_' + userId;
      const storedDeletedEchoes = getStoredJson<string[]>(userDeletedEchoKey, []);
      storedDeletedEchoes.forEach(id => deletedEchoIds.add(id));

      let echoOffset = 0;
      while (true) {
        const deletedBatch = await request(
          '/rest/v1/echoes?select=id,deleted_at,updated_at&user_id=eq.' + encodeURIComponent(userId) +
          '&deleted_at=not.is.null&order=id.asc&limit=100&offset=' + echoOffset
        );
        if (!Array.isArray(deletedBatch)) throw new Error('Invalid deletion page; reconciliation stopped.');
        if (deletedBatch.length > 0) {
          for (const d of deletedBatch) {
            if (d.id) deletedEchoIds.add(d.id);
          }
          if (deletedBatch.length < 100) break;
          echoOffset += 100;
        } else {
          break;
        }
      }
      checkOwner(); setStoredJson(userDeletedEchoKey, Array.from(deletedEchoIds));

      // 2. Fetch server loops (active)
      const serverLoops = await readAllRows('loops', userId, request);

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
                await request('/rest/v1/loops?id=eq.' + encodeURIComponent(sl.id), {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: localItem.status,
                    metadata: { ...sl.metadata, ...localItem.metadata },
                    subtasks: localItem.subtasks || [],
                    is_encrypted: Boolean(localItem.is_encrypted || localItem.isEncrypted),
                    closed_at: localItem.closed_at,
                    released_at: localItem.released_at,
                    phase_closed: localItem.phase_closed,
                    phase_name_closed: localItem.phase_name_closed,
                    lunar_month_closed: localItem.lunar_month_closed,
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
                await request('/rest/v1/loops', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: localItem.id,
                    user_id: userId,
                    title: localItem.title,
                    note: localItem.note,
                    status: localItem.status || 'active',
                    metadata: localItem.metadata || {},
                    subtasks: localItem.subtasks || [],
                    is_encrypted: Boolean(localItem.is_encrypted || localItem.isEncrypted),
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
        getStoredJson<string[]>(userDeletedLoopKey, []).forEach(id => deletedLoopIds.add(id));
        const latestAllLoops = getStoredJson<any[]>(LOOPS_KEY, []);
        const reconciledMap = new Map(reconciled.map(l => [l.id, l]));
        const finalLoops: any[] = [];
        const seenIds = new Set<string>();

        for (const item of latestAllLoops) {
          if (!item || !item.id) continue;
          if (deletedLoopIds.has(item.id) && (item.user_id || item.userId) === userId) continue;
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

        checkOwner(); setStoredJson(LOOPS_KEY, finalLoops);
      }

      // 3. Fetch server echoes (active)
      const recentPage = await request(echoPageEndpoint(userId,echoTimeQuery()));
      if(!Array.isArray(recentPage))throw new Error('Invalid Echo page.');
      const serverEchoes = recentPage.slice(0,ECHO_PAGE_SIZE);
      // Older pending uploads still reconcile by ID, without downloading history.
      const pendingIds=getStoredJson<any[]>(ECHOES_KEY,[]).filter(e=>(e.user_id||e.userId)===userId&&e.syncStatus!=='synced'&&!deletedEchoIds.has(e.id)&&!serverEchoes.some(r=>r.id===e.id)).map(e=>e.id);
      for(let offset=0;offset<pendingIds.length;offset+=50){
        const ids=pendingIds.slice(offset,offset+50).map(id=>JSON.stringify(String(id))).join(',');
        const rows=await request('/rest/v1/echoes?select=*&user_id=eq.'+encodeURIComponent(userId)+'&deleted_at=is.null&id=in.('+encodeURIComponent(ids)+')');
        if(!Array.isArray(rows))throw new Error('Pending Echo reconciliation failed.');
        serverEchoes.push(...rows);
      }

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
            const voice = se.source === 'voice' || se.kind === 'voice' || localItem.source === 'voice' || localItem.kind === 'voice';
            const remotePath = se.audio_path || se.audioPath;
            let audioPath = remotePath || localItem.audio_path || localItem.audioPath;
            let audioSyncStatus: SyncStatus = !voice || remotePath ? 'synced' : 'failed';
            if (voice && !remotePath) {
              try {
                if (!audioPath) {
                  const draft = await getDraftAudio(localItem.id, userId);
                  if (!draft?.blob) throw new Error('Original audio is not available locally.');
                  const ext = draft.blob.type.includes('mp4') ? 'mp4' : draft.blob.type.includes('ogg') ? 'ogg' : 'webm';
                  const uploaded = userId + '/' + localItem.id + '.' + ext;
                  await request('/storage/v1/object/echo-audio/' + uploaded, {method:'POST',headers:{'Content-Type':draft.blob.type || 'audio/webm','x-upsert':'true'},body:draft.blob});
                  audioPath = uploaded;
                }
                // Local path confirms upload only. Retry metadata independently until acknowledged.
                const patched = await request('/rest/v1/echoes?id=eq.' + encodeURIComponent(se.id) + '&user_id=eq.' + encodeURIComponent(userId) + '&deleted_at=is.null', {
                  method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=representation'},
                  body:JSON.stringify({audio_path:audioPath,updated_at:new Date().toISOString()})
                });
                if (!Array.isArray(patched) || !patched.some(row => row.id === se.id && row.audio_path === audioPath)) throw new Error('Audio metadata is awaiting confirmation.');
                audioSyncStatus = 'synced';
              } catch { audioSyncStatus = 'failed'; }
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
                audioMetadataPending: Boolean(voice && audioPath && audioSyncStatus !== 'synced'),
                syncStatus: audioSyncStatus === 'synced' ? ('synced' as SyncStatus) : ('failed' as SyncStatus)
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
                audioMetadataPending: Boolean(voice && audioPath && audioSyncStatus !== 'synced'),
                syncStatus: audioSyncStatus === 'synced' ? ('synced' as SyncStatus) : ('failed' as SyncStatus)
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
                      const ext = (draft.blob.type.includes('mp4') || draft.blob.type.includes('m4a')) ? 'mp4' :
                                  draft.blob.type.includes('webm') ? 'webm' :
                                  (draft.blob.type.includes('ogg') || draft.blob.type.includes('opus')) ? 'ogg' : 'webm';
                      audioPath = userId + '/' + localItem.id + '.' + ext;
                      await request('/storage/v1/object/echo-audio/' + audioPath, {
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

                await request('/rest/v1/echoes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: localItem.id,
                    user_id: userId,
                    is_encrypted: Boolean(localItem.is_encrypted || localItem.isEncrypted),
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
        getStoredJson<string[]>(userDeletedEchoKey, []).forEach(id => deletedEchoIds.add(id));
        const latestAllEchoes = getStoredJson<any[]>(ECHOES_KEY, []);
        const reconciledMap = new Map(reconciled.map(e => [e.id, e]));
        const finalEchoes: any[] = [];
        const seenIds = new Set<string>();

        for (const item of latestAllEchoes) {
          if (!item || !item.id) continue;
          if (deletedEchoIds.has(item.id) && (item.user_id || item.userId) === userId) continue;
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
        checkOwner(); setStoredJson(ECHOES_KEY, finalEchoes);
      }

      // 4. Fetch reflections
      const serverRefs = await request(
        '/rest/v1/echo_reflections?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.desc'
      ).catch(() => null);

      if (Array.isArray(serverRefs)) {
        const latestRefs = getStoredJson<any[]>(REFLECTIONS_KEY, []);
        const localIds = new Set(latestRefs.map(r => r.id));
        const merged = [...latestRefs];
        for (const sr of serverRefs) {
          if (!localIds.has(sr.id)) merged.push({ ...sr, user_id: userId });
        }
        checkOwner(); setStoredJson(REFLECTIONS_KEY, merged);
      }

      await decryptPrivateRecords();
      checkOwner(); memorySnapshot = assembleSnapshot();
    } catch (err) {
      console.warn('Sync incomplete; local data retained.');
      throw err;
    }
  }

  // The app starts synchronization after its account-change listeners are installed.

  return {
    mode: sampleMode ? 'sample' : 'live',
    isSampleMode: () => sampleMode,
    setSampleMode: (enabled: boolean) => {
      sampleMode = enabled;
      localStorage.setItem(SAMPLE_MODE_KEY, String(enabled));
      memorySnapshot = assembleSnapshot();
    },
    sync: syncServer,
    privacy: {
      unlocked: () => { accountChanged(); return Boolean(privacyKey); },
      lock: lockPrivate,
      async unlock(passphrase: string) {
        accountChanged();
        const owner = getAuthSession().userId, generation = authGeneration;
        const epoch = ++privacyEpoch;
        if (!owner) throw new Error('Sign in before unlocking private Echoes.');
        const rows = await supabaseFetch('/rest/v1/profiles?select=encryption_verify_token&id=eq.' + encodeURIComponent(owner));
        const verify = rows?.[0]?.encryption_verify_token;
        if (!verify) throw new Error('Set up your encryption passphrase in Classic Luna first.');
        const key = await unlockWithPassphrase(passphrase, owner, verify);
        if (getAuthSession().userId !== owner || authGeneration !== generation || epoch !== privacyEpoch) throw new Error('Account or lock state changed. Please try again.');
        if (!key) throw new Error('That passphrase did not unlock your private Echoes.');
        privacyKey = key;
        await decryptPrivateRecords();
        memorySnapshot = assembleSnapshot();
      }
    },

    auth: {
      async getSession() {
        await restoreSession();
        const { token, userId } = getAuthSession();
        return {
          mode: token && userId ? 'authenticated' : 'demo',
          subject: userId || undefined
        };
      },

      getUser(): AuthUser | null {
        try {
          const session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
          if (session?.access_token && session?.user?.id) {
            return {
              id: session.user.id,
              email: session.user.email
            };
          }
        } catch {}
        return null;
      },

      async signIn(email: string, password: string): Promise<AuthUser> {
        const loginGen = ++authGeneration;
        const loginIdentity = localStorage.getItem(AUTH_KEY);
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
        if (loginGen !== authGeneration || localStorage.getItem(AUTH_KEY) !== loginIdentity) throw new Error('Account changed during sign-in. Please try again.');
        const sessionRecord: SupabaseSession = {
          access_token: data.access_token,
          token_type: data.token_type || 'bearer',
          expires_in: data.expires_in,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
          refresh_token: data.refresh_token,
          user: data.user
        };

        await idbStorage.setItem(AUTH_KEY, JSON.stringify(sessionRecord));
        accountChanged();

        sampleMode = false;
        localStorage.setItem(SAMPLE_MODE_KEY, 'false');

        await syncServer().catch(() => {});
        memorySnapshot = assembleSnapshot();

        return { id: data.user.id, email: data.user.email };
      },

      async signOut(): Promise<void> {
        lockPrivate();
        authGeneration++;
        inFlightRefresh = null;
        signedUrlCache.clear();
        objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear();
        const removal = idbStorage.removeItem(AUTH_KEY);
        accountChanged();
        await removal;

        memorySnapshot = assembleSnapshot();
      }
    },

    echoes: {
      async list(query:EchoQuery = {}) {
        accountChanged();
        const owner=getAuthSession().userId,epoch=authGeneration,limit=Math.min(100,Math.max(1,query.limit||ECHO_PAGE_SIZE));
        if(sampleMode||!owner||!getAuthSession().token){
          const all=assembleSnapshot().echoes.filter(e=>matchesEchoQuery(e,query)).sort((a,b)=>(Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||b.id.localeCompare(a.id))*(query.order==='oldest'?-1:1));
          const offset=Math.max(0,Number(query.cursor)||0);
          return {items:all.slice(offset,offset+limit),nextCursor:offset+limit<all.length?String(offset+limit):undefined};
        }
        const rows=await supabaseFetch(echoPageEndpoint(owner,query));
        if(owner!==getAuthSession().userId||epoch!==authGeneration)throw new Error('Account changed.');
        if(!Array.isArray(rows))throw new Error('Echoes could not be loaded.');
        const page=rows.slice(0,limit);
        const deleted=new Set(getStoredJson<string[]>('luna_deleted_echo_ids_'+owner,[]));
        const raw=getStoredJson<any[]>(ECHOES_KEY,[]),map=new Map(raw.map(e=>[e.id,e]));
        for(const row of page){
          if(deleted.has(row.id))continue;
          const old=map.get(row.id);
          // Browsing is read-only: it must never acknowledge pending local writes.
          if(!old||old.syncStatus==='synced'){
            const audioPending=(row.source==='voice'||old?.kind==='voice')&&!row.audio_path;
            map.set(row.id,{...old,...row,user_id:owner,audio_path:row.audio_path||old?.audio_path,
              syncStatus:audioPending?'failed':'synced',audioSyncStatus:audioPending?'failed':'synced'});
          }
          loadedEchoIds.add(row.id);
        }
        setStoredJson(ECHOES_KEY,[...map.values()]);
        await decryptPrivateRecords();
        if(owner!==getAuthSession().userId||epoch!==authGeneration)throw new Error('Account changed.');
        const db=assembleSnapshot(),ids=new Set(page.map(r=>r.id));
        const items=db.echoes.filter(e=>ids.has(e.id)||((e.syncStatus!=='synced'||(query.search&&e.isEncrypted&&!e.locked))&&matchesEchoQuery(e,query))).sort((a,b)=>(Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||b.id.localeCompare(a.id))*(query.order==='oldest'?-1:1));
        return {items,nextCursor:rows.length>limit&&page.length?echoPageCursor(page.at(-1)):undefined};
      },

      async get(id: string) {
        accountChanged();loadedEchoIds.add(id);
        let found=assembleSnapshot().echoes.find(e=>e.id===id);
        const owner=getAuthSession().userId,epoch=authGeneration;
        if(!found&&owner&&!sampleMode){
          const rows=await supabaseFetch('/rest/v1/echoes?select=*&user_id=eq.'+encodeURIComponent(owner)+'&id=eq.'+encodeURIComponent(id)+'&deleted_at=is.null&limit=1');
          if(owner!==getAuthSession().userId||epoch!==authGeneration)throw new Error('Account changed.');
          if(Array.isArray(rows)&&rows[0]){
            const raw=getStoredJson<any[]>(ECHOES_KEY,[]);setStoredJson(ECHOES_KEY,[...raw.filter(e=>e.id!==id),{...rows[0],syncStatus:rows[0].source==='voice'&&!rows[0].audio_path?'failed':'synced',user_id:owner}]);
            await decryptPrivateRecords();
            if(owner!==getAuthSession().userId||epoch!==authGeneration)throw new Error('Account changed.');
            found=assembleSnapshot().echoes.find(e=>e.id===id);
          }
        }
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

        const occurredAt = input.occurredAt || new Date().toISOString();
        const lunar = getLiveLunarData(new Date(occurredAt));
        const echoId = 'e' + Date.now() + Math.random().toString(36).substr(2, 4);
        const { token, userId } = getAuthSession();

        const createGen = authGeneration;
        const assertOwner = () => { if (getAuthSession().userId !== userId || authGeneration !== createGen) throw new Error('Account changed. Recording remains in its original account drafts.'); };
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
          } catch {
            throw new Error('Audio could not be saved on this device. Keep this page open; retry or download the recording.');
          }
        }

        let syncStatus: SyncStatus = 'local-only';
        let audioSyncStatus: SyncStatus = (input.kind === 'voice') ? 'local-only' : 'synced';

        const encryptionKey = privacyKey;
        const storedBody = encryptionKey ? await encryptText(body, encryptionKey) : body;
        assertOwner();
        const title = cleanText(input.title, 120) || (body ? body.split(/[.\n!?]/)[0].slice(0, 50) : 'A spoken moment');

        // Canonical Classic Luna Echo schema with explicit SyncStatus typing
        const classicRecord: Record<string, any> & { syncStatus: SyncStatus; audioSyncStatus?: SyncStatus } = {
          id: echoId,
          text: storedBody,
          title: encryptionKey ? 'Private Echo' : title,
          isEncrypted: Boolean(encryptionKey), is_encrypted: Boolean(encryptionKey),
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
          created_at: occurredAt,
          createdAt: occurredAt,
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

        assertOwner();
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
              const ext = (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) ? 'mp4' :
                          audioBlob.type.includes('webm') ? 'webm' :
                          (audioBlob.type.includes('ogg') || audioBlob.type.includes('opus')) ? 'ogg' : 'webm';
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

          assertOwner();
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
                text: storedBody,
                title: encryptionKey ? 'Private Echo' : title,
                is_encrypted: Boolean(encryptionKey),
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

          assertOwner();
          // Transactionally update record in latest storage (preserving intervening records)
          const latestEchoes = getStoredJson<any[]>(ECHOES_KEY, []);
          const idx = latestEchoes.findIndex(e => e.id === echoId);
          if (idx !== -1) {
            latestEchoes[idx] = { ...latestEchoes[idx], ...classicRecord };
            setStoredJson(ECHOES_KEY, latestEchoes);
          }
        }

        await decryptPrivateRecords();
        memorySnapshot = assembleSnapshot();
        const mapped = memorySnapshot.echoes.find(e => e.id === echoId) || mapClassicEchoToBeta(classicRecord, lunar);
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

      async checklist(id: string, action: 'add'|'toggle'|'remove'|'up'|'down', itemId = '', text = '') {
        accountChanged();
        const owner = getAuthSession().userId, generation = authGeneration;
        const local = getStoredJson<any[]>(LOOPS_KEY, []);
        const loop = local.find(l => l.id === id && (l.user_id || l.userId || null) === owner);
        if (!loop) throw new Error('This intention is not available in your account.');
        const items = Array.isArray(loop.subtasks) ? loop.subtasks.map((item:any) => ({...item})) : [];
        const index = items.findIndex((item:any) => String(item.id) === itemId);
        if (action === 'add') {
          const value = cleanText(text, 300);
          if (!value) throw new Error('Add a few words for this step.');
          items.push({id:makeId('step'),text:value,done:false});
        } else {
          if (index < 0) throw new Error('This step is no longer available.');
          if (action === 'toggle') items[index].done = !Boolean(items[index].done ?? items[index].completed);
          else if (action === 'remove') items.splice(index,1);
          else {
            const destination = index + (action === 'up' ? -1 : 1);
            if (destination >= 0 && destination < items.length) [items[index],items[destination]] = [items[destination],items[index]];
          }
        }
        const changedAt = new Date(Math.max(Date.now(), Date.parse(loop.updated_at || loop.updatedAt || '') + 1 || 0)).toISOString();
        const marker = loop.metadata?.luna_beta_lifecycle;
        const markerCurrent = marker && marker.classicStatus === loop.status &&
          Date.parse(marker.updatedAt) === Date.parse(loop.updated_at || loop.updatedAt);
        loop.subtasks = items; loop.updated_at = loop.updatedAt = changedAt;
        if (markerCurrent) marker.updatedAt = changedAt;
        else if (marker) delete loop.metadata.luna_beta_lifecycle;
        loop.syncStatus = 'local-only';
        setStoredJson(LOOPS_KEY, local);
        if (owner) {
          let outcome: SyncStatus = 'synced';
          try {
            const confirmed = await supabaseFetch('/rest/v1/loops?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(owner) + '&deleted_at=is.null', {
              method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=representation'},
              body:JSON.stringify({subtasks:items, metadata:loop.metadata, updated_at:changedAt})
            });
            if (!Array.isArray(confirmed) || !confirmed.some(row => row.id === id)) throw new Error('Step changes are awaiting server confirmation.');
          } catch { outcome = 'failed'; }
          if (getAuthSession().userId !== owner || generation !== authGeneration) throw new Error('Account changed; step changes remain with the original account.');
          const latest = getStoredJson<any[]>(LOOPS_KEY, []);
          const current = latest.find(l => l.id === id && (l.user_id || l.userId) === owner);
          if (current?.updated_at === changedAt) { current.syncStatus = outcome; setStoredJson(LOOPS_KEY, latest); }
        }
        return assembleSnapshot().loops.find(l => l.id === id)!;
      },

      async transition(id: string, status: LoopStatus) {
        if (!LOOP_STATUSES.includes(status)) throw new Error('Choose a recognized intention state.');

        const local = getStoredJson<any[]>(LOOPS_KEY, []);
        const loop = local.find(l => l.id === id);
        if (!loop) throw new Error('This Loop is no longer available.');

        const previous = mapClassicLoopToBeta(loop);
        loop.history = [...previous.history];
        loop.history.push({
          status: previous.status,
          at: new Date().toISOString()
        });

        const classicStatus = mapBetaStatusToClassic(status);
        const nowIso = new Date().toISOString();
        const lunar = getLiveLunarData(new Date());

        loop.status = classicStatus;
        loop.updatedAt = nowIso;
        loop.updated_at = nowIso;
        loop.metadata = { ...loop.metadata, luna_beta_lifecycle: {
          status, classicStatus, updatedAt: nowIso, history: loop.history
        } };

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

        if (classicStatus === 'active') {
          loop.closedAt = loop.closed_at = loop.releasedAt = loop.released_at = null;
          loop.phaseClosed = loop.phase_closed = loop.phaseNameClosed = loop.phase_name_closed = null;
          loop.lunarMonthClosed = loop.lunar_month_closed = null;
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
                metadata: loop.metadata,
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
        accountChanged();
        const owner=getAuthSession().userId,epoch=authGeneration;
        if(sampleMode||!owner||!getAuthSession().token)return structuredClone(assembleSnapshot().threads);
        const rows:any[]=[];let cursor:string|undefined;
        do{
          const endpoint=echoPageEndpoint(owner,{cursor});
          const params=new URLSearchParams(endpoint.split('?')[1]);
          params.set('select','id,tags,created_at');params.set('tags','not.eq.[]');params.set('limit','501');
          const page=await supabaseFetch('/rest/v1/echoes?'+params.toString());
          if(owner!==getAuthSession().userId||epoch!==authGeneration)throw new Error('Account changed.');
          if(!Array.isArray(page))throw new Error('Threads could not be loaded.');
          const batch=page.slice(0,500);rows.push(...batch);
          const next=page.length>500&&batch.length?echoPageCursor(batch.at(-1)):undefined;
          if(next&&next===cursor)throw new Error('Threads could not finish loading. Try again.');
          cursor=next;
        }while(cursor);
        threadMetadata=rows;
        return structuredClone(assembleSnapshot().threads);
      },
      async linkEcho(threadId: string, echoId: string) {
        accountChanged();
        const owner=getAuthSession().userId;
        const local = getStoredJson<any[]>(ECHOES_KEY, []);
        const echo = local.find(e => e.id === echoId && ((!e.user_id&&!e.userId)||e.user_id===owner||e.userId===owner));
        if (!echo) throw new Error('Echo not found.');
        if (!Array.isArray(echo.tags)) echo.tags = [];
        if (!echo.tags.includes(threadId)) {
          echo.tags.push(threadId);echo.syncStatus='local-only';echo.updated_at=new Date().toISOString();
          if(threadMetadata){threadMetadata=threadMetadata.filter(row=>row.id!==echoId);threadMetadata.push({id:echoId,tags:[...echo.tags],created_at:echo.created_at});}
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
      async getActiveSession(): Promise<string> {
        const currentUserId = getAuthSession().userId;
        if (!currentUserId) return 'demo-session';
        try {
          const rows = await supabaseFetch(
            `/rest/v1/chat_sessions?select=id,title,updated_at,created_at&user_id=eq.${encodeURIComponent(currentUserId)}&order=updated_at.desc&limit=1`
          );
          if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) {
            return rows[0].id;
          }
          const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await supabaseFetch('/rest/v1/chat_sessions', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
              id: newId,
              user_id: currentUserId,
              title: 'Continuous Reflection'
            })
          });
          return newId;
        } catch (err) {
          console.warn('Failed to load/create active chat session from Supabase:', err);
          return `session_${Date.now()}_local`;
        }
      },

      async getMessages(sessionId: string): Promise<ChatMessage[]> {
        const currentUserId = getAuthSession().userId;
        if (!currentUserId || !sessionId || sessionId === 'demo-session') return [];
        try {
          const rows = await supabaseFetch(
            `/rest/v1/chat_messages?select=id,role,content,session_id,created_at,metadata&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`
          );
          if (!Array.isArray(rows)) return [];
          return rows
            .filter((m: any) => m.role !== 'system' && m.content !== '__LUNA_SESSION_ARCHIVED__')
            .map((m: any) => ({
              id: m.id || makeId('msg'),
              role: m.role === 'assistant' ? 'luna' : 'person',
              content: m.content || '',
              replyTo: m.metadata?.reply_to_user_message_id,
              servingModel: m.metadata?.serving_model,
              fallbackUsed: Boolean(m.metadata?.failover),
              echoIds: Array.isArray(m.metadata?.selectedEchoIds)
                ? m.metadata.selectedEchoIds
                : Array.isArray(m.metadata?.echoIds)
                ? m.metadata.echoIds
                : []
            }));
        } catch (err) {
          console.warn('Failed to load chat messages from Supabase:', err);
          return [];
        }
      },

      async respond(message: string, echoIds: string[], options?: { sessionId?: string; clientTurnId?: string; modelKey?: string; signal?: AbortSignal }): Promise<ChatMessage> {
        const clean = cleanText(message);
        if (!clean) throw new Error('Write a message first.');

        let auth = getAuthSession();
        if (!auth.userId || !auth.token) {
          throw new Error('Sign in to converse with Luna.');
        }

        const nowSec = Math.floor(Date.now() / 1000);
        if (auth.refreshToken && auth.expiresAt && auth.expiresAt - nowSec < 60) {
          try {
            const refreshed = await refreshAuthSession();
            if (refreshed.token) {
              auth = getAuthSession();
            }
          } catch {}
        }

        const sessionId = options?.sessionId || (await this.getActiveSession());
        const clientTurnId = options?.clientTurnId || makeId('turn');
        const modelKey = options?.modelKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('luna_model_key') : null) || 'anthropic-fable-5';
        const apiBaseUrl = 'https://loops-production-e1d5.up.railway.app';

        const {signal,cleanup}=composeTimeoutSignal(options?.signal,180000);

        try {
          const response = await fetch(`${apiBaseUrl}/api/chat`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: clean,
              sessionId,
              clientTurnId,
              modelKey,
              metadata: {
                selectedEchoIds: echoIds || []
              }
            }),
            signal
          });


          if (!response.ok) {
            let errMsg = `Server error (${response.status})`;
            try {
              const errData = await response.json();
              errMsg = errData.error || errMsg;
            } catch {
              try {
                const txt = await response.text();
                if (txt) errMsg = txt;
              } catch {}
            }
            throw new Error(errMsg);
          }

          const data = await response.json();
          const reply = typeof data.message === 'string' ? data.message : (data.message?.content || data.reply || '');
          if (!reply.trim()) throw new Error(data.error||'Luna returned no reply.');

          return {
            id: data.message?.id || data.assistantMessageId || makeId('chat'),
            role: 'luna',
            replyTo: data.userMessageId||clientTurnId,
            content: reply,
            echoIds: echoIds || [],
            servingModel: data.servingModel || data.message?.servingModel,
            fallbackUsed: Boolean(data.fallbackUsed || data.message?.fallbackUsed),
            fallbackNotice: data.fallbackNotice || data.message?.fallbackNotice
          };
        } catch (fetchErr: any) {

          if (!options?.signal?.aborted && signal.aborted) {
            throw new Error('Luna is taking longer than expected. Checking for a saved reply…');
          }
          throw fetchErr;
        }finally{cleanup();}
      },

      async synthesizeSpeech(text: string, options?: { voiceId?: string; model?: string; messageId?: string; signal?: AbortSignal }): Promise<SpeechSynthesisResult> {
        const auth = getAuthSession();
        const voiceId = options?.voiceId || (typeof localStorage !== 'undefined' ? localStorage.getItem('luna_voice_key') : null) || 'eleven-nicole';
        const model = options?.model || (typeof localStorage !== 'undefined' ? localStorage.getItem('luna_voice_model_key') : null) || 'eleven_flash_v2_5';
        const apiBaseUrl = 'https://loops-production-e1d5.up.railway.app';
        if (voiceId === 'browser-web-speech') {
          return { useClientFallback: true };
        }

        const { signal, cleanup } = composeTimeoutSignal(options?.signal, 15000);

        try {
          const res = await fetch(`${apiBaseUrl}/api/chat/synthesize-speech`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text,
              voiceId,
              model,
              messageId: options?.messageId
            }),
            signal
          });
          if (!res.ok) {
            return { useClientFallback: true, error: `HTTP ${res.status}` };
          }
          const data = await res.json();
          if (data.useClientFallback || (!data.audioBase64 && !data.audioUrl)) {
            return {
              useClientFallback: true,
              fallbackUsed: Boolean(data.fallbackUsed),
              provider: data.provider,
              model: data.model,
              voiceId: data.voiceId,
              error: data.error
            };
          }
          const mime = data.contentType || (data.provider === 'elevenlabs' ? 'audio/mpeg' : 'audio/wav');
          const audioUrl = data.audioUrl || `data:${mime};base64,${data.audioBase64}`;
          return {
            audioUrl,
            audioBase64: data.audioBase64,
            contentType: mime,
            useClientFallback: false,
            fallbackUsed: Boolean(data.fallbackUsed),
            provider: data.provider,
            model: data.model,
            voiceId: data.voiceId,
            error: data.error
          };
        } catch (err: any) {
          if (options?.signal?.aborted) {
            return { useClientFallback: false, error: 'aborted' };
          }
          return { useClientFallback: true, error: err.message };
        } finally {
          cleanup();
        }
      }
    },

    audio: {
      async resolve(echo: Echo, options: {signal?:AbortSignal; refresh?:boolean} = {}): Promise<string | null> {
        const currentUserId = getAuthSession().userId;
        const audioGen = authGeneration;
        const valid = () => !options.signal?.aborted && currentUserId === getAuthSession().userId && audioGen === authGeneration;
        if ((echo.user_id ?? null) !== currentUserId) {
          return null;
        }

        // 1. Resolve from local durable IndexedDB cache first (avoids stale/revoked blob URL masking durable audio)
        try {
          const draft = await getDraftAudio(echo.id, currentUserId);
          if (!valid()) return null;
          if (draft && draft.blob) {
            const localUrl = URL.createObjectURL(draft.blob);
            objectUrls.add(localUrl); return localUrl;
          }
        } catch {}

        if (!valid()) return null;
        if (sampleMode && echo.audioKey && audioAssets[echo.audioKey]) return audioAssets[echo.audioKey];

        const path = (echo as any).audio_path || (echo as any).audioPath;

        // 2. Only use echo.audioUrl if it is a remote/data URL or if no durable draft was found
        if (!path && echo.audioUrl) {
          if (echo.audioUrl.startsWith('http://') || echo.audioUrl.startsWith('https://') || echo.audioUrl.startsWith('data:')) {
            return echo.audioUrl;
          }
        }

        if (!path) {
          if (echo.audioUrl) return echo.audioUrl;
          return null;
        }

        // 3. Check in-memory signed URL cache (avoid spamming Supabase for same path within 50 minutes)
        if (!currentUserId || !path.startsWith(currentUserId + '/')) return null;
        if (options.refresh) signedUrlCache.delete(path);
        const cached = signedUrlCache.get(path);
        if (cached && cached.expires > Date.now()) {
          return cached.url;
        }

        // 4. Resolve from Supabase Storage
        try {
          const res = await supabaseFetch('/storage/v1/object/sign/echo-audio/' + path, {
            signal: options.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresIn: 3600 })
          });

          if (valid() && res && res.signedURL) {
            const fullUrl = SUPABASE_URL + '/storage/v1' + res.signedURL;
            signedUrlCache.set(path, { url: fullUrl, expires: Date.now() + 3000 * 1000 });
            return fullUrl;
          }
        } catch (err) {
          console.warn('Audio URL unavailable; playback can be retried.');
        }

        return null;
      }
    },

    snapshot(): FieldSnapshot {
      accountChanged();
      return assembleSnapshot();
    },

    reset(): void {
      localStorage.removeItem(ECHOES_KEY);
      localStorage.removeItem(LOOPS_KEY);
      localStorage.removeItem(REFLECTIONS_KEY);
      memorySnapshot = assembleSnapshot();
    }
  };
}
