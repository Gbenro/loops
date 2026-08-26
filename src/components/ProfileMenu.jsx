// Luna Loops - Profile Menu
// Account settings and birth data input

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  requestPermission,
  canNotify,
  getNotificationPrefs,
  saveNotificationPrefs,
} from '../lib/notifications.js';
import { useEncryption } from '../lib/EncryptionContext.jsx';
import { LunaLogo } from './LunaLogo.jsx';
import { useOnboarding } from './Onboarding/index.js';
import { seedAllData, clearAllData } from '../lib/seedData.js';
import { ThemeToggle } from './ThemeToggle.jsx';

const IS_V2 = true;

export function ProfileMenu({ isOpen, onClose, user, onSignOut, onProfileUpdate, onOpenTutorial }) {
  const [activeSection, setActiveSection] = useState('account');
  const [_profile, setProfile] = useState(null); // Profile state for future display
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevTools, setShowDevTools] = useState(import.meta.env.DEV);

  // Zodiac signs form
  const [sunSign, setSunSign] = useState('');
  const [moonSign, setMoonSign] = useState('');
  const [risingSign, setRisingSign] = useState('');
  const [hemisphere, setHemisphere] = useState('north');

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState(getNotificationPrefs());

  // Encryption
  const {
    status: encStatus,
    setupEncryption,
    disableEncryption,
    lock,
    decryptField,
    sessionKey,
  } = useEncryption();

  // Onboarding
  const { resetOnboarding } = useOnboarding();
  const [encPassphrase, setEncPassphrase] = useState('');
  const [encConfirm, setEncConfirm] = useState('');
  const [encError, setEncError] = useState('');
  const [encLoading, setEncLoading] = useState(false);

  const ZODIAC_SIGNS = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];

  const [digestStats, setDigestStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const getMoonEmoji = (phaseName) => {
    const name = (phaseName || '').toLowerCase();
    if (name.includes('new')) return '🌑';
    if (name.includes('waxing crescent')) return '🌒';
    if (name.includes('first quarter')) return '🌓';
    if (name.includes('waxing gibbous')) return '🌔';
    if (name.includes('full')) return '🌕';
    if (name.includes('waning gibbous')) return '🌖';
    if (name.includes('last quarter') || name.includes('third quarter')) return '🌗';
    if (name.includes('waning crescent')) return '🌘';
    return '🌙';
  };

  const loadDigestStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const [echoesRes, loopsRes] = await Promise.all([
        supabase
          .from('echoes')
          .select('source, lunar_month, phase_name, tags')
          .eq('user_id', user.id)
          .is('deleted_at', null),
        supabase
          .from('loops')
          .select('id, title, status')
          .eq('user_id', user.id)
          .is('deleted_at', null),
      ]);

      const echoes = echoesRes.data || [];
      const loops = loopsRes.data || [];

      // Unique moons
      const uniqueMoons = [...new Set(echoes.map((e) => e.lunar_month).filter(Boolean))];

      // Voice vs Text
      const voiceCount = echoes.filter((e) => e.source === 'voice').length;
      const textCount = echoes.filter((e) => e.source === 'text').length;

      // Tags frequency
      const tagFreq = {};
      echoes.forEach((e) => {
        let tagArray = [];
        try {
          tagArray = typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags;
        } catch (_) {
          tagArray = Array.isArray(e.tags) ? e.tags : [];
        }
        if (Array.isArray(tagArray)) {
          tagArray.forEach((t) => {
            tagFreq[t] = (tagFreq[t] || 0) + 1;
          });
        }
      });
      const topTags = Object.entries(tagFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      // Phase frequency
      const phaseFreq = {};
      echoes.forEach((e) => {
        const name = e.phase_name || 'Unknown';
        phaseFreq[name] = (phaseFreq[name] || 0) + 1;
      });
      const topPhases = Object.entries(phaseFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([phase, count]) => ({ phase, count }));

      setDigestStats({
        totalEchoes: echoes.length,
        voiceCount,
        textCount,
        uniqueMoonsCount: uniqueMoons.length,
        uniqueMoonsList: uniqueMoons,
        topTags,
        topPhases,
        loopsCount: loops.length,
        activeLoopsCount: loops.filter((l) => l.status === 'active').length,
      });
    } catch (e) {
      console.error('Error loading digest stats:', e);
    }
    setStatsLoading(false);
  };

  // Load profile on open
  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
      loadDigestStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (!error && data) {
        setProfile(data);
        setSunSign(data.sun_sign || '');
        setMoonSign(data.moon_sign || '');
        setRisingSign(data.rising_sign || '');
        setHemisphere(data.hemisphere || 'north');
      }
    } catch (_e) {
      // Profile not found yet
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

      const { error } = await supabase.from('profiles').upsert(profileData);

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

      // Decrypt echoes if encrypted and sessionKey is present
      const decryptedEchoes = await Promise.all(
        (echoesRes.data || []).map(async (echo) => {
          if (echo.is_encrypted && sessionKey) {
            try {
              const plainText = await decryptField(echo.text);
              return { ...echo, text: plainText, is_decrypted_in_export: true };
            } catch (err) {
              console.error('Could not decrypt echo during backup export:', echo.id, err);
            }
          }
          return echo;
        })
      );

      const exportData = {
        exportedAt: new Date().toISOString(),
        email: user.email,
        profile: profileRes.data || null,
        loops: loopsRes.data || [],
        echoes: decryptedEchoes,
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cosmic-loops-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Could not export backup. Please try again.');
    }
    setExporting(false);
  };

  const handleExportMarkdown = async () => {
    if (!user) return;
    setExporting(true);

    try {
      // Fetch echoes
      const [, echoesRes] = await Promise.all([
        supabase
          .from('loops')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('echoes')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      const echoes = await Promise.all(
        (echoesRes.data || []).map(async (echo) => {
          let text = echo.text;
          if (echo.is_encrypted && sessionKey) {
            try {
              text = await decryptField(echo.text);
            } catch (_) {
              // ignore decryption failure
            }
          }
          return { ...echo, text };
        })
      );

      // Group echoes by lunar_month
      const groupedByMonth = {};
      echoes.forEach((echo) => {
        const month = echo.lunar_month || 'Seed/Transition Moon';
        if (!groupedByMonth[month]) groupedByMonth[month] = [];
        groupedByMonth[month].push(echo);
      });

      let md = `# Luna Loops Journal - Personal Reflections\n\n`;
      md += `Exported on: ${new Date().toLocaleDateString()}\n`;
      md += `Email: ${user.email}\n\n`;
      md += `*A collection of decrypted reflections recorded under the guidance of the moon.*\n\n---\n\n`;

      Object.entries(groupedByMonth).forEach(([month, monthEchoes]) => {
        md += `# ☽ ${month} Cycle\n\n`;

        // Sort echoes within this month chronologically
        const sorted = [...monthEchoes].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        sorted.forEach((echo) => {
          const dateStr = new Date(echo.created_at).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const phaseName = (echo.phase_name || echo.phase || '').toUpperCase();
          const zodiac = echo.zodiac ? `in ${echo.zodiac}` : '';
          const dayOfCycle = echo.day_of_cycle != null ? `· Day ${echo.day_of_cycle}` : '';

          let tags = '';
          if (echo.tags) {
            let tagArray = [];
            try {
              tagArray = typeof echo.tags === 'string' ? JSON.parse(echo.tags) : echo.tags;
            } catch (_) {
              tagArray = Array.isArray(echo.tags) ? echo.tags : [];
            }
            if (tagArray.length > 0) {
              tags = `\n*Tags: ${tagArray.map((t) => `#${t}`).join(', ')}*`;
            }
          }

          md += `### ${dateStr}\n`;
          md += `**${phaseName} ${zodiac} ${dayOfCycle}**${tags}\n\n`;
          md += `${echo.text}\n\n`;
          md += `---\n\n`;
        });
      });

      // Download as markdown
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luna-loops-journal-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Could not export journal. Please try again.');
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
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
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          background: 'var(--color-surface)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
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
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--color-border-mid)',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: '0 20px 16px',
            textAlign: 'center',
          }}
        >
          <div
            onClick={() => {
              const next = devTapCount + 1;
              setDevTapCount(next);
              if (next >= 5 && !showDevTools) {
                setShowDevTools(true);
                setDevTapCount(0);
              }
            }}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 24,
              color: 'var(--color-text)',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            Settings
          </div>
        </div>

        {/* Section tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '0 20px 16px',
          }}
        >
          {[
            { id: 'account', label: 'Account', icon: '◯' },
            { id: 'digest', label: 'Digest', icon: '✦' },
            { id: 'birth', label: 'Your Sky', icon: '⚝' },
            { id: 'notifs', label: 'Alerts', icon: '◉' },
            { id: 'privacy', label: 'Privacy', icon: '◎' },
            { id: 'about', label: 'About', icon: '✧' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              title={s.label}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: 10,
                border: 'none',
                background:
                  activeSection === s.id ? 'var(--color-border-mid)' : 'var(--color-input-bg)',
                color: activeSection === s.id ? 'var(--color-text)' : 'var(--color-text-muted)',
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
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 40px',
          }}
        >
          {/* Account Section */}
          {activeSection === 'account' && (
            <div>
              {user ? (
                <>
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      SIGNED IN AS
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--color-text)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {user.email}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'rgba(52, 211, 153, 0.06)',
                      border: '1px solid rgba(52, 211, 153, 0.15)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: 'rgba(52, 211, 153, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>●</span>
                      <span>Data synced to cloud</span>
                    </div>
                  </div>

                  {/* Data Management */}
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'var(--color-text-muted)',
                      marginBottom: 12,
                      letterSpacing: '0.1em',
                    }}
                  >
                    DATA MANAGEMENT
                  </div>

                  <button
                    onClick={handleExportMarkdown}
                    disabled={exporting}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--color-accent)',
                      background: 'var(--color-accent-bg)',
                      color: exporting ? 'var(--color-text-muted)' : 'var(--color-accent)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: exporting ? 'wait' : 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    {exporting ? 'Exporting...' : 'Export Journal (Markdown)'}
                  </button>

                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--color-border-mid)',
                      background: 'var(--color-input-bg)',
                      color: exporting ? 'var(--color-text-muted)' : 'var(--color-text)',
                      fontSize: 13,
                      cursor: exporting ? 'wait' : 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    {exporting ? 'Exporting...' : 'Export Backup (JSON)'}
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
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-focus)',
                  }}
                >
                  <p>Sign in to sync your data across devices</p>
                </div>
              )}

              {/* Dev Tools - Test Data (dev mode or tap 5x on Settings title) */}
              {showDevTools && (
                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(167, 139, 250, 0.5)',
                      marginBottom: 12,
                      letterSpacing: '0.1em',
                    }}
                  >
                    DEV TOOLS
                  </div>

                  <button
                    onClick={() => {
                      setSeeding(true);
                      setSeedResult(null);
                      try {
                        const result = seedAllData({ cycleCount: 3, clearExisting: true });
                        setSeedResult(
                          `Loaded ${result.loops.length} loops, ${result.echoes.length} echoes, ${result.rhythms.length} rhythms`
                        );
                      } catch (err) {
                        setSeedResult(`Error: ${err.message}`);
                      }
                      setSeeding(false);
                    }}
                    disabled={seeding}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      background: 'rgba(167, 139, 250, 0.08)',
                      color: seeding ? 'rgba(167, 139, 250, 0.4)' : 'rgba(167, 139, 250, 0.8)',
                      fontSize: 13,
                      cursor: seeding ? 'wait' : 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    {seeding ? 'Loading...' : 'Load Test Data (3 cycles)'}
                  </button>

                  <button
                    onClick={() => {
                      clearAllData();
                      setSeedResult('All test data cleared');
                    }}
                    style={{
                      width: '100%',
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--color-border-mid)',
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-dim)',
                      fontSize: 13,
                      cursor: 'pointer',
                      marginBottom: 10,
                    }}
                  >
                    Clear All Data
                  </button>

                  {seedResult && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'rgba(167, 139, 250, 0.6)',
                        fontFamily: 'monospace',
                        padding: '8px 12px',
                        background: 'rgba(167, 139, 250, 0.06)',
                        borderRadius: 8,
                      }}
                    >
                      {seedResult}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reflections Digest Section */}
          {activeSection === 'digest' && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-dim)',
                  marginBottom: 20,
                  lineHeight: 1.6,
                }}
              >
                A high-level view of your reflections and habits accumulated across all your cycles.
              </div>

              {!user ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-focus)',
                    fontStyle: 'italic',
                  }}
                >
                  Sign in to view your Reflections Digest
                </div>
              ) : statsLoading ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Calculating cosmic metrics...
                </div>
              ) : digestStats ? (
                <div>
                  {/* Total reflections card */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-light)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
                        {digestStats.totalEchoes}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: 'var(--color-text-muted)',
                          marginTop: 4,
                          letterSpacing: '0.05em',
                        }}
                      >
                        TOTAL REFLECTIONS
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-light)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
                        {digestStats.uniqueMoonsCount}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: 'var(--color-text-muted)',
                          marginTop: 4,
                          letterSpacing: '0.05em',
                        }}
                      >
                        MOONS EXPERIENCED
                      </div>
                    </div>
                  </div>

                  {/* Voice vs Text progress bar */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 8,
                      }}
                    >
                      <span>VOICE ({digestStats.voiceCount})</span>
                      <span>TEXT ({digestStats.textCount})</span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: 'var(--color-border-light)',
                        display: 'flex',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${digestStats.totalEchoes > 0 ? (digestStats.voiceCount / digestStats.totalEchoes) * 100 : 50}%`,
                          background: 'var(--color-accent)',
                        }}
                      />
                      <div
                        style={{
                          width: `${digestStats.totalEchoes > 0 ? (digestStats.textCount / digestStats.totalEchoes) * 100 : 50}%`,
                          background: 'var(--color-border-mid)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Lunar Phase Alignment */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 12,
                        letterSpacing: '0.05em',
                      }}
                    >
                      LUNAR ALIGNMENT (Most Active Phases)
                    </div>
                    {digestStats.topPhases.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-dim)',
                          fontStyle: 'italic',
                        }}
                      >
                        No reflections recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {digestStats.topPhases.map(({ phase, count }) => (
                          <div
                            key={phase}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 13,
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{getMoonEmoji(phase)}</span>
                              <span style={{ color: 'var(--color-text)' }}>{phase}</span>
                            </span>
                            <span
                              style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}
                            >
                              {count} {count === 1 ? 'reflection' : 'reflections'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Tags / Emotional Signature */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 12,
                        letterSpacing: '0.05em',
                      }}
                    >
                      TOP TAGS (Emotional Signatures)
                    </div>
                    {digestStats.topTags.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-dim)',
                          fontStyle: 'italic',
                        }}
                      >
                        No tags used yet. Add tags to your reflections to see them here!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {digestStats.topTags.map(({ tag, count }) => (
                          <span
                            key={tag}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 16,
                              background: 'var(--color-accent-bg)',
                              color: 'var(--color-accent)',
                              border: '1px solid var(--color-accent)',
                              fontSize: 12,
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            #{tag}
                            <span
                              style={{
                                opacity: 0.6,
                                fontSize: 10,
                                fontFamily: 'monospace',
                              }}
                            >
                              ({count})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Moons Experienced list */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 12,
                        letterSpacing: '0.05em',
                      }}
                    >
                      MOONS HISTORY
                    </div>
                    {digestStats.uniqueMoonsList.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-dim)',
                          fontStyle: 'italic',
                        }}
                      >
                        No moon history recorded.
                      </div>
                    ) : (
                      <div
                        style={{
                          maxHeight: 120,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {digestStats.uniqueMoonsList.map((moon) => (
                          <div key={moon} style={{ fontSize: 13, color: 'var(--color-text)' }}>
                            ☾ {moon}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  No reflections recorded yet.
                </div>
              )}
            </div>
          )}

          {/* Birth Data Section */}
          {activeSection === 'birth' && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-dim)',
                  marginBottom: 20,
                  lineHeight: 1.6,
                }}
              >
                Enter your big three for personalized transits. Don&apos;t know yours? Look up your
                chart at cafeastrology.com
              </div>

              {!user ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-focus)',
                    fontStyle: 'italic',
                  }}
                >
                  Sign in to save your zodiac signs
                </div>
              ) : loading ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 24,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Loading...
                </div>
              ) : (
                <>
                  {/* Big Three Header */}
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(167, 139, 250, 0.7)',
                      marginBottom: 12,
                      letterSpacing: '0.1em',
                    }}
                  >
                    YOUR SIGNS
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "'Cormorant Garamond', serif",
                      color: 'var(--color-text-muted)',
                      marginBottom: 16,
                      fontStyle: 'italic',
                    }}
                  >
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
                    <label
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      ☉ SUN SIGN (your core identity)
                    </label>
                    <select
                      value={sunSign}
                      onChange={(e) => setSunSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map((sign) => (
                        <option key={sign} value={sign}>
                          {sign}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Moon Sign */}
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      ☽ MOON SIGN (your emotional nature)
                    </label>
                    <select
                      value={moonSign}
                      onChange={(e) => setMoonSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map((sign) => (
                        <option key={sign} value={sign}>
                          {sign}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rising Sign */}
                  <div style={{ marginBottom: 24 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      ↑ RISING SIGN (optional · how others see you)
                    </label>
                    <select
                      value={risingSign}
                      onChange={(e) => setRisingSign(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 14,
                      }}
                    >
                      <option value="">Select...</option>
                      {ZODIAC_SIGNS.map((sign) => (
                        <option key={sign} value={sign}>
                          {sign}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hemisphere */}
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'rgba(167, 139, 250, 0.7)',
                      marginBottom: 12,
                      marginTop: 24,
                      letterSpacing: '0.1em',
                    }}
                  >
                    YOUR LOCATION
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      🌍 HEMISPHERE (for accurate seasons)
                    </label>
                    <select
                      value={hemisphere}
                      onChange={(e) => setHemisphere(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-border-mid)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
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
                      background: saving ? 'var(--color-border-light)' : 'rgba(167, 139, 250, 0.2)',
                      color: saving ? 'var(--color-text-muted)' : '#A78BFA',
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
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-dim)',
                  marginBottom: 20,
                  lineHeight: 1.6,
                }}
              >
                End-to-end encryption protects your loops and echoes. Only your passphrase can
                decrypt them — even we can&apos;t read them.
              </div>

              {/* Status card */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 20,
                  background:
                    encStatus === 'unlocked'
                      ? 'rgba(52, 211, 153, 0.08)'
                      : encStatus === 'locked'
                        ? 'rgba(245, 200, 100, 0.08)'
                        : 'var(--color-input-bg)',
                  border: `1px solid ${
                    encStatus === 'unlocked'
                      ? 'rgba(52, 211, 153, 0.2)'
                      : encStatus === 'locked'
                        ? 'rgba(245, 200, 100, 0.2)'
                        : 'var(--color-input-hover)'
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color:
                      encStatus === 'unlocked'
                        ? 'rgba(52, 211, 153, 0.9)'
                        : encStatus === 'locked'
                          ? 'rgba(245, 200, 100, 0.9)'
                          : 'var(--color-focus)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>●</span>
                  <span>
                    {encStatus === 'unlocked'
                      ? 'Encryption active — content is decrypted this session'
                      : encStatus === 'locked'
                        ? 'Encryption enabled — locked this session'
                        : 'Encryption not enabled'}
                  </span>
                </div>
              </div>

              {/* Setup form (disabled state) */}
              {encStatus === 'disabled' && user && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-focus)',
                      marginBottom: 8,
                      lineHeight: 1.6,
                    }}
                  >
                    Choose a strong passphrase. You&apos;ll need it every time you open the app.
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      marginBottom: 12,
                      background: 'rgba(252, 129, 129, 0.08)',
                      border: '1px solid rgba(252, 129, 129, 0.2)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'rgba(252, 129, 129, 0.8)',
                      lineHeight: 1.6,
                    }}
                  >
                    If you forget your passphrase, your encrypted content cannot be recovered — not
                    by you, not by us. There is no reset. Write it down somewhere safe.
                  </div>
                  <input
                    type="password"
                    placeholder="Passphrase"
                    value={encPassphrase}
                    onChange={(e) => {
                      setEncPassphrase(e.target.value);
                      setEncError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      marginBottom: 10,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: 8,
                      color: 'var(--color-text)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm passphrase"
                    value={encConfirm}
                    onChange={(e) => {
                      setEncConfirm(e.target.value);
                      setEncError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      marginBottom: 12,
                      background: 'var(--color-input-bg)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: 8,
                      color: 'var(--color-text)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  {encError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        marginBottom: 12,
                        background: 'rgba(252,129,129,0.1)',
                        border: '1px solid rgba(252,129,129,0.3)',
                        borderRadius: 6,
                        color: 'rgba(252,129,129,0.9)',
                        fontSize: 12,
                      }}
                    >
                      {encError}
                    </div>
                  )}
                  <button
                    disabled={encLoading}
                    onClick={async () => {
                      if (encPassphrase.length < 4) {
                        setEncError('Passphrase must be at least 4 characters');
                        return;
                      }
                      if (encPassphrase !== encConfirm) {
                        setEncError('Passphrases do not match');
                        return;
                      }
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
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text)',
                      fontSize: 13,
                      cursor: encLoading ? 'wait' : 'pointer',
                    }}
                  >
                    {encLoading ? 'Setting up...' : 'Enable encryption'}
                  </button>
                </div>
              )}

              {/* Unlocked state */}
              {encStatus === 'unlocked' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => {
                      lock();
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--color-border-light)',
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-dim)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Lock session
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          'Disable encryption? Future content will be stored unencrypted. Existing encrypted content will remain unreadable without re-enabling.'
                        )
                      )
                        return;
                      await disableEncryption(user?.id);
                    }}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid rgba(252,129,129,0.2)',
                      background: 'rgba(252,129,129,0.05)',
                      color: 'rgba(252,129,129,0.7)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Disable encryption
                  </button>
                </div>
              )}

              {/* Locked state */}
              {encStatus === 'locked' && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  Your content is encrypted. Re-open the app to be prompted for your passphrase, or
                  close and reopen this menu.
                </div>
              )}
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifs' && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-dim)',
                  marginBottom: 20,
                  lineHeight: 1.6,
                }}
              >
                Get notified before phase transitions so you can prepare.
              </div>

              {/* Enable Notifications */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: notifPrefs.enabled
                    ? 'rgba(52, 211, 153, 0.08)'
                    : 'var(--color-input-bg)',
                  border: `1px solid ${
                    notifPrefs.enabled ? 'rgba(52, 211, 153, 0.2)' : 'var(--color-input-hover)'
                  }`,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--color-text)',
                        marginBottom: 4,
                      }}
                    >
                      Enable Notifications
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                      }}
                    >
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
                          alert(
                            'Notifications are blocked. Please enable them in your browser or device settings, then try again.'
                          );
                          return;
                        }
                        const granted = await requestPermission();
                        if (granted) {
                          const newPrefs = { ...notifPrefs, enabled: true };
                          setNotifPrefs(newPrefs);
                          saveNotificationPrefs(newPrefs);
                        } else {
                          alert(
                            'Notification permission was not granted. Please check your browser settings.'
                          );
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
                        : 'var(--color-border-mid)',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: notifPrefs.enabled ? '#34D399' : 'var(--color-focus)',
                        position: 'absolute',
                        top: 3,
                        left: notifPrefs.enabled ? 25 : 3,
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* Notification Types */}
              {notifPrefs.enabled && (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: 'var(--color-text-muted)',
                      marginBottom: 12,
                      letterSpacing: '0.1em',
                    }}
                  >
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
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: 24,
                }}
              >
                <LunaLogo variant="wordmark" width={200} style={{ marginBottom: 4 }} />
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  v1.0.0
                </div>
              </div>

              {/* Theme Toggle */}
              <div
                style={{
                  marginBottom: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  THEME
                </div>
                <ThemeToggle />
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-dim)',
                  lineHeight: 1.8,
                  textAlign: 'center',
                }}
              >
                <p>Track your growth with lunar wisdom.</p>
                <p style={{ marginTop: 12 }}>Built with intention under many moons.</p>
              </div>

              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                  }}
                >
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
                      onClick={() => {
                        resetOnboarding();
                        onClose();
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-dim)',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>◎</span>
                      <span>How to Use</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onOpenTutorial('phases');
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--color-border-light)',
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-dim)',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>☽</span>
                    <span>Phase Guide</span>
                  </button>
                </div>
              )}

              {/* Feedback */}
              <div style={{ marginTop: 32 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    color: 'var(--text-secondary)',
                    marginBottom: 10,
                  }}
                >
                  SHARE FEEDBACK
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What's working? What's missing? What feels off?"
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'var(--color-input-bg)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: 'var(--color-text)',
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
                    border: '1px solid var(--color-border-mid)',
                    background: feedbackSent
                      ? 'rgba(52, 211, 153, 0.1)'
                      : feedbackText.trim()
                        ? 'var(--color-input-hover)'
                        : 'transparent',
                    color: feedbackSent
                      ? 'rgba(52, 211, 153, 0.9)'
                      : feedbackText.trim()
                        ? 'var(--color-text)'
                        : 'var(--color-text-muted)',
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border-light)',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            marginTop: 2,
          }}
        >
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
          background: checked ? 'rgba(167, 139, 250, 0.4)' : 'var(--color-border-light)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: checked ? '#A78BFA' : 'var(--color-text-muted)',
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}
