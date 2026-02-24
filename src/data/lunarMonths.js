// Cosmic Loops - Lunar Month Names and Meanings
// Traditional names for each moon of the year

export const lunarMonths = {
  'Wolf': {
    name: 'Wolf Moon',
    timing: 'January',
    meaning: 'In the deep cold, wolves howl. A time of survival, community, and primal strength.',
    keywords: ['Survival', 'Strength', 'Pack', 'Howling'],
  },

  'Snow': {
    name: 'Snow Moon',
    timing: 'February',
    meaning: 'The heaviest snows fall. A time of patience and inner reflection.',
    keywords: ['Patience', 'Stillness', 'Reflection', 'Endurance'],
  },

  'Worm': {
    name: 'Worm Moon',
    timing: 'March',
    meaning: 'The ground thaws and earthworms emerge. Renewal begins below the surface.',
    keywords: ['Awakening', 'Emergence', 'Renewal', 'Spring'],
  },

  'Pink': {
    name: 'Pink Moon',
    timing: 'April',
    meaning: 'Named for pink phlox flowers. Full bloom approaches. Beauty emerges.',
    keywords: ['Beauty', 'Bloom', 'Color', 'Growth'],
  },

  'Flower': {
    name: 'Flower Moon',
    timing: 'May',
    meaning: 'Flowers are everywhere. Abundance and fertility peak.',
    keywords: ['Abundance', 'Fertility', 'Celebration', 'Bloom'],
  },

  'Strawberry': {
    name: 'Strawberry Moon',
    timing: 'June',
    meaning: 'Time to gather ripening strawberries. Sweet rewards for patience.',
    keywords: ['Harvest', 'Sweetness', 'Reward', 'Summer'],
  },

  'Buck': {
    name: 'Buck Moon',
    timing: 'July',
    meaning: "Buck deer grow new antlers. Growth, power, and the sun's peak.",
    keywords: ['Power', 'Growth', 'Masculinity', 'Peak'],
  },

  'Sturgeon': {
    name: 'Sturgeon Moon',
    timing: 'August',
    meaning: 'Sturgeon fish are abundant. Harvest from deep waters.',
    keywords: ['Abundance', 'Depth', 'Provision', 'Harvest'],
  },

  'Harvest': {
    name: 'Harvest Moon',
    timing: 'September',
    meaning: 'Crops are gathered. The main harvest. Work bears fruit.',
    keywords: ['Harvest', 'Gratitude', 'Completion', 'Fruits'],
  },

  "Hunter's": {
    name: "Hunter's Moon",
    timing: 'October',
    meaning: 'Hunting season begins. Preparation for winter. Strategic action.',
    keywords: ['Strategy', 'Preparation', 'Hunt', 'Focus'],
  },

  'Beaver': {
    name: 'Beaver Moon',
    timing: 'November',
    meaning: 'Beavers build dams for winter. Time to prepare and secure.',
    keywords: ['Building', 'Preparation', 'Security', 'Industry'],
  },

  'Cold': {
    name: 'Cold Moon',
    timing: 'December',
    meaning: 'Winter arrives fully. Long nights. Time for going inward.',
    keywords: ['Cold', 'Inward', 'Rest', 'Darkness'],
  },

  'Blue': {
    name: 'Blue Moon',
    timing: 'Variable',
    meaning: 'The rare second full moon in a month. Unexpected magic.',
    keywords: ['Rare', 'Magic', 'Surprise', 'Extra'],
  },
};

// Get lunar month info
export function getLunarMonthInfo(name) {
  return lunarMonths[name] || lunarMonths['Wolf'];
}
