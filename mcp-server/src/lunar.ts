// Luna Loops - Lunar Calculations (Server-side)
// Canonical Astronomical Algorithms (Jean Meeus Moon Ephemeris)

export const SYNODIC = 29.53058867; // Average synodic month in days
export const KNOWN_NEW_MOON = 2451550.259; // Jan 6 2000 18:14 UTC (known new moon JD)

// Phase Type Classification
const PHASE_TYPE: Record<string, string> = {
  'new': 'threshold',
  'waxing-crescent': 'flow',
  'first-quarter': 'threshold',
  'waxing-gibbous': 'flow',
  'full': 'threshold',
  'waning-gibbous': 'flow',
  'last-quarter': 'threshold',
  'waning-crescent': 'flow',
};

const PHASE_DURATION: Record<string, number> = {
  threshold: 1.85,
  flow: 5.55,
};

export const HALF_THRESHOLD = PHASE_DURATION.threshold / 2; // 0.925 days
export const FULL_MOON_PEAK = SYNODIC / 2; // ~14.7653 days

export const PHASES = [
  { name: 'New Moon', key: 'new', start: 0, end: HALF_THRESHOLD, next: 'Waxing Crescent', nextKey: 'waxing-crescent' },
  { name: 'Waxing Crescent', key: 'waxing-crescent', start: HALF_THRESHOLD, end: (SYNODIC / 4) - HALF_THRESHOLD, next: 'First Quarter', nextKey: 'first-quarter' },
  { name: 'First Quarter', key: 'first-quarter', start: (SYNODIC / 4) - HALF_THRESHOLD, end: (SYNODIC / 4) + HALF_THRESHOLD, next: 'Waxing Gibbous', nextKey: 'waxing-gibbous' },
  { name: 'Waxing Gibbous', key: 'waxing-gibbous', start: (SYNODIC / 4) + HALF_THRESHOLD, end: FULL_MOON_PEAK - HALF_THRESHOLD, next: 'Full Moon', nextKey: 'full' },
  { name: 'Full Moon', key: 'full', start: FULL_MOON_PEAK - HALF_THRESHOLD, end: FULL_MOON_PEAK + HALF_THRESHOLD, next: 'Waning Gibbous', nextKey: 'waning-gibbous' },
  { name: 'Waning Gibbous', key: 'waning-gibbous', start: FULL_MOON_PEAK + HALF_THRESHOLD, end: (3 * SYNODIC / 4) - HALF_THRESHOLD, next: 'Last Quarter', nextKey: 'last-quarter' },
  { name: 'Last Quarter', key: 'last-quarter', start: (3 * SYNODIC / 4) - HALF_THRESHOLD, end: (3 * SYNODIC / 4) + HALF_THRESHOLD, next: 'Waning Crescent', nextKey: 'waning-crescent' },
  { name: 'Waning Crescent', key: 'waning-crescent', start: (3 * SYNODIC / 4) + HALF_THRESHOLD, end: SYNODIC - HALF_THRESHOLD, next: 'New Moon', nextKey: 'new' },
];

const PHASE_CONTENT: Record<string, { title: string; symbol: string; energy: string }> = {
  'new': { title: 'New Moon', symbol: '🌑', energy: 'Seed' },
  'waxing-crescent': { title: 'Waxing Crescent', symbol: '🌒', energy: 'Build' },
  'first-quarter': { title: 'First Quarter', symbol: '🌓', energy: 'Clarity' },
  'waxing-gibbous': { title: 'Waxing Gibbous', symbol: '🌔', energy: 'Refine' },
  'full': { title: 'Full Moon', symbol: '🌕', energy: 'Release' },
  'waning-gibbous': { title: 'Waning Gibbous', symbol: '🌖', energy: 'Receive' },
  'last-quarter': { title: 'Last Quarter', symbol: '🌗', energy: 'Realign' },
  'waning-crescent': { title: 'Waning Crescent', symbol: '🌘', energy: 'Rest' }
};

// Convert Date to Julian Date
export function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

// Convert Julian Date back to Date
export function fromJulianDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

