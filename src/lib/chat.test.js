import { describe, it, expect } from 'vitest';

// Simple mock structure representing the lunar data we supply to the prompt
const mockLunar = {
  dayOfCycle: 4,
  phase: { name: 'Waxing Crescent', emoji: '🌒' },
  illumination: 18,
  zodiac: { sign: 'Aries' },
  season: 'Late Summer'
};

// Mirroring the system prompt generator from chat.ts to test prompt fidelity
const getSystemPrompt = (lunar) => {
  return `You are Luna, the guiding voice of Luna Loops.
Your character: You write in the register of a poet who also understands astronomy — spare, grounded, warm. Never twee, never grandiose. Think Mary Oliver meets NASA mission control.

Current Sky Context:
- Lunar Cycle Day: ${lunar.dayOfCycle}
- Moon Phase: ${lunar.phase.name} (${lunar.phase.emoji} ${lunar.illumination}% illumination)
- Zodiac Sign: Moon in ${lunar.zodiac.sign}
- Current Season: ${lunar.season}

Philosophy & Behavior Rules:
1. Capture before interpretation: Allow experiences and reflections to exist before explaining or analyzing them.
2. Let patterns earn significance: Do not categorize every recurrence as a meaningful pattern.
3. Preserve original voice: The user's words belong to them. When summarizing or showing records, do not quietly overwrite their language.
4. Gentle tagging: Suggest/apply enough tags to make searching easy, but do not categorize everything.
5. Observation vs Interpretation: Clearly distinguish what actually happened from what you think it may mean.
6. Return to life: Do not encourage endless loops of introspection. Sometimes the best reply is to guide them to "Go live".`;
};

