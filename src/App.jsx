// Luna Loops - Main App Shell
// Tab navigation between Sky, Loops, and Echoes

const IS_V2 = import.meta.env.VITE_APP_VERSION === 'v2';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { migrateLocalToServer, getLoops, getEchoes } from './lib/storage.js';
import { getSessionPhrases, FALLBACK_PHRASES, clearPhraseCache, isCacheStale } from './lib/language.js';
import { getLunarData } from './lib/lunar.js';
import { getSolarData } from './lib/solar.js';
import { detectLocation, getCachedLocation, hemisphereFromLat } from './lib/location.js';
import { startNotificationScheduler, checkPhaseNotifications } from './lib/notifications.js';
import { Sky } from './tabs/Sky.jsx';
import { Loops } from './tabs/Loops.jsx';
import { Echoes } from './tabs/Echoes.jsx';
import { AuthModal, PrivacyNotice } from './components/AuthModal.jsx';
import { AdminDashboard } from './components/AdminDashboard.jsx';
import { Tutorial } from './components/Tutorial.jsx';
import { useEncryption } from './lib/EncryptionContext.jsx';

const TABS = [
  { id: 'sky', label: 'Sky', icon: '☽' },
  { id: 'loops', label: 'Loops', icon: '◯' },
  { id: 'echoes', label: 'Echoes', icon: '〜' },
];

