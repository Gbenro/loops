// Luna Loops - Zodiac Sign Meanings

export const zodiacMeanings = {
  'Aries': {
    element: 'Fire',
    quality: 'Cardinal',
    symbol: '♈',
    keywords: ['Initiative', 'Courage', 'Action', 'Independence'],
    moonIn: 'Bold action energy. Patience runs low. Start things. Move your body. Act on impulse.',
    color: '#FF6B35',
  },

  'Taurus': {
    element: 'Earth',
    quality: 'Fixed',
    symbol: '♉',
    keywords: ['Stability', 'Sensuality', 'Persistence', 'Value'],
    moonIn: 'Grounding energy. Seek comfort and beauty. Move slowly. Trust what feels solid.',
    color: '#34D399',
  },

  'Gemini': {
    element: 'Air',
    quality: 'Mutable',
    symbol: '♊',
    keywords: ['Communication', 'Curiosity', 'Adaptability', 'Duality'],
    moonIn: 'Mental energy. Connect and communicate. Write. Learn. Follow curiosity.',
    color: '#FBBF24',
  },

  'Cancer': {
    element: 'Water',
    quality: 'Cardinal',
    symbol: '♋',
    keywords: ['Nurturing', 'Emotion', 'Home', 'Protection'],
    moonIn: 'Emotional depth. Tend to home and family. Honor your feelings. Seek safety.',
    color: '#60A5FA',
  },

  'Leo': {
    element: 'Fire',
    quality: 'Fixed',
    symbol: '♌',
    keywords: ['Creativity', 'Expression', 'Leadership', 'Heart'],
    moonIn: 'Creative energy. Express yourself. Play. Lead with heart. Seek joy.',
    color: '#F472B6',
  },

  'Virgo': {
    element: 'Earth',
    quality: 'Mutable',
    symbol: '♍',
    keywords: ['Service', 'Analysis', 'Health', 'Refinement'],
    moonIn: 'Refining energy. Organize and improve. Attend to health. Details matter.',
    color: '#A78BFA',
  },

  'Libra': {
    element: 'Air',
    quality: 'Cardinal',
    symbol: '♎',
    keywords: ['Balance', 'Partnership', 'Beauty', 'Justice'],
    moonIn: 'Harmonizing energy. Seek balance in relationships. Appreciate beauty. Find fairness.',
    color: '#38BDF8',
  },

  'Scorpio': {
    element: 'Water',
    quality: 'Fixed',
    symbol: '♏',
    keywords: ['Transformation', 'Intensity', 'Depth', 'Power'],
    moonIn: 'Deep energy. Face what you avoid. Transform through truth. Trust intensity.',
    color: '#FB7185',
  },

  'Sagittarius': {
    element: 'Fire',
    quality: 'Mutable',
    symbol: '♐',
    keywords: ['Adventure', 'Philosophy', 'Freedom', 'Truth'],
    moonIn: 'Expansive energy. Seek meaning and adventure. Speak truth. Need freedom.',
    color: '#FF6B35',
  },

  'Capricorn': {
    element: 'Earth',
    quality: 'Cardinal',
    symbol: '♑',
    keywords: ['Ambition', 'Structure', 'Discipline', 'Achievement'],
    moonIn: 'Focused energy. Work toward goals. Build structure. Discipline serves you.',
    color: '#34D399',
  },

  'Aquarius': {
    element: 'Air',
    quality: 'Fixed',
    symbol: '♒',
    keywords: ['Innovation', 'Community', 'Originality', 'Humanity'],
    moonIn: 'Unconventional energy. Think differently. Connect with community. Embrace the unusual.',
    color: '#60A5FA',
  },

  'Pisces': {
    element: 'Water',
    quality: 'Mutable',
    symbol: '♓',
    keywords: ['Intuition', 'Compassion', 'Dreams', 'Transcendence'],
    moonIn: 'Intuitive energy. Trust what you feel. Dream. Let compassion flow.',
    color: '#A78BFA',
  },
};

export function getZodiacInfo(sign) {
  return zodiacMeanings[sign] || zodiacMeanings['Aries'];
}

export function getElementDescription(element) {
  const elements = {
    'Fire': 'Active, passionate, transformative',
    'Earth': 'Grounded, practical, material',
    'Air': 'Mental, communicative, connective',
    'Water': 'Emotional, intuitive, flowing',
  };
  return elements[element] || '';
}
