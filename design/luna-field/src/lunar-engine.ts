import type { PhaseId, Phase, Cycle, LunarContext } from './contracts.ts';

// Canonical Astronomical Constants (Jean Meeus Moon Ephemeris)
export const SYNODIC = 29.53058867; // Average synodic month in days
export const KNOWN_NEW_MOON = 2451550.259; // Jan 6 2000 18:14 UTC

export const PHASE_DURATION = {
  threshold: 1.85, // days (±0.925 days around cardinal peaks)
  flow: 5.55,      // days
};
export const HALF_THRESHOLD = PHASE_DURATION.threshold / 2; // 0.925 days
export const FULL_MOON_PEAK = SYNODIC / 2; // ~14.7653 days

export const LUNAR_PHASE_DEFS: { id: PhaseId; name: string; shortName: string; index: number; start: number; end: number }[] = [
  { id: 'new', name: 'New Moon', shortName: 'New', index: 0, start: 0, end: HALF_THRESHOLD },
  { id: 'waxing-crescent', name: 'Waxing Crescent', shortName: 'Waxing crescent', index: 1, start: HALF_THRESHOLD, end: (SYNODIC / 4) - HALF_THRESHOLD },
  { id: 'first-quarter', name: 'First Quarter', shortName: 'First quarter', index: 2, start: (SYNODIC / 4) - HALF_THRESHOLD, end: (SYNODIC / 4) + HALF_THRESHOLD },
  { id: 'waxing-gibbous', name: 'Waxing Gibbous', shortName: 'Waxing gibbous', index: 3, start: (SYNODIC / 4) + HALF_THRESHOLD, end: FULL_MOON_PEAK - HALF_THRESHOLD },
  { id: 'full', name: 'Full Moon', shortName: 'Full', index: 4, start: FULL_MOON_PEAK - HALF_THRESHOLD, end: FULL_MOON_PEAK + HALF_THRESHOLD },
  { id: 'waning-gibbous', name: 'Waning Gibbous', shortName: 'Waning gibbous', index: 5, start: FULL_MOON_PEAK + HALF_THRESHOLD, end: (3 * SYNODIC / 4) - HALF_THRESHOLD },
  { id: 'last-quarter', name: 'Last Quarter', shortName: 'Last quarter', index: 6, start: (3 * SYNODIC / 4) - HALF_THRESHOLD, end: (3 * SYNODIC / 4) + HALF_THRESHOLD },
  { id: 'waning-crescent', name: 'Waning Crescent', shortName: 'Waning crescent', index: 7, start: (3 * SYNODIC / 4) + HALF_THRESHOLD, end: SYNODIC - HALF_THRESHOLD },
];

