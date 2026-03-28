// Cosmic Loops — PhaseRing
// 8-segment radial chart: inner arc = intention, outer arc = observation
// New Moon at top, clockwise.

const PHASES = [
  { key: 'new',             label: 'NM',  accent: 'rgba(245,230,200,0.75)' },
  { key: 'waxing-crescent', label: 'WxC', accent: '#74c69d' },
  { key: 'first-quarter',   label: 'FQ',  accent: '#f6ad55' },
  { key: 'waxing-gibbous',  label: 'WxG', accent: '#81e6d9' },
  { key: 'full',            label: 'FM',  accent: '#fefcbf' },
  { key: 'waning-gibbous',  label: 'WnG', accent: '#b794f4' },
  { key: 'last-quarter',    label: 'LQ',  accent: '#f687b3' },
  { key: 'waning-crescent', label: 'WnC', accent: '#718096' },
];

// Engagement level → { fraction, opacity }
const LEVEL_STYLE = {
  none:       null,
  light:      { f: 0.28, o: 0.45 },
  moderate:   { f: 0.58, o: 0.65 },
  deep:       { f: 0.85, o: 0.85 },
  ceremonial: { f: 1.00, o: 1.00 },
};

// Radial bands (inner ring = intention, outer ring = observation)
const INT_R_MIN  = 22;
const INT_R_MAX  = 44;
const OBS_R_MIN  = 50;
const OBS_R_MAX  = 76;

// Gap between segments in degrees (half on each side)
const GAP_DEG = 3;

function polarXY(cx, cy, r, angleDeg) {
  // angleDeg 0 = top (north), clockwise
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function annularArcPath(cx, cy, rMin, rMax, startDeg, endDeg) {
  const p1 = polarXY(cx, cy, rMax, startDeg);
  const p2 = polarXY(cx, cy, rMax, endDeg);
  const p3 = polarXY(cx, cy, rMin, endDeg);
  const p4 = polarXY(cx, cy, rMin, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rMax} ${rMax} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rMin} ${rMin} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// Renders one arc at a partial radial fill
function ArcSegment({ cx, cy, rMin, rMax, startDeg, endDeg, level, color, isCeremonial }) {
  const style = LEVEL_STYLE[level];
  if (!style) return null;

  const actualRMax = rMin + style.f * (rMax - rMin);
  const d = annularArcPath(cx, cy, rMin, actualRMax, startDeg, endDeg);

  return (
    <>
      <path
        d={d}
        fill={color}
        opacity={style.o}
      />
      {isCeremonial && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity={0.6}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
    </>
  );
}

export function PhaseRing({
  size = 180,
  intention = {},      // { phaseKey: level }  (from wholeIntention or phaseIntentions)
  observation = {},    // { phaseKey: level }
  currentPhaseKey = null,
  pastPhaseKeys = [],  // phases already completed this cycle
  onPhaseClick = null, // called with phaseKey
  showLabels = true,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 180;

  // Scale radii
  const obsMin = OBS_R_MIN * scale;
  const obsMax = OBS_R_MAX * scale;
  const intMin = INT_R_MIN * scale;
  const intMax = INT_R_MAX * scale;
  const labelR = (INT_R_MAX + 10) * scale;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {PHASES.map((phase, i) => {
        const segStart = i * 45 + GAP_DEG;
        const segEnd   = (i + 1) * 45 - GAP_DEG;
        const isActive = phase.key === currentPhaseKey;
        const isPast   = pastPhaseKeys.includes(phase.key);
        const isFuture = !isActive && !isPast;

        const obsLevel = observation[phase.key] || null;
        const intLevel = intention[phase.key] || null;

        const baseOpacity = isFuture ? 0.3 : 1;

        // Background track (shows the max extent of each band faintly)
        const bgObsPath = annularArcPath(cx, cy, obsMin, obsMax, segStart, segEnd);
        const bgIntPath = annularArcPath(cx, cy, intMin, intMax, segStart, segEnd);

        // Label position
        const midAngle = i * 45 + 22.5;
        const lp = polarXY(cx, cy, labelR, midAngle);

        return (
          <g
            key={phase.key}
            opacity={baseOpacity}
            style={{ cursor: onPhaseClick ? 'pointer' : 'default' }}
            onClick={() => onPhaseClick?.(phase.key)}
          >
            {/* Background tracks */}
            <path d={bgObsPath} fill={phase.accent} opacity={0.08} />
            <path d={bgIntPath} fill={phase.accent} opacity={0.06} />

            {/* Current phase highlight ring */}
            {isActive && (
              <path
                d={annularArcPath(cx, cy, obsMin - 2 * scale, intMax + 2 * scale, segStart - 1, segEnd + 1)}
                fill="none"
                stroke={phase.accent}
                strokeWidth={1 * scale}
                opacity={0.35}
              />
            )}

            {/* Intention arc (inner) */}
            {intLevel && intLevel !== 'none' && (
              <ArcSegment
                cx={cx} cy={cy}
                rMin={intMin} rMax={intMax}
                startDeg={segStart} endDeg={segEnd}
                level={intLevel}
                color={phase.accent}
                isCeremonial={intLevel === 'ceremonial'}
              />
            )}

            {/* Observation arc (outer) */}
            {obsLevel && obsLevel !== 'none' && (
              <ArcSegment
                cx={cx} cy={cy}
                rMin={obsMin} rMax={obsMax}
                startDeg={segStart} endDeg={segEnd}
                level={obsLevel}
                color={phase.accent}
                isCeremonial={obsLevel === 'ceremonial'}
              />
            )}

            {/* Phase label */}
            {showLabels && (
              <text
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={phase.accent}
                fontSize={7 * scale}
                fontFamily="monospace"
                letterSpacing="0.05em"
                opacity={isActive ? 0.9 : 0.4}
              >
                {phase.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2.5 * scale} fill="rgba(245,230,200,0.2)" />
    </svg>
  );
}

// Thumbnail variant — smaller, no labels, same ring
export function PhaseRingThumb({ size = 52, intention = {}, observation = {}, currentPhaseKey = null, pastPhaseKeys = [] }) {
  return (
    <PhaseRing
      size={size}
      intention={intention}
      observation={observation}
      currentPhaseKey={currentPhaseKey}
      pastPhaseKeys={pastPhaseKeys}
      showLabels={false}
    />
  );
}
