import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../../mcp-server/src/tools';

describe('Reflection Persistence and Cross-Interface Readback (iss_1791421493797_4ku7)', () => {
  let mockEchoes;
  let mockSubReflections;
  let mockSupabase;

  beforeEach(() => {
    mockEchoes = [];
    mockSubReflections = [];

    mockSupabase = {
      from: (table) => {
        if (table === 'echoes') {
          return {
            insert: (payload) => ({
              select: () => {
                const inserted = { ...payload, created_at: payload.created_at || new Date().toISOString() };
                mockEchoes.push(inserted);
                return Promise.resolve({ data: [inserted], error: null });
              }
            }),
            select: (cols) => ({
              eq: (col, val) => ({
                eq: (col2, val2) => ({
                  single: () => {
                    const row = mockEchoes.find(e => e.id === val);
                    return Promise.resolve({ data: row || null, error: row ? null : { message: 'Not found' } });
                  },
                  maybeSingle: () => {
                    const row = mockEchoes.find(e => e.id === val);
                    return Promise.resolve({ data: row || null, error: null });
                  }
                })
              })
            })
          };
        } else if (table === 'echo_reflections') {
          return {
            select: (cols) => ({
              or: (filterStr) => ({
                eq: (col2, val2) => ({
                  order: () => Promise.resolve({ data: mockSubReflections, error: null })
                })
              })
            })
          };
        }
        return {};
      }
    };
  });

  it('guarantees create_conversation_reflection performs canonical readback assertion before reporting success', async () => {
    const text = 'Orienting Toward the All of Life';
    const userId = 'user_test_123';

    const result = await executeTool(mockSupabase, 'create_conversation_reflection', { text }, userId);
    expect(result.content).toBeDefined();

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toMatch(/^e/);
    expect(parsed.text).toBe(text);
    expect(parsed.provenanceAuthor).toBe('co-created');
    expect(parsed.provenanceKind).toBe('conversation_reflection');

    // Verify record exists in mock echoes DB
    expect(mockEchoes.length).toBe(1);
    expect(mockEchoes[0].id).toBe(parsed.id);
  });

  it('guarantees get_echo_reflections (reflections.get) reads conversation reflections from echoes table', async () => {
    const userId = 'user_test_123';
    const reflectionId = 'e1791421361548t67h';

    // Seed mockEchoes with an existing conversation reflection
    mockEchoes.push({
      id: reflectionId,
      user_id: userId,
      text: 'Orienting Toward the All of Life',
      source: 'luna_conversation',
      tags: ['conversation-reflection'],
      provenance_author: 'co-created',
      provenance_kind: 'conversation_reflection',
      created_at: new Date().toISOString()
    });

    const result = await executeTool(mockSupabase, 'get_echo_reflections', { id: reflectionId }, userId);
    expect(result.content).toBeDefined();

    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe(reflectionId);
    expect(parsed[0].text).toBe('Orienting Toward the All of Life');
    expect(parsed[0].provenanceKind).toBe('conversation_reflection');
  });
});
