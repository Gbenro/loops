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
  AuthUser
} from './contracts.ts';
import { FIXTURES } from './fixtures.ts';
import { cleanText, makeId, filterEchoes, LOOP_STATUSES } from './mock-services.ts';
import { getLiveLunarData, LiveLunarBundle } from './lunar-engine.ts';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';
const LOOPS_KEY = 'cosmic_loops_v1';
const ECHOES_KEY = 'cosmic_echoes_v1';
const REFLECTIONS_KEY = 'cosmic_reflections_v1';
const AUTH_KEY = 'sb-eyxvsbqyzeodsjajfqsj-auth-token';
const SAMPLE_MODE_KEY = 'luna_beta_sample_mode';

interface SupabaseSession {
  access_token: string;
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

export function getAuthSession(): { token: string | null; userId: string | null } {
  try {
    const session = getStoredJson<SupabaseSession | null>(AUTH_KEY, null);
    if (session && session.access_token) {
      return {
        token: session.access_token,
        userId: session.user?.id || null
      };
    }
  } catch {}
  return { token: null, userId: null };
}

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const { token } = getAuthSession();
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
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error('Supabase request failed (' + res.status + '): ' + errorText);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
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
  const isVoice = Boolean(audio_path) || raw.source === 'voice';

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
    provenance: 'local-session'
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
    provenance: 'local-session'
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
    return raw.filter(e => e && typeof e === 'object').map(e => mapClassicEchoToBeta(e, lunar));
  }

  function getLocalLoops(): Loop[] {
    const raw = getStoredJson<any[]>(LOOPS_KEY, []);
    return raw.filter(l => l && typeof l === 'object').map(mapClassicLoopToBeta);
  }

  function getLocalReflections(): Reflection[] {
    const raw = getStoredJson<any[]>(REFLECTIONS_KEY, []);
    return raw.map(r => ({
      id: r.id || makeId('ref'),
      echoId: r.echo_id || r.echoId,
      author: r.author || 'person',
      body: r.body || '',
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      provenance: 'local-session' as const
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

  async function syncServer(): Promise<void> {
    const { token, userId } = getAuthSession();
    if (!token || !userId) return;

    try {
      const lunar = getLiveLunarData(new Date());

      // Fetch server echoes
      const serverEchoes = await supabaseFetch(
        '/rest/v1/echoes?select=*&user_id=eq.' + encodeURIComponent(userId) + '&deleted_at=is.null&order=created_at.desc'
      ).catch(() => []);

      if (Array.isArray(serverEchoes) && serverEchoes.length > 0) {
        const local = getStoredJson<any[]>(ECHOES_KEY, []);
        const localIds = new Set(local.map(e => e.id));

        const merged = [...local];
        for (const se of serverEchoes) {
          if (!localIds.has(se.id)) {
            merged.push(se);
          }
        }
        merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setStoredJson(ECHOES_KEY, merged);
      }

      // Fetch server loops
      const serverLoops = await supabaseFetch(
        '/rest/v1/loops?select=*&user_id=eq.' + encodeURIComponent(userId) + '&deleted_at=is.null&order=created_at.desc'
      ).catch(() => []);

      if (Array.isArray(serverLoops) && serverLoops.length > 0) {
        const local = getStoredJson<any[]>(LOOPS_KEY, []);
        const localIds = new Set(local.map(l => l.id));

        const merged = [...local];
        for (const sl of serverLoops) {
          if (!localIds.has(sl.id)) {
            merged.push(sl);
          }
        }
        setStoredJson(LOOPS_KEY, merged);
      }

      // Fetch reflections
      const serverRefs = await supabaseFetch(
        '/rest/v1/echo_reflections?select=*&user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.desc'
      ).catch(() => []);

      if (Array.isArray(serverRefs) && serverRefs.length > 0) {
        const local = getStoredJson<any[]>(REFLECTIONS_KEY, []);
        const localIds = new Set(local.map(r => r.id));
        const merged = [...local];
        for (const sr of serverRefs) {
          if (!localIds.has(sr.id)) merged.push(sr);
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
        localStorage.removeItem(AUTH_KEY);
        try {
          const req = indexedDB.open('luna_auth_db', 1);
          req.onsuccess = (e: any) => {
            const idb = e.target.result;
            if (idb?.objectStoreNames?.contains('auth')) {
              const tx = idb.transaction('auth', 'readwrite');
              tx.objectStore('auth').delete(AUTH_KEY);
            }
          };
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

        // Voice upload to Supabase Storage if authenticated and blob present
        if (input.kind === 'voice' && audioBlob && userId && token) {
          try {
            const ext = audioBlob.type.includes('mp4') ? 'mp4' :
                        audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
            audioPath = userId + '/' + echoId + '.' + ext;

            await supabaseFetch('/storage/v1/object/echo-audio/' + audioPath, {
              method: 'POST',
              headers: {
                'Content-Type': audioBlob.type || 'audio/webm',
                'x-upsert': 'true'
              },
              body: audioBlob
            });
          } catch (err) {
            console.warn('Audio upload to Supabase Storage failed, saved locally:', err);
          }
        }

        const title = cleanText(input.title, 120) || (body ? body.split(/[.\n!?]/)[0].slice(0, 50) : 'A spoken moment');

        // Canonical Classic Luna Echo schema
        const classicRecord = {
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
          audio_path: audioPath,
          audioPath: audioPath,
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
          provenanceKind: 'original_echo'
        };

        // Persist locally
        const local = getStoredJson<any[]>(ECHOES_KEY, []);
        local.unshift(classicRecord);
        setStoredJson(ECHOES_KEY, local);

        // Sync to Supabase if authenticated
        if (userId && token) {
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
          } catch (err) {
            console.warn('Server echo save failed, kept locally:', err);
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

        const classicLoop = {
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
          // snake_case aliases for direct Supabase/PostgREST schema compatibility
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
          updated_at: nowIso
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
          } catch (err) {
            console.warn('Server loop save failed, kept locally:', err);
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

        setStoredJson(LOOPS_KEY, local);

        const { token, userId } = getAuthSession();
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
          } catch (err) {
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
        if (echo.audioUrl) return echo.audioUrl;
        if (echo.audioKey && audioAssets[echo.audioKey]) return audioAssets[echo.audioKey];

        const path = (echo as any).audio_path || (echo as any).audioPath;
        if (!path) return null;

        // Check in-memory signed URL cache (avoid spamming Supabase for same path within 50 minutes)
        const cached = signedUrlCache.get(path);
        if (cached && cached.expires > Date.now()) {
          return cached.url;
        }

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
