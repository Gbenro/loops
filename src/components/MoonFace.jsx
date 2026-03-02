// Cosmic Loops - Moon Face SVG
// Renders actual illuminated portion with realistic surface texture

export function MoonFace({ size = 180, phase = 0, illumination = 50 }) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Generate the lit portion path
  const litPath = calculateMoonPath(cx, cy, r, phase);

  // Unique ID for this instance (for gradients)
  const id = `moon-${size}`;

  // Mare (dark patches) - approximate positions of real lunar maria
  const maria = [
    { x: cx - r * 0.25, y: cy - r * 0.15, rx: r * 0.22, ry: r * 0.18 }, // Mare Imbrium
    { x: cx + r * 0.15, y: cy + r * 0.2, rx: r * 0.2, ry: r * 0.25 },   // Mare Tranquillitatis
    { x: cx - r * 0.1, y: cy + r * 0.35, rx: r * 0.15, ry: r * 0.12 },  // Mare Nubium
    { x: cx + r * 0.3, y: cy - r * 0.25, rx: r * 0.12, ry: r * 0.1 },   // Mare Serenitatis
    { x: cx - r * 0.35, y: cy + r * 0.05, rx: r * 0.1, ry: r * 0.14 },  // Mare Humorum
    { x: cx + r * 0.05, y: cy - r * 0.4, rx: r * 0.08, ry: r * 0.06 },  // Small mare
  ];

  // Craters
  const craters = [
    { x: cx - r * 0.45, y: cy - r * 0.35, r: r * 0.06 },
    { x: cx + r * 0.4, y: cy + r * 0.4, r: r * 0.07 },
    { x: cx - r * 0.2, y: cy + r * 0.55, r: r * 0.05 },
    { x: cx + r * 0.5, y: cy - r * 0.1, r: r * 0.04 },
    { x: cx - r * 0.5, y: cy + r * 0.3, r: r * 0.03 },
    { x: cx + r * 0.25, y: cy - r * 0.5, r: r * 0.04 },
    { x: cx - r * 0.35, y: cy - r * 0.5, r: r * 0.035 },
    { x: cx + r * 0.45, y: cy + r * 0.15, r: r * 0.045 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ filter: 'drop-shadow(0 0 30px rgba(245, 230, 200, 0.2))' }}
    >
      <defs>
        {/* Main moon surface gradient - subtle warm tones */}
        <radialGradient id={`${id}-surface`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f0e8d8" />
          <stop offset="40%" stopColor="#e5dac8" />
          <stop offset="70%" stopColor="#d8ccb8" />
          <stop offset="100%" stopColor="#c8baa8" />
        </radialGradient>

        {/* Mare (dark region) gradient */}
        <radialGradient id={`${id}-mare`}>
          <stop offset="0%" stopColor="rgba(80, 75, 70, 0.4)" />
          <stop offset="70%" stopColor="rgba(90, 85, 75, 0.25)" />
          <stop offset="100%" stopColor="rgba(100, 95, 85, 0)" />
        </radialGradient>

        {/* Crater gradient - subtle depression */}
        <radialGradient id={`${id}-crater`}>
          <stop offset="0%" stopColor="rgba(60, 55, 50, 0.3)" />
          <stop offset="60%" stopColor="rgba(80, 75, 70, 0.15)" />
          <stop offset="100%" stopColor="rgba(100, 95, 90, 0)" />
        </radialGradient>

        {/* Highlight for crater rims */}
        <radialGradient id={`${id}-rim`} cx="30%" cy="30%">
          <stop offset="0%" stopColor="rgba(255, 250, 240, 0.2)" />
          <stop offset="100%" stopColor="rgba(255, 250, 240, 0)" />
        </radialGradient>

        {/* Noise texture for surface roughness */}
        <filter id={`${id}-noise`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>

        {/* Clip path for moon surface */}
        <clipPath id={`${id}-clip`}>
          {litPath ? <path d={litPath} /> : <circle cx={cx} cy={cy} r={r} />}
        </clipPath>

        {/* Full moon clip */}
        <clipPath id={`${id}-fullClip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Dark base (shadow side) with slight ambient */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#12121a"
      />

      {/* Very subtle earthshine on dark side */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgba(100, 110, 130, 0.03)"
      />

      {/* Lit portion base */}
      {litPath && (
        <path
          d={litPath}
          fill={`url(#${id}-surface)`}
        />
      )}

      {/* Maria (dark patches) - clipped to lit area */}
      {litPath && (
        <g clipPath={`url(#${id}-clip)`}>
          {maria.map((mare, i) => (
            <ellipse
              key={`mare-${i}`}
              cx={mare.x}
              cy={mare.y}
              rx={mare.rx}
              ry={mare.ry}
              fill={`url(#${id}-mare)`}
              transform={`rotate(${i * 23}, ${mare.x}, ${mare.y})`}
            />
          ))}
        </g>
      )}

      {/* Craters - clipped to lit area */}
      {litPath && (
        <g clipPath={`url(#${id}-clip)`}>
          {craters.map((crater, i) => (
            <g key={`crater-${i}`}>
              {/* Crater shadow */}
              <circle
                cx={crater.x}
                cy={crater.y}
                r={crater.r}
                fill={`url(#${id}-crater)`}
              />
              {/* Crater rim highlight */}
              <circle
                cx={crater.x - crater.r * 0.2}
                cy={crater.y - crater.r * 0.2}
                r={crater.r * 0.8}
                fill={`url(#${id}-rim)`}
              />
            </g>
          ))}
        </g>
      )}

      {/* Terminator edge softening - gradient along shadow line */}
      {litPath && phase > 0.02 && phase < 0.98 && (
        <path
          d={litPath}
          fill="none"
          stroke="rgba(40, 38, 45, 0.3)"
          strokeWidth={3}
          clipPath={`url(#${id}-fullClip)`}
          style={{ filter: 'blur(2px)' }}
        />
      )}

      {/* Outer atmosphere glow */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 3}
        fill="none"
        stroke="rgba(245, 235, 220, 0.06)"
        strokeWidth={6}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r + 1}
        fill="none"
        stroke="rgba(245, 235, 220, 0.1)"
        strokeWidth={2}
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
