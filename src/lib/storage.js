// Cosmic Loops - localStorage Persistence
// Simple offline-first storage (no backend sync)

const KEYS = {
  LOOPS: 'cosmic_loops_v1',
  ECHOES: 'cosmic_echoes_v1',
  SETTINGS: 'cosmic_settings_v1',
};

export const storage = {
  // ─── Loops ───────────────────────────────────────────────────────────────

  getLoops() {
    try {
      const raw = localStorage.getItem(KEYS.LOOPS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load loops:', e);
    }
    return [];
  },

  saveLoops(loops) {
    try {
      localStorage.setItem(KEYS.LOOPS, JSON.stringify(loops));
    } catch (e) {
      console.error('Failed to save loops:', e);
    }
  },

  // ─── Echoes (Journal) ────────────────────────────────────────────────────

  getEchoes() {
    try {
      const raw = localStorage.getItem(KEYS.ECHOES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load echoes:', e);
    }
    return [];
  },

  saveEchoes(echoes) {
    try {
      localStorage.setItem(KEYS.ECHOES, JSON.stringify(echoes));
    } catch (e) {
      console.error('Failed to save echoes:', e);
    }
  },

  // ─── Settings ────────────────────────────────────────────────────────────

  getSettings() {
    try {
      const raw = localStorage.getItem(KEYS.SETTINGS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return {
      location: { lat: 41.9, lng: -87.7, name: 'Chicago' }, // Default
    };
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  // ─── Utilities ───────────────────────────────────────────────────────────

  clearAll() {
    localStorage.removeItem(KEYS.LOOPS);
    localStorage.removeItem(KEYS.ECHOES);
    localStorage.removeItem(KEYS.SETTINGS);
  },

  // Generate unique ID
  generateId(prefix = 'l') {
    return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
  },
};
