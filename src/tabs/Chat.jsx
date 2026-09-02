import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { saveAudio } from '../lib/audioStorage.js';
import { useVoiceRecorder } from '../lib/useVoiceRecorder.js';
import { useLunaVoicePlayback } from '../lib/useLunaVoicePlayback.js';

export function Chat({ userId, lunarData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem('luna_model_key') || 'anthropic-fable'
  );

  // Exact 3-Turn Conversational Voice Cache
  const [recentVoiceTurns, setRecentVoiceTurns] = useState([]);
  const [savingEchoTurnId, setSavingEchoTurnId] = useState(null);
  const [echoSaveSuccess, setEchoSaveSuccess] = useState(null); // { id: string, hasAudio: boolean }

  const pendingVoiceMetaRef = useRef(null);
  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-resize composer textarea (from 38px up to ~180px)
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 38), 180);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Voice recording integration (populates single consolidated composer)
  const handleTranscriptReady = useCallback((transcript, metadata) => {
    pendingVoiceMetaRef.current = metadata;
    setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
  }, []);

  const {
    state: voiceState,
    isRecording,
    isTranscribing,
    recordingDuration,
    errorMessage: voiceError,
    startRecording,
    stopRecording,
    cancelRecording,
    resetError: resetVoiceError,
  } = useVoiceRecorder({
    onTranscriptReady: handleTranscriptReady,
    userId,
  });

  // Voice playback integration (Luna Voice Output)
  const {
    playbackStates,
    playMessage,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    replayPlayback
  } = useLunaVoicePlayback();

  // Format seconds into m:ss
  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Fetch active sessions and messages on initialization
  useEffect(() => {
    if (!userId) return;

    async function initChat() {
      try {
        setError('');
        // Fetch all conversations for user ordered by recency
        const { data: userSessions, error: sessionErr } = await supabase
          .from('chat_sessions')
          .select('id, model_key, title, updated_at, created_at')
          .order('updated_at', { ascending: false });

        if (sessionErr) throw sessionErr;

        let activeSession;
        if (userSessions && userSessions.length > 0) {
          activeSession = userSessions[0];
          setSessions(userSessions);
        } else {
          // Create initial session with model selection
          const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const initialModel = selectedModel || 'anthropic-fable';
          const { data: created, error: createErr } = await supabase
            .from('chat_sessions')
            .insert({
              id: newId,
              user_id: userId,
              title: 'Continuous Reflection',
              model_key: initialModel
            })
            .select()
            .single();

          if (createErr) throw createErr;
          activeSession = created;
          setSessions([created]);
        }

        setSessionId(activeSession.id);
        if (activeSession.model_key) {
          setSelectedModel(activeSession.model_key);
        }

        // Fetch messages for this active session
        const { data: msgs, error: msgsErr } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', activeSession.id)
          .order('created_at', { ascending: true });

        if (msgsErr) throw msgsErr;
        setMessages(msgs || []);
      } catch (err) {
        console.error('Error loading chat session:', err);
        setError('Failed to initialize connection with Luna.');
      }
    }

    initChat();
  }, [userId]);

  // Switch active conversation session
  const selectSession = async (targetSessionId) => {
    if (!targetSessionId || targetSessionId === sessionId) {
      setShowDrawer(false);
      return;
    }
    try {
      setLoading(true);
      setSessionId(targetSessionId);

      // Restore session model_key
      const targetSession = sessions.find((s) => s.id === targetSessionId);
      if (targetSession?.model_key) {
        setSelectedModel(targetSession.model_key);
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', targetSessionId)
        .order('created_at', { ascending: true });

      if (msgsErr) throw msgsErr;
      setMessages(msgs || []);
      setShowDrawer(false);
    } catch (err) {
      console.error('Error switching session:', err);
      setError('Failed to switch conversation.');
    } finally {
      setLoading(false);
    }
  };

  // Explicitly create a new conversation session
  const handleCreateNewChat = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const initialModel = selectedModel || 'anthropic-fable';
      const title = `Conversation ${sessions.length + 1}`;

      const { data: newSession, error: createErr } = await supabase
        .from('chat_sessions')
        .insert({
          id: newId,
          user_id: userId,
          title: title,
          model_key: initialModel
        })
        .select()
        .single();

      if (createErr) throw createErr;

      setSessions((prev) => [newSession, ...prev]);
      setSessionId(newId);
      setMessages([]);
      setSelectedModel(initialModel);
      setShowDrawer(false);
    } catch (err) {
      console.error('Error creating new session:', err);
      setError('Failed to create new chat.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Save a recent voice turn as an Original User Echo (Preserves authentic user audio & provenance)
  const handleSaveVoiceTurnAsEcho = async (voiceTurn) => {
    if (!voiceTurn || !userId) return;
    setSavingEchoTurnId(voiceTurn.id);

    try {
      const echoId = `e${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
      const phaseKey = voiceTurn.lunarContext?.phase?.key || lunarData?.phase?.key || 'new';
      const phaseName = voiceTurn.lunarContext?.phase?.name || lunarData?.phase?.name || 'New Moon';
      const phaseType = voiceTurn.lunarContext?.phase?.phaseType || lunarData?.phase?.phaseType || 'threshold';
      const lunarMonth = voiceTurn.lunarContext?.lunarMonth || lunarData?.lunarMonth || 'Wolf';
      const illumination = voiceTurn.lunarContext?.illumination ?? lunarData?.illumination ?? 0;
      const dayOfCycle = voiceTurn.lunarContext?.dayOfCycle ?? lunarData?.dayOfCycle ?? 1;
      const zodiacSign = voiceTurn.lunarContext?.zodiac?.sign || lunarData?.zodiac?.sign || 'Aries';

      // 1. Resolve authentic recorded audio path
      let audioPath = voiceTurn.audioPath || voiceTurn.metadata?.audioPath || voiceTurn.audio_path || null;

      // 2. Correlate with short-lived in-memory rolling voice cache across ID transitions
      const cachedTurn = recentVoiceTurns.find((t) =>
        t.id === voiceTurn.id ||
        (voiceTurn.metadata?.voiceTurnId && t.id === voiceTurn.metadata.voiceTurnId) ||
        (t.text === voiceTurn.text && Math.abs(new Date(t.timestamp).getTime() - new Date(voiceTurn.timestamp).getTime()) < 15000)
      );

      if (!audioPath && cachedTurn?.audioPath) {
        audioPath = cachedTurn.audioPath;
      }

      // 3. Fallback on-demand promotion if audioBlob is cached in memory but not yet stored in cloud
      const cachedBlob = voiceTurn.audioBlob ||
        voiceTurn.metadata?.audioBlob ||
        cachedTurn?.audioBlob ||
        cachedTurn?.metadata?.audioBlob;

      if (!audioPath && cachedBlob && userId) {
        try {
          const audioId = `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const path = await saveAudio(audioId, cachedBlob, userId);
          if (path && path !== 'TOO_LARGE') {
            audioPath = path;
          }
        } catch (uploadErr) {
          console.warn('[handleSaveVoiceTurnAsEcho] On-demand audio promotion skipped/failed:', uploadErr);
        }
      }

      const insertData = {
        id: echoId,
        user_id: userId,
        text: voiceTurn.text,
        source: 'voice_chat',
        tags: ['original-voice-echo'],
        provenance_author: 'user',
        provenance_kind: 'original_echo',
        audio_path: audioPath,
        phase: phaseKey,
        phase_name: phaseName,
        phase_type: phaseType,
        lunar_month: lunarMonth,
        day_of_cycle: dayOfCycle,
        zodiac: zodiacSign,
        illumination: illumination,
        is_encrypted: false,
        created_at: voiceTurn.timestamp || new Date().toISOString()
      };

      const { error: insertErr } = await supabase
        .from('echoes')
        .insert(insertData);

      if (insertErr) throw insertErr;

      setEchoSaveSuccess({
        id: voiceTurn.id,
        hasAudio: Boolean(audioPath)
      });
      setTimeout(() => {
        setEchoSaveSuccess(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to save voice turn as echo:', err);
      setError(`Could not save voice turn as Echo: ${err.message || 'database error'}`);
    } finally {
      setSavingEchoTurnId(null);
    }
  };

  // 3. Send message handler (guarantees responses never disappear & updates voice cache)
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || !sessionId) return;

    const userText = input.trim();
    const voiceMeta = pendingVoiceMetaRef.current;
    const inputType = voiceMeta ? 'voice' : 'text';

    setInput('');
    pendingVoiceMetaRef.current = null;
    setError('');
    setLoading(true);

    let vturnId = null;
    // If voice input, record to rolling 3-turn voice cache with authentic audioBlob
    if (inputType === 'voice') {
      vturnId = `vturn_${Date.now()}`;
      const newVoiceTurn = {
        id: vturnId,
        text: userText,
        timestamp: new Date().toISOString(),
        lunarContext: lunarData,
        metadata: voiceMeta,
        audioPath: voiceMeta?.audioPath || null,
        audioBlob: voiceMeta?.audioBlob || null
      };
      setRecentVoiceTurns((prev) => [newVoiceTurn, ...prev].slice(0, 3));
    }

    const turnMeta = { ...(voiceMeta || {}), ...(vturnId ? { voiceTurnId: vturnId } : {}) };

    // Optimistically add user message to list with metadata and correlated turn ID
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: userText,
      input_type: inputType,
      metadata: turnMeta,
      audio_path: voiceMeta?.audioPath || null,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Get auth session token for REST headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get base URL for backend API
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://loops-production-e1d5.up.railway.app';

      // Call Express API chat endpoint with 90s client timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userText,
          sessionId: sessionId,
          modelKey: selectedModel,
          inputType,
          metadata: turnMeta
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errMsg = `Server error (${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          try {
            const txt = await response.text();
            if (txt) errMsg = txt;
          } catch {}
        }
        throw new Error(errMsg);
      }

      const data = await response.json();

      // STRICT IMMUTABILITY: Add confirmed user and assistant turns immediately to in-memory state
      const confirmedUserMsg = {
        id: data.userMessageId || data.message?.userMessageId || tempUserMsg.id,
        session_id: sessionId,
        role: 'user',
        content: userText,
        input_type: inputType,
        metadata: turnMeta,
        audio_path: voiceMeta?.audioPath || null,
        created_at: tempUserMsg.created_at
      };

      const resolvedContent = data.message?.content || data.reply || '';
      const assistantMsg = {
        id: data.message?.id || data.assistantMessageId || `ast_${Date.now()}`,
        session_id: sessionId,
        role: 'assistant',
        content: resolvedContent,
        trace_id: data.telemetryId || data.traceId || null,
        created_at: data.message?.createdAt || new Date().toISOString()
      };

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...withoutTemp, confirmedUserMsg, assistantMsg];
      });

      // Background non-destructive sync (never wipes in-memory messages if DB fetch returns empty)
      try {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          setMessages(msgs);
        }
      } catch (syncErr) {
        console.warn('Background sync error (ignored to preserve state):', syncErr);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      if (err.name === 'AbortError') {
        setError('Luna reflection timed out after 90s. Please retry.');
      } else {
        setError(err.message || 'Connection lost. Please try again.');
      }
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const moonLabel = lunarData?.phase?.name || 'Luna';
  const moonEmoji = lunarData?.phase?.emoji || '☽';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--color-bg)',
        color: 'var(--color-text)'
      }}
    >
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          padding: '8px 14px 6px',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(8, 13, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          zIndex: 5
        }}
      >
        {/* Row 1: Title, Chats Switcher, and Lunar Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✦</span>
            <h1
              style={{
                fontFamily: 'serif',
                fontSize: '16px',
                fontWeight: '600',
                color: '#f5e6c8',
                letterSpacing: '0.02em',
                margin: 0
              }}
            >
              Luna Direct
            </h1>
            <button
              onClick={() => setShowDrawer((prev) => !prev)}
              aria-label="Toggle chat conversations list"
              style={{
                background: showDrawer ? 'rgba(245, 230, 200, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#f5e6c8',
                padding: '2px 8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>💬</span>
              <span>{sessions.length > 0 ? `${sessions.length} chats` : 'Chats'}</span>
            </button>
          </div>
          <p
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--color-text-faint)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>{moonEmoji}</span>
            <span>{moonLabel}</span>
            <span>·</span>
            <span>{lunarData?.illumination ?? 0}%</span>
          </p>
        </div>

        {/* Row 2: Model Engine Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '3px 8px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <label
            htmlFor="model-select"
            style={{
              fontSize: '9.5px',
              fontFamily: 'monospace',
              color: 'var(--color-text-faint)',
              textTransform: 'uppercase',
              flexShrink: 0
            }}
          >
            Engine:
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => {
              const newModel = e.target.value;
              setSelectedModel(newModel);
              if (sessionId) {
                supabase
                  .from('chat_sessions')
                  .update({ model_key: newModel, updated_at: new Date().toISOString() })
                  .eq('id', sessionId)
                  .then(() => {})
                  .catch(err => console.warn('Failed to update session model_key:', err));
              }
            }}
            style={{
              flex: 1,
              background: '#0d1527',
              color: '#f5e6c8',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '3px 6px',
              fontSize: '11.5px',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'sans-serif'
            }}
          >
            <optgroup label="Proprietary / Closed Frontier Models" style={{ background: '#0d1527', color: '#f5e6c8', fontWeight: 'bold' }}>
              <option value="anthropic-fable-5">Claude Fable 5 (Agentic Baseline · 1M Ctx)</option>
              <option value="anthropic-sonnet-5">Claude Sonnet 5 (Frontier Reasoning · 1M Ctx)</option>
              <option value="anthropic-opus-5">Claude Opus 5 (Deep Reasoning · 1M Ctx)</option>
              <option value="openai-gpt-5.6-sol">GPT-5.6 Sol (Multi-Step Agent · 1.05M Ctx)</option>
              <option value="openai-gpt-5.6-luna">GPT-5.6 Luna (Conversational · 1.05M Ctx)</option>
              <option value="gemini-3.7-flash">Gemini 3.7 Flash (Native Audio & Multimodal · 1.05M Ctx)</option>
              <option value="xai-grok-4.6">Grok 4.6 (Frontier Reasoning · 500k Ctx)</option>
            </optgroup>
            <optgroup label="Open-Weight Frontier Models (OpenRouter)" style={{ background: '#0d1527', color: '#c4b5fd', fontWeight: 'bold' }}>
              <option value="openrouter-deepseek-v4-pro-0813">DeepSeek V4 Pro 0813 (Frontier Reasoning · 1.05M Ctx)</option>
              <option value="openrouter-deepseek-v4-flash">DeepSeek V4 Flash (Economy Engine · 1.05M Ctx)</option>
              <option value="openrouter-qwen-3.8-max">Qwen 3.8 Max (Multimodal Flagship · 1M Ctx)</option>
              <option value="openrouter-qwen-3.6-35b-a3b">Qwen 3.6 35B-A3B (Dense Reasoning · 262k Ctx)</option>
              <option value="openrouter-qwen-3.6-27b">Qwen 3.6 27B (Efficiency Agent · 262k Ctx)</option>
              <option value="openrouter-glm-5.3">GLM 5.3 (Frontier Long-Context · 1.31M Ctx)</option>
              <option value="openrouter-glm-5.2">GLM 5.2 (Standard Baseline · 1.05M Ctx)</option>
              <option value="openrouter-minimax-m2.5">MiniMax M2.5 (Conversational · 204k Ctx)</option>
              <option value="openrouter-kimi-k2.5">Kimi K2.5 (Multimodal Agent · 262k Ctx)</option>
            </optgroup>
          </select>
        </div>
      </header>

      {/* Conversations Drawer / Sheet */}
      {showDrawer && (
        <div
          style={{
            position: 'absolute',
            top: '74px',
            left: '12px',
            right: '12px',
            maxWidth: '400px',
            background: '#0d1527',
            border: '1px solid rgba(245, 230, 200, 0.25)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
            zIndex: 50,
            padding: '12px',
            maxHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '6px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#f5e6c8', fontFamily: 'serif' }}>
              Conversations ({sessions.length})
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleCreateNewChat}
                style={{
                  background: 'linear-gradient(135deg, #f5e6c8, #d4af37)',
                  color: '#080d1a',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + New Chat
              </button>
              <button
                onClick={() => setShowDrawer(false)}
                aria-label="Close conversation list"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-faint)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '0 4px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sessions.map((s) => {
              const isActive = s.id === sessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(245, 230, 200, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: isActive ? '1px solid rgba(245, 230, 200, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: isActive ? '#f5e6c8' : '#e0e0e0',
                        fontWeight: isActive ? '600' : '400',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {isActive && <span style={{ color: '#d4af37', marginRight: '5px' }}>●</span>}
                      {s.title || 'Continuous Reflection'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>
                      {new Date(s.updated_at || s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-faint)',
                      fontFamily: 'monospace',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      flexShrink: 0
                    }}
                  >
                    {s.model_key?.replace('anthropic-', '').replace('openrouter-', '').replace('openai-', '') || 'fable'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '10px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              maxWidth: '320px',
              color: 'var(--color-text-faint)'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
            <p style={{ fontSize: 'var(--font-sm)', lineHeight: '1.6' }}>
              Speak or write to Luna. Reflections, ideas, questions, and observations become woven into continuous memory.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isVoice = msg.input_type === 'voice' || msg.metadata?.input_type === 'voice';

          if (isUser) {
            // User Message Bubble (Right Aligned)
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '4px'
                }}
              >
                <span
                  style={{
                    fontSize: '9px',
                    color: 'var(--color-text-faint)',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isVoice && <span title="Recorded via voice" style={{ fontSize: '10px' }}>🎙</span>}
                  You
                </span>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '14px 14px 4px 14px',
                    background: '#1a243d',
                    border: '1px solid rgba(245, 230, 200, 0.15)',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'sans-serif'
                  }}
                >
                  {msg.content}
                </div>

                {/* Save Voice to Echo action for recent voice turns */}
                {isVoice && (
                  <div style={{ marginTop: '2px' }}>
                    {echoSaveSuccess?.id === msg.id ? (
                      <span
                        style={{
                          fontSize: '10.5px',
                          color: echoSaveSuccess.hasAudio ? '#a7f3d0' : '#fbbf24',
                          fontFamily: 'monospace'
                        }}
                      >
                        {echoSaveSuccess.hasAudio
                          ? '✓ Saved with Original Audio'
                          : '✓ Saved as Text Echo (Audio unavailable)'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveVoiceTurnAsEcho({
                            id: msg.id,
                            text: msg.content,
                            timestamp: msg.created_at,
                            lunarContext: lunarData,
                            metadata: msg.metadata,
                            audioPath: msg.metadata?.audioPath || msg.audio_path
                          })
                        }
                        disabled={savingEchoTurnId === msg.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-faint)',
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: '2px 4px'
                        }}
                      >
                        {savingEchoTurnId === msg.id ? 'Saving Echo...' : '✦ Save as Original Echo'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Luna Editorial Full-Width Layout (Non-Bubbled)
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: 'stretch',
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '4px 0 12px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '10.5px',
                    color: '#c4b5fd',
                    fontFamily: 'serif',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  ✦ Luna
                </span>
              </div>

              {/* Editorial Full-width text */}
              <div
                style={{
                  color: '#f5e6c8',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'Playfair Display', Georgia, serif",
                  letterSpacing: '0.01em'
                }}
              >
                {msg.content}
              </div>

              {/* Luna Voice Output Playback Controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                {playbackStates[msg.id] === 'loading' && (
                  <span style={{ fontSize: '11.5px', color: '#c4b5fd', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite' }}>✦</span> Preparing voice...
                  </span>
                )}

                {playbackStates[msg.id] === 'playing' && (
                  <>
                    <button
                      type="button"
                      onClick={() => pausePlayback(msg.id)}
                      title="Pause voice playback"
                      style={{
                        background: 'rgba(167, 139, 250, 0.25)',
                        border: '1px solid rgba(167, 139, 250, 0.7)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: '#e9d5ff',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 0 10px rgba(167, 139, 250, 0.4)'
                      }}
                    >
                      ⏸ Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => stopPlayback(msg.id)}
                      title="Stop voice playback"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: 'var(--color-text-faint)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ⏹ Stop
                    </button>
                  </>
                )}

                {playbackStates[msg.id] === 'paused' && (
                  <>
                    <button
                      type="button"
                      onClick={() => resumePlayback(msg.id)}
                      title="Resume voice playback"
                      style={{
                        background: 'rgba(52, 211, 153, 0.25)',
                        border: '1px solid rgba(52, 211, 153, 0.6)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: '#a7f3d0',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ▶️ Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => replayPlayback(msg.id, msg.content)}
                      title="Restart from beginning"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: 'var(--color-text-faint)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      🔄 Replay
                    </button>
                    <button
                      type="button"
                      onClick={() => stopPlayback(msg.id)}
                      title="Stop voice playback"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: 'var(--color-text-faint)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      ⏹ Stop
                    </button>
                  </>
                )}

                {playbackStates[msg.id] === 'error' && (
                  <button
                    type="button"
                    onClick={() => playMessage(msg.id, msg.content)}
                    title="Retry voice playback"
                    style={{
                      background: 'rgba(244, 63, 94, 0.2)',
                      border: '1px solid rgba(244, 63, 94, 0.5)',
                      borderRadius: '12px',
                      padding: '4px 10px',
                      color: '#fecdd3',
                      fontSize: '11.5px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    ⚠️ Retry Voice
                  </button>
                )}

                {(!playbackStates[msg.id] || playbackStates[msg.id] === 'idle') && (
                  <button
                    type="button"
                    onClick={() => playMessage(msg.id, msg.content)}
                    title="Listen to Luna aloud"
                    style={{
                      background: 'rgba(167, 139, 250, 0.12)',
                      border: '1px solid rgba(167, 139, 250, 0.35)',
                      borderRadius: '12px',
                      padding: '4px 10px',
                      color: '#d8b4fe',
                      fontSize: '11.5px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>🔊</span> Listen
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {loading && (
          <div
            style={{
              alignSelf: 'stretch',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '8px 0'
            }}
          >
            <span style={{ fontSize: '10.5px', color: '#c4b5fd', fontFamily: 'serif' }}>
              ✦ Luna is contemplating...
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0' }}>
              <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c4b5fd', animation: 'pulse 1.4s infinite ease-in-out' }}></div>
              <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c4b5fd', animation: 'pulse 1.4s infinite ease-in-out 0.2s' }}></div>
              <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c4b5fd', animation: 'pulse 1.4s infinite ease-in-out 0.4s' }}></div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              fontSize: 'var(--font-xs)',
              lineHeight: '1.5',
              maxWidth: '90%',
              margin: '10px auto 0'
            }}
          >
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Voice Recording / Transcribing Overlay (Shows only while actively recording/transcribing) */}
      {isRecording && (
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '12px',
            right: '12px',
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'rgba(18, 25, 45, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#f43f5e',
                display: 'inline-block',
                animation: 'pulse 1s infinite'
              }}
            />
            <span style={{ fontSize: 'var(--font-sm)', color: '#f5e6c8', fontWeight: '500' }}>
              Listening to your reflection...
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>
              {formatDuration(recordingDuration)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={cancelRecording}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--color-text-faint)',
                fontSize: 'var(--font-xs)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: '#f43f5e',
                border: 'none',
                color: '#ffffff',
                fontSize: 'var(--font-xs)',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {isTranscribing && (
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '12px',
            right: '12px',
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'rgba(18, 25, 45, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10
          }}
        >
          <div className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c4b5fd', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 'var(--font-sm)', color: '#c4b5fd' }}>
            Transcribing speech to composer...
          </span>
        </div>
      )}

      {voiceError && (
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '12px',
            right: '12px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: 'var(--font-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10
          }}
        >
          <span>{voiceError}</span>
          <button
            type="button"
            onClick={resetVoiceError}
            style={{
              background: 'none',
              border: 'none',
              color: '#fca5a5',
              fontSize: 'var(--font-xs)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Single Consolidated Composer with Auto-Growing Textarea */}
      <form
        onSubmit={handleSend}
        style={{
          flexShrink: 0,
          position: 'relative',
          padding: '8px 12px',
          background: '#080d1a',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '6px',
          alignItems: 'flex-end',
          zIndex: 5
        }}
      >
        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading || isTranscribing}
          title={isRecording ? 'Stop and transcribe speech' : 'Speak to Luna'}
          aria-label="Voice input"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: isRecording
              ? 'rgba(244, 63, 94, 0.2)'
              : 'rgba(245, 230, 200, 0.06)',
            border: isRecording
              ? '1px solid rgba(244, 63, 94, 0.5)'
              : '1px solid rgba(245, 230, 200, 0.15)',
            color: isRecording ? '#f43f5e' : '#f5e6c8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || isTranscribing ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
            WebkitTapHighlightColor: 'transparent',
            marginBottom: '0px'
          }}
        >
          {isRecording ? (
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f43f5e' }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* Auto-Growing Single Composer Textarea (38px to 180px) */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Speak or type to Luna...'}
          disabled={loading || isRecording || isTranscribing}
          style={{
            flex: 1,
            minHeight: '38px',
            maxHeight: '180px',
            height: '38px',
            padding: '9px 12px',
            borderRadius: '10px',
            background: '#040810',
            border: pendingVoiceMetaRef.current
              ? '1px solid rgba(245, 230, 200, 0.45)'
              : '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: '13.5px',
            lineHeight: '1.45',
            outline: 'none',
            resize: 'none',
            overflowY: 'auto',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
            WebkitAppearance: 'none'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(245, 230, 200, 0.4)')}
          onBlur={(e) => (e.target.style.borderColor = pendingVoiceMetaRef.current ? 'rgba(245, 230, 200, 0.45)' : 'var(--color-border)')}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || isRecording || isTranscribing || !input.trim()}
          style={{
            padding: '0 14px',
            height: '38px',
            borderRadius: '10px',
            background: input.trim() && !loading ? '#f5e6c8' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: input.trim() && !loading ? '#040810' : 'var(--color-text-faint)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.2s',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0
          }}
        >
          Send
        </button>
      </form>

      {/* Inline styles for pulsing animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
