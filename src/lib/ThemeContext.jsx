import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'luna_theme';

// dark | light | dim | auto
const DEFAULT_THEME = 'dark';

const THEMES = {
  dark: {
    '--color-bg': '#040810',
    '--color-surface': '#080d1a',
    '--color-text': '#f5e6c8',
    '--color-text-dim': 'rgba(245, 230, 200, 0.55)',
    '--color-text-muted': 'rgba(245, 230, 200, 0.4)',
    '--color-text-faint': 'rgba(245, 230, 200, 0.26)',
    '--color-border': 'rgba(245, 230, 200, 0.06)',
    '--color-border-light': 'rgba(245, 230, 200, 0.1)',
    '--color-border-mid': 'rgba(245, 230, 200, 0.15)',
    '--color-accent': '#c4b5fd',
    '--color-accent-bg': 'rgba(167, 139, 250, 0.2)',
    '--color-glow': 'rgba(245, 230, 200, 0.25)',
    '--color-input-bg': 'rgba(245, 230, 200, 0.03)',
    '--color-input-hover': 'rgba(245, 230, 200, 0.08)',
    '--color-focus': 'rgba(245, 230, 200, 0.5)',
    '--color-meta-theme': '#040810',
  },
  dim: {
    '--color-bg': '#0d1526',
    '--color-surface': '#131d35',
    '--color-text': '#e0d0b0',
    '--color-text-dim': 'rgba(224, 208, 176, 0.55)',
    '--color-text-muted': 'rgba(224, 208, 176, 0.4)',
    '--color-text-faint': 'rgba(224, 208, 176, 0.28)',
    '--color-border': 'rgba(224, 208, 176, 0.07)',
    '--color-border-light': 'rgba(224, 208, 176, 0.12)',
    '--color-border-mid': 'rgba(224, 208, 176, 0.18)',
    '--color-accent': '#a78bfa',
    '--color-accent-bg': 'rgba(167, 139, 250, 0.15)',
    '--color-glow': 'rgba(224, 208, 176, 0.2)',
    '--color-input-bg': 'rgba(224, 208, 176, 0.04)',
    '--color-input-hover': 'rgba(224, 208, 176, 0.08)',
    '--color-focus': 'rgba(224, 208, 176, 0.45)',
    '--color-meta-theme': '#0d1526',
  },
  light: {
    '--color-bg': '#fdf8f0',
    '--color-surface': '#fff9f2',
    '--color-text': '#1c1410',
    '--color-text-dim': 'rgba(28, 20, 16, 0.65)',
    '--color-text-muted': 'rgba(28, 20, 16, 0.5)',
    '--color-text-faint': 'rgba(28, 20, 16, 0.35)',
    '--color-border': 'rgba(28, 20, 16, 0.07)',
    '--color-border-light': 'rgba(28, 20, 16, 0.12)',
    '--color-border-mid': 'rgba(28, 20, 16, 0.18)',
    '--color-accent': '#6d28d9',
    '--color-accent-bg': 'rgba(109, 40, 217, 0.1)',
    '--color-glow': 'rgba(28, 20, 16, 0.12)',
    '--color-input-bg': 'rgba(28, 20, 16, 0.03)',
    '--color-input-hover': 'rgba(28, 20, 16, 0.06)',
    '--color-focus': 'rgba(28, 20, 16, 0.4)',
    '--color-meta-theme': '#fdf8f0',
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
