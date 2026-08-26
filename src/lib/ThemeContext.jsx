import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'luna_theme';

// dark | light | dim | auto
const DEFAULT_THEME = 'dark';

const THEMES = {
  dark: {
    '--color-bg': '#040810',
    '--color-surface': '#080d1a',
    '--color-text': '#ffffff',
    '--color-text-dim': 'rgba(255, 255, 255, 0.88)',
    '--color-text-muted': 'rgba(255, 255, 255, 0.72)',
    '--color-text-faint': 'rgba(255, 255, 255, 0.55)',
    '--color-border': 'rgba(245, 230, 200, 0.20)',
    '--color-border-light': 'rgba(245, 230, 200, 0.30)',
    '--color-border-mid': 'rgba(245, 230, 200, 0.40)',
    '--color-accent': '#c4b5fd',
    '--color-accent-bg': 'rgba(167, 139, 250, 0.25)',
    '--color-glow': 'rgba(245, 230, 200, 0.3)',
    '--color-input-bg': 'rgba(245, 230, 200, 0.08)',
    '--color-input-hover': 'rgba(245, 230, 200, 0.16)',
    '--color-focus': '#ffffff',
    '--color-meta-theme': '#040810',
  },
  dim: {
    '--color-bg': '#1a1f2e',
    '--color-surface': '#222840',
    '--color-text': '#ffffff',
    '--color-text-dim': 'rgba(255, 255, 255, 0.88)',
    '--color-text-muted': 'rgba(255, 255, 255, 0.72)',
    '--color-text-faint': 'rgba(255, 255, 255, 0.55)',
    '--color-border': 'rgba(240, 230, 208, 0.22)',
    '--color-border-light': 'rgba(240, 230, 208, 0.30)',
    '--color-border-mid': 'rgba(240, 230, 208, 0.40)',
    '--color-accent': '#b4a0ff',
    '--color-accent-bg': 'rgba(180, 160, 255, 0.22)',
    '--color-glow': 'rgba(240, 230, 208, 0.3)',
    '--color-input-bg': 'rgba(240, 230, 208, 0.10)',
    '--color-input-hover': 'rgba(240, 230, 208, 0.18)',
    '--color-focus': '#ffffff',
    '--color-meta-theme': '#1a1f2e',
  },
  light: {
    '--color-bg': '#ffffff',
    '--color-surface': '#f8f4ee',
    '--color-text': '#000000',
    '--color-text-dim': 'rgba(0, 0, 0, 0.85)',
    '--color-text-muted': 'rgba(0, 0, 0, 0.70)',
    '--color-text-faint': 'rgba(0, 0, 0, 0.55)',
    '--color-border': 'rgba(0, 0, 0, 0.20)',
    '--color-border-light': 'rgba(0, 0, 0, 0.28)',
    '--color-border-mid': 'rgba(0, 0, 0, 0.38)',
    '--color-accent': '#4c1d95',
    '--color-accent-bg': 'rgba(76, 29, 149, 0.15)',
    '--color-glow': 'rgba(0, 0, 0, 0.15)',
    '--color-input-bg': 'rgba(0, 0, 0, 0.06)',
    '--color-input-hover': 'rgba(0, 0, 0, 0.12)',
    '--color-focus': 'rgba(0, 0, 0, 0.75)',
    '--color-meta-theme': '#ffffff',
  },
  sunlight: {
    '--color-bg': '#ffffff',
    '--color-surface': '#f1f5f9',
    '--color-text': '#000000',
    '--color-text-dim': '#000000',
    '--color-text-muted': '#0f172a',
    '--color-text-faint': '#334155',
    '--color-border': 'rgba(0, 0, 0, 0.40)',
    '--color-border-light': 'rgba(0, 0, 0, 0.50)',
    '--color-border-mid': 'rgba(0, 0, 0, 0.65)',
    '--color-accent': '#312e81',
    '--color-accent-bg': 'rgba(49, 46, 129, 0.18)',
    '--color-glow': 'rgba(0, 0, 0, 0.35)',
    '--color-input-bg': '#e2e8f0',
    '--color-input-hover': '#cbd5e1',
    '--color-focus': '#000000',
    '--color-meta-theme': '#ffffff',
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

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
