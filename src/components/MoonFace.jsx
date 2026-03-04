// Cosmic Loops - Moon Face SVG
// Renders actual illuminated portion with realistic 3D surface texture

export function MoonFace({ size = 180, phase = 0, illumination = 50 }) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Generate the lit portion path
  const litPath = calculateMoonPath(cx, cy, r, phase);

  // Unique ID for this instance (for gradients)
  const id = `moon-${size}-${Math.random().toString(36).substr(2, 4)}`;

  // Mare (dark patches) - approximate positions of real lunar maria
  const maria = [
    { x: cx - r * 0.25, y: cy - r * 0.15, rx: r * 0.24, ry: r * 0.20, rot: 15 }, // Mare Imbrium
    { x: cx + r * 0.12, y: cy + r * 0.18, rx: r * 0.22, ry: r * 0.28, rot: -10 }, // Mare Tranquillitatis
    { x: cx - r * 0.08, y: cy + r * 0.38, rx: r * 0.16, ry: r * 0.13, rot: 25 },  // Mare Nubium
    { x: cx + r * 0.28, y: cy - r * 0.22, rx: r * 0.14, ry: r * 0.12, rot: -5 },  // Mare Serenitatis
    { x: cx - r * 0.38, y: cy + r * 0.08, rx: r * 0.12, ry: r * 0.16, rot: 30 },  // Mare Humorum
    { x: cx + r * 0.08, y: cy - r * 0.42, rx: r * 0.10, ry: r * 0.08, rot: 0 },   // Mare Frigoris
    { x: cx - r * 0.15, y: cy - r * 0.35, rx: r * 0.08, ry: r * 0.06, rot: 45 },  // Small mare
    { x: cx + r * 0.35, y: cy + r * 0.35, rx: r * 0.09, ry: r * 0.07, rot: -20 }, // Mare Fecunditatis
  ];

  // More craters with varying sizes for realism
  const craters = [
    { x: cx - r * 0.45, y: cy - r * 0.35, r: r * 0.07, depth: 0.8 },
    { x: cx + r * 0.42, y: cy + r * 0.42, r: r * 0.08, depth: 0.9 },
    { x: cx - r * 0.18, y: cy + r * 0.58, r: r * 0.055, depth: 0.7 },
    { x: cx + r * 0.52, y: cy - r * 0.08, r: r * 0.045, depth: 0.6 },
    { x: cx - r * 0.52, y: cy + r * 0.28, r: r * 0.035, depth: 0.5 },
    { x: cx + r * 0.22, y: cy - r * 0.52, r: r * 0.05, depth: 0.7 },
    { x: cx - r * 0.38, y: cy - r * 0.52, r: r * 0.04, depth: 0.6 },
    { x: cx + r * 0.48, y: cy + r * 0.12, r: r * 0.05, depth: 0.8 },
    // Additional small craters
    { x: cx - r * 0.6, y: cy - r * 0.15, r: r * 0.025, depth: 0.4 },
    { x: cx + r * 0.6, y: cy - r * 0.35, r: r * 0.03, depth: 0.5 },
    { x: cx - r * 0.28, y: cy - r * 0.62, r: r * 0.025, depth: 0.4 },
    { x: cx + r * 0.15, y: cy + r * 0.6, r: r * 0.035, depth: 0.6 },
    { x: cx - r * 0.55, y: cy - r * 0.45, r: r * 0.02, depth: 0.3 },
    { x: cx + r * 0.3, y: cy + r * 0.55, r: r * 0.028, depth: 0.5 },
    { x: cx, y: cy - r * 0.7, r: r * 0.025, depth: 0.4 },
    { x: cx - r * 0.65, y: cy + r * 0.1, r: r * 0.02, depth: 0.3 },
  ];

  // Highland ridges for 3D texture
  const ridges = [
    { x1: cx - r * 0.4, y1: cy - r * 0.6, x2: cx - r * 0.2, y2: cy - r * 0.3 },
    { x1: cx + r * 0.3, y1: cy - r * 0.5, x2: cx + r * 0.5, y2: cy - r * 0.2 },
    { x1: cx - r * 0.5, y1: cy + r * 0.4, x2: cx - r * 0.3, y2: cy + r * 0.6 },
    { x1: cx + r * 0.1, y1: cy - r * 0.65, x2: cx + r * 0.25, y2: cy - r * 0.5 },
    { x1: cx - r * 0.6, y1: cy - r * 0.2, x2: cx - r * 0.45, y2: cy + r * 0.1 },
    { x1: cx + r * 0.4, y1: cy + r * 0.3, x2: cx + r * 0.55, y2: cy + r * 0.5 },
  ];

  // Highland bright spots (Tycho-like rays)
  const highlights = [
    { x: cx - r * 0.35, y: cy + r * 0.55, r: r * 0.06 },
    { x: cx + r * 0.45, y: cy - r * 0.4, r: r * 0.04 },
    { x: cx - r * 0.5, y: cy - r * 0.3, r: r * 0.035 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ filter: 'drop-shadow(0 0 35px rgba(245, 230, 200, 0.25))' }}
    >
      <defs>
        {/* 3D sphere gradient - light source from upper left */}
        <radialGradient id={`${id}-sphere`} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="15%" stopColor="#f5eedc" />
          <stop offset="35%" stopColor="#e8dcc8" />
          <stop offset="55%" stopColor="#d8cab4" />
          <stop offset="75%" stopColor="#c8b8a0" />
          <stop offset="100%" stopColor="#a89880" />
        </radialGradient>

        {/* Surface texture gradient */}
        <radialGradient id={`${id}-surface`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f5ede0" />
          <stop offset="30%" stopColor="#ebe0d0" />
          <stop offset="60%" stopColor="#ddd0bc" />
          <stop offset="100%" stopColor="#c8b8a4" />
        </radialGradient>

        {/* Mare (dark region) gradient - deeper and more realistic */}
        <radialGradient id={`${id}-mare`}>
          <stop offset="0%" stopColor="rgba(70, 65, 58, 0.5)" />
          <stop offset="50%" stopColor="rgba(85, 78, 68, 0.35)" />
          <stop offset="80%" stopColor="rgba(95, 88, 78, 0.2)" />
          <stop offset="100%" stopColor="rgba(110, 100, 88, 0)" />
        </radialGradient>

        {/* Crater gradient - realistic depression with 3D effect */}
        <radialGradient id={`${id}-crater`} cx="60%" cy="60%">
          <stop offset="0%" stopColor="rgba(50, 45, 40, 0.45)" />
          <stop offset="40%" stopColor="rgba(70, 65, 58, 0.3)" />
          <stop offset="70%" stopColor="rgba(90, 82, 72, 0.15)" />
          <stop offset="100%" stopColor="rgba(110, 100, 88, 0)" />
        </radialGradient>

        {/* Crater rim highlight - gives 3D raised edge effect */}
        <radialGradient id={`${id}-rim`} cx="25%" cy="25%">
          <stop offset="0%" stopColor="rgba(255, 252, 245, 0.4)" />
          <stop offset="40%" stopColor="rgba(255, 250, 240, 0.2)" />
          <stop offset="100%" stopColor="rgba(255, 248, 235, 0)" />
        </radialGradient>

        {/* Inner shadow for depth */}
        <radialGradient id={`${id}-inner-shadow`} cx="70%" cy="70%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="60%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.15)" />
        </radialGradient>

        {/* Noise texture for surface roughness */}
        <filter id={`${id}-noise`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="5" result="noise" seed="42" />
          <feColorMatrix type="saturate" values="0" />
          <feComposite in="SourceGraphic" in2="noise" operator="in" />
          <feBlend in="SourceGraphic" mode="soft-light" />
        </filter>

        {/* Subtle surface bump texture */}
        <filter id={`${id}-bump`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="3" result="noise" />
          <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1" result="light">
            <feDistantLight azimuth="315" elevation="45" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="light" operator="arithmetic" k1="0" k2="1" k3="0.3" k4="0" />
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
                opacity={crater.depth}
              />
              {/* Crater rim highlight */}
              <circle
                cx={crater.x - crater.r * 0.25}
                cy={crater.y - crater.r * 0.25}
                r={crater.r * 0.85}
                fill={`url(#${id}-rim)`}
                opacity={crater.depth * 0.7}
              />
            </g>
          ))}
        </g>
      )}

      {/* Highland ridges - clipped to lit area */}
      {litPath && (
        <g clipPath={`url(#${id}-clip)`}>
          {ridges.map((ridge, i) => (
            <line
              key={`ridge-${i}`}
              x1={ridge.x1}
              y1={ridge.y1}
              x2={ridge.x2}
              y2={ridge.y2}
              stroke="rgba(255, 252, 245, 0.08)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {/* Bright highland spots (like Tycho) - clipped to lit area */}
      {litPath && (
        <g clipPath={`url(#${id}-clip)`}>
          {highlights.map((hl, i) => (
            <circle
              key={`highlight-${i}`}
              cx={hl.x}
              cy={hl.y}
              r={hl.r}
              fill="rgba(255, 252, 245, 0.15)"
              style={{ filter: 'blur(1px)' }}
            />
          ))}
        </g>
      )}

      {/* 3D sphere shading overlay - clipped to lit area */}
      {litPath && (
        <path
          d={litPath}
          fill={`url(#${id}-sphere)`}
          opacity={0.4}
          style={{ mixBlendMode: 'overlay' }}
        />
      )}

      {/* Inner shadow for depth - clipped to lit area */}
      {litPath && (
        <path
          d={litPath}
          fill={`url(#${id}-inner-shadow)`}
          opacity={0.5}
        />
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

      {/* Subtle surface texture - clipped to lit area */}
      {litPath && (
        <path
          d={litPath}
          fill="rgba(255, 250, 240, 0.03)"
          filter={`url(#${id}-noise)`}
        />
      )}

      {/* Outer atmosphere glow */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 4}
        fill="none"
        stroke="rgba(245, 235, 220, 0.04)"
        strokeWidth={8}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r + 2}
        fill="none"
        stroke="rgba(245, 235, 220, 0.08)"
        strokeWidth={4}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r + 0.5}
        fill="none"
        stroke="rgba(255, 250, 240, 0.15)"
        strokeWidth={1}
      />
    </svg>
  );
}

// Calculate SVG path for the illuminated portion
// Uses a different approach: draw the lit area by tracing the outer edge and terminator
function calculateMoonPath(cx, cy, r, phase) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again
  // Normalize phase to 0-1 range
  phase = phase % 1;
  if (phase < 0) phase += 1;

  // Handle edge cases with wider ranges
  if (phase < 0.02 || phase > 0.98) {
    return null; // New moon - no visible light
  }

  // Wider full moon range (covers 0.47 to 0.53 = about 1.8 days around full)
  if (phase > 0.47 && phase < 0.53) {
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
  // For waning phases, we flip the bulge direction so the terminator
  // is on the shadow (right) side, not the lit (left) side
  const points = [];
  const steps = 32;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1
    const angle = Math.PI * t; // 0 to π (top to bottom)
    const y = cy - r * Math.cos(angle); // cy-r to cy+r
    // For waning, flip the bulge so terminator is on the right (shadow) side
    const x = isWaning
      ? cx - bulge * r * Math.sin(angle)
      : cx + bulge * r * Math.sin(angle);
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
