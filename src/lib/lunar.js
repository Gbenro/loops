// Luna Loops - Lunar Calculations
// Canonical Astronomical Algorithms (Jean Meeus Moon Ephemeris)

import { phaseContent } from '../data/phaseContent';

export const SYNODIC = 29.53058867; // Average synodic month in days
export const KNOWN_NEW_MOON = 2451550.259; // Jan 6 2000 18:14 UTC (known new moon JD)

// Phase Type Classification - Threshold (pivotal) vs Flow (sustained)
const PHASE_TYPE = {
  new: 'threshold',
  'waxing-crescent': 'flow',
  'first-quarter': 'threshold',
  'waxing-gibbous': 'flow',
  full: 'threshold',
  'waning-gibbous': 'flow',
  'last-quarter': 'threshold',
  'waning-crescent': 'flow',
};

const PHASE_DURATION = {
  threshold: 1.85, // days - brief, pivotal (±0.925 days around peak)
  flow: 5.55, // days - sustained, unfolding
};

export const HALF_THRESHOLD = PHASE_DURATION.threshold / 2; // 0.925 days
export const FULL_MOON_PEAK = SYNODIC / 2; // ~14.7653 days

// Symmetrical Phase Windows centered around cardinal astronomical events
export const PHASES = [
  {
    name: 'New Moon',
    key: 'new',
    start: 0,
    end: HALF_THRESHOLD,
    next: 'Waxing Crescent',
    nextKey: 'waxing-crescent',
  },
  {
    name: 'Waxing Crescent',
    key: 'waxing-crescent',
    start: HALF_THRESHOLD,
    end: (SYNODIC / 4) - HALF_THRESHOLD, // 6.458
    next: 'First Quarter',
    nextKey: 'first-quarter',
  },
  {
    name: 'First Quarter',
    key: 'first-quarter',
    start: (SYNODIC / 4) - HALF_THRESHOLD, // 6.458
    end: (SYNODIC / 4) + HALF_THRESHOLD, // 8.308
    next: 'Waxing Gibbous',
    nextKey: 'waxing-gibbous',
  },
  {
    name: 'Waxing Gibbous',
    key: 'waxing-gibbous',
    start: (SYNODIC / 4) + HALF_THRESHOLD, // 8.308
    end: FULL_MOON_PEAK - HALF_THRESHOLD, // 13.840
    next: 'Full Moon',
    nextKey: 'full',
  },
  {
    name: 'Full Moon',
    key: 'full',
    start: FULL_MOON_PEAK - HALF_THRESHOLD, // 13.840
    end: FULL_MOON_PEAK + HALF_THRESHOLD, // 15.690
    next: 'Waning Gibbous',
    nextKey: 'waning-gibbous',
  },
  {
    name: 'Waning Gibbous',
    key: 'waning-gibbous',
    start: FULL_MOON_PEAK + HALF_THRESHOLD, // 15.690
    end: (3 * SYNODIC / 4) - HALF_THRESHOLD, // 21.223
    next: 'Last Quarter',
    nextKey: 'last-quarter',
  },
  {
    name: 'Last Quarter',
    key: 'last-quarter',
    start: (3 * SYNODIC / 4) - HALF_THRESHOLD, // 21.223
    end: (3 * SYNODIC / 4) + HALF_THRESHOLD, // 23.073
    next: 'Waning Crescent',
    nextKey: 'waning-crescent',
  },
  {
    name: 'Waning Crescent',
    key: 'waning-crescent',
    start: (3 * SYNODIC / 4) + HALF_THRESHOLD, // 23.073
    end: SYNODIC - HALF_THRESHOLD, // 28.605
    next: 'New Moon',
    nextKey: 'new',
  },
];

// Convert JavaScript Date to Julian Date
export function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Convert Julian Date back to JavaScript Date
export function fromJulianDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

// Calculate Moon's astronomical elongation angle relative to the Sun (0° to 360°)
export function getMoonElongation(date = new Date()) {
  const jd = toJulianDate(date);
  const T = (jd - 2451545.0) / 36525;

  // Sun's mean anomaly & ecliptic longitude
  const M_sun = (357.52911 + 35999.05029 * T) * (Math.PI / 180);
  const L_sun = (280.46646 + 36000.76983 * T + 1.914602 * Math.sin(M_sun) + 0.019993 * Math.sin(2 * M_sun)) % 360;

  // Moon's mean longitude, mean anomaly, and elongation
  const L_moon = (218.3165 + 481267.8813 * T) % 360;
  const M_moon = (134.9634 + 477198.8675 * T) * (Math.PI / 180);
  const D = (297.8501921 + 445267.1114034 * T) % 360; // Mean elongation

  // Periodic orbital perturbations (Meeus astronomical model)
  const periodicTerms =
    6.289 * Math.sin(M_moon) -
    1.274 * Math.sin(2 * (D * Math.PI / 180) - M_moon) +
    0.658 * Math.sin(2 * (D * Math.PI / 180)) -
    0.214 * Math.sin(2 * M_moon) -
    0.186 * Math.sin(M_sun);

  const trueMoonLong = (L_moon + periodicTerms + 360) % 360;
  const trueSunLong = (L_sun + 360) % 360;

  return ((trueMoonLong - trueSunLong + 360) % 360);
}

