import { useTheme } from '../lib/ThemeContext.jsx';

const OPTIONS = [
  { value: 'dark',  label: '◑', title: 'Dark' },
  { value: 'dim',   label: '◐', title: 'Dim' },
  { value: 'light', label: '○', title: 'Light' },
  { value: 'auto',  label: '◎', title: 'Auto' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme selector"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        borderRadius: 10,
        background: 'var(--color-input-bg)',
        border: '1px solid var(--color-border-light)',
      }}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.title}
          aria-label={`${opt.title} theme`}
          aria-pressed={theme === opt.value}
          style={{
            background: theme === opt.value ? 'var(--color-border-mid)' : 'none',
            border: 'none',
            borderRadius: 6,
            color: theme === opt.value ? 'var(--color-text)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '4px 6px',
            transition: 'all 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
            minWidth: 28,
            minHeight: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
