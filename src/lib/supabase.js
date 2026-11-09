import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const supabaseAnonKey = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

// IndexedDB-backed storage with resilient localStorage fallback.
// iOS PWA can clear localStorage on termination; IndexedDB persists across restarts.
// Conversely, IndexedDB can stall or block in background/private tabs; localStorage acts as immediate fallback.

const IDB_NAME = 'luna_auth_db';
const IDB_STORE = 'auth';
const IDB_TIMEOUT_MS = 1500;

let dbPromise = null;

function getIDBPromise() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[AuthStorage] IndexedDB open timed out after', IDB_TIMEOUT_MS, 'ms; using localStorage fallback');
        resolve(null);
      }
    }, IDB_TIMEOUT_MS);

    try {
      const req = indexedDB.open(IDB_NAME, 1);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      req.onsuccess = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const db = e.target.result;
        db.onclose = () => { dbPromise = null; };
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };

      req.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };

      req.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.warn('[AuthStorage] IndexedDB open blocked; using localStorage fallback');
        resolve(null);
      };
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });

  return dbPromise;
}

export function resetDBPromiseForTesting() {
  dbPromise = null;
}

export const idbStorage = {
  async getItem(key) {
    // 1. Try IndexedDB with timeout
    try {
      const db = await getIDBPromise();
      if (db) {
        const idbVal = await new Promise((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });

        if (idbVal !== null && idbVal !== undefined) {
          // Keep localStorage in sync in case IDB was restored first
          try {
            if (typeof localStorage !== 'undefined' && idbVal) {
              localStorage.setItem(key, idbVal);
            }
          } catch {}
          return idbVal;
        }
      }
    } catch (err) {
      console.warn('[AuthStorage] getItem IndexedDB error:', err);
    }

    // 2. Fallback to localStorage if IDB misses, times out, or fails
    try {
      if (typeof localStorage !== 'undefined') {
        const localVal = localStorage.getItem(key);
        if (localVal) {
          // Asynchronously hydrate IndexedDB so future reads hit IDB
          getIDBPromise().then((db) => {
            if (db) {
              try {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).put(localVal, key);
              } catch {}
            }
          }).catch(() => {});
          return localVal;
        }
      }
    } catch (err) {
      console.warn('[AuthStorage] getItem localStorage error:', err);
    }

    return null;
  },

  async setItem(key, value) {
    // Synchronously write to localStorage first so immediate reloads or readers have data
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}

    // Persist to IndexedDB
    try {
      const db = await getIDBPromise();
      if (db) {
        await new Promise((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch {}
  },

  async removeItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}

    try {
      const db = await getIDBPromise();
      if (db) {
        await new Promise((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: idbStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
