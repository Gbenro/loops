// Luna Loops - Lunar Calculations (Server-side)
// Pure JS Julian Date mathematics (no external library dependencies)

const SYNODIC = 29.53058867; // Average synodic month in days
const KNOWN_NEW_MOON = 2451550.259; // Jan 6 2000 18:14 UTC (known new moon JD)

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

const FULL_MOON_PEAK = SYNODIC / 2; // ~14.7653

const PHASES = [
  { name: 'New Moon', key: 'new', start: 0, end: 1.85, next: 'Waxing Crescent', nextKey: 'waxing-crescent' },
  { name: 'Waxing Crescent', key: 'waxing-crescent', start: 1.85, end: 7.38, next: 'First Quarter', nextKey: 'first-quarter' },
  { name: 'First Quarter', key: 'first-quarter', start: 7.38, end: 9.22, next: 'Waxing Gibbous', nextKey: 'waxing-gibbous' },
  { name: 'Waxing Gibbous', key: 'waxing-gibbous', start: 9.22, end: FULL_MOON_PEAK, next: 'Full Moon', nextKey: 'full' },
  { name: 'Full Moon', key: 'full', start: FULL_MOON_PEAK, end: 16.61, next: 'Waning Gibbous', nextKey: 'waning-gibbous' },
  { name: 'Waning Gibbous', key: 'waning-gibbous', start: 16.61, end: 22.15, next: 'Last Quarter', nextKey: 'last-quarter' },
  { name: 'Last Quarter', key: 'last-quarter', start: 22.15, end: 23.99, next: 'Waning Crescent', nextKey: 'waning-crescent' },
  { name: 'Waning Crescent', key: 'waning-crescent', start: 23.99, end: 29.53, next: 'New Moon', nextKey: 'new' },
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

// Get moon age
export function getMoonAge(date: Date = new Date()): number {
  const JD = toJulianDate(date);
  return ((JD - KNOWN_NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC;
}

// Get illumination percentage
export function getIllumination(date: Date = new Date()): number {
  const age = getMoonAge(date);
  const illumination = (1 - Math.cos((age / SYNODIC) * 2 * Math.PI)) / 2;
  return Math.round(illumination * 100);
}

// Get phase info
export function getPhaseInfo(age: number) {
  for (const phase of PHASES) {
    if (age >= phase.start && age < phase.end) {
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
        isNew: phase.key === 'new',
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
    phaseDuration: 1.85,
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
  let daysUntil = targetAge - age;
  if (daysUntil < 0) daysUntil += SYNODIC;
  return Math.round(daysUntil);
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
