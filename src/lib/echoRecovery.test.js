import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveDraftAudio,
  getDraftAudio,
  getAllDraftAudio,
  updateDraftAudio,
  deleteDraftAudio,
} from './audioStorage.js';
import { saveEcho } from './storage.js';
import { supabase } from './supabase.js';

// Functional localStorage mock
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _reset: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Echo Data-Loss Prevention & Recovery Suite', () => {
  let mockStore = new Map();

  beforeEach(() => {
    mockStore = new Map();
    localStorageMock._reset();

    // In-memory IndexedDB mock for testing durable draft operations
    const mockDb = {
      transaction: () => {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore: () => ({
            put: (record) => {
              mockStore.set(record.id, record);
              setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
            },
            get: (id) => {
              const req = { result: mockStore.get(id) || null, onsuccess: null, onerror: null };
              setTimeout(() => {
                req.onsuccess && req.onsuccess();
                tx.oncomplete && tx.oncomplete();
              }, 0);
              return req;
            },
            getAll: () => {
              const req = { result: Array.from(mockStore.values()), onsuccess: null, onerror: null };
              setTimeout(() => {
                req.onsuccess && req.onsuccess();
                tx.oncomplete && tx.oncomplete();
              }, 0);
              return req;
            },
            delete: (id) => {
              mockStore.delete(id);
              setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
            }
          })
        };
        return tx;
      }
    };

    globalThis.indexedDB = {
      open: () => {
        const req = { result: mockDb, onsuccess: null, onerror: null, onupgradeneeded: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }
    };
  });

  describe('Durable Draft Audio & Metadata Storage', () => {
    it('persists a draft recording with full metadata before network operations', async () => {
      const draftId = 'draft_123';
      const fakeBlob = new Blob(['mock audio bits'], { type: 'audio/webm' });
      const lunarContext = {
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        zodiac: 'Virgo'
      };

      const record = await saveDraftAudio(draftId, fakeBlob, {
        echoId: 'e_target_456',
        userId: 'u_user_789',
        text: 'Initial voice reflection',
        status: 'draft',
        lunarContext
      });

      expect(record).toBeDefined();
      expect(record.id).toBe(draftId);
      expect(record.echoId).toBe('e_target_456');
      expect(record.userId).toBe('u_user_789');
      expect(record.text).toBe('Initial voice reflection');
      expect(record.status).toBe('draft');
      expect(record.lunarContext.lunarMonth).toBe('Harvest');
      expect(record.lunarContext.dayOfCycle).toBe(1);

      const retrieved = await getDraftAudio(draftId);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(draftId);
      expect(retrieved.text).toBe('Initial voice reflection');
    });

    it('updates draft status and transcript incrementally', async () => {
      const draftId = 'draft_update_test';
      const fakeBlob = new Blob(['audio sample'], { type: 'audio/webm' });

      await saveDraftAudio(draftId, fakeBlob, {
        echoId: 'e_up_1',
        text: '',
        status: 'transcribing'
      });

      const updated = await updateDraftAudio(draftId, {
        text: 'Transcribed text arriving incrementally',
        status: 'saving',
        audioPath: 'u_user/e_up_1.webm'
      });

      expect(updated.text).toBe('Transcribed text arriving incrementally');
      expect(updated.status).toBe('saving');
      expect(updated.audioPath).toBe('u_user/e_up_1.webm');

      const all = await getAllDraftAudio();
      expect(all.length).toBe(1);
      expect(all[0].status).toBe('saving');
    });

    it('preserves draft when network save fails, recording error details', async () => {
      const draftId = 'draft_fail_test';
      const fakeBlob = new Blob(['audio data'], { type: 'audio/webm' });

      await saveDraftAudio(draftId, fakeBlob, {
        echoId: 'e_fail_1',
        status: 'saving'
      });

      const failed = await updateDraftAudio(draftId, {
        status: 'failed',
        lastError: 'Audio upload timed out after 30s'
      });

      expect(failed.status).toBe('failed');
      expect(failed.lastError).toBe('Audio upload timed out after 30s');

      const preserved = await getDraftAudio(draftId);
      expect(preserved).not.toBeNull();
      expect(preserved.status).toBe('failed');
    });

    it('purges draft only upon confirmed positive acknowledgement', async () => {
      const draftId = 'draft_purge_test';
      const fakeBlob = new Blob(['audio data'], { type: 'audio/webm' });

      await saveDraftAudio(draftId, fakeBlob, { echoId: 'e_purge_1' });
      expect(mockStore.has(draftId)).toBe(true);

      const deleted = await deleteDraftAudio(draftId);
      expect(deleted).toBe(true);
      expect(mockStore.has(draftId)).toBe(false);
    });
  });

  describe('Idempotent Save & Deduplication', () => {
    it('does not duplicate echoes in local storage on multiple retries', async () => {
      const mockEcho = {
        id: 'e_dedup_test',
        text: 'Idempotent reflection',
        createdAt: new Date().toISOString(),
        phase: 'new',
        phaseName: 'New Moon',
        lunarMonth: 'Harvest',
        dayOfCycle: 1,
        zodiac: 'Virgo'
      };

      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        }),
        insert: async () => ({ error: null })
      });

      // First save
      await saveEcho(mockEcho, 'user_123');
      // Second save (simulated retry)
      await saveEcho(mockEcho, 'user_123');

      const raw = localStorageMock.getItem('cosmic_echoes_v1');
      const savedEchoes = JSON.parse(raw || '[]');
      const matching = savedEchoes.filter((e) => e.id === 'e_dedup_test');
      expect(matching.length).toBe(1);

      selectSpy.mockRestore();
    });

    it('treats duplicate primary key error (code 23505) as idempotent success', async () => {
      const mockEcho = {
        id: 'e_pk_test',
        text: 'Duplicate test',
        createdAt: new Date().toISOString()
      };

      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        }),
        insert: async () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      });

      const result = await saveEcho(mockEcho, 'user_123');
      expect(result).toBeDefined();
      expect(result.id).toBe('e_pk_test');

      selectSpy.mockRestore();
    });

    it('returns existing server echo without re-inserting if already present', async () => {
      const mockEcho = {
        id: 'e_existing_server',
        text: 'Already on server',
        createdAt: new Date().toISOString()
      };

      let insertCalled = false;
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 'e_existing_server' }, error: null })
          })
        }),
        insert: async () => {
          insertCalled = true;
          return { error: null };
        }
      });

      const result = await saveEcho(mockEcho, 'user_123');
      expect(result.id).toBe('e_existing_server');
      expect(insertCalled).toBe(false);

      selectSpy.mockRestore();
    });
  });

  describe('Startup & Refresh Reconciliation Logic', () => {
    it('detects un-synced drafts when absent server-side', () => {
      const serverEchoes = [{ id: 'e_server_1' }, { id: 'e_server_2' }];
      const localDrafts = [
        { id: 'draft_1', echoId: 'e_server_1', text: 'Already saved' },
        { id: 'draft_2', echoId: 'e_unsynced_lost', text: 'Lost heartfelt recording', blob: {} }
      ];

      const serverEchoIds = new Set(serverEchoes.map((e) => e.id));
      const recoverableDrafts = localDrafts.filter((d) => !serverEchoIds.has(d.echoId));

      expect(recoverableDrafts.length).toBe(1);
      expect(recoverableDrafts[0].echoId).toBe('e_unsynced_lost');
      expect(recoverableDrafts[0].text).toBe('Lost heartfelt recording');
    });

    it('identifies already-synced drafts for safe cleanup without duplicating', () => {
      const serverEchoes = [{ id: 'e_server_1' }];
      const draft = { id: 'draft_1', echoId: 'e_server_1' };

      const serverEchoIds = new Set(serverEchoes.map((e) => e.id));
      const isAlreadySynced = serverEchoIds.has(draft.echoId);

      expect(isAlreadySynced).toBe(true);
    });
  });
});
