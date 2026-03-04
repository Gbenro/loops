// Cosmic Loops - Lunar Month Names and Meanings

export const lunarMonths = {
  'Wolf': {
    name: 'Wolf Moon',
    timing: 'January',
    meaning: 'Deep cold. Wolves howl. Survival depends on community. Who is your pack?',
    keywords: ['Survival', 'Strength', 'Pack', 'Community'],
  },

  'Snow': {
    name: 'Snow Moon',
    timing: 'February',
    meaning: 'Heavy snows fall. Patience and inner reflection. Trust the waiting.',
    keywords: ['Patience', 'Stillness', 'Reflection', 'Endurance'],
  },

  'Worm': {
    name: 'Worm Moon',
    timing: 'March',
    meaning: 'Ground thaws. Life stirs below the surface. Renewal begins in the dark.',
    keywords: ['Awakening', 'Emergence', 'Renewal', 'Spring'],
  },

  'Pink': {
    name: 'Pink Moon',
    timing: 'April',
    meaning: 'Wild phlox blooms pink. Color returns. Beauty emerges after dormancy.',
    keywords: ['Beauty', 'Bloom', 'Color', 'Growth'],
  },

  'Flower': {
    name: 'Flower Moon',
    timing: 'May',
    meaning: 'Flowers everywhere. Peak abundance and fertility. Create freely.',
    keywords: ['Abundance', 'Fertility', 'Celebration', 'Bloom'],
  },

  'Strawberry': {
    name: 'Strawberry Moon',
    timing: 'June',
    meaning: 'First harvest ripens. Sweet rewards for patience. Taste what you\'ve grown.',
    keywords: ['Harvest', 'Sweetness', 'Reward', 'Summer'],
  },

  'Buck': {
    name: 'Buck Moon',
    timing: 'July',
    meaning: 'Antlers grow. Peak summer power. What natural strength are you developing?',
    keywords: ['Power', 'Growth', 'Peak', 'Renewal'],
  },

  'Sturgeon': {
    name: 'Sturgeon Moon',
    timing: 'August',
    meaning: 'Harvest from deep waters. Abundance exists in places you can\'t see.',
    keywords: ['Abundance', 'Depth', 'Provision', 'Harvest'],
  },

  'Harvest': {
    name: 'Harvest Moon',
    timing: 'September',
    meaning: 'The main gathering. Bring in what you\'ve grown before winter comes.',
    keywords: ['Harvest', 'Gratitude', 'Completion', 'Gathering'],
  },

  "Hunter's": {
    name: "Hunter's Moon",
    timing: 'October',
    meaning: 'Hunt season begins. Strategic pursuit. What do you need for winter?',
    keywords: ['Strategy', 'Preparation', 'Hunt', 'Focus'],
  },

  'Beaver': {
    name: 'Beaver Moon',
    timing: 'November',
    meaning: 'Build your dam before freeze. Secure your shelter. Prepare with urgency.',
    keywords: ['Building', 'Preparation', 'Security', 'Industry'],
  },

  'Cold': {
    name: 'Cold Moon',
    timing: 'December',
    meaning: 'Longest nights arrive. Go inward. Tend your inner fire. Trust returning light.',
    keywords: ['Cold', 'Inward', 'Rest', 'Darkness'],
  },

  'Blue': {
    name: 'Blue Moon',
    timing: 'Variable',
    meaning: 'Rare second full moon. Unexpected magic. Don\'t waste it on ordinary wishes.',
    keywords: ['Rare', 'Magic', 'Surprise', 'Opportunity'],
  },
};

export function getLunarMonthInfo(name) {
  return lunarMonths[name] || lunarMonths['Wolf'];
}
