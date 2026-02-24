// Cosmic Loops - Natal Chart Data
// Hardcoded for this user (Sep 23 1990, Lagos Nigeria, 20:00)

export const NATAL = {
  // Big Three
  sun: {
    sign: 'Libra',
    deg: 0.6,
    lon: 180.6, // Ecliptic longitude
    symbol: '♎',
    element: 'Air',
    quality: 'Cardinal',
    role: 'Identity',
    description: 'Born on the Autumn Equinox — the first degree of Libra. Your core identity seeks balance, beauty, and harmony. You are a bridge-builder, seeing all sides, sometimes to your own frustration.',
  },

  moon: {
    sign: 'Scorpio',
    deg: 21.1,
    lon: 231.1,
    symbol: '♏',
    element: 'Water',
    quality: 'Fixed',
    role: 'Inner World',
    description: 'Your emotional nature runs deep and intense. You feel everything deeply, process in private, and transform through crisis. Trust is sacred. Betrayal cuts to the bone.',
  },

  rising: {
    sign: 'Libra',
    deg: 23.5,
    lon: 203.5,
    symbol: '♎',
    element: 'Air',
    quality: 'Cardinal',
    role: 'First Impression',
    description: 'You present as diplomatic, charming, and aesthetically aware. People see grace and balance. But your Scorpio moon means the depths are far more intense than the surface suggests.',
  },

  // Birth data
  birth: {
    date: 'September 23, 1990',
    time: '20:00',
    location: 'Lagos, Nigeria',
    coordinates: { lat: 6.5244, lng: 3.3792 },
    timezone: 'UTC+1',
  },
};

// Element summary
export function getNatalElementSummary() {
  const elements = [NATAL.sun.element, NATAL.moon.element, NATAL.rising.element];
  const counts = elements.reduce((acc, el) => {
    acc[el] = (acc[el] || 0) + 1;
    return acc;
  }, {});

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return {
    dominant: dominant[0],
    breakdown: counts,
    summary: `Dominant ${dominant[0]} energy (${dominant[1]} of 3 placements)`,
  };
}

// Get natal placement by name
export function getNatalPlacement(name) {
  return NATAL[name] || null;
}
