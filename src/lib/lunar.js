// Cosmic Loops - Lunar Calculations
// Pure JS Julian Date mathematics (no external library)

const SYNODIC = 29.53058867; // Average synodic month in days
const KNOWN_NEW_MOON = 2451550.259; // Jan 6 2000 18:14 UTC (known new moon JD)

// Phase name constants with next phase info
const PHASES = [
  { name: 'New Moon', key: 'new', start: 0, end: 1.85, next: 'Waxing Crescent', nextKey: 'waxing-crescent' },
  { name: 'Waxing Crescent', key: 'waxing-crescent', start: 1.85, end: 7.38, next: 'First Quarter', nextKey: 'first-quarter' },
  { name: 'First Quarter', key: 'first-quarter', start: 7.38, end: 9.22, next: 'Waxing Gibbous', nextKey: 'waxing-gibbous' },
  { name: 'Waxing Gibbous', key: 'waxing-gibbous', start: 9.22, end: 14.77, next: 'Full Moon', nextKey: 'full' },
  { name: 'Full Moon', key: 'full', start: 14.77, end: 16.61, next: 'Waning Gibbous', nextKey: 'waning-gibbous' },
  { name: 'Waning Gibbous', key: 'waning-gibbous', start: 16.61, end: 22.15, next: 'Last Quarter', nextKey: 'last-quarter' },
  { name: 'Last Quarter', key: 'last-quarter', start: 22.15, end: 23.99, next: 'Waning Crescent', nextKey: 'waning-crescent' },
  { name: 'Waning Crescent', key: 'waning-crescent', start: 23.99, end: 29.53, next: 'New Moon', nextKey: 'new' },
];

// Phase energy content
const PHASE_ENERGY = {
  'new': 'Seed',
  'waxing-crescent': 'Build',
  'first-quarter': 'Decide',
  'waxing-gibbous': 'Refine',
  'full': 'Illuminate',
  'waning-gibbous': 'Share',
  'last-quarter': 'Release',
  'waning-crescent': 'Rest',
};

// Lunar month names (traditional)
const LUNAR_MONTHS = [
  'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
  'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold', 'Blue'
];

// Convert JavaScript Date to Julian Date
export function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Convert Julian Date back to JavaScript Date
export function fromJulianDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

// Get moon age (days into current lunar cycle, 0-29.53)
export function getMoonAge(date = new Date()) {
  const JD = toJulianDate(date);
  const age = ((JD - KNOWN_NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC;
  return age;
}

// Get illumination percentage (0-100)
export function getIllumination(date = new Date()) {
  const age = getMoonAge(date);
  const illumination = (1 - Math.cos((age / SYNODIC) * 2 * Math.PI)) / 2;
  return Math.round(illumination * 100);
}

// Get phase info from moon age
export function getPhaseInfo(age) {
  for (const phase of PHASES) {
    if (age >= phase.start && age < phase.end) {
      return {
        name: phase.name,
        key: phase.key,
        energy: PHASE_ENERGY[phase.key],
        isWaning: phase.key.includes('waning') || phase.key === 'last-quarter',
        isNew: phase.key === 'new',
        isFull: phase.key === 'full',
      };
    }
  }
  // Edge case: age >= 29.53 wraps to new moon
  return {
    name: 'New Moon',
    key: 'new',
    energy: 'Seed',
    isWaning: false,
    isNew: true,
    isFull: false,
  };
}

// Get lunar month name based on lunation count
export function getLunarMonthName(date = new Date()) {
  const JD = toJulianDate(date);
  const lunationsSinceKnown = Math.floor((JD - KNOWN_NEW_MOON) / SYNODIC);
  // Map to month index (0-12, with Blue moon as 13th)
  const monthIndex = lunationsSinceKnown % 13;
  return LUNAR_MONTHS[monthIndex];
}

// Get days until a specific phase (0=new, 0.5=full)
export function getDaysUntilPhase(targetPhase, date = new Date()) {
  const age = getMoonAge(date);
  const targetAge = targetPhase * SYNODIC;
  let daysUntil = targetAge - age;
  if (daysUntil < 0) daysUntil += SYNODIC;
  return Math.round(daysUntil);
}

// Get days until full moon
export function getDaysUntilFull(date = new Date()) {
  return getDaysUntilPhase(0.5, date);
}

// Get days until new moon
export function getDaysUntilNew(date = new Date()) {
  return getDaysUntilPhase(0, date);
}

// Calculate approximate zodiac sign from moon position
// (Simplified: moon travels ~13 degrees/day through zodiac)
export function getMoonZodiac(date = new Date()) {
  const age = getMoonAge(date);
  const zodiacAge = (age / SYNODIC) * 360;
  const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Scorpio',
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  const index = Math.floor(zodiacAge / 30) % 12;
  const degree = Math.floor(zodiacAge % 30);
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

  // Find current phase bounds for timing calculations
  const currentPhase = PHASES.find(p => age >= p.start && age < p.end) || PHASES[0];
  const phaseDuration = currentPhase.end - currentPhase.start;
  const phaseProgress = (age - currentPhase.start) / phaseDuration;
  const phaseRemaining = currentPhase.end - age;
  const remainingHours = Math.round(phaseRemaining * 24 * 10) / 10;
  const isApproaching = remainingHours < 24;
  const isImminent = remainingHours < 6;

  // Next phase info
  const nextPhase = currentPhase.next;
  const nextKey = currentPhase.nextKey;
  const nextSymbol = getPhaseEmoji(nextKey);
  const nextEnergy = PHASE_ENERGY[nextKey];

  return {
    age,                           // Days into cycle (0-29.53)
    dayOfCycle: Math.floor(age) + 1, // Day 1-30
    phase,                         // { name, key, energy, isWaning, isNew, isFull }
    illumination,                  // 0-100%
    lunarMonth,                    // "Snow", "Wolf", etc.
    zodiac,                        // { sign, degree }
    daysToFull,
    daysToNew,
    // Phase timing
    phaseProgress,                 // 0-1, position within current phase
    phaseRemaining,                // Days remaining in current phase
    remainingHours,                // Hours remaining (rounded)
    isApproaching,                 // true if < 24h remaining
    isImminent,                    // true if < 6h remaining
    nextPhase,                     // Name of next phase
    nextSymbol,                    // Emoji of next phase
    nextEnergy,                    // Energy word of next phase
  };
}

// Phase emoji for display
export function getPhaseEmoji(key) {
  const emojis = {
    'new': '🌑',
    'waxing-crescent': '🌒',
    'first-quarter': '🌓',
    'waxing-gibbous': '🌔',
    'full': '🌕',
    'waning-gibbous': '🌖',
    'last-quarter': '🌗',
    'waning-crescent': '🌘',
  };
  return emojis[key] || '🌙';
}

// Get all 8 phases for timeline display
export function getAllPhases() {
  return PHASES.map(p => ({
    name: p.name,
    key: p.key,
    emoji: getPhaseEmoji(p.key),
    energy: PHASE_ENERGY[p.key],
  }));
}
