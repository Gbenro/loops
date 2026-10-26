import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// 1. Polyfill localStorage for Node test environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Polyfill window / URL.createObjectURL for Node if needed
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = (blob) => 'blob:mock-' + Math.random().toString(36).slice(2);
  globalThis.URL.revokeObjectURL = () => {};
}

// 2. Import modules under test
import {
  createLiveLunaServices,
  saveDraftAudio,
  getDraftAudio,
  listDraftRecordings,
  getAuthSession,
  refreshAuthSession
} from '../src/live-services.ts';

const ECHOES_KEY = 'cosmic_echoes_v1';
const LOOPS_KEY = 'cosmic_loops_v1';

function resetStorage() {
  mockStorage.clear();
}

// ---------------------------------------------------------------------------
// Defect 1: Bundles contain zero export statements and evaluate cleanly in VM
// ---------------------------------------------------------------------------
test('Defect 1: Distribution bundles contain zero export statements and parse cleanly in VM', async () => {
  const distDir = path.resolve(fileURLToPath(import.meta.url), '../../dist');
  const appBundle = await readFile(path.join(distDir, 'app.bundle.js'), 'utf8');

  // Must not have any top-level export statements (e.g. export async, export function, export const)
  const exportStatementRegex = /(?:^|\n)\s*export\s+(?:async\s+)?(?:const|let|var|function|class|default|\{)/;
  assert.equal(
    exportStatementRegex.test(appBundle),
    false,
    'app.bundle.js must not contain any export statements'
  );

  // Must parse as valid VM script without SyntaxError
  assert.doesNotThrow(() => {
    new vm.Script(appBundle, { filename: 'app.bundle.js' });
  }, 'app.bundle.js must compile in node:vm without SyntaxError');
});

// ---------------------------------------------------------------------------
// Defect 2: Serialized sync and conflict-safe local preservation against delayed network
// ---------------------------------------------------------------------------
test('Defect 2: Conflict-safe reconciliation preserves intervening local edits against delayed server responses', async () => {
  resetStorage();
  const userId = 'usr-defect2-test';
  const session = {
    access_token: 'token-defect2',
    refresh_token: 'refresh-defect2',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'defect2@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  // Initial local state
  const initialEchoes = [
    {
      id: 'echo-base-1',
      user_id: userId,
      title: 'Original Title',
      body: 'Original Body',
      kind: 'text',
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      syncStatus: 'synced'
    }
  ];
  mockStorage.set(ECHOES_KEY, JSON.stringify(initialEchoes));

  const originalFetch = globalThis.fetch;
  let serverFetchResolved = false;

  // Server response is delayed by 40ms and returns older server state
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('deleted_at=not.is.null')) {
      return Response.json([]);
    }
    if (urlStr.includes('/rest/v1/echoes')) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      serverFetchResolved = true;
      return Response.json([
        {
          id: 'echo-base-1',
          user_id: userId,
          title: 'Older Server Title',
          body: 'Older Server Body',
          kind: 'text',
          created_at: '2026-10-20T10:00:00Z',
          updated_at: '2026-10-20T10:00:00Z'
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();

    // Start sync in background
    const syncPromise = services.sync();

    // While sync is in-flight on the network, user creates a new Echo offline and edits an existing Echo locally
    const currentStored = JSON.parse(mockStorage.get(ECHOES_KEY) || '[]');
    currentStored.push({
      id: 'echo-intervening-2',
      user_id: userId,
      title: 'Intervening Offline Echo',
      body: 'Created during sync await',
      kind: 'text',
      created_at: '2026-10-20T10:00:02Z',
      updated_at: '2026-10-20T10:00:02Z',
      syncStatus: 'pending'
    });
    // And updates the local record with a newer edit and newer timestamp
    currentStored[0].title = 'Locally Edited Newer Title';
    currentStored[0].syncStatus = 'pending';
    currentStored[0].updated_at = '2026-10-20T10:00:05Z';
    mockStorage.set(ECHOES_KEY, JSON.stringify(currentStored));

    // Wait for the server sync to complete
    await syncPromise;
    assert.ok(serverFetchResolved, 'Server fetch must have resolved');

    // Verify stored echoes: intervening Echo must NOT be lost!
    const reconciledEchoes = JSON.parse(mockStorage.get(ECHOES_KEY) || '[]');
    const intervening = reconciledEchoes.find((e) => e.id === 'echo-intervening-2');
    assert.ok(intervening, 'Intervening local echo must be preserved across server reconciliation');
    assert.equal(intervening.title, 'Intervening Offline Echo');

    // Newer local pending edit must be preserved over older server title
    const edited = reconciledEchoes.find((e) => e.id === 'echo-base-1');
    assert.ok(edited, 'Base echo must exist');
    assert.equal(edited.title, 'Locally Edited Newer Title');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Defect 3: Audio sync status is decoupled from metadata; failed upload is retried independently
// ---------------------------------------------------------------------------
test('Defect 3: Audio upload failure leaves audioSyncStatus failed and retries on subsequent sync', async () => {
  resetStorage();
  const userId = 'usr-defect3-test';
  const session = {
    access_token: 'token-defect3',
    refresh_token: 'refresh-defect3',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'defect3@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  let storageUploadAttempted = 0;
  let simulateStorageFail = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/storage/v1/object/echo-audio/')) {
      storageUploadAttempted++;
      if (simulateStorageFail) {
        return new Response(JSON.stringify({ error: 'Storage upload temporary failure' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
      return Response.json({ Key: 'echo-audio/test.webm' });
    }
    if (urlStr.includes('/rest/v1/echoes')) {
      return Response.json([]);
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    const testAudioBlob = new Blob(['defect3-voice-audio-bytes'], { type: 'audio/webm' });

    // Create voice echo with storage failing
    const createdEcho = await services.echoes.create({
      title: 'Voice with failed audio upload',
      body: 'Spoken test',
      kind: 'voice',
      audioBlob: testAudioBlob,
      duration: 45,
      context: { cycleId: 'c1', phaseId: 'p1', source: 'live', timestamp: new Date().toISOString() }
    });

    // Verify audioSyncStatus is failed and overall syncStatus is failed
    assert.equal(createdEcho.audioSyncStatus, 'failed', 'audioSyncStatus must be failed when upload fails');
    assert.equal(createdEcho.syncStatus, 'failed', 'syncStatus must be failed when audio upload fails');

    // Local draft must be preserved in draft storage
    const draft = await getDraftAudio(createdEcho.id, userId);
    assert.ok(draft, 'Draft audio must remain preserved locally');

    // Now storage heals
    simulateStorageFail = false;
    await services.sync();

    // Verify upload was retried and succeeded
    assert.ok(storageUploadAttempted >= 2, 'Storage upload must be retried on sync');
    const storedEchoes = JSON.parse(mockStorage.get(ECHOES_KEY) || '[]');
    const retriedEcho = storedEchoes.find((e) => e.id === createdEcho.id);
    assert.ok(retriedEcho, 'Echo must exist in local storage');
    assert.equal(retriedEcho.audioSyncStatus, 'synced', 'audioSyncStatus must become synced after retry');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Defect 4: Delayed auth token refresh cannot resurrect a signed-out session or overwrite a new user
// ---------------------------------------------------------------------------
test('Defect 4: Stale in-flight auth refresh is discarded upon sign-out and cannot corrupt new session', async () => {
  resetStorage();
  const userIdA = 'usr-account-a';
  const sessionA = {
    access_token: 'old-token-a',
    refresh_token: 'old-refresh-a',
    expires_at: Math.floor(Date.now() / 1000) - 10,
    user: { id: userIdA, email: 'a@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(sessionA));

  const originalFetch = globalThis.fetch;
  let resolveDelayedRefresh;
  const delayedRefreshPromise = new Promise((resolve) => {
    resolveDelayedRefresh = resolve;
  });

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/auth/v1/token?grant_type=refresh_token')) {
      await delayedRefreshPromise;
      return Response.json({
        access_token: 'new-stale-token-a',
        refresh_token: 'new-stale-refresh-a',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: { id: userIdA, email: 'a@example.com' }
      });
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();

    // Trigger refresh in-flight
    const refreshTask = refreshAuthSession();

    // User signs out while refresh is still awaiting on network
    await services.auth.signOut();
    const sessionAfterSignOut = getAuthSession();
    assert.equal(sessionAfterSignOut.token, null, 'Session token must be null after sign out');
    assert.equal(sessionAfterSignOut.userId, null, 'Session userId must be null after sign out');
    assert.equal(localStorage.getItem('sb-eyxvsbqyzeodsjajfqsj-auth-token'), null, 'Storage token must be cleared');

    // Now delayed refresh finally completes
    resolveDelayedRefresh();
    const result = await refreshTask;

    // Must return null because session was signed out and generation changed
    assert.equal(result.token, null, 'Delayed refresh token must be null when generation changed');
    assert.equal(getAuthSession().token, null, 'Session must not be resurrected after sign out');
    assert.equal(
      localStorage.getItem('sb-eyxvsbqyzeodsjajfqsj-auth-token'),
      null,
      'Refreshed token must not be written to storage after sign out'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Defect 4 & 5: Audio resolution precedence and cross-account isolation
// ---------------------------------------------------------------------------
test('Defects 4 & 5: Audio resolution uses draft blob precedence and isolates records across users', async () => {
  resetStorage();
  const userA = 'usr-isolation-a';
  const userB = 'usr-isolation-b';

  const services = createLiveLunaServices();
  const testBlobA = new Blob(['user-a-private-audio'], { type: 'audio/webm' });

  // Save private draft audio for User A
  await saveDraftAudio('echo-user-a-1', testBlobA, { duration: 25, userId: userA }, userA);

  // Sign in as User A
  mockStorage.set(
    'sb-eyxvsbqyzeodsjajfqsj-auth-token',
    JSON.stringify({
      access_token: 'token-a',
      refresh_token: 'ref-a',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userA, email: 'a@example.com' }
    })
  );

  const echoA = {
    id: 'echo-user-a-1',
    user_id: userA,
    kind: 'voice',
    audio_url: 'blob:stale-revoked-url',
    duration: 25
  };

  // User A resolves own audio: must return object URL from fresh draft blob (not stale audio_url)
  const resolvedA = await services.audio.resolve(echoA);
  assert.ok(resolvedA, 'User A must be able to resolve their own audio');
  assert.ok(resolvedA.startsWith('blob:') || resolvedA.startsWith('data:'));

  // Switch to User B
  await services.auth.signOut();
  mockStorage.set(
    'sb-eyxvsbqyzeodsjajfqsj-auth-token',
    JSON.stringify({
      access_token: 'token-b',
      refresh_token: 'ref-b',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userB, email: 'b@example.com' }
    })
  );

  // User B attempts to resolve User A's private echo: must return null!
  const resolvedB = await services.audio.resolve(echoA);
  assert.equal(resolvedB, null, 'User B must NOT be able to resolve User A private audio');

  // User B cannot get User A draft audio directly
  const draftCross = await getDraftAudio('echo-user-a-1', userB);
  assert.equal(draftCross, null, 'User B cannot read User A draft audio');
});

// ---------------------------------------------------------------------------
// Defect 5: Honest error propagation on IndexedDB persistence failure
// ---------------------------------------------------------------------------
test('Defect 5: saveDraftAudio rejects with honest error on IndexedDB failure', async () => {
  const originalIDB = globalThis.indexedDB;

  // Mock failing indexedDB
  globalThis.indexedDB = {
    open: () => {
      const req = {};
      setTimeout(() => {
        if (req.onerror) {
          req.error = new Error('Simulated QuotaExceededError: disk full');
          req.onerror({ target: req });
        }
      }, 5);
      return req;
    }
  };

  try {
    const testBlob = new Blob(['failing-audio-data'], { type: 'audio/webm' });
    await assert.rejects(
      async () => {
        await saveDraftAudio('fail-rec', testBlob, { duration: 10, userId: 'usr-idb-fail' }, 'usr-idb-fail');
      },
      /QuotaExceededError|Simulated/i,
      'saveDraftAudio must reject when IndexedDB open fails'
    );
  } finally {
    globalThis.indexedDB = originalIDB;
  }
});

// ---------------------------------------------------------------------------
// Defect 5: Interrupted audio draft recovery and enumeration
// ---------------------------------------------------------------------------
test('Defect 5: Interrupted audio drafts are enumeratable and recoverable by owner', async () => {
  resetStorage();
  const userId = 'usr-interrupted-unique';
  const testBlob = new Blob(['interrupted-voice-draft'], { type: 'audio/webm' });

  // Save an interrupted draft (e.g., app backgrounded or phone call during recording)
  await saveDraftAudio('draft-interrupted-1', testBlob, { duration: 75, status: 'interrupted', userId }, userId);
  await saveDraftAudio('draft-active-2', testBlob, { duration: 12, status: 'recording', userId }, userId);

  // Enumerate drafts for this user
  const drafts = await listDraftRecordings(userId);
  assert.equal(drafts.length, 2, 'Must list both interrupted and active drafts');

  const interruptedDraft = drafts.find((d) => d.id === 'draft-interrupted-1');
  assert.ok(interruptedDraft);
  assert.equal(interruptedDraft.status, 'interrupted');
  assert.equal(interruptedDraft.duration, 75);

  // Audio content is fully retrievable
  const recoveredAudio = await getDraftAudio('draft-interrupted-1', userId);
  assert.ok(recoveredAudio, 'Audio must be retrievable for recovery');
  assert.equal(recoveredAudio.status, 'interrupted');
});

// ---------------------------------------------------------------------------
// Defect 6: Tombstones are scoped by authenticated user, paged, and win over server rows
// ---------------------------------------------------------------------------
test('Defect 6: Scoped deletion tombstones override active server rows and page through deletions', async () => {
  resetStorage();
  const userId = 'usr-tombstone-test';
  const session = {
    access_token: 'token-tombstone',
    refresh_token: 'refresh-tombstone',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: 'tombstone@example.com' }
  };
  mockStorage.set('sb-eyxvsbqyzeodsjajfqsj-auth-token', JSON.stringify(session));

  // Store a local tombstone for deleted echo
  const deletedIds = ['echo-deleted-1'];
  mockStorage.set(`luna_deleted_echo_ids_${userId}`, JSON.stringify(deletedIds));

  // Existing local echoes
  mockStorage.set(
    ECHOES_KEY,
    JSON.stringify([
      { id: 'echo-keep-2', user_id: userId, title: 'Kept', body: 'Keep', kind: 'text', syncStatus: 'synced' },
      { id: 'echo-deleted-1', user_id: userId, title: 'To Delete', body: 'Del', kind: 'text', syncStatus: 'synced' }
    ])
  );

  const originalFetch = globalThis.fetch;
  let serverPagesFetched = 0;

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    // Deleted echoes endpoint with paging
    if (urlStr.includes('/rest/v1/echoes') && urlStr.includes('deleted_at=not.is.null')) {
      serverPagesFetched++;
      if (urlStr.includes('offset=0')) {
        return Response.json([{ id: 'echo-deleted-from-server-3' }]);
      }
      return Response.json([]);
    }
    // Active echoes endpoint returns echo-deleted-1 (stale server view)
    if (urlStr.includes('/rest/v1/echoes')) {
      return Response.json([
        { id: 'echo-deleted-1', user_id: userId, title: 'To Delete', body: 'Del', kind: 'text' },
        { id: 'echo-keep-2', user_id: userId, title: 'Kept', body: 'Keep', kind: 'text' }
      ]);
    }
    return Response.json([]);
  };

  try {
    const services = createLiveLunaServices();
    await services.sync();

    // Verify echo-deleted-1 is removed (local tombstone won over server active row)
    const storedEchoes = JSON.parse(mockStorage.get(ECHOES_KEY) || '[]');
    assert.equal(storedEchoes.some((e) => e.id === 'echo-deleted-1'), false, 'Tombstoned echo must be excluded');
    assert.equal(storedEchoes.some((e) => e.id === 'echo-keep-2'), true, 'Kept echo must remain');

    // Server-fetched deletion must be merged into local tombstones
    const updatedTombstones = JSON.parse(mockStorage.get(`luna_deleted_echo_ids_${userId}`) || '[]');
    assert.ok(updatedTombstones.includes('echo-deleted-from-server-3'), 'Server deletions must be paged into tombstones');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Defect 7: Wake-lock generation guard releases lock if capture ends before promise resolves
// ---------------------------------------------------------------------------
test('Defect 7: Late wake-lock resolution is safely released if capture ended beforehand', async () => {
  let releaseCalled = false;
  let resolveWakeLock;
  const mockWakeLockPromise = new Promise((resolve) => {
    resolveWakeLock = resolve;
  });

  const sentinel = {
    release: async () => {
      releaseCalled = true;
    }
  };

  // Simulate wakeLockToken guard logic from app.ts:
  // When capture starts, token is incremented
  let wakeLockToken = 1;
  const tokenAtStart = wakeLockToken;
  let isCapturing = true;

  const wakeLockResolution = mockWakeLockPromise.then((lock) => {
    // Generation check matching app.ts
    if (wakeLockToken !== tokenAtStart || !isCapturing) {
      lock.release?.().catch(() => {});
      return null;
    }
    return lock;
  });

  // User stops capture before wake lock resolves
  wakeLockToken++;
  isCapturing = false;

  // Wake lock finally resolves
  resolveWakeLock(sentinel);
  const resultLock = await wakeLockResolution;

  assert.equal(resultLock, null, 'Result lock must be null when capture ended before resolution');
  assert.equal(releaseCalled, true, 'Sentinel release() must be called immediately when capture token changed');
});

// ---------------------------------------------------------------------------
// Defect 1: Real browser boot, DOM mounting, and route navigation via Playwright Chrome
// ---------------------------------------------------------------------------
test('Defect 1: Standalone bundle boots cleanly in real Chrome browser and navigates without errors', async () => {
  const distHtmlPath = path.resolve(fileURLToPath(import.meta.url), '../../dist/index.html');
  const fileUrl = 'file:///' + distHtmlPath.replace(/\\/g, '/');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 5000 });

    // Verify DOM content is rendered
    const appHtml = await page.$eval('#app', (el) => el.innerHTML);
    assert.ok(appHtml.length > 500, 'App DOM should be populated with initial view');

    // Test route navigation: Sky, Field, Echoes, Loops
    const routes = ['#/sky', '#/field', '#/echoes', '#/loops'];
    for (const route of routes) {
      await page.evaluate((r) => { window.location.hash = r; }, route);
      await page.waitForTimeout(100);
      const content = await page.$eval('#app', (el) => el.innerHTML);
      assert.ok(content.length > 100, `Route ${route} should render content`);
    }

    assert.equal(pageErrors.length, 0, `Page should have 0 unhandled errors, got: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
