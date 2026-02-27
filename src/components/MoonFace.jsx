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
// Uses a different approach: draw the lit area by tracing the outer edge and terminator
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

  // For the terminator curve, we need to know how much it bulges
  // At first/last quarter (phase 0.25 or 0.75), terminator is straight (bulge = 0)
  // At crescent, it bulges toward the lit side
  // At gibbous, it bulges toward the shadow side

  // Map phase to a value from -1 to 1 representing terminator bulge
  // phase 0: bulge = 1 (curves right, toward lit side = tiny crescent)
  // phase 0.25: bulge = 0 (straight line = half moon)
  // phase 0.5: bulge = -1 (curves left, toward shadow = full moon)
  const bulge = Math.cos(phase * 2 * Math.PI);

  // Generate points along the terminator using parametric ellipse
  // The terminator goes from top (cy - r) to bottom (cy + r)
  // Its x-offset from center is controlled by bulge
  const points = [];
  const steps = 32;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1
    const angle = Math.PI * t; // 0 to π (top to bottom)
    const y = cy - r * Math.cos(angle); // cy-r to cy+r
    const x = cx + bulge * r * Math.sin(angle); // bulges based on phase
    points.push({ x, y });
  }

  // Build the path
  // For waxing: trace right semicircle (top to bottom), then terminator (bottom to top)
  // For waning: trace left semicircle (top to bottom), then terminator (bottom to top)

  let path = `M ${cx} ${cy - r}`; // Start at top

  if (isWaning) {
    // Left semicircle
    path += ` A ${r} ${r} 0 0 0 ${cx} ${cy + r}`;
  } else {
    // Right semicircle
    path += ` A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
  }

  // Trace terminator from bottom to top (reverse order)
  for (let i = steps - 1; i >= 0; i--) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  path += ' Z'; // Close path

  return path;
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
