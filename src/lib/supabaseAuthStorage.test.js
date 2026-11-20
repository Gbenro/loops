import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { idbStorage } from './supabase.js';

describe('idbStorage Dual Storage Adapter', () => {
  let localStorageMock;
  let idbRecords;
  let originalIndexedDB;

  beforeEach(() => {

    // Mock localStorage
    const localStore = new Map();
    localStorageMock = {
      getItem: vi.fn((key) => localStore.get(key) || null),
      setItem: vi.fn((key, val) => localStore.set(key, String(val))),
      removeItem: vi.fn((key) => localStore.delete(key)),
      clear: vi.fn(() => localStore.clear()),
    };
    vi.stubGlobal('localStorage', localStorageMock);

    // Mock indexedDB
    idbRecords = new Map();
    originalIndexedDB = globalThis.indexedDB;

    const mockIDB = {
      open: vi.fn((name, version) => {
        const req = {};
        setTimeout(() => {
          const db = {
            objectStoreNames: {
              contains: vi.fn((store) => true),
            },
            createObjectStore: vi.fn(),
            transaction: vi.fn((storeName, mode) => {
              const tx = {
                objectStore: vi.fn(() => ({
                  get: vi.fn((key) => {
                    const getReq = {};
                    setTimeout(() => {
                      getReq.result = idbRecords.get(key);
                      getReq.onsuccess?.({ target: { result: getReq.result } });
                    }, 5);
                    return getReq;
                  }),
                  put: vi.fn((val, key) => {
                    idbRecords.set(key, val);
                    setTimeout(() => tx.oncomplete?.(), 5);
                  }),
                  delete: vi.fn((key) => {
                    idbRecords.delete(key);
                    setTimeout(() => tx.oncomplete?.(), 5);
                  }),
                })),
                oncomplete: null,
                onerror: null,
              };
              return tx;
            }),
            close: vi.fn(),
          };
          req.result = db;
          req.onsuccess?.({ target: { result: db } });
        }, 10);
        return req;
      }),
    };
    vi.stubGlobal('indexedDB', mockIDB);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalIndexedDB) {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });

  it('reads session from IndexedDB when present and mirrors to localStorage', async () => {
    const testSession = JSON.stringify({ access_token: 'idb_token', user: { id: 'u1' } });
    idbRecords.set('sb-auth-token', testSession);

    const val = await idbStorage.getItem('sb-auth-token');
    expect(val).toBe(testSession);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('sb-auth-token', testSession);
  });

  it('falls back to localStorage when IndexedDB returns undefined (empty store)', async () => {
    const localSession = JSON.stringify({ access_token: 'local_token', user: { id: 'u2' } });
    localStorageMock.setItem('sb-auth-token', localSession);

    // IndexedDB does not have the key
    expect(idbRecords.has('sb-auth-token')).toBe(false);

    const val = await idbStorage.getItem('sb-auth-token');
    expect(val).toBe(localSession);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('sb-auth-token');

  });

  it('falls back to localStorage when IndexedDB is blocked or times out', async () => {

    // Mock indexedDB that triggers onblocked or stalls
    const blockedIDB = {
      open: vi.fn(() => {
        const req = {};
        setTimeout(() => {
          req.onblocked?.();
        }, 10);
        return req;
      }),
    };
    vi.stubGlobal('indexedDB', blockedIDB);

    const localSession = JSON.stringify({ access_token: 'fallback_token' });
    localStorageMock.setItem('sb-auth-token', localSession);

    const val = await idbStorage.getItem('sb-auth-token');
    expect(val).toBe(localSession);
  });

  it('setItem synchronously updates localStorage and persists to IndexedDB', async () => {
    const sessionData = JSON.stringify({ access_token: 'new_session' });
    await idbStorage.setItem('sb-auth-token', sessionData);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('sb-auth-token', sessionData);
    expect(idbRecords.get('sb-auth-token')).toBe(sessionData);
  });

  it('removeItem removes from both localStorage and IndexedDB', async () => {
    idbRecords.set('sb-auth-token', 'to_delete');
    localStorageMock.setItem('sb-auth-token', 'to_delete');

    await idbStorage.removeItem('sb-auth-token');

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('sb-auth-token');
    expect(idbRecords.has('sb-auth-token')).toBe(false);
  });
});
