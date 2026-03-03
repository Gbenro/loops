// Cosmic Loops - Profile Menu
// Account settings and birth data input

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export function ProfileMenu({ isOpen, onClose, user, onSignOut }) {
  const [activeSection, setActiveSection] = useState('account');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Birth data form
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthLocation, setBirthLocation] = useState('');

  // Load profile on open
  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
    }
  }, [isOpen, user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setBirthDate(data.birth_date || '');
        setBirthTime(data.birth_time || '');
        setBirthLocation(data.birth_location || '');
      }
    } catch (e) {
      // Profile doesn't exist yet, that's ok
      console.log('No profile yet');
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const profileData = {
        id: user.id,
        birth_date: birthDate || null,
        birth_time: birthTime || null,
        birth_location: birthLocation || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error) throw error;

      setProfile(profileData);
      alert('Birth data saved!');
    } catch (e) {
      console.error('Save error:', e);
      alert('Could not save: ' + e.message);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    if (confirm('Sign out of Cosmic Loops?')) {
      onSignOut();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '80vh',
        background: '#0a0a12',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Drag handle */}
        <div
          onClick={onClose}
          style={{
            padding: '12px 0',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(245, 230, 200, 0.2)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '0 20px 16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24,
            color: '#f5e6c8',
          }}>
            Settings
          </div>
        </div>

        {/* Section tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '0 20px 16px',
        }}>
          {[
            { id: 'account', label: 'Account', icon: '◯' },
            { id: 'birth', label: 'Your Sky', icon: '⚝' },
            { id: 'about', label: 'About', icon: '✧' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                border: 'none',
                background: activeSection === s.id
                  ? 'rgba(245, 230, 200, 0.12)'
                  : 'rgba(245, 230, 200, 0.04)',
                color: activeSection === s.id
                  ? '#f5e6c8'
                  : 'rgba(245, 230, 200, 0.4)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 40px',
        }}>
          {/* Account Section */}
          {activeSection === 'account' && (
            <div>
              {user ? (
                <>
                  <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(245, 230, 200, 0.04)',
                    border: '1px solid rgba(245, 230, 200, 0.08)',
                    marginBottom: 16,
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      SIGNED IN AS
                    </div>
                    <div style={{
                      fontSize: 14,
                      color: '#f5e6c8',
                      wordBreak: 'break-all',
                    }}>
                      {user.email}
                    </div>
                  </div>

                  <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(52, 211, 153, 0.06)',
                    border: '1px solid rgba(52, 211, 153, 0.15)',
                    marginBottom: 16,
                  }}>
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(52, 211, 153, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span>●</span>
                      <span>Data synced to cloud</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid rgba(252, 129, 129, 0.2)',
                      background: 'rgba(252, 129, 129, 0.06)',
                      color: 'rgba(252, 129, 129, 0.8)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: 24,
                  color: 'rgba(245, 230, 200, 0.5)',
                }}>
                  <p>Sign in to sync your data across devices</p>
                </div>
              )}
            </div>
          )}

          {/* Birth Data Section */}
          {activeSection === 'birth' && (
            <div>
              <div style={{
                fontSize: 13,
                color: 'rgba(245, 230, 200, 0.6)',
                marginBottom: 20,
                lineHeight: 1.6,
              }}>
                Enter your birth details for personalized natal transits. This data is stored securely and never shared.
              </div>

              {!user ? (
                <div style={{
                  textAlign: 'center',
                  padding: 24,
                  color: 'rgba(245, 230, 200, 0.5)',
                  fontStyle: 'italic',
                }}>
                  Sign in to save your birth data
                </div>
              ) : (
                <>
                  {/* Birth Date */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      BIRTH DATE
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={e => setBirthDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    />
                  </div>

                  {/* Birth Time */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      BIRTH TIME (optional, for rising sign)
                    </label>
                    <input
                      type="time"
                      value={birthTime}
                      onChange={e => setBirthTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    />
                  </div>

                  {/* Birth Location */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      BIRTH CITY
                    </label>
                    <input
                      type="text"
                      value={birthLocation}
                      onChange={e => setBirthLocation(e.target.value)}
                      placeholder="e.g., London, UK"
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: 'none',
                      background: saving
                        ? 'rgba(245, 230, 200, 0.1)'
                        : 'rgba(167, 139, 250, 0.2)',
                      color: saving
                        ? 'rgba(245, 230, 200, 0.4)'
                        : '#A78BFA',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: saving ? 'wait' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Birth Data'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* About Section */}
          {activeSection === 'about' && (
            <div>
              <div style={{
                textAlign: 'center',
                marginBottom: 24,
              }}>
                <div style={{
                  fontSize: 32,
                  marginBottom: 8,
                }}>
                  ☽
                </div>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 20,
                  color: '#f5e6c8',
                  marginBottom: 4,
                }}>
                  Cosmic Loops
                </div>
                <div style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'rgba(245, 230, 200, 0.4)',
                }}>
                  v1.0.0
                </div>
              </div>

              <div style={{
                fontSize: 13,
                color: 'rgba(245, 230, 200, 0.6)',
                lineHeight: 1.8,
                textAlign: 'center',
              }}>
                <p>Track your growth with lunar wisdom.</p>
                <p style={{ marginTop: 12 }}>
                  Built with intention under many moons.
                </p>
              </div>

              <div style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 12,
                background: 'rgba(245, 230, 200, 0.03)',
                border: '1px solid rgba(245, 230, 200, 0.06)',
              }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: 'rgba(245, 230, 200, 0.3)',
                  textAlign: 'center',
                }}>
                  DATA STORED LOCALLY + CLOUD (WHEN SIGNED IN)
                  <br />
                  VOICE TRANSCRIPTION VIA GROQ WHISPER
                  <br />
                  PHRASES GENERATED BY CLAUDE
                </div>
              </div>
            </div>
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
