import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveEcho,
  getEchoes,
  updateEchoText,
  updateEchoAudioPath,
  generateId,
} from './storage.js';
import { mapEcho } from '../../mcp-server/src/tools.ts';
import { supabase } from './supabase.js';

// Mock localStorage
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
    _store: store,
    _reset: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Loop-Attached Echo Creation & Relationship Symmetry (iss_1789756747974_8rpf)', () => {
  beforeEach(() => {
    localStorageMock._reset();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    vi.restoreAllMocks();
  });

  describe('Empty Content Rejection & Visibility', () => {
    it('rejects saving an echo with empty text and no audio', async () => {
      const emptyEcho = {
        id: 'e_empty_1',
        text: '',
        linkedLoopId: 'l_test_1',
        createdAt: new Date().toISOString(),
      };

      await expect(saveEcho(emptyEcho, 'user_123')).rejects.toThrow(
        /Cannot save empty echo: text or audio reflection is required/i
      );

      // Verify nothing was stored in localStorage
      const raw = localStorageMock.getItem('cosmic_echoes_v1');
      const saved = JSON.parse(raw || '[]');
      expect(saved.find((e) => e.id === 'e_empty_1')).toBeUndefined();
    });

    it('rejects saving an echo with whitespace-only text and null audio', async () => {
      const whitespaceEcho = {
        id: 'e_whitespace_1',
        text: '    \n\t  ',
        audio_path: null,
        audioPath: null,
        linkedLoopId: 'l_test_1',
        createdAt: new Date().toISOString(),
      };

      await expect(saveEcho(whitespaceEcho, 'user_123')).rejects.toThrow(
        /Cannot save empty echo: text or audio reflection is required/i
      );
    });

    it('allows saving an echo with non-empty text and no audio', async () => {
      const validTextEcho = {
        id: 'e_valid_text',
        text: 'Meeting reflections with Demola: agreed on design next steps',
        linkedLoopId: 'l_demola_1',
        createdAt: new Date().toISOString(),
      };

      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          expect(payload.text).toBe(validTextEcho.text);
          expect(payload.linked_loop_id).toBe('l_demola_1');
          expect(payload.loop_ids).toEqual(['l_demola_1']);
          return { error: null };
        },
      });

      const result = await saveEcho(validTextEcho, 'user_123');
      expect(result.id).toBe('e_valid_text');
      expect(result.text).toBe(validTextEcho.text);
      expect(result.loopIds).toEqual(['l_demola_1']);
      expect(result.linkedLoopId).toBe('l_demola_1');

      selectSpy.mockRestore();
    });

    it('allows saving an audio-only echo with label fallback or audio_path', async () => {
      const voiceEcho = {
        id: 'e_voice_1',
        text: 'Voice reflection',
        audio_path: 'user_123/e_voice_1.webm',
        linkedLoopId: 'l_demola_1',
        createdAt: new Date().toISOString(),
      };

      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          expect(payload.audio_path).toBe('user_123/e_voice_1.webm');
          expect(payload.text).toBe('Voice reflection');
          return { error: null };
        },
      });

      const result = await saveEcho(voiceEcho, 'user_123');
      expect(result.audio_path).toBe('user_123/e_voice_1.webm');
      expect(result.text).toBe('Voice reflection');

      selectSpy.mockRestore();
    });
  });

  describe('Bidirectional Relationship Persistence & Symmetry', () => {
    it('populates both linked_loop_id and loop_ids when linkedLoopId is provided', async () => {
      let capturedPayload = null;
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          capturedPayload = payload;
          return { error: null };
        },
      });

      const echo = {
        id: 'e_rel_1',
        text: 'Follow up on contracts',
        linkedLoopId: 'l_contract_loop',
        createdAt: new Date().toISOString(),
      };

      await saveEcho(echo, 'user_123');
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.linked_loop_id).toBe('l_contract_loop');
      expect(capturedPayload.loop_ids).toEqual(['l_contract_loop']);

      selectSpy.mockRestore();
    });

    it('populates linked_loop_id and loop_ids symmetrically when loopIds array is provided', async () => {
      let capturedPayload = null;
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          capturedPayload = payload;
          return { error: null };
        },
      });

      const echo = {
        id: 'e_multi_loop',
        text: 'Cross-functional reflection',
        loopIds: ['l_loop_a', 'l_loop_b'],
        createdAt: new Date().toISOString(),
      };

      await saveEcho(echo, 'user_123');
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.linked_loop_id).toBe('l_loop_a');
      expect(capturedPayload.loop_ids).toEqual(['l_loop_a', 'l_loop_b']);

      selectSpy.mockRestore();
    });

    it('unifies and deduplicates linkedLoopId and loopIds when both are passed', async () => {
      let capturedPayload = null;
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          capturedPayload = payload;
          return { error: null };
        },
      });

      const echo = {
        id: 'e_unified_rel',
        text: 'Unified reflection',
        linkedLoopId: 'l_primary',
        loopIds: ['l_primary', 'l_secondary'],
        createdAt: new Date().toISOString(),
      };

      const result = await saveEcho(echo, 'user_123');
      expect(capturedPayload.linked_loop_id).toBe('l_primary');
      expect(capturedPayload.loop_ids).toEqual(['l_primary', 'l_secondary']);
      expect(result.linkedLoopId).toBe('l_primary');
      expect(result.loopIds).toEqual(['l_primary', 'l_secondary']);

      selectSpy.mockRestore();
    });
  });

  describe('MCP tools.ts mapEcho Relationship Symmetry', () => {
    it('resolves loopIds from linked_loop_id when loop_ids in DB is empty array [] (Demola bug case)', () => {
      const dbRowWithEmptyLoopIds = {
        id: 'e1789682858451f0mv',
        text: 'Demola appointment discussion',
        linked_loop_id: 'l1789152529300e6a0',
        loop_ids: [], // Previously caused loopIds to evaluate to [] because Array.isArray([]) is true
        created_at: '2026-09-17T22:07:38.451Z',
        tags: [],
        provenance_author: 'user',
        provenance_kind: 'original_echo',
      };

      const mapped = mapEcho(dbRowWithEmptyLoopIds);
      expect(mapped).toBeDefined();
      expect(mapped.loopIds).toEqual(['l1789152529300e6a0']);
    });

    it('resolves loopIds when loop_ids contains IDs and linked_loop_id is also present without duplicate', () => {
      const dbRow = {
        id: 'e_test_dedup',
        text: 'Testing deduplication in mapper',
        linked_loop_id: 'l_main',
        loop_ids: ['l_main', 'l_other'],
        created_at: '2026-09-17T22:07:38.451Z',
      };

      const mapped = mapEcho(dbRow);
      expect(mapped.loopIds).toEqual(['l_main', 'l_other']);
    });

    it('returns empty loopIds when both loop_ids and linked_loop_id are absent', () => {
      const dbRow = {
        id: 'e_standalone',
        text: 'Standalone echo',
        linked_loop_id: null,
        loop_ids: null,
        created_at: '2026-09-17T22:07:38.451Z',
      };

      const mapped = mapEcho(dbRow);
      expect(mapped.loopIds).toEqual([]);
    });
  });

  describe('getEchoes Symmetric Relationship Mapping', () => {
    it('maps both linkedLoopId and loopIds when fetching from Supabase', async () => {
      const mockServerRows = [
        {
          id: 'e_srv_1',
          text: 'Server echo linked to loop',
          linked_loop_id: 'l_target_loop',
          loop_ids: ['l_target_loop'],
          created_at: new Date().toISOString(),
          provenance_author: 'user',
          provenance_kind: 'original_echo',
        },
        {
          id: 'e_srv_2',
          text: 'Server echo with only linked_loop_id',
          linked_loop_id: 'l_legacy_loop',
          loop_ids: [],
          created_at: new Date().toISOString(),
          provenance_author: 'user',
          provenance_kind: 'original_echo',
        },
      ];

      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            is: () => ({
              or: () => ({
                or: () => ({
                  order: async () => ({ data: mockServerRows, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      const echoes = await getEchoes('user_123');
      expect(echoes.length).toBe(2);

      const first = echoes.find((e) => e.id === 'e_srv_1');
      expect(first.linkedLoopId).toBe('l_target_loop');
      expect(first.loopIds).toEqual(['l_target_loop']);

      const second = echoes.find((e) => e.id === 'e_srv_2');
      expect(second.linkedLoopId).toBe('l_legacy_loop');
      expect(second.loopIds).toEqual(['l_legacy_loop']);

      selectSpy.mockRestore();
    });

    it('maps loopIds for unauthenticated local echoes', async () => {
      const localEchoes = [
        {
          id: 'e_local_1',
          text: 'Local draft echo',
          linkedLoopId: 'l_local_loop',
          provenanceAuthor: 'user',
          provenanceKind: 'original_echo',
        },
      ];
      localStorageMock.setItem('cosmic_echoes_v1', JSON.stringify(localEchoes));

      const echoes = await getEchoes(null);
      expect(echoes.length).toBe(1);
      expect(echoes[0].linkedLoopId).toBe('l_local_loop');
      expect(echoes[0].loopIds).toEqual(['l_local_loop']);
    });
  });

  describe('Failure Safety & Idempotency', () => {
    it('falls back gracefully when loop_ids column does not exist on server (code 42703)', async () => {
      let callCount = 0;
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (payload) => {
          callCount++;
          if (callCount === 1) {
            // First call with loop_ids fails with 42703 (undefined column)
            return { error: { code: '42703', message: 'column loop_ids does not exist' } };
          }
          // Retry call without loop_ids succeeds
          expect(payload.loop_ids).toBeUndefined();
          expect(payload.linked_loop_id).toBe('l_fallback_loop');
          return { error: null };
        },
      });

      const echo = {
        id: 'e_schema_fallback',
        text: 'Graceful column fallback test',
        linkedLoopId: 'l_fallback_loop',
        createdAt: new Date().toISOString(),
      };

      const saved = await saveEcho(echo, 'user_123');
      expect(saved.id).toBe('e_schema_fallback');
      expect(callCount).toBe(2);

      selectSpy.mockRestore();
    });

    it('throws server error visibly if insert fails with unexpected error', async () => {
      const selectSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async () => ({
          error: { code: '50000', message: 'database down' },
        }),
      });

      const echo = {
        id: 'e_fail_visible',
        text: 'Visible error echo',
        linkedLoopId: 'l_fail_loop',
        createdAt: new Date().toISOString(),
      };

      await expect(saveEcho(echo, 'user_123')).rejects.toThrow(
        /Failed to save echo to server: database down/i
      );

      selectSpy.mockRestore();
    });
  });

  describe('Personal Echo Immutability', () => {
    it('prevents updating text of an existing personal echo', async () => {
      const personalEcho = {
        id: 'e_immutable_txt',
        text: 'Original reflection content',
        provenanceAuthor: 'user',
        provenanceKind: 'original_echo',
      };
      localStorageMock.setItem('cosmic_echoes_v1', JSON.stringify([personalEcho]));

      await expect(
        updateEchoText('e_immutable_txt', 'Modified content', 'user_123')
      ).rejects.toThrow(/Personal Echo text content is immutable/i);
    });

    it('prevents overwriting audio reference of an existing personal echo that already has audio', async () => {
      const personalAudioEcho = {
        id: 'e_immutable_audio',
        text: 'Voice note',
        audio_path: 'user_123/original.webm',
        provenanceAuthor: 'user',
        provenanceKind: 'original_echo',
      };
      localStorageMock.setItem('cosmic_echoes_v1', JSON.stringify([personalAudioEcho]));

      await expect(
        updateEchoAudioPath('e_immutable_audio', 'user_123/new.webm', 'user_123')
      ).rejects.toThrow(/Personal Echo audio reference is immutable/i);
    });
  });
});
