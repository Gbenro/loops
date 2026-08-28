import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useVoiceRecorder } from '../lib/useVoiceRecorder.js';

export function Chat({ userId, lunarData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem('luna_model_key') || 'anthropic-fable'
  );
  
  const chatEndRef = useRef(null);
  const pendingVoiceMetaRef = useRef(null);

  // Voice recording integration
  const handleTranscriptReady = useCallback((transcript, metadata) => {
    setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
    pendingVoiceMetaRef.current = metadata;
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

  // Format seconds into m:ss
  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Fetch active session and messages
  useEffect(() => {
    if (!userId) return;

    async function initChat() {
      try {
        setError('');
        // Fetch or create default session
        const { data: sessions, error: sessionErr } = await supabase
          .from('chat_sessions')
          .select('id')
          .limit(1);

        if (sessionErr) throw sessionErr;

        let activeSessionId;
        if (sessions && sessions.length > 0) {
          activeSessionId = sessions[0].id;
        } else {
          // Create new session
          const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const { error: createErr } = await supabase
            .from('chat_sessions')
            .insert({
              id: newId,
              user_id: userId,
              title: 'Continuous Reflection'
            });
          if (createErr) throw createErr;
          activeSessionId = newId;
        }

        setSessionId(activeSessionId);

        // Fetch messages for this session
        const { data: msgs, error: msgsErr } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', activeSessionId)
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

  // 2. Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 3. Send message handler
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || isRecording || isTranscribing || !sessionId) return;

    const userText = input.trim();
    const voiceMeta = pendingVoiceMetaRef.current;
    const inputType = voiceMeta ? 'voice' : 'text';

    setInput('');
    pendingVoiceMetaRef.current = null;
    setError('');
    setLoading(true);

    // Optimistically add user message to list
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: userText,
      input_type: inputType,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Get auth session token for REST headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get base URL for backend API (from Vite environment, fallback to active Railway)
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://loops-production-e1d5.up.railway.app';

      // Call Express API chat endpoint
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
          metadata: voiceMeta || {}
        })
      });

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
      
      // Update messages list (fetching latest to stay perfectly in sync)
      const { data: msgs, error: msgsErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (msgsErr) throw msgsErr;
      setMessages(msgs || []);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message || 'Connection lost. Please try again.');
      // Remove the last optimistic message since it failed
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
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
        background: 'var(--color-bg)',
        color: 'var(--color-text)'
      }}
    >
      {/* Header */}
      <header
        style={{
          flexShrink: 0,
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(8, 13, 26, 0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-md)',
              fontFamily: 'serif',
              color: '#f5e6c8',
              letterSpacing: '0.05em'
            }}
          >
            ✦ Luna Chat
          </h1>
          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text-faint)',
              fontFamily: 'monospace',
              letterSpacing: '0.05em'
            }}
          >
            {moonEmoji} {moonLabel} | Moon in {lunarData?.zodiac?.sign || 'Aries'}
          </p>
        </div>

        {/* Model Selector Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            htmlFor="model-select"
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: 'var(--color-text-faint)',
              textTransform: 'uppercase'
            }}
          >
            Model:
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => {
              const newModel = e.target.value;
              setSelectedModel(newModel);
              localStorage.setItem('luna_model_key', newModel);
            }}
            style={{
              background: '#0e1626',
              color: '#f5e6c8',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: 'var(--font-xs)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'sans-serif'
            }}
          >
            <option value="anthropic-3.7-sonnet">Anthropic Claude 3.7 Sonnet (Frontier)</option>
            <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Frontier)</option>
            <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Fast)</option>
            <option value="gemini-2.0-flash-thinking">Google Gemini 2.0 Flash Thinking</option>
            <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
            <option value="gemini-1.5-flash">Google Gemini 1.5 Flash</option>
            <option value="anthropic-frontier">Anthropic Claude 3.5 Sonnet</option>
            <option value="openai-frontier">OpenAI GPT-4o</option>
            <option value="openai-balanced">OpenAI GPT-4o Mini</option>
          </select>
        </div>
      </header>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          paddingBottom: '100px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
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
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: '4px'
              }}
            >
              {/* Provenance label */}
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
                {isUser ? (
                  <>
                    {isVoice && <span title="Recorded via voice" style={{ fontSize: '10px' }}>🎙</span>}
                    You
                  </>
                ) : (
                  '✦ Luna'
                )}
              </span>

              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isUser ? '#1a243d' : 'rgba(167, 139, 250, 0.06)',
                  border: isUser ? '1px solid rgba(245, 230, 200, 0.15)' : '1px solid rgba(167, 139, 250, 0.2)',
                  boxShadow: isUser ? 'none' : '0 4px 12px rgba(167, 139, 250, 0.03)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-sm)',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  fontFamily: isUser ? 'sans-serif' : 'serif',
                  letterSpacing: isUser ? 'normal' : '0.01em'
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '9px', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>
              ✦ Luna
            </span>
            <div
              style={{
                padding: '12px 20px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(167, 139, 250, 0.04)',
                border: '1px solid rgba(167, 139, 250, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
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

      {/* Voice Recording / Transcribing Action Bar Overlay */}
      {isRecording && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '20px',
            right: '20px',
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
              Listening...
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
            bottom: '80px',
            left: '20px',
            right: '20px',
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
            Transcribing speech to text...
          </span>
        </div>
      )}

      {voiceError && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '20px',
            right: '20px',
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

      {/* Styled input bar */}
      <form
        onSubmit={handleSend}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px calc(16px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(to top, var(--color-bg) 70%, transparent)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}
      >
        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading || isTranscribing}
          title={isRecording ? 'Stop recording' : 'Speak to Luna'}
          aria-label="Voice input"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
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
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {isRecording ? (
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#f43f5e' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* Text Input Composer */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Speak or type to Luna...'}
          disabled={loading || isRecording || isTranscribing}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#080d1a',
            border: pendingVoiceMetaRef.current
              ? '1px solid rgba(245, 230, 200, 0.5)'
              : '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-sm)',
            outline: 'none',
            transition: 'border-color 0.2s',
            WebkitAppearance: 'none'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(245, 230, 200, 0.4)')}
          onBlur={(e) => (e.target.style.borderColor = pendingVoiceMetaRef.current ? 'rgba(245, 230, 200, 0.5)' : 'var(--color-border)')}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || isRecording || isTranscribing || !input.trim()}
          style={{
            padding: '0 18px',
            height: '44px',
            borderRadius: '12px',
            background: input.trim() && !loading ? '#f5e6c8' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: input.trim() && !loading ? '#040810' : 'var(--color-text-faint)',
            fontSize: 'var(--font-sm)',
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
