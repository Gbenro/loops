// Shared by Classic and Beta. Bound every IndexedDB operation, not just opening.
export function createAuthStorage(timeoutMs = 1500) {
  const versions = new Map();
  const local = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const marker = (key) => key + ':signed-out';
  const version = (key) => versions.get(key) || 0;
  function transact(key, mode, value, expectedVersion) {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      let done = false, db, tx;
      const finish = (result = null) => {
        if (done) return;
        done = true; clearTimeout(timer); db?.close?.(); resolve(result);
      };
      const timer = setTimeout(() => { try { tx?.abort?.(); } catch {} finish(); }, timeoutMs);
      try {
        const request = indexedDB.open('luna_auth_db', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('auth')) database.createObjectStore('auth');
        };
        request.onerror = request.onblocked = () => finish();
        request.onsuccess = () => {
          db = request.result;
          if (done) { db?.close?.(); return; }
          if (expectedVersion !== version(key)) { finish(); return; }
          // A newer tab may have changed the session while IndexedDB was opening.
          const current = local(key);
          if (mode === 'put' && ((current !== null && current !== value) || local(marker(key)))) { finish(); return; }
          if (mode === 'delete' && current !== null) { finish(); return; }
          try {
            tx = db.transaction('auth', mode === 'get' ? 'readonly' : 'readwrite');
            const store = tx.objectStore('auth');
            const op = mode === 'get' ? store.get(key) : mode === 'put' ? store.put(value, key) : store.delete(key);
            if (mode === 'get') op.onsuccess = () => finish(op.result ?? null);
            tx.oncomplete = () => finish();
            tx.onerror = tx.onabort = () => finish();
            op.onerror = () => finish();
          } catch { finish(); }
        };
      } catch { finish(); }
    });
  }
  return {
    async getItem(key) {
      // The synchronous copy contains the latest rotated token even if IDB is stale.
      const current = local(key);
      if (current !== null) {
        void transact(key, 'put', current, version(key));
        return current;
      }
      if (local(marker(key))) return null;
      const before = version(key);
      const stored = await transact(key, 'get', null, before);
      if (before !== version(key) || local(marker(key))) return local(key);
      const newer = local(key);
      if (newer !== null) return newer;
      if (typeof stored !== 'string') return null;
      try { localStorage.setItem(key, stored); } catch {}
      return stored;
    },
    async setItem(key, value) {
      const next = version(key) + 1; versions.set(key, next);
      try { localStorage.setItem(key, value); localStorage.removeItem(marker(key)); } catch {}
      await transact(key, 'put', value, next);
    },
    async removeItem(key) {
      const next = version(key) + 1; versions.set(key, next);
      // Retain a tombstone if IDB deletion stalls, so a later launch cannot revive it.
      try { localStorage.setItem(marker(key), '1'); localStorage.removeItem(key); } catch {}
      await transact(key, 'delete', null, next);
    }
  };
}
export const idbStorage = createAuthStorage();
