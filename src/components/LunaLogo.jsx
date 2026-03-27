// Luna Loops — Logo component
// variant="wordmark" — icon + LUNA LOOPS + tagline
// variant="icon"     — orbital moon only

export function LunaLogo({ variant = 'icon', width, className, style }) {
  // Each instance gets unique gradient IDs to avoid conflicts
  const uid = Math.random().toString(36).slice(2, 7);
  const _bgId = `ll-bg-${uid}`; // Reserved for future background gradient
  const ringId = `ll-ring-${uid}`;
  const moonId = `ll-moon-${uid}`;

  const defs = (
    <defs>
      <linearGradient id={ringId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c4a882" stopOpacity="1" />
        <stop offset="60%" stopColor="#8a6f52" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#c4a882" stopOpacity="0.2" />
      </linearGradient>
      <radialGradient id={moonId} cx="38%" cy="33%" r="62%">
        <stop offset="0%" stopColor="#f5e6c8" />
        <stop offset="65%" stopColor="#c4a882" />
        <stop offset="100%" stopColor="#7a6040" />
      </radialGradient>
    </defs>
  );

  // Orbital moon icon — centered at 0,0, fits in ±90
  const icon = (rx, ry, moonR, nodeR) => (
    <g>
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="none" stroke={`url(#${ringId})`} strokeWidth="0.9" strokeDasharray="2.5 5" />
      <ellipse cx="0" cy="0" rx={rx * 0.756} ry={ry * 0.756} fill="none" stroke="#c4a882" strokeWidth="0.65" strokeOpacity="0.3" />
      <ellipse cx="0" cy="0" rx={rx * 0.533} ry={ry * 0.533} fill="none" stroke="#c4a882" strokeWidth="0.5" strokeOpacity="0.15" />
      <circle cx="0" cy="0" r={moonR} fill={`url(#${moonId})`} />
      <path d={`M 0,${-moonR} A ${moonR},${moonR} 0 0,1 0,${moonR} A ${moonR * 0.567},${moonR} 0 0,0 0,${-moonR} Z`} fill="#040810" fillOpacity="0.78" />
      <circle cx="0" cy={-ry} r={nodeR} fill="#c4a882" fillOpacity="0.9" />
      <circle cx="0" cy={-ry} r={nodeR * 2} fill="#c4a882" fillOpacity="0.1" />
      <circle cx={rx * 0.711} cy={-ry * 0.289} r={nodeR * 0.57} fill="#c4a882" fillOpacity="0.45" />
      <circle cx={-rx * 0.8} cy={ry * 0.244} r={nodeR * 0.37} fill="#c4a882" fillOpacity="0.25" />
    </g>
  );

  if (variant === 'icon') {
    const w = width || 100;
    const h = w;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-95 -95 190 190"
        width={w} height={h}
        className={className}
        style={style}
      >
        {defs}
        {icon(90, 90, 30, 3.5)}
      </svg>
    );
  }

  // Wordmark: icon centred above text
  const w = width || 240;
  const h = Math.round(w * 0.6);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-120 -110 240 144"
      width={w} height={h}
      className={className}
      style={style}
    >
      {defs}
      <g transform="translate(0, -42)">
        {icon(56, 56, 19, 2.2)}
      </g>
      <text
        x="0" y="30"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="22" letterSpacing="5"
        fill="#f5e6c8" textAnchor="middle" fontWeight="300"
      >
        LUNA LOOPS
      </text>
      <text
        x="0" y="46"
        fontFamily="'DM Sans', sans-serif"
        fontSize="6.5" letterSpacing="3"
        fill="#c4a882" fillOpacity="0.55" textAnchor="middle" fontWeight="300"
      >
        entrain with the cycle
      </text>
    </svg>
  );
}