// Calculate Moon's astronomical elongation angle relative to the Sun (0° to 360°)
export function getMoonElongation(date: Date = new Date()): number {
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

// Get moon age derived from astronomical elongation (0-29.53 days)
export function getMoonAge(date: Date = new Date()): number {
  const elongation = getMoonElongation(date);
  const age = (elongation / 360) * SYNODIC;
  return age >= SYNODIC - 0.1 ? 0 : age;
}

// Get illumination percentage
export function getIllumination(date: Date = new Date()): number {
  const elongation = getMoonElongation(date);
  const illumination = (1 - Math.cos((elongation * Math.PI) / 180)) / 2;
  return Math.round(illumination * 100);
}

// Get phase info
export function getPhaseInfo(age: number) {
  // If age is near the end of cycle, wrap to New Moon
  if (age >= SYNODIC - HALF_THRESHOLD || age < HALF_THRESHOLD) {
    return {
      name: 'New Moon',
      key: 'new',
      energy: 'Seed',
      symbol: '🌑',
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
      const phaseType = PHASE_TYPE[phase.key] || 'flow';
      const phaseDuration = PHASE_DURATION[phaseType] || 5.55;
      const dayInPhase = age - phase.start;
      const content = PHASE_CONTENT[phase.key] || { title: phase.name, symbol: '🌙', energy: 'Flow' };
      return {
        name: phase.name,
        key: phase.key,
        energy: content.energy,
        symbol: content.symbol,
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
    energy: 'Seed',
    symbol: '🌑',
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

const LUNAR_MONTH_BY_CALENDAR = [
  'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
  'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold'
];

// Get lunar month name
export function getLunarMonthName(date: Date = new Date()): string {
  const age = getMoonAge(date);
  const daysToFull = FULL_MOON_PEAK - age;
  const fullMoonDate = new Date(date.getTime() + daysToFull * 24 * 60 * 60 * 1000);
  const month = fullMoonDate.getMonth();
  return LUNAR_MONTH_BY_CALENDAR[month];
}

// Get days until a specific phase (0=new, 0.5=full)
export function getDaysUntilPhase(targetPhase: number, date: Date = new Date()): number {
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

// Get approximate moon zodiac sign
export function getMoonZodiac(date: Date = new Date()) {
  const jd = toJulianDate(date);
  const normalize = (v: number) => v - Math.floor(v);

  const rp = normalize((jd - 2451555.8) / 27.321582241);
  const ip = normalize((jd - 2451550.1) / 29.530588853);
  const dp = 2 * Math.PI * normalize((jd - 2451562.2) / 27.55454988);

  const radIp = 2 * Math.PI * ip;
  let longitude = 360 * rp + 6.3 * Math.sin(dp) + 1.3 * Math.sin(2 * radIp - dp) + 0.7 * Math.sin(2 * radIp);
  const finalLongitude = (longitude % 360 + 360) % 360;

  const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  const index = Math.floor(finalLongitude / 30) % 12;
  const degree = Math.floor(finalLongitude % 30);
  return { sign: signs[index], degree };
}

// Get complete lunar data bundle
export function getLunarData(date: Date = new Date()) {
  const age = getMoonAge(date);
  const phase = getPhaseInfo(age);
  const illumination = getIllumination(date);
  const lunarMonth = getLunarMonthName(date);
  const zodiac = getMoonZodiac(date);
  const daysToFull = getDaysUntilPhase(0.5, date);
  const daysToNew = getDaysUntilPhase(0, date);

  const cycleStart = new Date(date.getTime() - age * 24 * 60 * 60 * 1000).toISOString();
  const currentPhase = PHASES.find(p => age >= p.start && age < p.end) || PHASES[0];
  const phaseRemaining = currentPhase.end - age;
  const remainingHours = Math.round(phaseRemaining * 24 * 10) / 10;

  return {
    age,
    dayOfCycle: Math.floor(age) + 1,
    cycleStart,
    phase: {
      name: phase.name,
      key: phase.key,
      energy: phase.energy,
      symbol: phase.symbol,
      isWaning: phase.isWaning,
      isNew: phase.isNew,
      isFull: phase.isFull,
      phaseType: phase.phaseType,
      phaseDuration: phase.phaseDuration,
    },
    illumination,
    lunarMonth,
    zodiac,
    daysToFull,
    daysToNew,
    remainingHours,
    nextPhase: currentPhase.next,
  };
}
