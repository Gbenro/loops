// Cosmic Loops - Moon Face SVG
// Renders actual illuminated portion using terminator geometry

export function MoonFace({ size = 180, phase = 0, illumination = 50 }) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again
  // The terminator (shadow line) is a semi-ellipse whose minor axis varies

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Determine waxing/waning
  const isWaning = phase > 0.5;
  const normalizedPhase = isWaning ? (1 - phase) * 2 : phase * 2;

  // Generate the lit portion path
  const litPath = calculateMoonPath(cx, cy, r, phase);

  // Crater positions for texture (consistent positions)
  const craters = [
    { x: cx - r * 0.3, y: cy - r * 0.2, r: r * 0.12 },
    { x: cx + r * 0.2, y: cy + r * 0.3, r: r * 0.15 },
    { x: cx - r * 0.1, y: cy + r * 0.5, r: r * 0.08 },
    { x: cx + r * 0.4, y: cy - r * 0.3, r: r * 0.1 },
    { x: cx - r * 0.4, y: cy + r * 0.1, r: r * 0.07 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ filter: 'drop-shadow(0 0 20px rgba(245, 230, 200, 0.15))' }}
    >
      <defs>
        {/* Gradient for lit surface */}
        <radialGradient id="moonGlow" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fffef5" />
          <stop offset="50%" stopColor="#f5e6c8" />
          <stop offset="100%" stopColor="#d4c4a8" />
        </radialGradient>

        {/* Crater texture gradient */}
        <radialGradient id="crater">
          <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Clip path for craters within moon */}
        <clipPath id="moonClip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Dark base (shadow side) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#1a1a24"
      />

      {/* Lit portion */}
      {litPath && (
        <path
          d={litPath}
          fill="url(#moonGlow)"
        />
      )}

      {/* Crater texture overlay (only visible on lit side) */}
      <g clipPath="url(#moonClip)" opacity={0.6}>
        {craters.map((crater, i) => (
          <circle
            key={i}
            cx={crater.x}
            cy={crater.y}
            r={crater.r}
            fill="url(#crater)"
          />
        ))}
      </g>

      {/* Subtle outer glow */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 2}
        fill="none"
        stroke="rgba(245, 230, 200, 0.08)"
        strokeWidth={4}
      />
    </svg>
  );
}

// Calculate SVG path for the illuminated portion
function calculateMoonPath(cx, cy, r, phase) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again

  // Handle edge cases
  if (phase < 0.01 || phase > 0.99) {
    return null; // New moon - no visible light
  }

  if (phase > 0.49 && phase < 0.51) {
    // Full moon - complete circle
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  }

  const isWaning = phase > 0.5;

  // k determines terminator position: 1 at new, 0 at quarter, -1 at full
  const k = Math.cos(phase * 2 * Math.PI);

  // The terminator is an ellipse with rx = |k| * r, ry = r
  const terminatorRx = Math.abs(k) * r;

  // Determine if crescent (thin sliver) or gibbous (mostly lit)
  // Waxing: crescent when k > 0 (phase < 0.25), gibbous when k < 0 (phase > 0.25)
  // Waning: gibbous when k < 0 (phase < 0.75), crescent when k > 0 (phase > 0.75)

  if (isWaning) {
    // Light on LEFT side
    const isGibbous = k < 0; // phase 0.5 to 0.75

    // For gibbous: terminator sweeps through RIGHT (into shadow)
    // For crescent: terminator sweeps through LEFT (same side as light)
    const terminatorSweep = isGibbous ? 1 : 0;

    return `M ${cx} ${cy - r}
            A ${r} ${r} 0 0 0 ${cx} ${cy + r}
            A ${terminatorRx} ${r} 0 0 ${terminatorSweep} ${cx} ${cy - r}`;
  } else {
    // Light on RIGHT side
    const isGibbous = k < 0; // phase 0.25 to 0.5

    // For gibbous: terminator sweeps through LEFT (into shadow)
    // For crescent: terminator sweeps through RIGHT (same side as light)
    const terminatorSweep = isGibbous ? 0 : 1;

    return `M ${cx} ${cy - r}
            A ${r} ${r} 0 0 1 ${cx} ${cy + r}
            A ${terminatorRx} ${r} 0 0 ${terminatorSweep} ${cx} ${cy - r}`;
  }
}

// Small moon for inline display
export function MiniMoon({ size = 24, phase = 0 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  const litPath = calculateMoonPath(cx, cy, r, phase);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#2a2a34" />
      {litPath && <path d={litPath} fill="#f5e6c8" />}
    </svg>
  );
}
