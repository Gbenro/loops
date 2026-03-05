// Cosmic Loops - Ring Component
// Circular progress indicator with optional pulse animation

export function Ring({
  pct = 0,
  color = '#A78BFA',
  size = 48,
  stroke = 3,
  pulse = false,
  speed = '2s',
  dim = false,
  glow = false,
  variant = 'default',  // 'default' | 'cycle'
  children
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const isComplete = pct >= 100;
  const displayColor = isComplete ? '#34D399' : color;
  const isCycle = variant === 'cycle';

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
    }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Outer glow ring for cycle variant */}
        {isCycle && (
          <circle
            cx={size/2}
            cy={size/2}
            r={r + stroke}
            fill="none"
            stroke="rgba(245, 230, 200, 0.04)"
            strokeWidth={1}
          />
        )}
        {/* Background track */}
        <circle
          cx={size/2}
          cy={size/2}
          r={r}
          fill="none"
          stroke={isCycle ? 'rgba(245, 230, 200, 0.12)' : 'rgba(245, 230, 200, 0.08)'}
          strokeWidth={stroke}
          strokeDasharray={isCycle ? '2 4' : 'none'}  // Dotted for cycle
        />
        {/* Progress arc */}
        <circle
          cx={size/2}
          cy={size/2}
          r={r}
          fill="none"
          stroke={displayColor}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease',
            opacity: dim ? 0.3 : 1,
            filter: glow || isCycle ? `drop-shadow(0 0 ${isCycle ? 6 : 4}px ${displayColor})` : 'none',
          }}
        />
        {/* Inner ring for cycle variant */}
        {isCycle && (
          <circle
            cx={size/2}
            cy={size/2}
            r={r - stroke - 2}
            fill="none"
            stroke="rgba(245, 230, 200, 0.06)"
            strokeWidth={1}
          />
        )}
      </svg>

      {/* Center content */}
      {children && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {children}
        </div>
      )}

      {/* Pulse indicator */}
      {pulse && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: displayColor,
            animation: `breathe ${speed} ease-in-out infinite`,
          }} />
        </div>
      )}
    </div>
  );
}

// Mini ring variant for inline use
export function MiniRing({ pct = 0, color = '#A78BFA', size = 16 }) {
  const r = (size - 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const isComplete = pct >= 100;
  const displayColor = isComplete ? '#34D399' : color;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        fill="none"
        stroke="rgba(245, 230, 200, 0.1)"
        strokeWidth={2}
      />
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        fill="none"
        stroke={displayColor}
        strokeWidth={2}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}
