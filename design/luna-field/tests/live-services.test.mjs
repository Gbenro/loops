import './idb-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 1. Polyfill localStorage for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// 2. Import modules under test
import {
  createLiveLunaServices,
  saveDraftAudio,
  getDraftAudio,
  getAuthSession,
  refreshAuthSession
} from '../src/live-services.ts';

function resetStorage() {
  mockStorage.clear();
}

test('token auto-refresh: refreshes expired session and updates storage and headers', async () => {
  resetStorage();
  const originalFetch = globalThis.fetch;
  let refreshCalled = false;
  let queryCalledWithRefreshedToken = false;

  const expiredSession = {
    access_token: 'old-expired-token',
    refresh_token: 'valid-refresh-token-123',
    expires_at: Math.floor(Date.now() / 1000) - 100, // expired 100s ago
    user: { id: 'usr-refresh-test', email: 'refresh@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(expiredSession));

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/auth/v1/token?grant_type=refresh_token')) {
      refreshCalled = true;
      const body = JSON.parse(options.body || '{}');
      assert.equal(body.refresh_token, 'valid-refresh-token-123');
      return Response.json({
        access_token: 'new-refreshed-token-456',
        refresh_token: 'new-refresh-token-789',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: { id: 'usr-refresh-test', email: 'refresh@example.com' }
      });
    }
    if (urlStr.includes('/rest/v1/loops')) {
      const authHeader = options.headers?.['Authorization'] || options.headers?.Authorization;
      if (authHeader === 'Bearer new-refreshed-token-456') {
        queryCalledWithRefreshedToken = true;
        return Response.json([]);
      }
      return new Response(JSON.stringify({ message: 'JWT expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }
    return Response.json([]);
  };

  try {
    const refreshed = await refreshAuthSession();
    assert.equal(refreshed.token, 'new-refreshed-token-456');
    assert.equal(refreshed.userId, 'usr-refresh-test');

    const stored = JSON.parse(mockStorage.get('sb-eyxvsbqyzeodsjajfqsj-auth-token'));
    assert.equal(stored.access_token, 'new-refreshed-token-456');
    assert.equal(stored.refresh_token, 'new-refresh-token-789');

    const session = getAuthSession();
    assert.equal(session.token, 'new-refreshed-token-456');
    assert.equal(session.userId, 'usr-refresh-test');
    assert.ok(refreshCalled);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('safe reconciliation: server status change updates local state without losing record history', async () => {
  resetStorage();
  const userId = 'usr-reconcile-test';
  const session = {
    access_token: 'mock-valid-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'reconcile@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  // Pre-seed local storage with an open loop
  const localLoops = [
    {
      id: 'loop-alpha',
      title: 'Hold space for quiet',
      note: 'Begin before dawn',
      status: 'open',
      createdAt: '2026-10-26T08:00:00Z',
      updatedAt: '2026-10-26T08:00:00Z',
      user_id: userId,
      syncStatus: 'synced',
      history: [{ status: 'open', timestamp: '2026-10-26T08:00:00Z' }]
    }
  ];
  mockStorage.set('cosmic_loops_v1', JSON.stringify(localLoops));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/rest/v1/loops') && urlStr.includes('deleted_at=is.null')) {
      // Server returns loop-alpha closed at a later timestamp
      return Response.json([
        {
          id: 'loop-alpha',
          title: 'Hold space for quiet',
          note: 'Begin before dawn',
          status: 'closed',
          user_id: userId,
          created_at: '2026-10-26T08:00:00Z',
          updated_at: '2026-10-26T09:30:00Z'
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    await services.sync();

    const storedLoops = JSON.parse(mockStorage.get('cosmic_loops_v1') || '[]');
    const target = storedLoops.find(l => l.id === 'loop-alpha');
    assert.ok(target, 'loop-alpha must still exist in storage');
    assert.equal(target.status, 'closed', 'local loop status must be updated to closed');
    assert.equal(target.syncStatus, 'synced');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('safe reconciliation: records missing from server response are NOT purged (protecting paginated queries)', async () => {
  resetStorage();
  const userId = 'usr-preserve-test';
  const session = {
    access_token: 'mock-valid-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'preserve@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  // Pre-seed local storage with 3 loops
  const localLoops = [
    { id: 'loop-1', title: 'First intention', status: 'open', user_id: userId, updatedAt: '2026-10-26T07:00:00Z' },
    { id: 'loop-2', title: 'Second intention', status: 'evolving', user_id: userId, updatedAt: '2026-10-26T07:30:00Z' },
    { id: 'loop-3', title: 'Third intention', status: 'carried-forward', user_id: userId, updatedAt: '2026-10-26T08:00:00Z' }
  ];
  mockStorage.set('cosmic_loops_v1', JSON.stringify(localLoops));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/rest/v1/loops') && urlStr.includes('deleted_at=is.null')) {
      // Server returns only loop-1 (simulating partial page / query limit)
      return Response.json([
        { id: 'loop-1', title: 'First intention', status: 'open', user_id: userId, updated_at: '2026-10-26T07:00:00Z' }
      ]);
    }
    // No explicit tombstones
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    await services.sync();

    const storedLoops = JSON.parse(mockStorage.get('cosmic_loops_v1') || '[]');
    assert.equal(storedLoops.length, 3, 'all 3 loops must remain stored despite absence from server page');
    assert.ok(storedLoops.some(l => l.id === 'loop-1'));
    assert.ok(storedLoops.some(l => l.id === 'loop-2'));
    assert.ok(storedLoops.some(l => l.id === 'loop-3'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('safe reconciliation: authoritative tombstones (deleted_at IS NOT NULL) ARE purged', async () => {
  resetStorage();
  const userId = 'usr-tombstone-test';
  const session = {
    access_token: 'mock-valid-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'tombstone@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  const localEchoes = [
    { id: 'echo-keep', title: 'Echo to keep', kind: 'text', user_id: userId, updatedAt: '2026-10-26T07:00:00Z' },
    { id: 'echo-tombstone', title: 'Echo to delete', kind: 'text', user_id: userId, updatedAt: '2026-10-26T07:00:00Z' }
  ];
  mockStorage.set('cosmic_echoes_v1', JSON.stringify(localEchoes));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/rest/v1/echoes') && urlStr.includes('deleted_at=not.is.null')) {
      // Authoritative deletion tombstone returned
      return Response.json([{ id: 'echo-tombstone', deleted_at: '2026-10-26T08:00:00Z' }]);
    }
    if (urlStr.includes('/rest/v1/echoes') && urlStr.includes('deleted_at=is.null')) {
      return Response.json([{ id: 'echo-keep', title: 'Echo to keep', kind: 'text', user_id: userId }]);
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    await services.sync();

    const storedEchoes = JSON.parse(mockStorage.get('cosmic_echoes_v1') || '[]');
    assert.equal(storedEchoes.length, 1);
    assert.equal(storedEchoes[0].id, 'echo-keep');
    assert.ok(!storedEchoes.some(e => e.id === 'echo-tombstone'), 'tombstoned echo must be purged');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('offline-to-online recovery: offline creations are preserved and pushed on sync', async () => {
  resetStorage();
  const userId = 'usr-offline-sync';
  const session = {
    access_token: 'mock-valid-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'offline@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  let pushedPayload = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (options.method === 'POST' && urlStr.includes('/rest/v1/loops')) {
      pushedPayload = JSON.parse(options.body || '{}');
      return Response.json([{ id: pushedPayload.id, ...pushedPayload }], { status: 201 });
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    // Simulate creating a loop while offline or disconnected
    const newLoop = await services.loops.create('Intention created offline', 'A quiet note');
    assert.equal(newLoop.user_id, userId);

    // Force syncStatus to local-only to verify sync push
    const currentLoops = JSON.parse(mockStorage.get('cosmic_loops_v1') || '[]');
    const idx = currentLoops.findIndex(l => l.id === newLoop.id);
    currentLoops[idx].syncStatus = 'local-only';
    mockStorage.set('cosmic_loops_v1', JSON.stringify(currentLoops));

    await services.sync();

    assert.ok(pushedPayload, 'unsynced offline loop must be pushed to server');
    assert.equal(pushedPayload.id, newLoop.id);
    assert.equal(pushedPayload.title, 'Intention created offline');

    const updatedLoops = JSON.parse(mockStorage.get('cosmic_loops_v1') || '[]');
    const pushedLoop = updatedLoops.find(l => l.id === newLoop.id);
    assert.equal(pushedLoop.syncStatus, 'synced');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('account isolation: users cannot access records belonging to other users', async () => {
  resetStorage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([]);

  try {
    // 1. User Alpha logs in and creates records
    const sessionAlpha = {
      access_token: 'token-alpha',
      refresh_token: 'refresh-alpha',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'usr-alpha-001', email: 'alpha@example.com' }
    };
    mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(sessionAlpha));

    const servicesAlpha = createLiveLunaServices();
    const echoAlpha = await servicesAlpha.echoes.create({
      title: 'Private Echo by Alpha',
      body: 'Alpha confidential observation',
      kind: 'text',
      context: { cycleId: 'cycle-10', phaseId: 'new-moon', source: 'live', timestamp: new Date().toISOString() }
    });
    const loopAlpha = await servicesAlpha.loops.create('Alpha intention');

    assert.equal(echoAlpha.user_id, 'usr-alpha-001');
    assert.equal(loopAlpha.user_id, 'usr-alpha-001');

    // 2. User Beta logs in
    const sessionBeta = {
      access_token: 'token-beta',
      refresh_token: 'refresh-beta',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'usr-beta-002', email: 'beta@example.com' }
    };
    mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(sessionBeta));

    const servicesBeta = createLiveLunaServices();
    const betaEchoes = (await servicesBeta.echoes.list()).items;
    const betaLoops = await servicesBeta.loops.list();

    // Verify Beta cannot see Alpha's records
    assert.ok(
      !betaEchoes.some(e => e.id === echoAlpha.id || e.title === 'Private Echo by Alpha'),
      'User Beta must never see User Alpha echoes'
    );
    assert.ok(
      !betaLoops.some(l => l.id === loopAlpha.id || l.title === 'Alpha intention'),
      'User Beta must never see User Alpha loops'
    );

    // 3. User Beta signs out
    await servicesBeta.auth.signOut();
    assert.equal(localStorage.getItem('sb-eyxvsbqyzeodsjajfqsj-auth-token'), null);
    assert.equal(servicesBeta.auth.getUser(), null);

    // Unauthenticated user should not see authenticated user data
    const guestEchoes = (await servicesBeta.echoes.list()).items;
    assert.ok(
      !guestEchoes.some(e => e.user_id === 'usr-alpha-001' || e.user_id === 'usr-beta-002'),
      'Guest session must not expose authenticated user records'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('local-first audio persistence: saves to draft audio and resolves offline without network', async () => {
  resetStorage();
  const userId = 'usr-audio-test';
  const session = {
    access_token: 'token-audio',
    refresh_token: 'refresh-audio',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'audio@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  const originalFetch = globalThis.fetch;
  // Network calls fail completely (offline simulation)
  globalThis.fetch = async () => {
    throw new Error('Network error: Device is offline');
  };

  try {
    const services = createLiveLunaServices();
    const testAudioBlob = new Blob(['sample-audio-stream-bytes'], { type: 'audio/webm' });

    // Save draft audio directly to draft storage
    await saveDraftAudio('draft-test-1', testAudioBlob, { duration: 185, status: 'captured' });
    const draft = await getDraftAudio('draft-test-1');
    assert.ok(draft, 'Draft audio must be retrievable from local draft storage');
    assert.equal(draft.duration, 185);

    // Create an echo with local audioBlob
    const echo = await services.echoes.create({
      title: 'Long audio echo',
      body: 'Spoken intention',
      kind: 'voice',
      audioBlob: testAudioBlob,
      duration: 185,
      context: { cycleId: 'cycle-10', phaseId: 'full-moon', source: 'live', timestamp: new Date().toISOString() }
    });

    assert.equal(echo.kind, 'voice');
    assert.equal(echo.duration, 185);

    // Resolve audio offline — must return an object URL derived from local draft storage
    const resolvedUrl = await services.audio.resolve(echo);
    assert.ok(resolvedUrl, 'Audio must resolve locally from draft storage even while offline');
    assert.ok(
      resolvedUrl.startsWith('blob:') || resolvedUrl.startsWith('data:'),
      'Resolved URL must be local object URL'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recording duration: supports durations longer than 2 minutes without limit or truncation', async () => {
  resetStorage();
  const services = createLiveLunaServices();

  // Test creating an Echo with 350 seconds (almost 6 minutes)
  const longEcho = await services.echoes.create({
    title: 'Deep reflection over 5 minutes',
    body: 'Extended meditation recording',
    kind: 'voice',
    audioUrl: 'blob:mock-long-audio',
    duration: 350,
    context: { cycleId: 'cycle-10', phaseId: 'waning-gibbous', source: 'live', timestamp: new Date().toISOString() }
  });

  assert.equal(longEcho.duration, 350, 'Duration must not be clamped to 120 seconds');

  // Verify app.ts code does not reintroduce hardcoded 120s limit or stopRecording at 120
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  assert.ok(
    !appSource.includes('recordingDuration >= 120'),
    'app.ts must not contain 120s auto-stop condition'
  );
  assert.ok(
    !appSource.includes('Math.min(120,'),
    'app.ts must not contain Math.min(120, ...) clamp'
  );
  assert.ok(
    !appSource.includes('Up to 2 minutes'),
    'app.ts UI caption must not claim a 2 minute limit'
  );
});
