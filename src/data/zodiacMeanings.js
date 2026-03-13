// Luna Loops - Zodiac Sign Meanings

// Stable daily pick — same result for the day, different per pool, changes tomorrow
export function pickForToday(pool) {
  if (!Array.isArray(pool)) return pool;
  const seed = new Date().toDateString() + pool[0].slice(0, 8);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return pool[hash % pool.length];
}

export const zodiacMeanings = {
  'Aries': {
    element: 'Fire',
    quality: 'Cardinal',
    symbol: '♈',
    keywords: ['Initiative', 'Courage', 'Action', 'Independence'],
    moonIn: [
      'Bold action energy. Patience runs low. Start things. Move your body. Act on impulse.',
      'The moon in Aries wants to move. Do not wait to be ready — begin.',
      'Energy runs high and fast. Use it. The window for action is now.',
      'Courage is available. What have you been hesitating on? This is the moment.',
      'Impulse and initiative. The moon in Aries does not wait — neither should you.',
    ],
    color: '#FF6B35',
  },

  'Taurus': {
    element: 'Earth',
    quality: 'Fixed',
    symbol: '♉',
    keywords: ['Stability', 'Sensuality', 'Persistence', 'Value'],
    moonIn: [
      'Grounding energy. Seek comfort and beauty. Move slowly. Trust what feels solid.',
      'The moon in Taurus slows everything down. Let that be welcome.',
      'Stability and the senses. What feels good, real, and lasting? Lean into it.',
      'This is a time for steadiness. Do not rush. What endures is more important than what is fast.',
      'The body knows. The moon in Taurus asks you to trust what you can touch, taste, and feel.',
    ],
    color: '#34D399',
  },

  'Gemini': {
    element: 'Air',
    quality: 'Mutable',
    symbol: '♊',
    keywords: ['Communication', 'Curiosity', 'Adaptability', 'Duality'],
    moonIn: [
      'Mental energy. Connect and communicate. Write. Learn. Follow curiosity.',
      'The mind is quick now. Let it wander — something useful will emerge from the connections.',
      'The moon in Gemini wants conversation. Who do you need to talk to?',
      'Curiosity is the compass. Follow it wherever it leads — restlessness is information.',
      'Ideas are moving fast. Catch them. Write them down. Do not demand they be finished.',
    ],
    color: '#FBBF24',
  },

  'Cancer': {
    element: 'Water',
    quality: 'Cardinal',
    symbol: '♋',
    keywords: ['Nurturing', 'Emotion', 'Home', 'Protection'],
    moonIn: [
      'Emotional depth. Tend to home and family. Honor your feelings. Seek safety.',
      'The moon is in its home sign. What does home mean to you right now?',
      'Feeling runs deep. Do not push through it — go with it.',
      'The moon in Cancer asks for tenderness. Toward others, and toward yourself.',
      'Protective and soft. What needs care right now — in your life, your space, your relationships?',
    ],
    color: '#60A5FA',
  },

  'Leo': {
    element: 'Fire',
    quality: 'Fixed',
    symbol: '♌',
    keywords: ['Creativity', 'Expression', 'Leadership', 'Heart'],
    moonIn: [
      'Creative energy. Express yourself. Play. Lead with heart. Seek joy.',
      'The moon in Leo wants to be seen. Do not hide what you are making.',
      'Full-hearted. What brings you joy right now? Do that.',
      'Creative fire is available. Give it a form. Express what is moving in you.',
      'Warmth and radiance. The moon in Leo asks you to shine — not to perform, but to genuinely give of yourself.',
    ],
    color: '#F472B6',
  },

  'Virgo': {
    element: 'Earth',
    quality: 'Mutable',
    symbol: '♍',
    keywords: ['Service', 'Analysis', 'Health', 'Refinement'],
    moonIn: [
      'Refining energy. Organize and improve. Attend to health. Details matter.',
      'The moon in Virgo wants order. What needs to be sorted, cleaned, or improved?',
      'Precision and care. The small things are worth attending to now.',
      'The body and the work. How is your health? How is your routine? Small adjustments compound.',
      'Discernment is sharp. The moon in Virgo can see what is not quite right — and knows how to fix it.',
    ],
    color: '#A78BFA',
  },

  'Libra': {
    element: 'Air',
    quality: 'Cardinal',
    symbol: '♎',
    keywords: ['Balance', 'Partnership', 'Beauty', 'Justice'],
    moonIn: [
      'Harmonizing energy. Seek balance in relationships. Appreciate beauty. Find fairness.',
      'The moon in Libra wants peace. What needs to be brought into balance?',
      'Relating and reciprocity. Who in your life deserves more of your attention?',
      'Aesthetic and fair. What is beautiful around you? What is unjust? Both are visible now.',
      'The moon in Libra weighs everything. Let that instinct guide you — something in you knows what is fair.',
    ],
    color: '#38BDF8',
  },

  'Scorpio': {
    element: 'Water',
    quality: 'Fixed',
    symbol: '♏',
    keywords: ['Transformation', 'Intensity', 'Depth', 'Power'],
    moonIn: [
      'Deep energy. Face what you avoid. Transform through truth. Trust intensity.',
      'The moon in Scorpio does not stay on the surface. What is underneath?',
      'Intensity is here. Do not dilute it — go where it leads.',
      'Truth and transformation. What needs to be said, seen, or released that you have been holding back?',
      'The moon in Scorpio illuminates what hides. What have you been unwilling to look at?',
    ],
    color: '#FB7185',
  },

  'Sagittarius': {
    element: 'Fire',
    quality: 'Mutable',
    symbol: '♐',
    keywords: ['Adventure', 'Philosophy', 'Freedom', 'Truth'],
    moonIn: [
      'Expansive energy. Seek meaning and adventure. Speak truth. Need freedom.',
      'The moon in Sagittarius wants to roam. What have you been too narrow about?',
      'Meaning and movement. What gives your life direction? This is a good time to find out.',
      'The truth wants to be spoken. The moon in Sagittarius does not stay polite — say what is real.',
      'Adventure is available. Even in small ways — go somewhere, think something new, ask the big question.',
    ],
    color: '#FF6B35',
  },

  'Capricorn': {
    element: 'Earth',
    quality: 'Cardinal',
    symbol: '♑',
    keywords: ['Ambition', 'Structure', 'Discipline', 'Achievement'],
    moonIn: [
      'Focused energy. Work toward goals. Build structure. Discipline serves you.',
      'The moon in Capricorn wants to build. What deserves your serious effort right now?',
      'Long-term thinking. The moon in Capricorn sees the mountain — not just the next step.',
      'Ambition and patience. What are you building that will matter in five years?',
      'Structure and discipline. The moon in Capricorn does not cut corners. Neither should you.',
    ],
    color: '#34D399',
  },

  'Aquarius': {
    element: 'Air',
    quality: 'Fixed',
    symbol: '♒',
    keywords: ['Innovation', 'Community', 'Originality', 'Humanity'],
    moonIn: [
      'Unconventional energy. Think differently. Connect with community. Embrace the unusual.',
      'The moon in Aquarius detaches from the personal to see the larger pattern. What do you see from up there?',
      'Community and originality. Who needs you? What needs to change?',
      'The unexpected is welcome now. What have you been too conventional to try?',
      'Collective thinking. The moon in Aquarius asks what you can contribute to something larger than yourself.',
    ],
    color: '#60A5FA',
  },

  'Pisces': {
    element: 'Water',
    quality: 'Mutable',
    symbol: '♓',
    keywords: ['Intuition', 'Compassion', 'Dreams', 'Transcendence'],
    moonIn: [
      'Intuitive energy. Trust what you feel. Dream. Let compassion flow.',
      'The moon in Pisces dissolves edges. Let that happen — not everything needs to be defined right now.',
      'Dreams and feeling. What has been arriving at the edge of your awareness? Pay attention to it.',
      'Compassion is open. The moon in Pisces makes it easy to feel for others — let that soften you.',
      'The veil is thin. What is your intuition telling you that your thinking mind is trying to override?',
    ],
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
