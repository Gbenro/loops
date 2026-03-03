// Cosmic Loops - Profile Menu
// Account settings and birth data input

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export function ProfileMenu({ isOpen, onClose, user, onSignOut, onProfileUpdate }) {
  const [activeSection, setActiveSection] = useState('account');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Zodiac signs form
  const [sunSign, setSunSign] = useState('');
  const [moonSign, setMoonSign] = useState('');
  const [risingSign, setRisingSign] = useState('');

  const ZODIAC_SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];

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
        setSunSign(data.sun_sign || '');
        setMoonSign(data.moon_sign || '');
        setRisingSign(data.rising_sign || '');
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
        sun_sign: sunSign || null,
        moon_sign: moonSign || null,
        rising_sign: risingSign || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(profileData);

      if (error) throw error;

      setProfile(profileData);
      if (onProfileUpdate) onProfileUpdate();
      alert('Zodiac signs saved!');
    } catch (e) {
      console.error('Save error:', e);
      alert('Could not save. Please try again.');
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
                Enter your big three for personalized transits. Don't know yours? Look up your chart at cafeastrology.com
              </div>

              {!user ? (
                <div style={{
                  textAlign: 'center',
                  padding: 24,
                  color: 'rgba(245, 230, 200, 0.5)',
                  fontStyle: 'italic',
                }}>
                  Sign in to save your zodiac signs
                </div>
              ) : (
                <>
                  {/* Big Three Header */}
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'rgba(167, 139, 250, 0.7)',
                    marginBottom: 12,
                    letterSpacing: '0.1em',
                  }}>
                    YOUR BIG THREE
                  </div>

                  {/* Sun Sign */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      ☉ SUN SIGN (your core identity)
                    </label>
                    <select
                      value={sunSign}
                      onChange={e => setSunSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map(sign => (
                        <option key={sign} value={sign}>{sign}</option>
                      ))}
                    </select>
                  </div>

                  {/* Moon Sign */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      ☽ MOON SIGN (your emotional nature)
                    </label>
                    <select
                      value={moonSign}
                      onChange={e => setMoonSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map(sign => (
                        <option key={sign} value={sign}>{sign}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rising Sign */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      ↑ RISING SIGN (how others see you)
                    </label>
                    <select
                      value={risingSign}
                      onChange={e => setRisingSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid rgba(245, 230, 200, 0.15)',
                        background: 'rgba(245, 230, 200, 0.03)',
                        color: '#f5e6c8',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map(sign => (
                        <option key={sign} value={sign}>{sign}</option>
                      ))}
                    </select>
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
                    {saving ? 'Saving...' : 'Save'}
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
