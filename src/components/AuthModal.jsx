// Cosmic Loops - Auth Modal
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const REDIRECT_URL = 'https://lunaloops.app';

export function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'apple'
  const [error, setError] = useState('');

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT_URL },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
    // On success the page redirects — no further action needed here
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) onSuccess?.(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) onSuccess?.(data.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(4, 8, 16, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        background: '#0a0f18',
        border: '1px solid rgba(245, 230, 200, 0.1)',
        borderRadius: 16,
        padding: 24,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>☽</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22,
            color: '#f5e6c8',
          }}>
            {mode === 'signin' ? 'Welcome Back' : 'Join the Cosmos'}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.4)',
            marginTop: 6,
          }}>
            {mode === 'signin' ? 'SIGN IN TO SYNC' : 'CREATE YOUR ACCOUNT'}
          </div>
        </div>

        {/* Social buttons */}
        <button
          onClick={() => handleOAuth('google')}
          disabled={!!oauthLoading}
          style={{
            width: '100%',
            padding: '13px 16px',
            marginBottom: 10,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(245, 230, 200, 0.15)',
            borderRadius: 8,
            color: '#f5e6c8',
            fontSize: 14,
            fontWeight: 500,
            cursor: oauthLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <button
          onClick={() => handleOAuth('apple')}
          disabled={!!oauthLoading}
          style={{
            width: '100%',
            padding: '13px 16px',
            marginBottom: 20,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(245, 230, 200, 0.15)',
            borderRadius: 8,
            color: '#f5e6c8',
            fontSize: 14,
            fontWeight: 500,
            cursor: oauthLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f5e6c8">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(245, 230, 200, 0.08)' }} />
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.3)',
            letterSpacing: '0.1em',
          }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(245, 230, 200, 0.08)' }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              marginBottom: 10,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px solid rgba(245, 230, 200, 0.1)',
              borderRadius: 8,
              color: '#f5e6c8',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '12px 14px',
              marginBottom: 14,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px solid rgba(245, 230, 200, 0.1)',
              borderRadius: 8,
              color: '#f5e6c8',
              fontSize: 14,
              outline: 'none',
            }}
          />

          {error && (
            <div style={{
              padding: '10px 12px',
              marginBottom: 14,
              background: 'rgba(252, 129, 129, 0.1)',
              border: '1px solid rgba(252, 129, 129, 0.3)',
              borderRadius: 6,
              color: 'rgba(252, 129, 129, 0.9)',
              fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? 'rgba(245, 230, 200, 0.04)' : 'rgba(245, 230, 200, 0.08)',
              border: '1px solid rgba(245, 230, 200, 0.15)',
              borderRadius: 8,
              color: 'rgba(245, 230, 200, 0.8)',
              fontSize: 13,
              cursor: loading ? 'wait' : 'pointer',
              marginBottom: 14,
            }}
          >
            {loading ? '...' : (mode === 'signin' ? 'Sign in with email' : 'Create account')}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.4)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
          </button>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.25)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            CONTINUE WITHOUT SYNC →
          </button>
        </div>
      </div>
    </div>
  );
}
