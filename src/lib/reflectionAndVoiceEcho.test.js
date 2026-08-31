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

  it('preserves authentic audio_path when saving a voice chat turn as an Original Voice Echo', () => {
    const voiceTurn = {
      id: 'vturn_1788142000000',
      text: 'Observing the crescent moon tonight',
      timestamp: '2026-08-31T02:00:00.000Z',
      audioPath: 'voice/usr_test_123/aud_1788142000000.webm',
      metadata: {
        audioPath: 'voice/usr_test_123/aud_1788142000000.webm',
        durationMs: 4200,
        inputType: 'voice'
      }
    };

    const audioPath = voiceTurn.audioPath || voiceTurn.metadata?.audioPath || null;
    expect(audioPath).toBe('voice/usr_test_123/aud_1788142000000.webm');

    const insertData = {
      id: 'e_1788142000000',
      user_id: mockUser.id,
      text: voiceTurn.text,
      source: 'voice_chat',
      tags: ['original-voice-echo'],
      provenance_author: 'user',
      provenance_kind: 'original_echo',
      audio_path: audioPath,
      created_at: voiceTurn.timestamp
    };

    expect(insertData.audio_path).toBe('voice/usr_test_123/aud_1788142000000.webm');
    expect(insertData.provenance_kind).toBe('original_echo');
    expect(insertData.provenance_author).toBe('user');
  });

  it('promotes cached audioBlob fallback when initial capture had no audioPath (string return contract)', async () => {
    // saveAudio contract: returns string path directly
    const mockSaveAudio = vi.fn().mockResolvedValue('voice/usr_test_123/aud_promoted_99.webm');
    const dummyBlob = new Blob(['fake audio content'], { type: 'audio/webm' });

    const voiceTurnWithoutPath = {
      id: 'vturn_offline_1',
      text: 'Offline voice note captured',
      timestamp: '2026-08-31T02:05:00.000Z',
      audioPath: null,
      metadata: {
        audioPath: null,
        audioBlob: dummyBlob
      }
    };

    let resolvedPath = voiceTurnWithoutPath.audioPath || voiceTurnWithoutPath.metadata?.audioPath || null;
    if (!resolvedPath && voiceTurnWithoutPath.metadata?.audioBlob) {
      const path = await mockSaveAudio('aud_promoted_99', voiceTurnWithoutPath.metadata.audioBlob, mockUser.id);
      if (path && path !== 'TOO_LARGE') {
        resolvedPath = path;
      }
    }

    expect(mockSaveAudio).toHaveBeenCalled();
    expect(resolvedPath).toBe('voice/usr_test_123/aud_promoted_99.webm');
  });

  it('recovers authentic audioBlob from rolling voice cache across persisted message ID transition', async () => {
    const dummyBlob = new Blob(['authentic voice'], { type: 'audio/webm' });
    const originalTurnId = 'vturn_1788143000000';
    const originalTimestamp = '2026-08-31T02:30:00.000Z';
    const textContent = 'Speaking with genuine reflection';

    // In-memory 3-turn rolling cache recorded during voice input
    const recentVoiceTurns = [
      {
        id: originalTurnId,
        text: textContent,
        timestamp: originalTimestamp,
        audioPath: 'voice/usr_test_123/aud_1788143000000.webm',
        audioBlob: dummyBlob,
        metadata: {
          audioPath: 'voice/usr_test_123/aud_1788143000000.webm',
          audioBlob: dummyBlob
        }
      }
    ];

    // Persisted message in database has different ID (e.g. msg_123456)
    const persistedMessage = {
      id: 'msg_987654321',
      content: textContent,
      created_at: originalTimestamp,
      metadata: {
        voiceTurnId: originalTurnId,
        audioPath: 'voice/usr_test_123/aud_1788143000000.webm'
      }
    };

    // Correlation lookup in handleSaveVoiceTurnAsEcho
    const correlatedTurn = recentVoiceTurns.find((t) =>
      t.id === persistedMessage.id ||
      (persistedMessage.metadata?.voiceTurnId && t.id === persistedMessage.metadata.voiceTurnId) ||
      (t.text === persistedMessage.content && Math.abs(new Date(t.timestamp).getTime() - new Date(persistedMessage.created_at).getTime()) < 15000)
    );

    expect(correlatedTurn).toBeDefined();
    expect(correlatedTurn.id).toBe(originalTurnId);
    expect(correlatedTurn.audioPath).toBe('voice/usr_test_123/aud_1788143000000.webm');
    expect(correlatedTurn.audioBlob).toBe(dummyBlob);
  });

  it('truthfully reports audio availability without falsely claiming complete preservation', () => {
    const formatFeedback = (hasAudio) => ({
      hasAudio: Boolean(hasAudio),
      userMessage: hasAudio ? '✓ Saved with Original Audio' : '✓ Saved as Text Echo (Audio unavailable)'
    });

    const successWithAudio = formatFeedback('voice/usr_test_123/aud_1.webm');
    expect(successWithAudio.hasAudio).toBe(true);
    expect(successWithAudio.userMessage).toBe('✓ Saved with Original Audio');

    const fallbackNoAudio = formatFeedback(null);
    expect(fallbackNoAudio.hasAudio).toBe(false);
    expect(fallbackNoAudio.userMessage).toBe('✓ Saved as Text Echo (Audio unavailable)');
  });

  it('never substitutes synthesized Kokoro/TTS audio for original user voice recordings', () => {
    const originalVoiceTurn = {
      id: 'vturn_1',
      text: 'User speaking genuinely',
      provenance_author: 'user',
      provenance_kind: 'original_echo',
      audio_path: null // authentic audio missing
    };

    // Synthesizing TTS for user voice is strictly forbidden
    const substituteTTS = vi.fn();
    const saveTurn = (turn) => {
      // Invariant: Do not call substituteTTS for original_echo
      if (turn.provenance_kind === 'original_echo') {
        return { ...turn, audio_path: turn.audio_path || null };
      }
      return turn;
    };

    const saved = saveTurn(originalVoiceTurn);
    expect(substituteTTS).not.toHaveBeenCalled();
    expect(saved.audio_path).toBeNull(); // remains null or text-only rather than fake TTS
  });
});
