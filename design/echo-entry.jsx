import { createRoot } from 'react-dom/client';
import { Echoes } from '../src/tabs/Echoes.jsx';
import { ThemeProvider } from '../src/lib/ThemeContext.jsx';
import { ThemeToggle } from '../src/components/ThemeToggle.jsx';
import './echo-entry.css';

// Render the real Echoes tab. The dedicated Vite config replaces cloud services
// with tab-local adapters; no App/auth/seed bootstrap is imported.
// Echoes also reads a legacy cache directly. Refuse to mount if this origin has
// one, rather than display or erase any existing browser data.
let canUseSampleContent = false;
try {
  canUseSampleContent = window.localStorage.getItem('cosmic_echoes_v1') === null;
} catch {
  // A private window with available browser storage can run this preview.
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <div className="echo-preview">
      <aside className="echo-preview__notice" aria-label="Preview limits">
        <strong>Local design preview · sample content</strong>
        <p>Try the new entrance and Luna’s existing recorder. Microphone access is optional.
          Audio stays in this tab, transcription is simulated, and reloading discards your preview Echoes.
          Please don’t use this preview for a recording you want to keep.</p>
      </aside>
      <header className="echo-preview__toolbar">
        <span className="echo-preview__brand">luna</span>
        <ThemeToggle />
      </header>
      {canUseSampleContent ? <main className="echo-preview__app" aria-label="Luna Echoes preview">
        <Echoes
          userId="design-preview-user"
          phrases={{ emptyStateGuidance: 'Your sample Echo will appear here.' }}
          phrasesLoading={false}
        />
      </main> : <p className="echo-preview__notice" role="alert">
        Open this preview in a fresh private window to use sample content.
        This browser address already has Luna data, or browser storage is unavailable.
      </p>}
    </div>
  </ThemeProvider>
);