function UnlockModal({ verifyToken, userId }) {
  const { unlock } = useEncryption();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const ok = await unlock(passphrase, userId, verifyToken);
    if (!ok) setError('Wrong passphrase');
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(4, 8, 16, 0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: '#0a0f18',
        border: '1px solid rgba(245, 230, 200, 0.1)',
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, color: '#f5e6c8', marginBottom: 6,
          }}>Encrypted content</div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace',
            color: 'rgba(245, 230, 200, 0.35)', letterSpacing: '0.08em',
          }}>ENTER PASSPHRASE TO DECRYPT</div>
        </div>
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            autoFocus
            required
            style={{
              width: '100%', padding: '12px 14px', marginBottom: 12,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px solid rgba(245, 230, 200, 0.1)',
              borderRadius: 8, color: '#f5e6c8', fontSize: 14, outline: 'none',
            }}
          />
          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 12,
              background: 'rgba(252, 129, 129, 0.1)',
              border: '1px solid rgba(252, 129, 129, 0.3)',
              borderRadius: 6, color: 'rgba(252, 129, 129, 0.9)', fontSize: 12,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px',
            background: 'rgba(245, 230, 200, 0.08)',
            border: '1px solid rgba(245, 230, 200, 0.15)',
            borderRadius: 8, color: '#f5e6c8', fontSize: 13,
            cursor: loading ? 'wait' : 'pointer',
          }}>
            {loading ? '...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Detect iOS (no beforeinstallprompt support)
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

// Check if already running as installed PWA
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function InstallBanner({ onDismiss, deferredPrompt }) {
  const ios = isIOS();
  const mobile = isMobile();

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    }
    onDismiss();
  };

  const title = ios ? 'Add to Home Screen' : mobile ? 'Add to your home screen' : 'Install as an app';
  const body = ios
    ? 'Tap the share icon in Safari, then "Add to Home Screen" for the full experience.'
    : mobile
    ? 'Install Lunar Loops for quick access and a distraction-free experience.'
    : 'Install Lunar Loops to your desktop for instant, distraction-free access.';

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      // Stay within the app's 520px container
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(calc(100% - 32px), 488px)',
      background: '#0e1420',
      border: '1px solid rgba(167, 139, 250, 0.25)',
      borderRadius: 16, padding: '16px 18px',
      zIndex: 500,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>☽</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 16, color: '#f5e6c8', marginBottom: 4,
          }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245, 230, 200, 0.5)', lineHeight: 1.5, marginBottom: 12 }}>
            {body}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!ios && deferredPrompt && (
              <button
                onClick={handleInstall}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(167, 139, 250, 0.2)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  color: '#c4b5fd', fontSize: 12, cursor: 'pointer',
                }}
              >
                Install
              </button>
            )}
            <button
              onClick={onDismiss}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(245, 230, 200, 0.1)',
                color: 'rgba(245, 230, 200, 0.4)', fontSize: 12, cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BetaGate({ onSignOut }) {
  return (
    <div style={{
      height: '100dvh', background: '#040810',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, flexDirection: 'column', textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 20 }}>☽</div>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 26, color: '#f5e6c8', marginBottom: 12,
      }}>
        Luna Loops v2
      </div>
      <div style={{
        fontSize: 14, color: 'rgba(245,230,200,0.5)',
        lineHeight: 1.8, maxWidth: 280, marginBottom: 32,
      }}>
        This version is in private beta. You're on the list — we'll be in touch when your access is ready.
      </div>
      <button
        onClick={onSignOut}
        style={{
          background: 'none', border: '1px solid rgba(245,230,200,0.15)',
          borderRadius: 8, color: 'rgba(245,230,200,0.4)',
          fontSize: 11, fontFamily: 'monospace', padding: '10px 20px',
          cursor: 'pointer', letterSpacing: '0.08em',
        }}
      >
        SIGN OUT
      </button>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('sky');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [phrases, setPhrases] = useState(FALLBACK_PHRASES);
  const [phrasesLoading, setPhrasesLoading] = useState(true);
  const [loops, setLoops] = useState([]);
  const [echoes, setEchoes] = useState([]);

  const { initFromProfile, status: encryptionStatus } = useEncryption();

  // Location state — seeded from cache immediately, then updated from GPS
  const [location, setLocation] = useState(() => getCachedLocation());

  // Calculate cosmic data once at app level
  const lunarData = useMemo(() => getLunarData(), []);
  // Hemisphere priority: live GPS > profile setting > default north
  const hemisphere = location?.hemisphere
    || (userProfile?.latitude != null ? hemisphereFromLat(userProfile.latitude) : null)
    || userProfile?.hemisphere
    || 'north';
  const solarData = useMemo(() => getSolarData(new Date(), hemisphere), [hemisphere]);

  // Fetch loops and echoes for phase summaries
  const refreshLoopsAndEchoes = useCallback(async () => {
    const [loopsData, echoesData] = await Promise.all([
      getLoops(user?.id),
      getEchoes(user?.id),
    ]);
    setLoops(loopsData);
    setEchoes(echoesData);
  }, [user?.id]);

  useEffect(() => {
    refreshLoopsAndEchoes();
  }, [refreshLoopsAndEchoes]);

  // Fetch user profile when user changes
  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
    } else {
      setUserProfile(null);
      initFromProfile(null);
    }
  }, [user, initFromProfile]);

  // Init encryption when profile loads (only after auth check completes)
  useEffect(() => {
    if (!loading) {
      initFromProfile(userProfile);
    }
  }, [userProfile, initFromProfile, loading]);

  const checkAccess = async (userEmail) => {
    if (!userEmail) { setAccessStatus('denied'); return; }
    const { data, error } = await supabase.rpc('check_my_access');
    if (error) {
      console.error('checkAccess error:', error);
      // On V1, fail open; on V2, fail closed
      setAccessStatus(IS_V2 ? 'denied' : 'allowed');
      setIsAdmin(false);
      return;
    }
    if (data) {
      setAccessStatus('allowed');
      setIsAdmin(data === 'admin');
    } else {
      // Not on allowlist: V1 still lets them in, V2 gates them
      setAccessStatus(IS_V2 ? 'denied' : 'allowed');
      setIsAdmin(false);
    }
  };

  const fetchProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setUserProfile(data);
    } catch (e) {
      // No profile yet
      setUserProfile(null);
    }
  };

  // Check auth state on mount
  useEffect(() => {
    const init = async () => {
      // If tokens are in URL hash (from version switcher), restore session explicitly
      const hash = window.location.hash;
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          // Clean the tokens from the URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user || null;
      setUser(u);
      setLoading(false);
      if (u) checkAccess(u.email);
      else setAccessStatus('allowed');
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        checkAccess(u.email);
        const key = `privacy_ack_${u.id}`;
        if (!localStorage.getItem(key)) setShowPrivacyNotice(true);
      } else {
        setAccessStatus('allowed');
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-show tutorial on first launch (V2 only)
  useEffect(() => {
    if (!loading && IS_V2 && !localStorage.getItem('tutorial_completed')) {
      setShowTutorial(true);
    }
  }, [loading]);

  // Detect precise location for accurate hemisphere + future moonrise/set
  useEffect(() => {
    detectLocation().then(async (loc) => {
      if (!loc) return;
      setLocation(loc);

      // Save to Supabase profile if logged in and data changed
      if (user) {
        const profile = userProfile;
        const sameHemisphere = profile?.hemisphere === loc.hemisphere;
        const sameCoords = Math.abs((profile?.latitude || 0) - loc.latitude) < 0.1
          && Math.abs((profile?.longitude || 0) - loc.longitude) < 0.1;
        if (!sameHemisphere || !sameCoords) {
          await supabase.from('profiles').upsert({
            id: user.id,
            hemisphere: loc.hemisphere,
            latitude: loc.latitude,
            longitude: loc.longitude,
            timezone: loc.timezone,
          });
        }
      }
    });
  }, [user?.id]);

  // Load generative phrases on mount
  useEffect(() => {
    // Check if cache is stale (phase changed)
    if (isCacheStale(lunarData.phase.name)) {
      clearPhraseCache();
    }

    getSessionPhrases(lunarData, solarData).then(p => {
      setPhrases(p);
      setPhrasesLoading(false);
    });
  }, [lunarData, solarData]);

  // Capture install prompt event before it fires automatically
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Start notification scheduler
  useEffect(() => {
    // Check notifications on load
    checkPhaseNotifications(lunarData);
    // Start periodic checks
    const cleanup = startNotificationScheduler(() => getLunarData());
    return cleanup;
  }, [lunarData]);

  const handleAuthSuccess = async (newUser) => {
    setUser(newUser);
    setShowAuth(false);
    // Show privacy notice for new email sign-ups
    const key = `privacy_ack_${newUser.id}`;
    if (!localStorage.getItem(key)) {
      setShowPrivacyNotice(true);
    }
    // Migrate any local data to server
    await migrateLocalToServer(newUser.id);
  };

  const handlePrivacyAck = () => {
    if (user) localStorage.setItem(`privacy_ack_${user.id}`, '1');
    setShowPrivacyNotice(false);
    // Show install prompt after privacy notice if not already installed/dismissed
    if (!isInStandaloneMode() && !localStorage.getItem('install_dismissed')) {
      // Small delay so it doesn't overlap with the notice dismissal
      setTimeout(() => setShowInstallBanner(true), 600);
    }
  };

  const handleInstallDismiss = () => {
    localStorage.setItem('install_dismissed', '1');
    setShowInstallBanner(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        height: '100dvh',
        background: '#040810',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f5e6c8',
        fontSize: 24,
      }}>
        ☽
      </div>
    );
  }

  // Beta gate: user is signed in but not on the allowlist
  if (user && accessStatus === 'denied') {
    return (
      <div style={{ minHeight: '100dvh', background: '#040810', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <BetaGate onSignOut={handleSignOut} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#040810',
      display: 'flex',
      justifyContent: 'center',
    }}>
      {/* App Container - max width for desktop */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        height: '100dvh',
        background: '#040810',
        color: '#f5e6c8',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.3)',
      }}>
      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          /* Base font sizes - larger for accessibility */
          --font-xs: 11px;
          --font-sm: 13px;
          --font-md: 15px;
          --font-lg: 18px;
          --font-xl: 22px;
          --font-2xl: 28px;
          --font-3xl: 32px;
        }

        /* Larger fonts on desktop for better readability */
        @media (min-width: 768px) {
          :root {
            --font-xs: 12px;
            --font-sm: 14px;
            --font-md: 16px;
            --font-lg: 20px;
            --font-xl: 26px;
            --font-2xl: 32px;
            --font-3xl: 38px;
          }
        }

        * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        html, body, #root {
          height: 100%;
        }

        body {
          margin: 0;
          padding: 0;
          overscroll-behavior: none;
          background: #040810;
          color: #f5e6c8;
        }

        input, textarea, button {
          font-family: inherit;
        }

        input::placeholder, textarea::placeholder {
          color: rgba(245, 230, 200, 0.35);
          font-style: italic;
        }

        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar {
          width: 4px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(245, 230, 200, 0.15);
          border-radius: 2px;
        }

        /* Safe area for notched phones */
        @supports (padding-top: env(safe-area-inset-top)) {
          body {
            padding-top: env(safe-area-inset-top);
          }
        }
      `}</style>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Privacy Notice — shown once to new users (email or OAuth) */}
      {showPrivacyNotice && (
        <PrivacyNotice onAck={handlePrivacyAck} />
      )}

      {/* Encryption unlock — shown when user has encryption set up but session key missing */}
      {encryptionStatus === 'locked' && userProfile?.encryption_verify_token && (
        <UnlockModal verifyToken={userProfile.encryption_verify_token} userId={user?.id} />
      )}

      {/* PWA install banner */}
      {showInstallBanner && (
        <InstallBanner
          onDismiss={handleInstallDismiss}
          deferredPrompt={deferredInstallPrompt}
        />
      )}

      {/* Admin Dashboard */}
      {isAdmin && showAdmin && (
        <AdminDashboard
          isOpen={showAdmin}
          onClose={() => setShowAdmin(false)}
          currentUserEmail={user?.email}
        />
      )}

      {/* Tab Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        position: 'relative',
      }}>
        {activeTab === 'sky' && (
          <Sky
            user={user}
            userProfile={userProfile}
            onProfileUpdate={() => fetchProfile(user?.id)}
            onSignIn={() => setShowAuth(true)}
            onSignOut={handleSignOut}
            onSwitchToEchoes={() => setActiveTab('echoes')}
            phrases={phrases}
            phrasesLoading={phrasesLoading}
            lunarData={lunarData}
            solarData={solarData}
            loops={loops}
            echoes={echoes}
            onOpenTutorial={IS_V2 ? () => setShowTutorial(true) : undefined}
          />
        )}
        {activeTab === 'loops' && (
          <Loops
            userId={user?.id}
            phrases={phrases}
            phrasesLoading={phrasesLoading}
          />
        )}
        {activeTab === 'echoes' && (
          <Echoes
            userId={user?.id}
            phrases={phrases}
            phrasesLoading={phrasesLoading}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav style={{
        flexShrink: 0,
        display: 'flex',
        borderTop: '1px solid rgba(245, 230, 200, 0.06)',
        background: '#040810',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tutorial={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '16px 0 12px',
                background: 'none',
                border: 'none',
                color: isActive ? '#f5e6c8' : 'rgba(245, 230, 200, 0.26)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: 26,
                filter: isActive ? 'none' : 'grayscale(100%)',
                transition: 'filter 0.2s',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 'var(--font-xs)',
                fontFamily: 'monospace',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
        {/* Version badge — only shown on V2 */}
        {IS_V2 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 10px',
            color: 'rgba(167,139,250,0.35)',
            fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.1em',
            userSelect: 'none',
          }}>
            V2
          </div>
        )}
        {isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            style={{
              padding: '16px 14px 12px',
              background: 'none', border: 'none',
              color: 'rgba(167,139,250,0.4)',
              cursor: 'pointer', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 6,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em' }}>ADMIN</span>
          </button>
        )}
      </nav>

      {/* Tutorial — V2 only, mounts outside overflow:hidden container */}
      {IS_V2 && showTutorial && (
        <Tutorial
          activeTab={activeTab}
          onSwitchTab={setActiveTab}
          onClose={() => {
            localStorage.setItem('tutorial_completed', 'true');
            setShowTutorial(false);
          }}
        />
      )}
      </div>
    </div>
  );
}
