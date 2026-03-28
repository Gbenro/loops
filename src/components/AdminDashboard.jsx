// Luna Loops - Admin Dashboard
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const IS_V2 = import.meta.env.VITE_APP_VERSION === 'v2';
const V1_URL = import.meta.env.VITE_V1_URL || null;
const V2_URL = import.meta.env.VITE_V2_URL || null;

export function AdminDashboard({ isOpen, onClose, currentUserEmail: _currentUserEmail }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, allowlistRes, feedbackRes] = await Promise.all([
      supabase.rpc('get_user_stats'),
      supabase.from('allowed_emails').select('*').order('added_at', { ascending: false }),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (usersRes.data) setUsers(usersRes.data);
    if (allowlistRes.data) setAllowlist(allowlistRes.data);
    if (feedbackRes.data) setFeedback(feedbackRes.data);
    setLoading(false);
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setAddError('');
    const { error } = await supabase.from('allowed_emails').insert({
      email: newEmail.trim().toLowerCase(),
      role: 'tester',
      note: newNote.trim() || null,
    });
    if (error) {
      setAddError(error.message);
    } else {
      setNewEmail('');
      setNewNote('');
      loadData();
    }
    setAdding(false);
  };

  const removeEmail = async (email) => {
    await supabase.from('allowed_emails').delete().eq('email', email);
    loadData();
  };

  const switchVersion = async (targetUrl) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=bearer`;
      window.location.href = `${targetUrl}/#${hash}`;
    } else {
      window.location.href = targetUrl;
    }
  };

  if (!isOpen) return null;

  // Stats derived from users
  const totalUsers = users.length;
  const totalLoops = users.reduce((s, u) => s + Number(u.loop_count), 0);
  const totalEchoes = users.reduce((s, u) => s + Number(u.echo_count), 0);
  const totalFeedback = feedback.length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)', width: '100%', maxWidth: 520,
        height: '92vh',
        background: '#070b14',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Handle */}
        <div onClick={onClose} style={{
          padding: '12px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(245,230,200,0.2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(245,230,200,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, color: '#f5e6c8', marginBottom: 4,
              }}>
                Mission Control
              </div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245,230,200,0.3)', letterSpacing: '0.1em' }}>
                LUNA LOOPS
              </div>
            </div>
            {/* Version switcher */}
            {(V1_URL || V2_URL) && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
                {V1_URL && (
                  <button onClick={() => switchVersion(V1_URL)} style={{
                    padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${!IS_V2 ? 'rgba(245,230,200,0.4)' : 'rgba(245,230,200,0.12)'}`,
                    color: !IS_V2 ? 'rgba(245,230,200,0.8)' : 'rgba(245,230,200,0.35)',
                    fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em',
                    background: 'none',
                  }}>V1</button>
                )}
                {V2_URL && (
                  <button onClick={() => switchVersion(V2_URL)} style={{
                    padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                    border: `1px solid ${IS_V2 ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.15)'}`,
                    color: IS_V2 ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.4)',
                    fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em',
                    background: 'none',
                  }}>V2</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 1,
          padding: '16px 20px',
          borderBottom: '1px solid rgba(245,230,200,0.06)',
        }}>
          {[
            { label: 'USERS', value: totalUsers },
            { label: 'LOOPS', value: totalLoops },
            { label: 'ECHOES', value: totalEchoes },
            { label: 'FEEDBACK', value: totalFeedback },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#f5e6c8', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(245,230,200,0.35)', letterSpacing: '0.1em', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid rgba(245,230,200,0.06)' }}>
          {['users', 'allowlist', 'feedback'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: activeTab === tab ? 'rgba(245,230,200,0.1)' : 'transparent',
                color: activeTab === tab ? 'rgba(245,230,200,0.8)' : 'rgba(245,230,200,0.3)',
                fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'rgba(245,230,200,0.3)', padding: 40, fontSize: 20 }}>〜</div>
          ) : (
            <>
              {/* Users tab */}
              {activeTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {users.length === 0 && (
                    <div style={{ color: 'rgba(245,230,200,0.3)', fontSize: 13, fontStyle: 'italic' }}>No users yet.</div>
                  )}
                  {users.map(u => (
                    <div key={u.email} style={{
                      padding: '14px 16px',
                      background: 'rgba(245,230,200,0.03)',
                      border: '1px solid rgba(245,230,200,0.07)',
                      borderRadius: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: '#f5e6c8' }}>
                          {u.email}
                        </div>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.08em',
                          padding: '2px 6px', borderRadius: 3,
                          background: u.role === 'admin' ? 'rgba(167,139,250,0.15)' : 'rgba(245,230,200,0.06)',
                          color: u.role === 'admin' ? 'rgba(167,139,250,0.8)' : 'rgba(245,230,200,0.4)',
                        }}>
                          {u.role?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 10, fontFamily: 'monospace', color: 'rgba(245,230,200,0.4)' }}>
                        <span>{u.loop_count} loops</span>
                        <span>{u.echo_count} echoes</span>
                        <span>{u.feedback_count} feedback</span>
                        <span style={{ marginLeft: 'auto' }}>
                          {u.last_seen ? new Date(u.last_seen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'never'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Allowlist tab */}
              {activeTab === 'allowlist' && (
                <div>
                  {/* Add email form */}
                  <div style={{
                    padding: 16, borderRadius: 12,
                    background: 'rgba(167,139,250,0.04)',
                    border: '1px solid rgba(167,139,250,0.12)',
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245,230,200,0.35)', letterSpacing: '0.1em', marginBottom: 12 }}>
                      INVITE TESTER
                    </div>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addEmail()}
                      style={{
                        width: '100%', padding: '10px 12px', marginBottom: 8,
                        background: 'rgba(245,230,200,0.03)',
                        border: '1px solid rgba(245,230,200,0.1)',
                        borderRadius: 8, color: '#f5e6c8', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Note (optional — who are they?)"
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', marginBottom: 10,
                        background: 'rgba(245,230,200,0.03)',
                        border: '1px solid rgba(245,230,200,0.1)',
                        borderRadius: 8, color: '#f5e6c8', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {addError && (
                      <div style={{ fontSize: 11, color: 'rgba(252,129,129,0.8)', marginBottom: 8 }}>{addError}</div>
                    )}
                    <button
                      onClick={addEmail}
                      disabled={!newEmail.trim() || adding}
                      style={{
                        width: '100%', padding: '10px',
                        borderRadius: 8, border: 'none',
                        background: newEmail.trim() ? 'rgba(167,139,250,0.15)' : 'rgba(245,230,200,0.04)',
                        color: newEmail.trim() ? 'rgba(167,139,250,0.9)' : 'rgba(245,230,200,0.3)',
                        fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em',
                        cursor: newEmail.trim() ? 'pointer' : 'default',
                      }}
                    >
                      {adding ? '...' : 'ADD TO BETA'}
                    </button>
                  </div>

                  {/* Current list */}
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245,230,200,0.3)', letterSpacing: '0.1em', marginBottom: 12 }}>
                    {allowlist.length} ALLOWED
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allowlist.map(entry => (
                      <div key={entry.email} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        background: 'rgba(245,230,200,0.03)',
                        border: '1px solid rgba(245,230,200,0.07)',
                        borderRadius: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#f5e6c8', marginBottom: 2 }}>{entry.email}</div>
                          {entry.note && (
                            <div style={{ fontSize: 10, color: 'rgba(245,230,200,0.4)' }}>{entry.note}</div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace',
                          padding: '2px 6px', borderRadius: 3,
                          background: entry.role === 'admin' ? 'rgba(167,139,250,0.12)' : 'rgba(245,230,200,0.06)',
                          color: entry.role === 'admin' ? 'rgba(167,139,250,0.7)' : 'rgba(245,230,200,0.35)',
                        }}>
                          {entry.role?.toUpperCase()}
                        </span>
                        {entry.role !== 'admin' && (
                          <button
                            onClick={() => removeEmail(entry.email)}
                            style={{
                              background: 'none', border: 'none',
                              color: 'rgba(252,129,129,0.4)',
                              fontSize: 16, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback tab */}
              {activeTab === 'feedback' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {feedback.length === 0 && (
                    <div style={{ color: 'rgba(245,230,200,0.3)', fontSize: 13, fontStyle: 'italic' }}>No feedback yet.</div>
                  )}
                  {feedback.map(f => (
                    <div key={f.id} style={{
                      padding: '14px 16px',
                      background: 'rgba(245,230,200,0.03)',
                      border: '1px solid rgba(245,230,200,0.07)',
                      borderRadius: 10,
                    }}>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 15, color: 'rgba(245,230,200,0.85)',
                        lineHeight: 1.6, marginBottom: 10,
                      }}>
                        {f.text}
                      </div>
                      <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245,230,200,0.3)' }}>
                        {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
