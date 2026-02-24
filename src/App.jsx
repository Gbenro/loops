// Cosmic Loops - Main App Shell
// Tab navigation between Sky, Loops, and Echoes

import { useState } from 'react';
import { Sky } from './tabs/Sky.jsx';
import { Loops } from './tabs/Loops.jsx';
import { Echoes } from './tabs/Echoes.jsx';

const TABS = [
  { id: 'sky', label: 'Sky', icon: '☽' },
  { id: 'loops', label: 'Loops', icon: '◯' },
  { id: 'echoes', label: 'Echoes', icon: '✧' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sky');

  return (
    <div style={{
      height: '100dvh',
      background: '#040810',
      color: '#f5e6c8',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');

        * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
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

        ::-webkit-scrollbar {
          width: 3px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(245, 230, 200, 0.1);
          border-radius: 2px;
        }

        /* Safe area for notched phones */
        @supports (padding-top: env(safe-area-inset-top)) {
          body {
            padding-top: env(safe-area-inset-top);
          }
        }
      `}</style>

      {/* Tab Content */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {activeTab === 'sky' && <Sky />}
        {activeTab === 'loops' && <Loops />}
        {activeTab === 'echoes' && <Echoes />}
      </div>

      {/* Bottom Navigation */}
      <nav style={{
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
                padding: '14px 0 10px',
                background: 'none',
                border: 'none',
                color: isActive ? '#f5e6c8' : 'rgba(245, 230, 200, 0.26)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: 22,
                filter: isActive ? 'none' : 'grayscale(100%)',
                transition: 'filter 0.2s',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 9,
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
  );
}
