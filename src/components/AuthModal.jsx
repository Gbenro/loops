import { useState } from 'react';

export function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await onSuccess(mode, email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const accent = '#A78BFA';

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          background: '#16161c',
          border: `1px solid ${accent}33`,
          borderRadius: 22,
          padding: '32px 28px',
          width: '100%',
          maxWidth: 400,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 18,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          x
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.25)',
              fontFamily: 'monospace',
              letterSpacing: '0.16em',
              marginBottom: 8,
            }}
          >
            {mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 24,
              fontWeight: 700,
              color: '#f0ece4',
            }}
          >
            {mode === 'login' ? 'Sign in to sync' : 'Create account'}
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'monospace',
            }}
          >
            {mode === 'login'
              ? 'Access your loops across devices'
              : 'Sync your loops everywhere'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 9,
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                marginBottom: 7,
              }}
            >
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#f0ece4',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 9,
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                marginBottom: 7,
              }}
            >
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#f0ece4',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                  marginBottom: 7,
                }}
              >
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#f0ece4',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(252,129,129,0.1)',
                border: '1px solid rgba(252,129,129,0.2)',
                borderRadius: 8,
                color: '#FC8181',
                fontSize: 11,
                fontFamily: 'monospace',
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: accent,
              border: 'none',
              borderRadius: 13,
              padding: '14px 0',
              color: '#0c0c0f',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
              marginBottom: 14,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'monospace',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Skip option */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.2)',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  );
}