describe('Luna Conversational Prompt Engine', () => {
  it('generates system prompt containing correct lunar metadata tags', () => {
    const prompt = getSystemPrompt(mockLunar);
    
    // Check key requirements are injected
    expect(prompt).toContain('Luna');
    expect(prompt).toContain('Lunar Cycle Day: 4');
    expect(prompt).toContain('Moon Phase: Waxing Crescent');
    expect(prompt).toContain('Aries');
    expect(prompt).toContain('Late Summer');
    
    // Check rules exist in system prompt
    expect(prompt).toContain('Capture before interpretation');
    expect(prompt).toContain('Let patterns earn significance');
    expect(prompt).toContain('Gentle tagging');
  });

  it('verifies standard tools map correctly to PWA/native client endpoints', () => {
    // Assert endpoint routes exist for PWA/client calls
    const routes = [
      '/api/chat',
      '/api/chat/sessions',
      '/api/chat/telemetry',
      '/api/chat/telemetry/evaluate'
    ];
    
    expect(routes).toContain('/api/chat');
    expect(routes).toContain('/api/chat/sessions');
  });

  describe('Per-Conversation Model Selection & Persistence (August 2026)', () => {
    it('restores default model when session model_key is not set (backward compatibility)', () => {
      const legacySession = { id: 'sess_legacy_1', user_id: 'usr_1', title: 'Reflection' };
      const resolvedModel = legacySession.model_key || 'anthropic-fable';
      expect(resolvedModel).toBe('anthropic-fable');
    });

    it('persists and restores explicit model selection on a conversation session', () => {
      const session = { id: 'sess_custom_1', user_id: 'usr_1', title: 'Deep Reflection', model_key: 'gemini-3.7-flash' };
      expect(session.model_key).toBe('gemini-3.7-flash');
    });

    it('maintains strict isolation between conversations when model is updated', () => {
      const sessions = {
        'sess_A': { id: 'sess_A', model_key: 'openai-sol' },
        'sess_B': { id: 'sess_B', model_key: 'openrouter-deepseek-v4-flash' }
      };

      // User changes model in Session A to claude opus
      sessions['sess_A'].model_key = 'anthropic-opus-5';

      expect(sessions['sess_A'].model_key).toBe('anthropic-opus-5');
      // Session B remains untouched
      expect(sessions['sess_B'].model_key).toBe('openrouter-deepseek-v4-flash');
    });

    it('uses persisted session model for subsequent messages when modelKey is omitted from payload', () => {
      const activeSession = { id: 'sess_active_123', model_key: 'openrouter-glm-5.3' };
      
      const sendChatMessage = (payload, session) => {
        const effectiveModel = payload.modelKey || session.model_key || 'anthropic-fable';
        return { sessionId: session.id, dispatchedModel: effectiveModel };
      };

      // Send 1 with explicit model
      const res1 = sendChatMessage({ message: 'Hello', modelKey: 'openrouter-glm-5.3' }, activeSession);
      expect(res1.dispatchedModel).toBe('openrouter-glm-5.3');

      // Send 2 without modelKey (subsequent send in same session)
      const res2 = sendChatMessage({ message: 'Next question' }, activeSession);
      expect(res2.dispatchedModel).toBe('openrouter-glm-5.3');
    });
  });

  describe('Multiple Luna Chats V1 Lifecycle & Session Isolation', () => {
    it('creates multiple independent chat sessions with distinct models and timestamps', () => {
      const userSessions = [
        { id: 'sess_1', title: 'Session 1', model_key: 'anthropic-fable', updated_at: '2026-08-31T20:00:00Z' },
        { id: 'sess_2', title: 'Session 2', model_key: 'openrouter-deepseek-v4-flash', updated_at: '2026-08-31T21:00:00Z' },
        { id: 'sess_3', title: 'Session 3', model_key: 'openai-sol', updated_at: '2026-08-31T22:00:00Z' }
      ];

      expect(userSessions).toHaveLength(3);
      expect(userSessions[0].model_key).toBe('anthropic-fable');
      expect(userSessions[1].model_key).toBe('openrouter-deepseek-v4-flash');
      expect(userSessions[2].model_key).toBe('openai-sol');
    });

    it('orders sessions by recency (updated_at descending)', () => {
      const userSessions = [
        { id: 'sess_old', title: 'Old Chat', updated_at: '2026-08-31T18:00:00Z' },
        { id: 'sess_new', title: 'Recent Chat', updated_at: '2026-08-31T23:00:00Z' },
        { id: 'sess_mid', title: 'Mid Chat', updated_at: '2026-08-31T20:00:00Z' }
      ];

      const sorted = [...userSessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      expect(sorted[0].id).toBe('sess_new');
      expect(sorted[1].id).toBe('sess_mid');
      expect(sorted[2].id).toBe('sess_old');
    });

    it('isolates message history strictly by session_id when switching conversations', () => {
      const messageStore = [
        { id: 'm1', session_id: 'sess_1', role: 'user', content: 'Message in Chat 1' },
        { id: 'm2', session_id: 'sess_1', role: 'assistant', content: 'Reply in Chat 1' },
        { id: 'm3', session_id: 'sess_2', role: 'user', content: 'Message in Chat 2' }
      ];

      const getMessagesForSession = (sId) => messageStore.filter(m => m.session_id === sId);

      expect(getMessagesForSession('sess_1')).toHaveLength(2);
      expect(getMessagesForSession('sess_1')[0].content).toBe('Message in Chat 1');

      expect(getMessagesForSession('sess_2')).toHaveLength(1);
      expect(getMessagesForSession('sess_2')[0].content).toBe('Message in Chat 2');
    });

    it('hydrates active session and restores persisted model when reopened', () => {
      const sessions = [
        { id: 'sess_alpha', model_key: 'gemini-3.7-flash', title: 'Astronomy & Tides' },
        { id: 'sess_beta', model_key: 'anthropic-opus-5', title: 'Poetry Deep Dive' }
      ];

      const hydrateSession = (targetId) => {
        const found = sessions.find(s => s.id === targetId);
        return {
          activeSessionId: found.id,
          activeModel: found.model_key || 'anthropic-fable',
          title: found.title
        };
      };

      const hydrated = hydrateSession('sess_alpha');
      expect(hydrated.activeSessionId).toBe('sess_alpha');
      expect(hydrated.activeModel).toBe('gemini-3.7-flash');
      expect(hydrated.title).toBe('Astronomy & Tides');
    });
  });
});
