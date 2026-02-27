// Cosmic Loops - Solar/Season Calculations
// Equinox, solstice, and season tracking

// The 8 solar thresholds (Celtic cross-quarter days + astronomical)
const SOLAR_THRESHOLDS = [
  { name: 'Winter Solstice', day: 355 },  // Dec 21
  { name: 'Imbolc',          day: 33  },  // Feb 2
  { name: 'Spring Equinox',  day: 80  },  // Mar 21
  { name: 'Beltane',         day: 121 },  // May 1
  { name: 'Summer Solstice', day: 172 },  // Jun 21
  { name: 'Lughnasadh',      day: 213 },  // Aug 1
  { name: 'Autumn Equinox',  day: 266 },  // Sep 23
  { name: 'Samhain',         day: 305 },  // Nov 1
];

// Season definitions with day-of-year boundaries (Northern Hemisphere)
const SEASONS = [
  { name: 'Winter', start: 355, end: 80, next: 'Spring Equinox', nextDay: 80 },
  { name: 'Spring', start: 80, end: 172, next: 'Summer Solstice', nextDay: 172 },
  { name: 'Summer', start: 172, end: 266, next: 'Autumn Equinox', nextDay: 266 },
  { name: 'Autumn', start: 266, end: 355, next: 'Winter Solstice', nextDay: 355 },
];

// Solar event descriptions
const SOLAR_EVENTS = {
  'Spring Equinox': {
    meaning: 'Day and night equal. New beginnings emerge.',
    date: 'March 20',
  },
  'Summer Solstice': {
    meaning: 'Longest day. Peak of light and energy.',
    date: 'June 21',
  },
  'Autumn Equinox': {
    meaning: 'Day and night equal. Time to harvest and release.',
    date: 'September 22',
  },
  'Winter Solstice': {
    meaning: 'Longest night. Turning point toward light.',
    date: 'December 21',
  },
};

// Get day of year (1-365/366)
export function getDayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// Get current season info
export function getSeasonInfo(date = new Date()) {
  const dayOfYear = getDayOfYear(date);
  const year = date.getFullYear();

  // Handle winter wrapping around year boundary
  if (dayOfYear >= 355 || dayOfYear < 80) {
    const daysInYear = isLeapYear(year) ? 366 : 365;
    let daysToNext;
    if (dayOfYear >= 355) {
      daysToNext = (daysInYear - dayOfYear) + 80;
    } else {
      daysToNext = 80 - dayOfYear;
    }

    // Calculate progress through winter
    const winterStart = 355;
    const winterLength = (daysInYear - 355) + 80;
    let dayIntoWinter;
    if (dayOfYear >= 355) {
      dayIntoWinter = dayOfYear - 355;
    } else {
      dayIntoWinter = (daysInYear - 355) + dayOfYear;
    }
    const progress = dayIntoWinter / winterLength;

    return {
      name: 'Winter',
      nextEvent: 'Spring Equinox',
      daysToNext,
      progress: Math.round(progress * 100),
      ...SOLAR_EVENTS['Spring Equinox'],
    };
  }

  for (const season of SEASONS) {
    if (season.name === 'Winter') continue; // Handled above

    if (dayOfYear >= season.start && dayOfYear < season.end) {
      const daysToNext = season.nextDay - dayOfYear;
      const seasonLength = season.end - season.start;
      const dayIntoSeason = dayOfYear - season.start;
      const progress = dayIntoSeason / seasonLength;

      return {
        name: season.name,
        nextEvent: season.next,
        daysToNext,
        progress: Math.round(progress * 100),
        ...SOLAR_EVENTS[season.next],
      };
    }
  }

  // Fallback
  return {
    name: 'Winter',
    nextEvent: 'Spring Equinox',
    daysToNext: 80 - dayOfYear,
    progress: 0,
  };
}

