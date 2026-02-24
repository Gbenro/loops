// Cosmic Loops - Auth Modal
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          onSuccess?.(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          onSuccess?.(data.user);
        }
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
          <div style={{
            fontSize: 32,
            marginBottom: 8,
          }}>☽</div>
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              marginBottom: 12,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px solid rgba(245, 230, 200, 0.1)',
              borderRadius: 8,
              color: '#f5e6c8',
              fontSize: 15,
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
              padding: '14px 16px',
              marginBottom: 16,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px solid rgba(245, 230, 200, 0.1)',
              borderRadius: 8,
              color: '#f5e6c8',
              fontSize: 15,
              outline: 'none',
            }}
          />

          {error && (
            <div style={{
              padding: '10px 12px',
              marginBottom: 16,
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
              padding: '14px',
              background: loading ? 'rgba(245, 230, 200, 0.05)' : 'rgba(245, 230, 200, 0.1)',
              border: '1px solid rgba(245, 230, 200, 0.2)',
              borderRadius: 8,
              color: '#f5e6c8',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              marginBottom: 16,
            }}
          >
            {loading ? '...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.5)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.3)',
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
