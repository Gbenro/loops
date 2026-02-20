import { api } from './client';

const STORAGE_KEY = 'loops_v5_data';
const SYNC_TIMESTAMP_KEY = 'loops_last_sync';
const PENDING_CHANGES_KEY = 'loops_pending_changes';

export const syncManager = {
  // Load from localStorage (offline-first)
  loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load local data:', e);
    }
    return null;
  },

  // Save to localStorage
  saveLocal(loops) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loops));
    } catch (e) {
      console.error('Failed to save local data:', e);
    }
  },

  // Get last sync timestamp
  getLastSync() {
    const ts = localStorage.getItem(SYNC_TIMESTAMP_KEY);
    return ts ? new Date(ts) : null;
  },

  // Save sync timestamp
  saveLastSync(timestamp) {
    localStorage.setItem(SYNC_TIMESTAMP_KEY, timestamp.toISOString());
  },

  // Mark changes as pending (for offline mode)
  markPendingChanges(hasPending = true) {
    localStorage.setItem(PENDING_CHANGES_KEY, hasPending ? 'true' : 'false');
  },

  hasPendingChanges() {
    return localStorage.getItem(PENDING_CHANGES_KEY) === 'true';
  },

  // Full sync with server
  async syncWithServer(localLoops) {
    if (!api.isAuthenticated()) {
      return { loops: localLoops, synced: false };
    }

    try {
      const lastSync = this.getLastSync();
      const response = await api.syncLoops(localLoops, lastSync);

      const serverLoops = response.loops;
      const serverTimestamp = new Date(response.serverTimestamp);

      this.saveLastSync(serverTimestamp);
      this.saveLocal(serverLoops);
      this.markPendingChanges(false);

      return {
        loops: serverLoops,
        synced: true,
        conflicts: response.conflicts
      };
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        return { loops: localLoops, synced: false, authError: true };
      }
      // Network error - stay offline
      console.warn('Sync failed, using local data:', error);
      this.markPendingChanges(true);
      return { loops: localLoops, synced: false, offline: true };
    }
  },

  // Migration: first-time sync after login
  async migrateLocalToServer() {
    const localLoops = this.loadLocal();

    // First, check what's on the server
    let serverLoops = [];
    try {
      serverLoops = await api.getLoops();
    } catch (e) {
      console.error('Failed to fetch server loops:', e);
    }

    // If server has data, use it (don't overwrite with local demo data)
    if (serverLoops && serverLoops.length > 0) {
      console.log('[Sync] Server has data, using server loops');
      this.saveLocal(serverLoops);
      this.saveLastSync(new Date());
      return { migrated: 0, loops: serverLoops };
    }

    // Server is empty - push local data if we have any
    if (localLoops && localLoops.length > 0) {
      console.log('[Sync] Server empty, migrating local loops');
      try {
        const response = await api.syncLoops(localLoops, null);
        this.saveLastSync(new Date(response.serverTimestamp));
        this.saveLocal(response.loops);
        return { migrated: localLoops.length, loops: response.loops };
      } catch (error) {
        console.error('Migration failed:', error);
        throw error;
      }
    }

    // Both empty
    return { migrated: 0, loops: [] };
  },
};
