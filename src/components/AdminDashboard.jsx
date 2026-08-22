// Luna Loops - Admin Dashboard
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';



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

  if (!isOpen) return null;

  // Stats derived from users
  const totalUsers = users.length;
  const totalLoops = users.reduce((s, u) => s + Number(u.loop_count), 0);
  const totalEchoes = users.reduce((s, u) => s + Number(u.echo_count), 0);
  const totalFeedback = feedback.length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        height: '92vh',
        background: 'var(--color-surface)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Handle */}
        <div onClick={onClose} style={{
          padding: '12px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-mid)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, color: 'var(--color-text)', marginBottom: 4,
              }}>
                Mission Control
              </div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>
                LUNA LOOPS
              </div>
            </div>

          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 1,
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {[
            { label: 'USERS', value: totalUsers },
            { label: 'LOOPS', value: totalLoops },
            { label: 'ECHOES', value: totalEchoes },
            { label: 'FEEDBACK', value: totalFeedback },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: 'var(--color-text)', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
          {['users', 'allowlist', 'feedback'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: activeTab === tab ? 'var(--color-border-light)' : 'transparent',
                color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
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
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40, fontSize: 20 }}>〜</div>
          ) : (
            <>
              {/* Users tab */}
              {activeTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {users.length === 0 && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>No users yet.</div>
                  )}
                  {users.map(u => (
                    <div key={u.email} style={{
                      padding: '14px 16px',
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'var(--color-text)' }}>
                          {u.email}
                        </div>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.08em',
                          padding: '2px 6px', borderRadius: 3,
                          background: u.role === 'admin' ? 'var(--color-accent-bg)' : 'var(--color-border-light)',
                          color: u.role === 'admin' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        }}>
                          {u.role?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
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
                    background: 'var(--color-accent-bg)',
                    border: '1px solid var(--color-border-light)',
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 12 }}>
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
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: 8, color: 'var(--color-text)', fontSize: 13, outline: 'none',
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
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: 8, color: 'var(--color-text)', fontSize: 13, outline: 'none',
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
                        background: newEmail.trim() ? 'var(--color-accent-bg)' : 'var(--color-input-bg)',
                        color: newEmail.trim() ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em',
                        cursor: newEmail.trim() ? 'pointer' : 'default',
                      }}
                    >
                      {adding ? '...' : 'ADD TO BETA'}
                    </button>
                  </div>

                  {/* Current list */}
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--color-text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>
                    {allowlist.length} ALLOWED
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {allowlist.map(entry => (
                      <div key={entry.email} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 2 }}>{entry.email}</div>
                          {entry.note && (
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{entry.note}</div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 8, fontFamily: 'monospace',
                          padding: '2px 6px', borderRadius: 3,
                          background: entry.role === 'admin' ? 'var(--color-accent-bg)' : 'var(--color-border-light)',
                          color: entry.role === 'admin' ? 'var(--color-accent)' : 'var(--color-text-muted)',
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
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>No feedback yet.</div>
                  )}
                  {feedback.map(f => (
                    <div key={f.id} style={{
                      padding: '14px 16px',
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                    }}>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 15, color: 'var(--color-text-dim)',
                        lineHeight: 1.6, marginBottom: 10,
                      }}>
                        {f.text}
                      </div>
                      <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
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


    </div>
  );
}
