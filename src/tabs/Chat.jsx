import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

export function Chat({ userId, lunarData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem('luna_model_key') || 'anthropic-frontier'
  );
  
  const chatEndRef = useRef(null);

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
    e.preventDefault();
    if (!input.trim() || loading || !sessionId) return;

    const userText = input.trim();
    setInput('');
    setError('');
    setLoading(true);

    // Optimistically add user message to list
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Get auth session token for REST headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call Express API chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userText,
          sessionId: sessionId,
          modelKey: selectedModel
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error');
      }

      const data = await response.json();
      
      // Update messages list (replacing optimistic and appending assistant message)
      // Fetch latest messages to stay perfectly in sync
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
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
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

        {/* Model Selector Dropdown */}
        <select
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            localStorage.setItem('luna_model_key', e.target.value);
          }}
          style={{
            background: '#080d1a',
            border: '1px solid var(--color-border)',
            color: '#f5e6c8',
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '6px 10px',
            borderRadius: '6px',
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            textAlign: 'center'
          }}
        >
          <option value="anthropic-frontier">Claude 3.5 Sonnet</option>
          <option value="openai-frontier">GPT-4o</option>
          <option value="openai-balanced">GPT-4o-mini</option>
          <option value="google-frontier">Gemini 1.5 Pro</option>
        </select>
      </header>

      {/* Message history */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingBottom: '100px' // Leave space for sticky input
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              maxWidth: '300px',
              color: 'var(--color-text-faint)',
              fontSize: 'var(--font-sm)',
              fontStyle: 'italic',
              padding: '40px 20px',
              lineHeight: '1.6'
            }}
          >
            "Speak to Luna to reflect on your field, recall previous circles, or log intentions and realizations."
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
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
                  textTransform: 'uppercase'
                }}
              >
                {isUser ? 'You' : '✦ Luna'}
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
          gap: '10px'
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak to Luna..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#080d1a',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-sm)',
            outline: 'none',
            transition: 'border-color 0.2s',
            WebkitAppearance: 'none'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(245, 230, 200, 0.4)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '0 20px',
            borderRadius: '12px',
            background: input.trim() && !loading ? '#f5e6c8' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: input.trim() && !loading ? '#040810' : 'var(--color-text-faint)',
            fontSize: 'var(--font-sm)',
            fontWeight: '600',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.2s',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          Send
        </button>
      </form>

      {/* Inline styles for pulsing animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
