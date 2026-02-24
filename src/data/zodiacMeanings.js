// Cosmic Loops - Zodiac Sign Meanings
// Element, quality, and moon-in-sign interpretations

export const zodiacMeanings = {
  'Aries': {
    element: 'Fire',
    quality: 'Cardinal',
    symbol: '♈',
    keywords: ['Initiative', 'Courage', 'Action', 'Independence'],
    moonIn: 'Time for bold action and new starts. Energy is high, patience low. Act on impulse.',
    color: '#FF6B35',
  },

  'Taurus': {
    element: 'Earth',
    quality: 'Fixed',
    symbol: '♉',
    keywords: ['Stability', 'Sensuality', 'Persistence', 'Value'],
    moonIn: 'Ground yourself. Seek comfort and beauty. Move slowly and deliberately.',
    color: '#34D399',
  },

  'Gemini': {
    element: 'Air',
    quality: 'Mutable',
    symbol: '♊',
    keywords: ['Communication', 'Curiosity', 'Adaptability', 'Duality'],
    moonIn: 'Mind is active. Connect, communicate, learn. Good for writing and conversations.',
    color: '#FBBF24',
  },

  'Cancer': {
    element: 'Water',
    quality: 'Cardinal',
    symbol: '♋',
    keywords: ['Nurturing', 'Emotion', 'Home', 'Protection'],
    moonIn: 'Emotional depth surfaces. Tend to home and family. Honor your feelings.',
    color: '#60A5FA',
  },

  'Leo': {
    element: 'Fire',
    quality: 'Fixed',
    symbol: '♌',
    keywords: ['Creativity', 'Expression', 'Leadership', 'Heart'],
    moonIn: 'Express yourself. Create. Lead with heart. Seek recognition and joy.',
    color: '#F472B6',
  },

  'Virgo': {
    element: 'Earth',
    quality: 'Mutable',
    symbol: '♍',
    keywords: ['Service', 'Analysis', 'Health', 'Refinement'],
    moonIn: 'Organize and refine. Attend to details. Health and routine matter now.',
    color: '#A78BFA',
  },

  'Libra': {
    element: 'Air',
    quality: 'Cardinal',
    symbol: '♎',
    keywords: ['Balance', 'Partnership', 'Beauty', 'Justice'],
    moonIn: 'Seek harmony in relationships. Appreciate beauty. Balance is key.',
    color: '#38BDF8',
  },

  'Scorpio': {
    element: 'Water',
    quality: 'Fixed',
    symbol: '♏',
    keywords: ['Transformation', 'Intensity', 'Depth', 'Power'],
    moonIn: 'Go deep. Face shadows. Transformation is possible. Trust intensity.',
    color: '#FB7185',
  },

  'Sagittarius': {
    element: 'Fire',
    quality: 'Mutable',
    symbol: '♐',
    keywords: ['Adventure', 'Philosophy', 'Freedom', 'Truth'],
    moonIn: 'Expand horizons. Seek meaning and adventure. Speak your truth.',
    color: '#FF6B35',
  },

  'Capricorn': {
    element: 'Earth',
    quality: 'Cardinal',
    symbol: '♑',
    keywords: ['Ambition', 'Structure', 'Discipline', 'Achievement'],
    moonIn: 'Focus on goals. Build structure. Discipline serves you now.',
    color: '#34D399',
  },

  'Aquarius': {
    element: 'Air',
    quality: 'Fixed',
    symbol: '♒',
    keywords: ['Innovation', 'Community', 'Originality', 'Humanity'],
    moonIn: 'Think unconventionally. Connect with community. Embrace the unusual.',
    color: '#60A5FA',
  },

  'Pisces': {
    element: 'Water',
    quality: 'Mutable',
    symbol: '♓',
    keywords: ['Intuition', 'Compassion', 'Dreams', 'Transcendence'],
    moonIn: 'Trust intuition. Dream and imagine. Compassion flows freely.',
    color: '#A78BFA',
  },
};

// Get sign info
export function getZodiacInfo(sign) {
  return zodiacMeanings[sign] || zodiacMeanings['Aries'];
}

// Get element description
export function getElementDescription(element) {
  const elements = {
    'Fire': 'Active, passionate, transformative energy',
    'Earth': 'Grounded, practical, material energy',
    'Air': 'Mental, communicative, connective energy',
    'Water': 'Emotional, intuitive, flowing energy',
  };
  return elements[element] || '';
}
