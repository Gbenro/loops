// Luna Loops - Lunar Month Names and Meanings

export const lunarMonths = {
  'Wolf': {
    name: 'Wolf Moon',
    nameSouth: 'Fire Moon',
    timing: 'January',
    meaning: 'Deep cold. Wolves howl. Survival depends on community. Who is your pack?',
    meaningSouth: 'Peak summer fire. The sun is at full force. What in you burns brightest right now?',
    keywords: ['Survival', 'Strength', 'Pack', 'Community'],
  },

  'Snow': {
    name: 'Snow Moon',
    nameSouth: 'Abundance Moon',
    timing: 'February',
    meaning: 'Heavy snows fall. Patience and inner reflection. Trust the waiting.',
    meaningSouth: 'Late summer abundance. The land is full. Gather and give thanks before the turn.',
    keywords: ['Patience', 'Stillness', 'Reflection', 'Endurance'],
  },

  'Worm': {
    name: 'Worm Moon',
    nameSouth: 'Harvest Moon',
    timing: 'March',
    meaning: 'Ground thaws. Life stirs below the surface. Renewal begins in the dark.',
    meaningSouth: 'The main gathering. Autumn arrives with its gifts. Bring in what you have grown.',
    keywords: ['Awakening', 'Emergence', 'Renewal', 'Spring'],
  },

  'Pink': {
    name: 'Pink Moon',
    nameSouth: 'Release Moon',
    timing: 'April',
    meaning: 'Wild phlox blooms pink. Color returns. Beauty emerges after dormancy.',
    meaningSouth: 'Deep autumn. Days shorten. What no longer serves is ready to be released.',
    keywords: ['Beauty', 'Bloom', 'Color', 'Growth'],
  },

  'Flower': {
    name: 'Flower Moon',
    nameSouth: 'Stillness Moon',
    timing: 'May',
    meaning: 'Flowers everywhere. Peak abundance and fertility. Create freely.',
    meaningSouth: 'The world quiets. Winter draws close. Find stillness before the long dark.',
    keywords: ['Abundance', 'Fertility', 'Celebration', 'Bloom'],
  },

  'Strawberry': {
    name: 'Strawberry Moon',
    nameSouth: 'Seed Moon',
    timing: 'June',
    meaning: 'First harvest ripens. Sweet rewards for patience. Taste what you\'ve grown.',
    meaningSouth: 'Midwinter. The darkest point. Plant the seeds of what you wish to grow in spring.',
    keywords: ['Harvest', 'Sweetness', 'Reward', 'Summer'],
  },

  'Buck': {
    name: 'Buck Moon',
    nameSouth: 'Emergence Moon',
    timing: 'July',
    meaning: 'Antlers grow. Peak summer power. What natural strength are you developing?',
    meaningSouth: 'The cold begins to lift. Something stirs. What is ready to emerge from within you?',
    keywords: ['Power', 'Growth', 'Peak', 'Renewal'],
  },

  'Sturgeon': {
    name: 'Sturgeon Moon',
    nameSouth: 'Bloom Moon',
    timing: 'August',
    meaning: 'Harvest from deep waters. Abundance exists in places you can\'t see.',
    meaningSouth: 'Spring blooms open. Life returns visibly. Let what is ready in you come forward.',
    keywords: ['Abundance', 'Depth', 'Provision', 'Harvest'],
  },

  'Harvest': {
    name: 'Harvest Moon',
    nameSouth: 'Radiance Moon',
    timing: 'September',
    meaning: 'The main gathering. Bring in what you\'ve grown before winter comes.',
    meaningSouth: 'Full spring radiance. Light and warmth in abundance. Shine what you have been growing.',
    keywords: ['Harvest', 'Gratitude', 'Completion', 'Gathering'],
  },

  "Hunter's": {
    name: "Hunter's Moon",
    nameSouth: 'Ripening Moon',
    timing: 'October',
    meaning: 'Hunt season begins. Strategic pursuit. What do you need for winter?',
    meaningSouth: 'Summer ripens everything. What you have tended is coming into fullness.',
    keywords: ['Strategy', 'Preparation', 'Hunt', 'Focus'],
  },

  'Beaver': {
    name: 'Beaver Moon',
    nameSouth: 'Gathering Moon',
    timing: 'November',
    meaning: 'Build your dam before freeze. Secure your shelter. Prepare with urgency.',
    meaningSouth: 'Late summer fullness. Gather the harvest of this cycle before the wheel turns.',
    keywords: ['Building', 'Preparation', 'Security', 'Industry'],
  },

  'Cold': {
    name: 'Cold Moon',
    nameSouth: 'Deep Rest Moon',
    timing: 'December',
    meaning: 'Longest nights arrive. Go inward. Tend your inner fire. Trust returning light.',
    meaningSouth: 'Peak summer heat begins to soften. A brief rest before the year completes its arc.',
    keywords: ['Cold', 'Inward', 'Rest', 'Darkness'],
  },

  'Blue': {
    name: 'Blue Moon',
    nameSouth: 'Blue Moon',
    timing: 'Variable',
    meaning: 'Rare second full moon. Unexpected magic. Don\'t waste it on ordinary wishes.',
    meaningSouth: 'Rare second full moon. Unexpected magic. Don\'t waste it on ordinary wishes.',
    keywords: ['Rare', 'Magic', 'Surprise', 'Opportunity'],
  },
};

export function getLunarMonthInfo(name, hemisphere = 'north') {
  const info = lunarMonths[name] || lunarMonths['Wolf'];
  if (hemisphere === 'south') {
    return {
      ...info,
      name: info.nameSouth || info.name,
      meaning: info.meaningSouth || info.meaning,
    };
  }
  return info;
}
