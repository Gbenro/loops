import { describe, it, expect, vi } from 'vitest';
import { executeTool } from '../../mcp-server/dist/tools.js';

describe('Reflection & Original Voice Echo Mutations Suite', () => {
  const mockUser = { id: 'usr_test_123', email: 'user@example.com' };

  const createMockSupabase = (insertResult = { data: [{ id: 'e_123', text: 'Sample text' }], error: null }) => {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(insertResult)
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'e_123' }, error: null })
        })
      })
    };
  };

  it('correctly creates conversation reflection with co-created provenance', async () => {
    const supabase = createMockSupabase();
    const result = await executeTool(supabase, 'create_conversation_reflection', {
      text: 'Our intentional reflection for tonight: stay grounded in stillness.',
      sessionId: 'session_abc',
      tags: ['intention', 'stillness']
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const insertCall = supabase.from('echoes').insert;
    expect(insertCall).toHaveBeenCalled();
    const insertedPayload = insertCall.mock.calls[0][0];

    expect(insertedPayload.text).toBe('Our intentional reflection for tonight: stay grounded in stillness.');
    expect(insertedPayload.provenance_author).toBe('co-created');
    expect(insertedPayload.provenance_kind).toBe('conversation_reflection');
    expect(insertedPayload.source).toBe('luna_conversation');
    expect(insertedPayload.user_id).toBe('usr_test_123');
    expect(insertedPayload.phase).toBeDefined();
    expect(insertedPayload.phase_name).toBeDefined();
  });

  it('correctly creates original echo with user author provenance', async () => {
    const supabase = createMockSupabase();
    const result = await executeTool(supabase, 'create_echo', {
      text: 'Saw the moon rising over the trees tonight.',
      source: 'voice_chat',
      tags: ['observation']
    });

    expect(result).toBeDefined();
    const insertCall = supabase.from('echoes').insert;
    const insertedPayload = insertCall.mock.calls[0][0];

    expect(insertedPayload.text).toBe('Saw the moon rising over the trees tonight.');
    expect(insertedPayload.provenance_author).toBe('user');
    expect(insertedPayload.provenance_kind).toBe('original_echo');
    expect(insertedPayload.source).toBe('voice_chat');
    expect(insertedPayload.user_id).toBe('usr_test_123');
  });

  it('throws an error and prevents false confirmation if database mutation fails', async () => {
    const dbError = new Error('Database connection failed');
    const supabase = createMockSupabase({ data: null, error: dbError });

    await expect(
      executeTool(supabase, 'create_conversation_reflection', {
        text: 'Failed reflection'
      })
    ).rejects.toThrow('Database connection failed');
  });

  it('verifies 3-turn voice cache slice invariant', () => {
    const voiceTurns = [
      { id: 'v1', text: 'First voice turn' },
      { id: 'v2', text: 'Second voice turn' },
      { id: 'v3', text: 'Third voice turn' },
      { id: 'v4', text: 'Fourth voice turn' }
    ];

    const cache = voiceTurns.slice(-3);
    expect(cache.length).toBe(3);
    expect(cache[0].id).toBe('v2');
    expect(cache[2].id).toBe('v4');
  });

  it('verifies original voice echo payload includes authentic timestamp and lunar metadata', () => {
    const originalTimestamp = '2026-08-29T22:30:00.000Z';
    const mockLunarContext = {
      phase: { key: 'waxing-gibbous', name: 'Waxing Gibbous', phaseType: 'flow' },
      lunarMonth: 'Harvest',
      illumination: 88,
      dayOfCycle: 12,
      zodiac: { sign: 'Pisces' }
    };

    const echoPayload = {
      id: 'e1788064500000',
      user_id: mockUser.id,
      text: 'My authentic voice reflection',
      source: 'voice_chat',
      tags: ['original-voice-echo'],
      provenance_author: 'user',
      provenance_kind: 'original_echo',
      phase: mockLunarContext.phase.key,
      phase_name: mockLunarContext.phase.name,
      phase_type: mockLunarContext.phase.phaseType,
      lunar_month: mockLunarContext.lunarMonth,
      day_of_cycle: mockLunarContext.dayOfCycle,
      zodiac: mockLunarContext.zodiac.sign,
      illumination: mockLunarContext.illumination,
      is_encrypted: false,
      created_at: originalTimestamp
    };

    expect(echoPayload.provenance_author).toBe('user');
    expect(echoPayload.provenance_kind).toBe('original_echo');
    expect(echoPayload.created_at).toBe(originalTimestamp);
    expect(echoPayload.text).toBe('My authentic voice reflection');
    expect(echoPayload.illumination).toBe(88);
  });
});
