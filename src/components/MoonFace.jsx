// Luna Loops - Moon Face Component
// Renders realistic moon using NASA lunar imagery with CSS phase masking

import { useMemo } from 'react';

// Import moon texture (NASA public domain - Clementine mission)
const MOON_TEXTURE = '/moon-texture.jpg';

export function MoonFace({ size = 180, phase = 0, illumination: _illumination = 50, phaseName = null }) {
  // phase: 0 = new moon, 0.5 = full moon, 1 = new moon again

  // Generate accessible description
  const getPhaseDescription = () => {
    if (phaseName) return `Moon phase: ${phaseName}`;
    const pct = Math.round((phase <= 0.5 ? phase * 2 : (1 - phase) * 2) * 100);
    if (phase < 0.02 || phase > 0.98) return 'New Moon, not illuminated';
    if (phase > 0.47 && phase < 0.53) return 'Full Moon, fully illuminated';
    if (phase < 0.25) return `Waxing Crescent Moon, ${pct}% illuminated`;
    if (phase < 0.27) return `First Quarter Moon, 50% illuminated`;
    if (phase < 0.5) return `Waxing Gibbous Moon, ${pct}% illuminated`;
    if (phase < 0.75) return `Waning Gibbous Moon, ${pct}% illuminated`;
    if (phase < 0.77) return `Last Quarter Moon, 50% illuminated`;
    return `Waning Crescent Moon, ${pct}% illuminated`;
  };

  // Calculate the clip path for the illuminated portion
  const clipPath = useMemo(() => {
    // Normalize phase
    let p = phase % 1;
    if (p < 0) p += 1;

    // New moon - show nothing
    if (p < 0.02 || p > 0.98) {
      return 'circle(0% at 50% 50%)';
    }

    // Full moon - show everything
    if (p > 0.47 && p < 0.53) {
      return 'circle(50% at 50% 50%)';
    }

    // For phases in between, we use a polygon approximation of the lit area
    // The terminator (shadow edge) curves based on phase angle
    const isWaning = p > 0.5;

    // Calculate terminator bulge
    // phase 0: bulge = 1 (curves toward lit side = tiny crescent)
    // phase 0.25: bulge = 0 (straight line = half moon)
    // phase 0.5: bulge = -1 (curves toward shadow = full moon)
    const bulge = Math.cos(p * 2 * Math.PI);

    // Generate points along the terminator
    const points = [];
    const steps = 32;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = Math.PI * t; // 0 to π (top to bottom)
      const y = 50 - 50 * Math.cos(angle); // 0 to 100
      // x position of terminator at this y
      const terminatorX = isWaning
        ? 50 - bulge * 50 * Math.sin(angle)
        : 50 + bulge * 50 * Math.sin(angle);
      points.push({ x: terminatorX, y });
    }

    // Build polygon path
    // For waxing: right semicircle + terminator
    // For waning: left semicircle + terminator
    let pathPoints = [];

    if (isWaning) {
      // Left semicircle (from top to bottom)
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 - 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x}% ${y}%`);
      }
      // Terminator (from bottom to top)
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x}% ${points[i].y}%`);
      }
    } else {
      // Right semicircle (from top to bottom)
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 + 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x}% ${y}%`);
      }
      // Terminator (from bottom to top)
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x}% ${points[i].y}%`);
      }
    }

    return `polygon(${pathPoints.join(', ')})`;
  }, [phase]);

  // Calculate terminator position for soft shadow gradient
  const terminatorGradient = useMemo(() => {
    let p = phase % 1;
    if (p < 0) p += 1;

    // No terminator for new or full moon
    if (p < 0.02 || p > 0.98 || (p > 0.47 && p < 0.53)) {
      return null;
    }

    const isWaning = p > 0.5;
    // Position of terminator center (as percentage from left)
    const bulge = Math.cos(p * 2 * Math.PI);
    const terminatorCenter = isWaning ? 50 - bulge * 25 : 50 + bulge * 25;

    // Gradient direction
    const direction = isWaning ? 'to left' : 'to right';

    return {
      direction,
      position: terminatorCenter,
    };
  }, [phase]);

  // Check if new moon (minimal display)
  const isNewMoon = phase < 0.02 || phase > 0.98;

  return (
    <div
      role="img"
      aria-label={getPhaseDescription()}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
      }}
    >
      {/* Outer glow - warm golden */}
      <div
        className="moon-glow"
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          boxShadow: isNewMoon
            ? '0 0 25px rgba(255, 220, 150, 0.1)'
            : '0 0 35px rgba(255, 215, 120, 0.35), 0 0 60px rgba(255, 200, 100, 0.15)',
          pointerEvents: 'none',
        }}
      />

      {/* Dark base (shadow side) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: '#12121a',
        }}
      />

      {/* Earthshine on dark side */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'rgba(100, 120, 140, 0.04)',
        }}
      />

      {/* Moon texture (lit portion) - warm golden tint */}
      {!isNewMoon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage: `url(${MOON_TEXTURE})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            clipPath: clipPath,
            // Warm golden effect: sepia for warmth, saturate to enhance gold tones
            filter: 'sepia(25%) saturate(1.3) brightness(1.1) contrast(1.05)',
          }}
        />
      )}

      {/* Golden color overlay for warm lit effect */}
      {!isNewMoon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, rgba(255, 210, 120, 0.12) 0%, rgba(255, 190, 80, 0.08) 60%, transparent 100%)',
            clipPath: clipPath,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Terminator softening gradient */}
      {terminatorGradient && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `linear-gradient(${terminatorGradient.direction},
              transparent 0%,
              transparent 30%,
              rgba(18, 18, 26, 0.15) 40%,
              rgba(18, 18, 26, 0.35) 50%,
              transparent 60%,
              transparent 100%
            )`,
            clipPath: clipPath,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Limb darkening (3D spherical appearance) */}
      {!isNewMoon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, transparent 0%, transparent 60%, rgba(0,0,0,0.2) 100%)',
            clipPath: clipPath,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Subtle highlight (3D effect) */}
      {!isNewMoon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 50%)',
            clipPath: clipPath,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Thin rim highlight - golden tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: isNewMoon
            ? 'inset 0 0 2px rgba(100, 120, 140, 0.15)'
            : 'inset 0 0 2px rgba(255, 220, 150, 0.2)',
          pointerEvents: 'none',
        }}
      />

      {/* Atmospheric edge glow - golden */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: '50%',
          border: '1px solid rgba(255, 215, 140, 0.12)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// Small moon for inline display (simplified version)
export function MiniMoon({ size = 24, phase = 0, phaseName = null }) {
  // Simplified accessible description for small display
  const ariaLabel = phaseName ? `Moon: ${phaseName}` : 'Moon phase indicator';

  // Calculate simple clip path for small moon
  const clipPath = useMemo(() => {
    let p = phase % 1;
    if (p < 0) p += 1;

    if (p < 0.02 || p > 0.98) return 'circle(0% at 50% 50%)';
    if (p > 0.47 && p < 0.53) return 'circle(50% at 50% 50%)';

    const isWaning = p > 0.5;
    const bulge = Math.cos(p * 2 * Math.PI);
    const steps = 16;
    let pathPoints = [];

    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = Math.PI * t;
      const y = 50 - 50 * Math.cos(angle);
      const terminatorX = isWaning
        ? 50 - bulge * 50 * Math.sin(angle)
        : 50 + bulge * 50 * Math.sin(angle);
      points.push({ x: terminatorX, y });
    }

    if (isWaning) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 - 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x}% ${y}%`);
      }
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x}% ${points[i].y}%`);
      }
    } else {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 + 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x}% ${y}%`);
      }
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x}% ${points[i].y}%`);
      }
    }

    return `polygon(${pathPoints.join(', ')})`;
  }, [phase]);

  const isNewMoon = phase < 0.02 || phase > 0.98;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
      }}
    >
      {/* Dark base */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: '#2a2a34',
        }}
      />

      {/* Lit portion - warm golden */}
      {!isNewMoon && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f5d88a 0%, #e8c870 50%, #d4b060 100%)',
            clipPath: clipPath,
          }}
        />
      )}
    </div>
  );
}
