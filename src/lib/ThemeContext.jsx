import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'luna_theme';

// dark | light | dim | auto
const DEFAULT_THEME = 'dark';

const THEMES = {
  dark: {
    '--color-bg': '#040810',
    '--color-surface': '#080d1a',
    '--color-text': '#f5e6c8',
    '--color-text-dim': 'rgba(245, 230, 200, 0.75)',        // was 0.55 — increased for better contrast
    '--color-text-muted': 'rgba(245, 230, 200, 0.55)',      // was 0.4 — increased for readability
    '--color-text-faint': 'rgba(245, 230, 200, 0.40)',      // was 0.26 — increased so it's visible
    '--color-border': 'rgba(245, 230, 200, 0.12)',          // was 0.06 — doubled for visibility
    '--color-border-light': 'rgba(245, 230, 200, 0.18)',    // was 0.1 — increased
    '--color-border-mid': 'rgba(245, 230, 200, 0.25)',      // was 0.15 — increased
    '--color-accent': '#c4b5fd',
    '--color-accent-bg': 'rgba(167, 139, 250, 0.2)',
    '--color-glow': 'rgba(245, 230, 200, 0.25)',
    '--color-input-bg': 'rgba(245, 230, 200, 0.06)',        // was 0.03 — doubled
    '--color-input-hover': 'rgba(245, 230, 200, 0.12)',     // was 0.08 — increased
    '--color-focus': 'rgba(245, 230, 200, 0.6)',            // was 0.5 — increased
    '--color-meta-theme': '#040810',
  },
  dim: {
    '--color-bg': '#1a1f2e',                                 // was #0d1526 — lightened for better visibility
    '--color-surface': '#222840',                            // was #131d35 — lightened
    '--color-text': '#f0e6d0',                               // was #e0d0b0 — brighter for better contrast
    '--color-text-dim': 'rgba(240, 230, 208, 0.75)',         // increased opacity & adjusted base
    '--color-text-muted': 'rgba(240, 230, 208, 0.55)',       // increased opacity
    '--color-text-faint': 'rgba(240, 230, 208, 0.40)',       // increased from 0.28
    '--color-border': 'rgba(240, 230, 208, 0.15)',           // was 0.07 — much more visible
    '--color-border-light': 'rgba(240, 230, 208, 0.22)',     // was 0.12 — increased
    '--color-border-mid': 'rgba(240, 230, 208, 0.30)',       // was 0.18 — increased
    '--color-accent': '#b4a0ff',                             // was #a78bfa — brighter purple
    '--color-accent-bg': 'rgba(180, 160, 255, 0.18)',        // adjusted
    '--color-glow': 'rgba(240, 230, 208, 0.25)',
    '--color-input-bg': 'rgba(240, 230, 208, 0.08)',         // was 0.04 — doubled
    '--color-input-hover': 'rgba(240, 230, 208, 0.14)',      // was 0.08 — increased
    '--color-focus': 'rgba(240, 230, 208, 0.55)',            // was 0.45 — increased
    '--color-meta-theme': '#1a1f2e',
  },
  light: {
    '--color-bg': '#fdfaf4',                                 // slightly warmer white
    '--color-surface': '#f8f4ee',                            // slightly darker surface for depth
    '--color-text': '#0d0a08',                               // was #1c1410 — much darker for strong contrast
    '--color-text-dim': 'rgba(13, 10, 8, 0.72)',             // was 0.65 — increased
    '--color-text-muted': 'rgba(13, 10, 8, 0.58)',           // was 0.5 — increased
    '--color-text-faint': 'rgba(13, 10, 8, 0.42)',           // was 0.35 — increased
    '--color-border': 'rgba(13, 10, 8, 0.15)',               // was 0.07 — much more visible
    '--color-border-light': 'rgba(13, 10, 8, 0.20)',         // was 0.12 — increased
    '--color-border-mid': 'rgba(13, 10, 8, 0.28)',           // was 0.18 — increased
    '--color-accent': '#5b21b6',                             // was #6d28d9 — darker purple for better contrast on light
    '--color-accent-bg': 'rgba(91, 33, 182, 0.12)',          // adjusted
    '--color-glow': 'rgba(13, 10, 8, 0.15)',
    '--color-input-bg': 'rgba(13, 10, 8, 0.05)',             // was 0.03 — increased
    '--color-input-hover': 'rgba(13, 10, 8, 0.09)',          // was 0.06 — increased
    '--color-focus': 'rgba(13, 10, 8, 0.5)',                 // was 0.4 — increased
    '--color-meta-theme': '#fdfaf4',
  },
};

function resolveTheme(preference) {
  if (preference === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  const vars = THEMES[resolved] || THEMES.dark;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  document.documentElement.setAttribute('data-theme', resolved);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', vars['--color-meta-theme']);
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Re-apply when system preference changes (for auto mode)
  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
