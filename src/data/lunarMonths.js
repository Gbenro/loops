// Luna Loops - Lunar Month Names and Meanings

export const lunarMonths = {
  'Wolf': {
    name: 'Wolf Moon',
    timing: 'January',
    meaning: 'Deep cold. Wolves howl. Survival depends on community. Who is your pack?',
    meaningSouth: 'Peak summer heat. Sun at full strength. What is flourishing under your care?',
    keywords: ['Survival', 'Strength', 'Pack', 'Community'],
  },

  'Snow': {
    name: 'Snow Moon',
    timing: 'February',
    meaning: 'Heavy snows fall. Patience and inner reflection. Trust the waiting.',
    meaningSouth: 'Late summer abundance. Energy peaks before the first autumn cooling. Gather what is ripe.',
    keywords: ['Patience', 'Stillness', 'Reflection', 'Endurance'],
  },

  'Worm': {
    name: 'Worm Moon',
    timing: 'March',
    meaning: 'Ground thaws. Life stirs below the surface. Renewal begins in the dark.',
    meaningSouth: 'Autumn arrives. Leaves turn. Energy begins its inward turn.',
    keywords: ['Awakening', 'Emergence', 'Renewal', 'Spring'],
  },

  'Pink': {
    name: 'Pink Moon',
    timing: 'April',
    meaning: 'Wild phlox blooms pink. Color returns. Beauty emerges after dormancy.',
    meaningSouth: 'Deep autumn. Days shorten. What needs to be released before winter?',
    keywords: ['Beauty', 'Bloom', 'Color', 'Growth'],
  },

  'Flower': {
    name: 'Flower Moon',
    timing: 'May',
    meaning: 'Flowers everywhere. Peak abundance and fertility. Create freely.',
    meaningSouth: 'The wheel turns toward winter. Prepare your inner reserves. Rest approaches.',
    keywords: ['Abundance', 'Fertility', 'Celebration', 'Bloom'],
  },

  'Strawberry': {
    name: 'Strawberry Moon',
    timing: 'June',
    meaning: 'First harvest ripens. Sweet rewards for patience. Taste what you\'ve grown.',
    meaningSouth: 'Midwinter. The shortest days. Go deep. Tend your inner fire.',
    keywords: ['Harvest', 'Sweetness', 'Reward', 'Summer'],
  },

  'Buck': {
    name: 'Buck Moon',
    timing: 'July',
    meaning: 'Antlers grow. Peak summer power. What natural strength are you developing?',
    meaningSouth: 'Deep winter. Stillness and quiet strength. What grows in you during the cold?',
    keywords: ['Power', 'Growth', 'Peak', 'Renewal'],
  },

  'Sturgeon': {
    name: 'Sturgeon Moon',
    timing: 'August',
    meaning: 'Harvest from deep waters. Abundance exists in places you can\'t see.',
    meaningSouth: 'Late winter. First stirrings beneath the surface. The long cold is nearly done.',
    keywords: ['Abundance', 'Depth', 'Provision', 'Harvest'],
  },

  'Harvest': {
    name: 'Harvest Moon',
    timing: 'September',
    meaning: 'The main gathering. Bring in what you\'ve grown before winter comes.',
    meaningSouth: 'Spring awakens. Warmth returns. New growth emerges — meet it with intention.',
    keywords: ['Harvest', 'Gratitude', 'Completion', 'Gathering'],
  },

  "Hunter's": {
    name: "Hunter's Moon",
    timing: 'October',
    meaning: 'Hunt season begins. Strategic pursuit. What do you need for winter?',
    meaningSouth: 'Spring in full motion. Energy rises. What new directions are calling you?',
    keywords: ['Strategy', 'Preparation', 'Hunt', 'Focus'],
  },

  'Beaver': {
    name: 'Beaver Moon',
    timing: 'November',
    meaning: 'Build your dam before freeze. Secure your shelter. Prepare with urgency.',
    meaningSouth: 'Early summer arrives. Days lengthen. Build while the energy is expansive.',
    keywords: ['Building', 'Preparation', 'Security', 'Industry'],
  },

  'Cold': {
    name: 'Cold Moon',
    timing: 'December',
    meaning: 'Longest nights arrive. Go inward. Tend your inner fire. Trust returning light.',
    meaningSouth: 'Peak summer light. Long bright days. The year is at its fullest outward arc.',
    keywords: ['Cold', 'Inward', 'Rest', 'Darkness'],
  },

  'Blue': {
    name: 'Blue Moon',
    timing: 'Variable',
    meaning: 'Rare second full moon. Unexpected magic. Don\'t waste it on ordinary wishes.',
    meaningSouth: 'Rare second full moon. Unexpected magic. Don\'t waste it on ordinary wishes.',
    keywords: ['Rare', 'Magic', 'Surprise', 'Opportunity'],
  },
};

export function getLunarMonthInfo(name, hemisphere = 'north') {
  const info = lunarMonths[name] || lunarMonths['Wolf'];
  if (hemisphere === 'south' && info.meaningSouth) {
    return { ...info, meaning: info.meaningSouth };
  }
  return info;
}
