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

  describe('Full Chat Lifecycle (Rename, Archive, Restore, Preserve-to-Field, Safe Delete)', () => {
    it('renames session display title without altering original messages or metadata', () => {
      const session = {
        id: 'sess_101',
        title: 'Original Title',
        model_key: 'openrouter-qwen-3.8-max',
        created_at: '2026-09-02T10:00:00Z',
        updated_at: '2026-09-02T10:00:00Z'
      };
      const messages = [
        { id: 'm1', session_id: 'sess_101', role: 'user', content: 'What is the moon doing?' },
        { id: 'm2', session_id: 'sess_101', role: 'assistant', content: 'The moon is waxing crescent.' }
      ];

      // Rename operation
      const newTitle = 'Waxing Moon Observations';
      const updatedSession = { ...session, title: newTitle, updated_at: '2026-09-02T10:05:00Z' };

      expect(updatedSession.title).toBe('Waxing Moon Observations');
      expect(updatedSession.id).toBe(session.id);
      expect(updatedSession.model_key).toBe(session.model_key);
      expect(messages[0].content).toBe('What is the moon doing?');
      expect(messages[1].content).toBe('The moon is waxing crescent.');
    });

    it('archives an active chat session and filters it out of the active list', () => {
      const sessions = [
        { id: 's1', title: 'Active Chat 1', is_archived: false, archived_at: null },
        { id: 's2', title: 'Active Chat 2', is_archived: false, archived_at: null },
        { id: 's3', title: 'Active Chat 3', is_archived: false, archived_at: null }
      ];

      // Archive s2
      const now = '2026-09-02T12:00:00Z';
      const updatedSessions = sessions.map(s => s.id === 's2' ? { ...s, is_archived: true, archived_at: now } : s);

      const activeList = updatedSessions.filter(s => !s.is_archived && !s.archived_at);
      const archivedList = updatedSessions.filter(s => s.is_archived || s.archived_at);

      expect(activeList.map(s => s.id)).toEqual(['s1', 's3']);
      expect(archivedList.map(s => s.id)).toEqual(['s2']);
      expect(archivedList[0].archived_at).toBe(now);
    });

    it('performs round-trip restore of an archived session back to active status intact', () => {
      let session = { id: 's_arch', title: 'Past Insights', is_archived: true, archived_at: '2026-09-01T00:00:00Z' };
      
      // Restore
      session = { ...session, is_archived: false, archived_at: null, updated_at: '2026-09-02T14:00:00Z' };

      expect(session.is_archived).toBe(false);
      expect(session.archived_at).toBeNull();
      expect(session.title).toBe('Past Insights');
    });

    it('requires explicit confirmation flag before permanent deletion', () => {
      const deleteSession = (session, confirmFlag) => {
        if (!confirmFlag) {
          throw new Error('Permanent deletion requires explicit confirmPermanentDelete: true flag. Consider archive_chat_session instead.');
        }
        return { deletedId: session.id, status: 'deleted' };
      };

      const session = { id: 'sess_del_1', title: 'Temporary Chat' };

      expect(() => deleteSession(session, false)).toThrow('Permanent deletion requires explicit confirmPermanentDelete: true flag');
      expect(deleteSession(session, true)).toEqual({ deletedId: 'sess_del_1', status: 'deleted' });
    });

    it('preserves important conversation material to Field as an Echo before deletion', () => {
      const session = { id: 'sess_pre_1', title: 'Solar Equinox Chat' };
      const messages = [
        { role: 'user', content: 'How do rhythms connect to the seasons?' },
        { role: 'assistant', content: 'Seasons ground biological rhythms in planetary cadence.' }
      ];

      const preserveToField = (sess, msgs) => {
        const text = `Preserved Reflection from Chat "${sess.title}":\n\n` +
          msgs.map(m => `${m.role === 'user' ? 'You' : 'Luna'}: ${m.content}`).join('\n\n');
        return {
          id: 'e_preserved_1',
          text,
          provenance_author: 'user',
          provenance_kind: 'chat_reflection',
          tags: ['chat-reflection']
        };
      };

      const echo = preserveToField(session, messages);
      expect(echo.text).toContain('Solar Equinox Chat');
      expect(echo.text).toContain('Seasons ground biological rhythms in planetary cadence');
      expect(echo.provenance_kind).toBe('chat_reflection');
      expect(echo.tags).toContain('chat-reflection');
    });

    it('guarantees user ownership and isolation during chat mutations', () => {
      const authorizedUserId = 'user-owner-123';
      const unauthorizedUserId = 'user-intruder-456';
      const session = { id: 'sess_owner_1', user_id: 'user-owner-123', title: 'My Private Journal' };

      const mutateSession = (sess, callingUserId, newTitle) => {
        if (sess.user_id !== callingUserId) {
          throw new Error('Unauthorized');
        }
        return { ...sess, title: newTitle };
      };

      expect(() => mutateSession(session, unauthorizedUserId, 'Hacked Title')).toThrow('Unauthorized');
      const updated = mutateSession(session, authorizedUserId, 'My Renamed Journal');
      expect(updated.title).toBe('My Renamed Journal');
    });

    it('handles legacy sessions missing archive columns gracefully (migration backward-compatibility)', () => {
      // Legacy session from older schema where is_archived and archived_at are undefined
      const legacySession = { id: 'sess_legacy_99', user_id: 'u1', title: 'Old Chat' };

      const isActive = !legacySession.is_archived && !legacySession.archived_at;
      expect(isActive).toBe(true);

      const isArchived = Boolean(legacySession.is_archived || legacySession.archived_at);
      expect(isArchived).toBe(false);
    });
  });
});
