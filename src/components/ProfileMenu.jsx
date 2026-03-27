// Luna Loops - Profile Menu
// Account settings and birth data input

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { requestPermission, canNotify, getNotificationPrefs, saveNotificationPrefs } from '../lib/notifications.js';
import { useEncryption } from '../lib/EncryptionContext.jsx';
import { LunaLogo } from './LunaLogo.jsx';

const IS_V2 = import.meta.env.VITE_APP_VERSION === 'v2';

export function ProfileMenu({ isOpen, onClose, user, onSignOut, onProfileUpdate, onOpenTutorial }) {
  const [activeSection, setActiveSection] = useState('account');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Zodiac signs form
  const [sunSign, setSunSign] = useState('');
  const [moonSign, setMoonSign] = useState('');
  const [risingSign, setRisingSign] = useState('');
  const [hemisphere, setHemisphere] = useState('north');

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState(getNotificationPrefs());

  // Encryption
  const { status: encStatus, setupEncryption, disableEncryption, lock } = useEncryption();
  const [encPassphrase, setEncPassphrase] = useState('');
  const [encConfirm, setEncConfirm] = useState('');
  const [encError, setEncError] = useState('');
  const [encLoading, setEncLoading] = useState(false);

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
    // Reset form state
    setSunSign('');
    setMoonSign('');
    setRisingSign('');
    setHemisphere('north');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Profile load error:', error.message);
      } else if (data) {
        setProfile(data);
        setSunSign(data.sun_sign || '');
        setMoonSign(data.moon_sign || '');
        setRisingSign(data.rising_sign || '');
        setHemisphere(data.hemisphere || 'north');
      }
    } catch (e) {
      console.log('No profile yet:', e.message);
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
        hemisphere: hemisphere || 'north',
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
    if (confirm('Sign out of Luna Loops?')) {
      onSignOut();
      onClose();
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    try {
      await supabase.from('feedback').insert({
        user_id: user?.id || null,
        text: feedbackText.trim(),
        created_at: new Date().toISOString(),
      });
      setFeedbackText('');
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    } catch (e) {
      console.warn('Feedback send failed:', e);
    }
    setFeedbackSending(false);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);

    try {
      // Fetch all user data
      const [profileRes, loopsRes, echoesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('loops').select('*').eq('user_id', user.id),
        supabase.from('echoes').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        email: user.email,
        profile: profileRes.data || null,
        loops: loopsRes.data || [],
        echoes: echoesRes.data || [],
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cosmic-loops-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Could not export data. Please try again.');
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = confirm(
      'Delete your account? This will permanently remove all your data including loops, echoes, and profile. This cannot be undone.'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('Are you absolutely sure? Type OK to proceed.');
    if (!doubleConfirm) return;

    setDeleting(true);
    try {
      // Delete all user data
      await Promise.all([
        supabase.from('echoes').delete().eq('user_id', user.id),
        supabase.from('loops').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('id', user.id),
      ]);

      // Sign out
      await supabase.auth.signOut();
      onSignOut();
      onClose();
      alert('Your account and all data have been deleted.');
    } catch (e) {
      console.error('Delete error:', e);
      alert('Could not delete account. Please try again.');
    }
    setDeleting(false);
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
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 520,
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
          gap: 6,
          padding: '0 20px 16px',
        }}>
          {[
            { id: 'account', label: 'Account', icon: '◯' },
            { id: 'birth', label: 'Your Sky', icon: '⚝' },
            { id: 'notifs', label: 'Alerts', icon: '◉' },
            { id: 'privacy', label: 'Privacy', icon: '◎' },
            { id: 'about', label: 'About', icon: '✧' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              title={s.label}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: 10,
                border: 'none',
                background: activeSection === s.id
                  ? 'rgba(245, 230, 200, 0.12)'
                  : 'rgba(245, 230, 200, 0.04)',
                color: activeSection === s.id
                  ? '#f5e6c8'
                  : 'rgba(245, 230, 200, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{
                fontSize: 9, fontFamily: 'monospace',
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>{s.label}</span>
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

                  {/* Data Management */}
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'rgba(245, 230, 200, 0.4)',
                    marginBottom: 12,
                    letterSpacing: '0.1em',
                  }}>
                    DATA MANAGEMENT
                  </div>

                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid rgba(245, 230, 200, 0.15)',
                      background: 'rgba(245, 230, 200, 0.04)',
                      color: exporting ? 'rgba(245, 230, 200, 0.4)' : 'rgba(245, 230, 200, 0.7)',
                      fontSize: 13,
                      cursor: exporting ? 'wait' : 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    {exporting ? 'Exporting...' : 'Export My Data'}
                  </button>

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
                      marginBottom: 10,
                    }}
                  >
                    Sign Out
                  </button>

                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid rgba(252, 80, 80, 0.3)',
                      background: 'rgba(252, 80, 80, 0.08)',
                      color: deleting ? 'rgba(252, 80, 80, 0.4)' : 'rgba(252, 80, 80, 0.9)',
                      fontSize: 13,
                      cursor: deleting ? 'wait' : 'pointer',
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Delete Account'}
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
                Enter your big three for personalized transits. Don&apos;t know yours? Look up your chart at cafeastrology.com
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
              ) : loading ? (
                <div style={{
                  textAlign: 'center',
                  padding: 24,
                  color: 'rgba(245, 230, 200, 0.4)',
                }}>
                  Loading...
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
                    YOUR SIGNS
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontFamily: "'Cormorant Garamond', serif",
                    color: 'rgba(245, 230, 200, 0.4)',
                    marginBottom: 16,
                    fontStyle: 'italic',
                  }}>
                    Sun and moon are enough. Rising is a bonus if you know it.{' '}
                    <a
                      href="https://horoscopes.astro-seek.com/birth-chart-horoscope-online"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'rgba(167, 139, 250, 0.6)', textDecoration: 'none' }}
                    >
                      Find yours →
                    </a>
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
                      ↑ RISING SIGN (optional · how others see you)
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

                  {/* Hemisphere */}
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'rgba(167, 139, 250, 0.7)',
                    marginBottom: 12,
                    marginTop: 24,
                    letterSpacing: '0.1em',
                  }}>
                    YOUR LOCATION
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(245, 230, 200, 0.4)',
                      marginBottom: 6,
                    }}>
                      🌍 HEMISPHERE (for accurate seasons)
                    </label>
                    <select
                      value={hemisphere}
                      onChange={e => setHemisphere(e.target.value)}
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
                      <option value="north">Northern Hemisphere</option>
                      <option value="south">Southern Hemisphere</option>
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

          {/* Privacy / Encryption Section */}
          {activeSection === 'privacy' && (
            <div>
              <div style={{ fontSize: 13, color: 'rgba(245, 230, 200, 0.6)', marginBottom: 20, lineHeight: 1.6 }}>
                End-to-end encryption protects your loops and echoes. Only your passphrase can decrypt them — even we can&apos;t read them.
              </div>

              {/* Status card */}
              <div style={{
                padding: 16, borderRadius: 12, marginBottom: 20,
                background: encStatus === 'unlocked'
                  ? 'rgba(52, 211, 153, 0.08)'
                  : encStatus === 'locked'
                  ? 'rgba(245, 200, 100, 0.08)'
                  : 'rgba(245, 230, 200, 0.04)',
                border: `1px solid ${encStatus === 'unlocked'
                  ? 'rgba(52, 211, 153, 0.2)'
                  : encStatus === 'locked'
                  ? 'rgba(245, 200, 100, 0.2)'
                  : 'rgba(245, 230, 200, 0.08)'}`,
              }}>
                <div style={{ fontSize: 12, color: encStatus === 'unlocked' ? 'rgba(52, 211, 153, 0.9)' : encStatus === 'locked' ? 'rgba(245, 200, 100, 0.9)' : 'rgba(245, 230, 200, 0.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>●</span>
                  <span>{encStatus === 'unlocked' ? 'Encryption active — content is decrypted this session' : encStatus === 'locked' ? 'Encryption enabled — locked this session' : 'Encryption not enabled'}</span>
                </div>
              </div>

              {/* Setup form (disabled state) */}
              {encStatus === 'disabled' && user && (
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(245, 230, 200, 0.5)', marginBottom: 8, lineHeight: 1.6 }}>Choose a strong passphrase. You&apos;ll need it every time you open the app.</div>
                  <div style={{ padding: '10px 12px', marginBottom: 12, background: 'rgba(252, 129, 129, 0.08)', border: '1px solid rgba(252, 129, 129, 0.2)', borderRadius: 8, fontSize: 12, color: 'rgba(252, 129, 129, 0.8)', lineHeight: 1.6 }}>
                    If you forget your passphrase, your encrypted content cannot be recovered — not by you, not by us. There is no reset. Write it down somewhere safe.
                  </div>
                  <input
                    type="password"
                    placeholder="Passphrase"
                    value={encPassphrase}
                    onChange={e => { setEncPassphrase(e.target.value); setEncError(''); }}
                    style={{ width: '100%', padding: '11px 14px', marginBottom: 10, background: 'rgba(245,230,200,0.03)', border: '1px solid rgba(245,230,200,0.1)', borderRadius: 8, color: '#f5e6c8', fontSize: 14, outline: 'none' }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm passphrase"
                    value={encConfirm}
                    onChange={e => { setEncConfirm(e.target.value); setEncError(''); }}
                    style={{ width: '100%', padding: '11px 14px', marginBottom: 12, background: 'rgba(245,230,200,0.03)', border: '1px solid rgba(245,230,200,0.1)', borderRadius: 8, color: '#f5e6c8', fontSize: 14, outline: 'none' }}
                  />
                  {encError && <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(252,129,129,0.1)', border: '1px solid rgba(252,129,129,0.3)', borderRadius: 6, color: 'rgba(252,129,129,0.9)', fontSize: 12 }}>{encError}</div>}
                  <button
                    disabled={encLoading}
                    onClick={async () => {
                      if (encPassphrase.length < 4) { setEncError('Passphrase must be at least 4 characters'); return; }
                      if (encPassphrase !== encConfirm) { setEncError('Passphrases do not match'); return; }
                      setEncLoading(true);
                      try {
                        await setupEncryption(encPassphrase, user.id);
                        setEncPassphrase('');
                        setEncConfirm('');
                      } catch (e) {
                        setEncError(e.message);
                      }
                      setEncLoading(false);
                    }}
                    style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'rgba(245,230,200,0.08)', color: '#f5e6c8', fontSize: 13, cursor: encLoading ? 'wait' : 'pointer' }}
                  >
                    {encLoading ? 'Setting up...' : 'Enable encryption'}
                  </button>
                </div>
              )}

              {/* Unlocked state */}
              {encStatus === 'unlocked' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => { lock(); onClose(); }}
                    style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(245,230,200,0.1)', background: 'rgba(245,230,200,0.04)', color: 'rgba(245,230,200,0.7)', fontSize: 13, cursor: 'pointer' }}
                  >
                    Lock session
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Disable encryption? Future content will be stored unencrypted. Existing encrypted content will remain unreadable without re-enabling.')) return;
                      await disableEncryption(user?.id);
                    }}
                    style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(252,129,129,0.2)', background: 'rgba(252,129,129,0.05)', color: 'rgba(252,129,129,0.7)', fontSize: 13, cursor: 'pointer' }}
                  >
                    Disable encryption
                  </button>
                </div>
              )}

              {/* Locked state */}
              {encStatus === 'locked' && (
                <div style={{ fontSize: 12, color: 'rgba(245,230,200,0.45)', lineHeight: 1.7 }}>
                  Your content is encrypted. Re-open the app to be prompted for your passphrase, or close and reopen this menu.
                </div>
              )}
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifs' && (
            <div>
              <div style={{
                fontSize: 13,
                color: 'rgba(245, 230, 200, 0.6)',
                marginBottom: 20,
                lineHeight: 1.6,
              }}>
                Get notified before phase transitions so you can prepare.
              </div>

              {/* Enable Notifications */}
              <div style={{
                padding: 16,
                borderRadius: 12,
                background: notifPrefs.enabled
                  ? 'rgba(52, 211, 153, 0.08)'
                  : 'rgba(245, 230, 200, 0.04)',
                border: `1px solid ${notifPrefs.enabled
                  ? 'rgba(52, 211, 153, 0.2)'
                  : 'rgba(245, 230, 200, 0.08)'}`,
                marginBottom: 16,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      fontSize: 14,
                      color: '#f5e6c8',
                      marginBottom: 4,
                    }}>
                      Enable Notifications
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(245, 230, 200, 0.4)',
                    }}>
                      {canNotify() ? 'Notifications allowed' : 'Permission needed'}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!notifPrefs.enabled) {
                        if (!('Notification' in window)) {
                          alert('Notifications are not supported on this browser.');
                          return;
                        }
                        if (Notification.permission === 'denied') {
                          alert('Notifications are blocked. Please enable them in your browser or device settings, then try again.');
                          return;
                        }
                        const granted = await requestPermission();
                        if (granted) {
                          const newPrefs = { ...notifPrefs, enabled: true };
                          setNotifPrefs(newPrefs);
                          saveNotificationPrefs(newPrefs);
                        } else {
                          alert('Notification permission was not granted. Please check your browser settings.');
                        }
                      } else {
                        const newPrefs = { ...notifPrefs, enabled: false };
                        setNotifPrefs(newPrefs);
                        saveNotificationPrefs(newPrefs);
                      }
                    }}
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      border: 'none',
                      background: notifPrefs.enabled
                        ? 'rgba(52, 211, 153, 0.4)'
                        : 'rgba(245, 230, 200, 0.15)',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: notifPrefs.enabled ? '#34D399' : 'rgba(245, 230, 200, 0.5)',
                      position: 'absolute',
                      top: 3,
                      left: notifPrefs.enabled ? 25 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>

              {/* Notification Types */}
              {notifPrefs.enabled && (
                <>
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'rgba(245, 230, 200, 0.4)',
                    marginBottom: 12,
                    letterSpacing: '0.1em',
                  }}>
                    NOTIFY ME FOR
                  </div>

                  {/* New Cycle */}
                  <NotifToggle
                    label="New Lunar Cycle"
                    sublabel="24h before new moon"
                    checked={notifPrefs.newCycle}
                    onChange={(v) => {
                      const newPrefs = { ...notifPrefs, newCycle: v };
                      setNotifPrefs(newPrefs);
                      saveNotificationPrefs(newPrefs);
                    }}
                  />

                  {/* Threshold Phases */}
                  <NotifToggle
                    label="Threshold Phases"
                    sublabel="4h before (New, Quarter, Full)"
                    checked={notifPrefs.thresholdPhases}
                    onChange={(v) => {
                      const newPrefs = { ...notifPrefs, thresholdPhases: v };
                      setNotifPrefs(newPrefs);
                      saveNotificationPrefs(newPrefs);
                    }}
                  />

                  {/* Flow Phases */}
                  <NotifToggle
                    label="Flow Phases"
                    sublabel="8h before (Crescent, Gibbous)"
                    checked={notifPrefs.flowPhases}
                    onChange={(v) => {
                      const newPrefs = { ...notifPrefs, flowPhases: v };
                      setNotifPrefs(newPrefs);
                      saveNotificationPrefs(newPrefs);
                    }}
                  />
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
                <LunaLogo variant="wordmark" width={200} style={{ marginBottom: 4 }} />
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

              {/* Guide / Tutorial */}
              {onOpenTutorial && (
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {IS_V2 && (
                    <button
                      onClick={() => { onOpenTutorial('guide'); onClose(); }}
                      style={{
                        width: '100%', padding: '12px 16px',
                        borderRadius: 10, border: '1px solid rgba(245,230,200,0.1)',
                        background: 'rgba(245,230,200,0.04)',
                        color: 'rgba(245,230,200,0.7)',
                        fontSize: 13, cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>◎</span>
                      <span>App Guide</span>
                    </button>
                  )}
                  <button
                    onClick={() => { onOpenTutorial('phases'); onClose(); }}
                    style={{
                      width: '100%', padding: '12px 16px',
                      borderRadius: 10, border: '1px solid rgba(245,230,200,0.1)',
                      background: 'rgba(245,230,200,0.04)',
                      color: 'rgba(245,230,200,0.7)',
                      fontSize: 13, cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>☽</span>
                    <span>Phase Guide</span>
                  </button>
                </div>
              )}

              {/* Feedback */}
              <div style={{ marginTop: 32 }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                  color: 'rgba(245, 230, 200, 0.35)',
                  marginBottom: 10,
                }}>
                  SHARE FEEDBACK
                </div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="What's working? What's missing? What feels off?"
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'rgba(245, 230, 200, 0.03)',
                    border: '1px solid rgba(245, 230, 200, 0.1)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: '#f5e6c8',
                    fontSize: 13,
                    fontFamily: "'Cormorant Garamond', serif",
                    lineHeight: 1.6,
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackText.trim() || feedbackSending}
                  style={{
                    width: '100%',
                    marginTop: 10,
                    padding: '12px',
                    borderRadius: 10,
                    border: '1px solid rgba(245, 230, 200, 0.15)',
                    background: feedbackSent
                      ? 'rgba(52, 211, 153, 0.1)'
                      : feedbackText.trim()
                        ? 'rgba(245, 230, 200, 0.08)'
                        : 'transparent',
                    color: feedbackSent
                      ? 'rgba(52, 211, 153, 0.9)'
                      : feedbackText.trim()
                        ? '#f5e6c8'
                        : 'rgba(245, 230, 200, 0.3)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    cursor: feedbackText.trim() && !feedbackSending ? 'pointer' : 'default',
                    transition: 'all 0.3s',
                  }}
                >
                  {feedbackSent ? '✓ SENT' : feedbackSending ? '...' : 'SEND'}
                </button>
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

// Toggle component for notification settings
function NotifToggle({ label, sublabel, checked, onChange }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid rgba(245, 230, 200, 0.06)',
    }}>
      <div>
        <div style={{
          fontSize: 13,
          color: 'rgba(245, 230, 200, 0.8)',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(245, 230, 200, 0.35)',
          marginTop: 2,
        }}>
          {sublabel}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          background: checked
            ? 'rgba(167, 139, 250, 0.4)'
            : 'rgba(245, 230, 200, 0.1)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          background: checked ? '#A78BFA' : 'rgba(245, 230, 200, 0.4)',
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}
