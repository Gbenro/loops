import { describe, it, expect, vi } from 'vitest';
import { executeTool, mapRelationalMemory } from '../../mcp-server/src/tools.ts';

describe('Relational Memory Schema Resilience & Recovery (iss_1789151302301_pgiq)', () => {
  const userId = 'a7def673-5786-4d52-833f-2e7e2dbc7b05';

  describe('mapRelationalMemory backward compatibility', () => {
    it('maps relational memory with existing recurrence_count', () => {
      const row = {
        id: 'rm_123',
        statement: 'Meet them where the stream actually is',
        type: 'interaction_preference',
        evidence_record_ids: ['e1', 'e2'],
        confidence: 0.85,
        strength: 2,
        recurrence_count: 3,
        lifecycle_status: 'active',
        provenance: 'explicit',
        user_action_status: 'active',
        first_seen_at: '2026-09-11T12:00:00Z',
        last_seen_at: '2026-09-11T14:00:00Z',
        created_at: '2026-09-11T12:00:00Z',
        updated_at: '2026-09-11T14:00:00Z'
      };

      const mapped = mapRelationalMemory(row);
      expect(mapped.id).toBe('rm_123');
      expect(mapped.recurrenceCount).toBe(3);
      expect(mapped.strength).toBe(2);
      expect(mapped.lifecycleStatus).toBe('active');
    });

    it('gracefully falls back recurrenceCount to strength when recurrence_count is missing from legacy rows', () => {
      const row = {
        id: 'rm_456',
        statement: 'Old memory without recurrence_count column',
        type: 'orientation',
        confidence: 0.90,
        strength: 4,
        recurrence_count: null, // missing/null in legacy schema
        lifecycle_status: 'active',
        provenance: 'explicit'
      };

      const mapped = mapRelationalMemory(row);
      expect(mapped.recurrenceCount).toBe(4);
      expect(mapped.strength).toBe(4);
    });
  });

  describe('propose_candidate_memory schema cache resilience', () => {
    it('successfully proposes candidate when recurrence_count is accepted by database', async () => {
      const insertedRows = [];
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] })
              })
            })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedRows.push(payload);
            return {
              select: vi.fn().mockResolvedValue({ data: [{ ...payload }] })
            };
          })
        })
      };

      const result = await executeTool(mockSupabase, 'propose_candidate_memory', {
        type: 'interaction_preference',
        statement: 'Speak clearly and softly',
        provenance: 'explicit',
        confidence: 0.85
      }, userId);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.statement).toBe('Speak clearly and softly');
      expect(parsed.lifecycleStatus).toBe('active');
      expect(parsed.recurrenceCount).toBe(1);
      expect(insertedRows[0].recurrence_count).toBe(1);
    });

    it('gracefully falls back and persists candidate when recurrence_count is missing from schema cache (PGRST204)', async () => {
      let insertAttempts = 0;
      let finalInsertedPayload = null;

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] })
              })
            })
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertAttempts++;
            if (payload.recurrence_count !== undefined) {
              // Simulate production schema cache error
              return {
                select: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: 'PGRST204',
                    message: "Could not find the 'recurrence_count' column of 'relational_memories' in the schema cache"
                  }
                })
              };
            }
            finalInsertedPayload = payload;
            return {
              select: vi.fn().mockResolvedValue({ data: [{ ...payload }] })
            };
          })
        })
      };

      const result = await executeTool(mockSupabase, 'propose_candidate_memory', {
        type: 'interaction_preference',
        statement: "When the user shares from their stream, meet them where the stream actually is: don't assume it's still flowing or urge them onward, and when they've landed, land with them. Reflect freely and honestly without forcing a predetermined insight — be present, not performative.",
        confidence: 0.85,
        provenance: 'explicit',
        evidenceRecordIds: ['e1788559486686vax2', 'e1788459670000z3od', 'e1788658188666snf3']
      }, userId);

      expect(insertAttempts).toBe(2);
      expect(finalInsertedPayload).toBeDefined();
      expect(finalInsertedPayload.recurrence_count).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.statement).toContain('meet them where the stream actually is');
      expect(parsed.lifecycleStatus).toBe('active');
      expect(parsed.confidence).toBe(0.85);
      expect(parsed.recurrenceCount).toBe(1); // falls back to strength=1
      expect(parsed.evidenceRecordIds).toEqual(['e1788559486686vax2', 'e1788459670000z3od', 'e1788658188666snf3']);
    });

    it('deduplicates when proposing an existing memory statement, merging new evidence IDs without duplicates', async () => {
      const existingRecord = {
        id: 'rm_existing_999',
        user_id: userId,
        statement: 'Meet them where the stream actually is',
        type: 'interaction_preference',
        evidence_record_ids: ['e1'],
        confidence: 0.85,
        strength: 1,
        lifecycle_status: 'active',
        provenance: 'explicit',
        user_action_status: 'active',
        first_seen_at: '2026-09-11T12:00:00Z',
        last_seen_at: '2026-09-11T12:00:00Z',
        created_at: '2026-09-11T12:00:00Z',
        updated_at: '2026-09-11T12:00:00Z'
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [existingRecord] })
      });
      const insertMock = vi.fn();

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [existingRecord] })
              })
            })
          }),
          insert: insertMock,
          update: updateMock
        })
      };

      const result = await executeTool(mockSupabase, 'propose_candidate_memory', {
        type: 'interaction_preference',
        statement: 'Meet them where the stream actually is',
        evidenceRecordIds: ['e1', 'e2_new'],
        provenance: 'explicit'
      }, userId);

      // Verify no duplicate row was inserted
      expect(insertMock).not.toHaveBeenCalled();
      // Verify evidence list was updated with new id
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        evidence_record_ids: ['e1', 'e2_new']
      }));

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe('rm_existing_999');
      expect(parsed.evidenceRecordIds).toEqual(['e1', 'e2_new']);
    });
  });

  describe('reinforce_relational_memory schema cache resilience', () => {
    it('gracefully falls back when updating memory if recurrence_count is missing from schema cache', async () => {
      const existing = {
        id: 'rm_reinforce_1',
        user_id: userId,
        statement: 'Still unfolding',
        strength: 1,
        recurrence_count: null, // missing in db
        lifecycle_status: 'candidate',
        evidence_record_ids: ['e1']
      };

      let updateAttempts = 0;
      let finalUpdatePayload = null;

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existing })
              })
            })
          }),
          update: vi.fn().mockImplementation((payload) => {
            updateAttempts++;
            if (payload.recurrence_count !== undefined) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                      data: null,
                      error: {
                        code: 'PGRST204',
                        message: "Could not find the 'recurrence_count' column of 'relational_memories' in the schema cache"
                      }
                    })
                  })
                })
              };
            }
            finalUpdatePayload = payload;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ ...existing, ...payload }]
                  })
                })
              })
            };
          })
        })
      };

      const result = await executeTool(mockSupabase, 'reinforce_relational_memory', {
        id: 'rm_reinforce_1',
        newEvidenceRecordIds: ['e2']
      }, userId);

      expect(updateAttempts).toBe(2);
      expect(finalUpdatePayload).toBeDefined();
      expect(finalUpdatePayload.recurrence_count).toBeUndefined();
      expect(finalUpdatePayload.strength).toBe(2);
      expect(finalUpdatePayload.lifecycle_status).toBe('emerging'); // promoted candidate -> emerging at recurrence 2

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.strength).toBe(2);
      expect(parsed.lifecycleStatus).toBe('emerging');
    });
  });
});
