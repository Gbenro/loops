// Cosmic Loops - Star Field Background
// Animated twinkling stars

import { useMemo } from 'react';

export function StarField({ count = 60, opacity = 1 }) {
  // Generate consistent star positions using seeded random
  const stars = useMemo(() => {
    const seed = 12345;
    const seededRandom = (i) => {
      const x = Math.sin(seed + i * 9999) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: seededRandom(i * 3) * 100,
      y: seededRandom(i * 3 + 1) * 100,
      size: seededRandom(i * 3 + 2) * 1.5 + 0.5,
      delay: seededRandom(i * 7) * 5,
      duration: seededRandom(i * 11) * 3 + 2,
      brightness: seededRandom(i * 13) * 0.6 + 0.4,
    }));
  }, [count]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity,
      }}
    >
      {stars.map(star => (
        <div
          key={star.id}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: `rgba(245, 230, 200, ${star.brightness})`,
            animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Shooting star effect (optional enhancement)
export function ShootingStar({ active = false }) {
  if (!active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20%',
        right: '10%',
        width: 2,
        height: 2,
        borderRadius: '50%',
        background: '#f5e6c8',
        boxShadow: '-30px 0 15px 1px rgba(245, 230, 200, 0.3)',
        animation: 'shooting 1s ease-in-out forwards',
      }}
    />
  );
}