// Get moon age (days into current lunar cycle, 0-29.53) derived from astronomical elongation
export function getMoonAge(date = new Date()) {
  const elongation = getMoonElongation(date);
  const age = (elongation / 360) * SYNODIC;
  return age >= SYNODIC - 0.1 ? 0 : age;
}

// Get illumination percentage (0-100)
export function getIllumination(date = new Date()) {
  const elongation = getMoonElongation(date);
  const illumination = (1 - Math.cos((elongation * Math.PI) / 180)) / 2;
  return Math.round(illumination * 100);
}

// Get phase info from moon age
export function getPhaseInfo(age) {
  // If age is near the end of cycle, wrap to New Moon
  if (age >= SYNODIC - HALF_THRESHOLD || age < HALF_THRESHOLD) {
    return {
      name: 'New Moon',
      key: 'new',
      energy: phaseContent['new'].energy,
      isWaning: false,
      isNew: true,
      isFull: false,
      phaseType: 'threshold',
      phaseDuration: PHASE_DURATION.threshold,
      dayInPhase: age >= SYNODIC - HALF_THRESHOLD ? age - (SYNODIC - HALF_THRESHOLD) : age + HALF_THRESHOLD,
      isThreshold: true,
      isFlow: false,
    };
  }

  for (const phase of PHASES) {
    if (phase.key !== 'new' && age >= phase.start && age < phase.end) {
      const phaseType = PHASE_TYPE[phase.key];
      const phaseDuration = PHASE_DURATION[phaseType];
      const dayInPhase = age - phase.start;
      return {
        name: phase.name,
        key: phase.key,
        energy: phaseContent[phase.key].energy,
        isWaning: phase.key.includes('waning') || phase.key === 'last-quarter',
        isNew: false,
        isFull: phase.key === 'full',
        phaseType,
        phaseDuration,
        dayInPhase,
        isThreshold: phaseType === 'threshold',
        isFlow: phaseType === 'flow',
      };
    }
  }

  return {
    name: 'New Moon',
    key: 'new',
    energy: phaseContent['new'].energy,
    isWaning: false,
    isNew: true,
    isFull: false,
    phaseType: 'threshold',
    phaseDuration: PHASE_DURATION.threshold,
    dayInPhase: 0,
    isThreshold: true,
    isFlow: false,
  };
}

// Lunar month names by calendar month (0-indexed)
const LUNAR_MONTH_BY_CALENDAR = [
  'Wolf', // January
  'Snow', // February
  'Worm', // March
  'Pink', // April
  'Flower', // May
  'Strawberry', // June
  'Buck', // July
  'Sturgeon', // August
  'Harvest', // September
  "Hunter's", // October
  'Beaver', // November
  'Cold', // December
];

// Get lunar month name based on the month containing the full moon
export function getLunarMonthName(date = new Date()) {
  const age = getMoonAge(date);
  // Find the date of the full moon in this cycle
  // Full moon is at age SYNODIC/2 days (half of synodic month)
  const daysToFull = FULL_MOON_PEAK - age;
  const fullMoonDate = new Date(date.getTime() + daysToFull * 24 * 60 * 60 * 1000);
  // Use the calendar month of the full moon
  const month = fullMoonDate.getMonth();
  return LUNAR_MONTH_BY_CALENDAR[month];
}

// Get days until a specific phase (0=new, 0.5=full)
export function getDaysUntilPhase(targetPhase, date = new Date()) {
  const age = getMoonAge(date);
  const targetAge = targetPhase * SYNODIC;
  let diff = targetAge - age;
  while (diff < -SYNODIC / 2) diff += SYNODIC;
  while (diff > SYNODIC / 2) diff -= SYNODIC;
  if (Math.abs(diff) <= 0.75) return 0;

  let daysUntil = targetAge - age;
  while (daysUntil < 0) daysUntil += SYNODIC;
  while (daysUntil >= SYNODIC) daysUntil -= SYNODIC;
  const rounded = Math.round(daysUntil);
  return rounded >= Math.round(SYNODIC) ? 0 : rounded;
}

// Get days until full moon
export function getDaysUntilFull(date = new Date()) {
  return getDaysUntilPhase(0.5, date);
}

// Get days until new moon
export function getDaysUntilNew(date = new Date()) {
  return getDaysUntilPhase(0, date);
}