export const LUNAR_MONTHS = [
  'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
  'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold'
];

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export function toJulianDate(date: Date = new Date()): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function getMoonElongation(date: Date = new Date()): number {
  const jd = toJulianDate(date);
  const T = (jd - 2451545.0) / 36525;

  const M_sun = (357.52911 + 35999.05029 * T) * (Math.PI / 180);
  const L_sun = (280.46646 + 36000.76983 * T + 1.914602 * Math.sin(M_sun) + 0.019993 * Math.sin(2 * M_sun)) % 360;

  const L_moon = (218.3165 + 481267.8813 * T) % 360;
  const M_moon = (134.9634 + 477198.8675 * T) * (Math.PI / 180);
  const D = (297.8501921 + 445267.1114034 * T) % 360;

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

export function getMoonAge(date: Date = new Date()): number {
  const elongation = getMoonElongation(date);
  const age = (elongation / 360) * SYNODIC;
  return age >= SYNODIC - 0.1 ? 0 : age;
}

export function getIllumination(date: Date = new Date()): number {
  const elongation = getMoonElongation(date);
  const illumination = (1 - Math.cos((elongation * Math.PI) / 180)) / 2;
  return Math.round(illumination * 100);
}

export function getPhaseId(age: number): PhaseId {
  if (age >= SYNODIC - HALF_THRESHOLD || age < HALF_THRESHOLD) {
    return 'new';
  }
  for (const p of LUNAR_PHASE_DEFS) {
    if (p.id !== 'new' && age >= p.start && age < p.end) {
      return p.id;
    }
  }
  return 'new';
}

export function getLunarMonthName(date: Date = new Date()): string {
  const age = getMoonAge(date);
  let daysToFull: number;
  if (age >= SYNODIC - HALF_THRESHOLD) {
    daysToFull = (SYNODIC - age) + FULL_MOON_PEAK;
  } else {
    daysToFull = FULL_MOON_PEAK - age;
  }
  const fullMoonDate = new Date(date.getTime() + daysToFull * 86400000);
  return LUNAR_MONTHS[fullMoonDate.getMonth()];
}

export function getMoonZodiac(date: Date = new Date()): { sign: string; degree: number } {
  const jd = toJulianDate(date);
  const normalize = (v: number) => v - Math.floor(v);

  const rp = normalize((jd - 2451555.8) / 27.321582241);
  const ip = normalize((jd - 2451550.1) / 29.530588853);
  const dp = 2 * Math.PI * normalize((jd - 2451562.2) / 27.55454988);
  const radIp = 2 * Math.PI * ip;

  const longitude = 360 * rp + 6.3 * Math.sin(dp) + 1.3 * Math.sin(2 * radIp - dp) + 0.7 * Math.sin(2 * radIp);
  const finalLongitude = ((longitude % 360) + 360) % 360;

  const index = Math.floor(finalLongitude / 30) % 12;
  const degree = Math.floor(finalLongitude % 30);
  return { sign: ZODIAC_SIGNS[index], degree };
}

export interface LiveLunarBundle {
  age: number;
  illumination: number;
  phaseId: PhaseId;
  phaseName: string;
  lunarMonth: string;
  zodiac: { sign: string; degree: number };
  dayOfCycle: number;
  phaseRemaining: number;
  cycleStart: Date;
  cycleEnd: Date;
  cycleId: string;
  cycleName: string;
  context: LunarContext;
  phases: Phase[];
}

export function getLiveLunarData(date: Date = new Date()): LiveLunarBundle {
  const age = getMoonAge(date);
  const phaseId = getPhaseId(age);
  const illumination = getIllumination(date);
  const lunarMonth = getLunarMonthName(date);
  const zodiac = getMoonZodiac(date);

  const isPreConjunction = age >= SYNODIC - HALF_THRESHOLD;
  const cycleStart = isPreConjunction
    ? new Date(date.getTime() + (SYNODIC - age) * 86400000)
    : new Date(date.getTime() - age * 86400000);
  const cycleEnd = new Date(cycleStart.getTime() + SYNODIC * 86400000);
  const dayOfCycle = isPreConjunction ? 1 : Math.floor(age) + 1;

  const phaseDef = LUNAR_PHASE_DEFS.find(p => p.id === phaseId) || LUNAR_PHASE_DEFS[0];
  const isNewMoonWindow = isPreConjunction || age < HALF_THRESHOLD;
  const phaseDuration = isNewMoonWindow ? PHASE_DURATION.threshold : (phaseDef.end - phaseDef.start);
  const dayInPhase = isNewMoonWindow
    ? (age >= SYNODIC - HALF_THRESHOLD ? age - (SYNODIC - HALF_THRESHOLD) : age + HALF_THRESHOLD)
    : (age - phaseDef.start);
  const phaseRemaining = Math.max(0, phaseDuration - dayInPhase);

  const cycleId = 'cycle-' + lunarMonth.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cycleName = 'The ' + lunarMonth + ' field';

  const phases: Phase[] = LUNAR_PHASE_DEFS.map(p => {
    const phaseMidAge = (p.start + p.end) / 2;
    const phaseDate = new Date(cycleStart.getTime() + phaseMidAge * 86400000);
    const dateLabel = phaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let light = 0.5;
    if (p.id === 'new') light = 0.05;
    else if (p.id === 'waxing-crescent') light = 0.25;
    else if (p.id === 'first-quarter') light = 0.5;
    else if (p.id === 'waxing-gibbous') light = 0.75;
    else if (p.id === 'full') light = 0.98;
    else if (p.id === 'waning-gibbous') light = 0.75;
    else if (p.id === 'last-quarter') light = 0.5;
    else if (p.id === 'waning-crescent') light = 0.25;

    return {
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      index: p.index,
      light,
      fixtureDate: dateLabel
    };
  });

  const context: LunarContext = {
    cycleId,
    phaseId,
    label: phaseDef.name,
    source: 'backend'
  };

  return {
    age,
    illumination,
    phaseId,
    phaseName: phaseDef.name,
    lunarMonth,
    zodiac,
    dayOfCycle,
    phaseRemaining,
    cycleStart,
    cycleEnd,
    cycleId,
    cycleName,
    context,
    phases
  };
}
