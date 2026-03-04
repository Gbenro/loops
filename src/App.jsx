// Cosmic Loops - Main App Shell
// Tab navigation between Sky, Loops, and Echoes

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { migrateLocalToServer, getLoops, getEchoes } from './lib/storage.js';
import { getSessionPhrases, FALLBACK_PHRASES, clearPhraseCache, isCacheStale } from './lib/language.js';
import { getLunarData } from './lib/lunar.js';
import { getSolarData } from './lib/solar.js';
import { Sky } from './tabs/Sky.jsx';
import { Loops } from './tabs/Loops.jsx';
import { Echoes } from './tabs/Echoes.jsx';
import { AuthModal } from './components/AuthModal.jsx';

const TABS = [
  { id: 'sky', label: 'Sky', icon: '☽' },
  { id: 'loops', label: 'Loops', icon: '◯' },
  { id: 'echoes', label: 'Echoes', icon: '〜' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sky');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phrases, setPhrases] = useState(FALLBACK_PHRASES);
  const [phrasesLoading, setPhrasesLoading] = useState(true);
  const [loops, setLoops] = useState([]);
  const [echoes, setEchoes] = useState([]);

  // Calculate cosmic data once at app level
  const lunarData = useMemo(() => getLunarData(), []);
  const solarData = useMemo(() => getSolarData(), []);

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
    }
  }, [user]);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleAuthSuccess = async (newUser) => {
    setUser(newUser);
    setShowAuth(false);
    // Migrate any local data to server
    await migrateLocalToServer(newUser.id);
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
      </nav>
      </div>
    </div>
  );
}