// Calculate approximate zodiac sign from moon position using astronomical ecliptic longitude approximation
export function getMoonZodiac(date = new Date()) {
  const jd = toJulianDate(date);
  const normalize = (v) => v - Math.floor(v);

  // rp: Moon's mean longitude (sidereal period of 27.321582241 days)
  const rp = normalize((jd - 2451555.8) / 27.321582241);

  // ip: Moon's mean elongation/phase (synodic period of 29.530588853 days)
  const ip = normalize((jd - 2451550.1) / 29.530588853);

  // dp: Moon's mean anomaly (anomalistic period of 27.55454988 days)
  const dp = 2 * Math.PI * normalize((jd - 2451562.2) / 27.55454988);

  const radIp = 2 * Math.PI * ip;

  // Calculate approximate ecliptic longitude of the moon in degrees
  let longitude =
    360 * rp + 6.3 * Math.sin(dp) + 1.3 * Math.sin(2 * radIp - dp) + 0.7 * Math.sin(2 * radIp);

  // Ensure within [0, 360) range
  const finalLongitude = ((longitude % 360) + 360) % 360;

  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];
  const index = Math.floor(finalLongitude / 30) % 12;
  const degree = Math.floor(finalLongitude % 30);
  return { sign: signs[index], degree };
}

// Get complete lunar data bundle
export function getLunarData(date = new Date()) {
  const age = getMoonAge(date);
  const phase = getPhaseInfo(age);
  const illumination = getIllumination(date);
  const lunarMonth = getLunarMonthName(date);
  const zodiac = getMoonZodiac(date);
  const daysToFull = getDaysUntilFull(date);
  const daysToNew = getDaysUntilNew(date);

  // Calculate cycle start (new moon that began this cycle)
  const cycleStart = new Date(date.getTime() - age * 24 * 60 * 60 * 1000).toISOString();

  // Find current phase bounds for timing calculations
  const currentPhase = PHASES.find((p) => age >= p.start && age < p.end) || PHASES[0];
  const phaseDuration = currentPhase.end - currentPhase.start;
  const phaseProgress = (age - currentPhase.start) / phaseDuration;
  const phaseRemaining = currentPhase.end - age;
  const remainingHours = Math.round(phaseRemaining * 24 * 10) / 10;

  // Next phase info
  const nextPhase = currentPhase.next;
  const nextKey = currentPhase.nextKey;
  const nextSymbol = getPhaseEmoji(nextKey);
  const nextEnergy = phaseContent[nextKey].energy;
  const nextPhaseType = PHASE_TYPE[nextKey];
  const nextPhaseDuration = PHASE_DURATION[nextPhaseType];

  // Dynamic approaching thresholds based on what's coming
  // New cycle (new moon): 24 hours - biggest transition
  // Threshold phases: 4 hours - brief, need less warning
  // Flow phases: 8 hours - more time to prepare
  const isNewCycleApproaching = nextKey === 'new';
  const approachingThreshold = isNewCycleApproaching ? 24 : nextPhaseType === 'threshold' ? 4 : 8;
  const isApproaching = remainingHours < approachingThreshold;
  const isImminent = remainingHours < approachingThreshold / 4; // 1/4 of threshold

  return {
    age, // Days into cycle (0-29.53)
    dayOfCycle: Math.floor(age) + 1, // Day 1-30
    cycleStart, // ISO string of new moon that started this cycle
    phase, // { name, key, energy, isWaning, isNew, isFull }
    illumination, // 0-100%
    lunarMonth, // "Snow", "Wolf", etc.
    zodiac, // { sign, degree }
    daysToFull,
    daysToNew,
    // Phase timing
    phaseProgress, // 0-1, position within current phase
    phaseRemaining, // Days remaining in current phase
    remainingHours, // Hours remaining (rounded)
    isApproaching, // true if < 24h remaining
    isImminent, // true if < 6h remaining
    nextPhase, // Name of next phase
    nextSymbol, // Emoji of next phase
    nextEnergy, // Energy word of next phase
    nextPhaseType, // 'threshold' | 'flow'
    nextPhaseDuration, // 1.85 | 5.55 days
    // Transition timing
    approachingThreshold, // Hours before showing transition card
    isNewCycleApproaching, // true if next phase is new moon (new cycle)
  };
}

// Phase emoji — used for notifications and data only. In-app UI uses MiniMoon component instead.
// Reads from phaseContent.symbol — single source of truth for emoji mapping.
export function getPhaseEmoji(key) {
  return phaseContent[key]?.symbol || '🌙';
}

// Get all 8 phases for timeline display
export function getAllPhases() {
  return PHASES.map((p) => ({
    name: p.name,
    key: p.key,
    emoji: getPhaseEmoji(p.key),
    energy: phaseContent[p.key].energy,
  }));
}
