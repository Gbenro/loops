import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const supabaseAnonKey = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

// IndexedDB-backed storage for auth session.
// localStorage on iOS PWA can be cleared by the OS when the app is closed.
// IndexedDB persists reliably across PWA restarts on iOS and Android.

const IDB_NAME = 'luna_auth_db';
const IDB_STORE = 'auth';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

const idbStorage = {
  async getItem(key) {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const req = db.transaction(IDB_STORE, 'readonly')
          .objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(localStorage.getItem(key)); // fallback
      });
    } catch {
      return localStorage.getItem(key);
    }
  },
  async setItem(key, value) {
    try {
      localStorage.setItem(key, value); // keep localStorage in sync as backup
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch {
      localStorage.setItem(key, value);
    }
  },
  async removeItem(key) {
    try {
      localStorage.removeItem(key);
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch {
      localStorage.removeItem(key);
    }
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