// Check if leap year
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Get sun sign (approximate, based on date)
export function getSunSign(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  const signs = [
    { sign: 'Capricorn', start: [12, 22], end: [1, 19] },
    { sign: 'Aquarius', start: [1, 20], end: [2, 18] },
    { sign: 'Pisces', start: [2, 19], end: [3, 20] },
    { sign: 'Aries', start: [3, 21], end: [4, 19] },
    { sign: 'Taurus', start: [4, 20], end: [5, 20] },
    { sign: 'Gemini', start: [5, 21], end: [6, 20] },
    { sign: 'Cancer', start: [6, 21], end: [7, 22] },
    { sign: 'Leo', start: [7, 23], end: [8, 22] },
    { sign: 'Virgo', start: [8, 23], end: [9, 22] },
    { sign: 'Libra', start: [9, 23], end: [10, 22] },
    { sign: 'Scorpio', start: [10, 23], end: [11, 21] },
    { sign: 'Sagittarius', start: [11, 22], end: [12, 21] },
  ];

  for (const s of signs) {
    const [startMonth, startDay] = s.start;
    const [endMonth, endDay] = s.end;

    // Handle Capricorn wrapping around year
    if (startMonth > endMonth) {
      if ((month === startMonth && day >= startDay) ||
          (month === endMonth && day <= endDay) ||
          (month === 12 && month > startMonth) ||
          (month === 1 && month < endMonth)) {
        return s.sign;
      }
    } else {
      if ((month === startMonth && day >= startDay) ||
          (month === endMonth && day <= endDay) ||
          (month > startMonth && month < endMonth)) {
        return s.sign;
      }
    }
  }

  return 'Capricorn'; // Default fallback
}

// Get threshold position info
function getThresholdPosition(date = new Date()) {
  const dayOfYear = getDayOfYear(date);
  const year = date.getFullYear();
  const isLeap = isLeapYear(year);
  const daysInYear = isLeap ? 366 : 365;

  // Sort thresholds by day for processing
  // Handle Winter Solstice wrapping: treat it as either day 355 or day -10 (355 - 365)
  let lastThreshold = null;
  let nextThreshold = null;
  let daysFromLast = Infinity;
  let daysToNext = Infinity;

  for (let i = 0; i < SOLAR_THRESHOLDS.length; i++) {
    const threshold = SOLAR_THRESHOLDS[i];
    let thresholdDay = threshold.day;

    // Calculate days since this threshold
    let daysSince;
    if (thresholdDay <= dayOfYear) {
      daysSince = dayOfYear - thresholdDay;
    } else {
      // Threshold is later in year, so days since is from last year
      daysSince = (daysInYear - thresholdDay) + dayOfYear;
    }

    if (daysSince < daysFromLast && daysSince >= 0) {
      daysFromLast = daysSince;
      lastThreshold = threshold;
    }

    // Calculate days until this threshold
    let daysUntil;
    if (thresholdDay > dayOfYear) {
      daysUntil = thresholdDay - dayOfYear;
    } else {
      // Threshold is earlier in year, so days until is to next year
      daysUntil = (daysInYear - dayOfYear) + thresholdDay;
    }

    if (daysUntil < daysToNext && daysUntil > 0) {
      daysToNext = daysUntil;
      nextThreshold = threshold;
    }
  }

  return {
    daysFromLastThreshold: daysFromLast,
    daysToNextThreshold: daysToNext,
    lastThresholdName: lastThreshold?.name || 'unknown',
    nextThresholdName: nextThreshold?.name || 'unknown',
    solarYearPct: dayOfYear / daysInYear,
  };
}

// Get all threshold data for display
export function getSolarThresholds() {
  return SOLAR_THRESHOLDS;
}

// Get complete solar data bundle
export function getSolarData(date = new Date()) {
  const season = getSeasonInfo(date);
  const sunSign = getSunSign(date);
  const dayOfYear = getDayOfYear(date);
  const thresholdPosition = getThresholdPosition(date);

  return {
    season,
    sunSign,
    dayOfYear,
    ...thresholdPosition,
  };
}
