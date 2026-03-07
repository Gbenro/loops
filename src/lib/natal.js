// Luna Loops - Natal Resonance Calculations
// Detect active transits between current sky and natal chart

import { NATAL } from '../data/natal.js';
import { getLunarData, getMoonAge } from './lunar.js';

const SYNODIC = 29.53058867;

// Zodiac sign to ecliptic longitude (midpoint of each sign)
const SIGN_LONGITUDES = {
  'Aries': 15,
  'Taurus': 45,
  'Gemini': 75,
  'Cancer': 105,
  'Leo': 135,
  'Virgo': 165,
  'Libra': 195,
  'Scorpio': 225,
  'Sagittarius': 255,
  'Capricorn': 285,
  'Aquarius': 315,
  'Pisces': 345,
};

// Get natal data from user profile or fall back to default
function getNatalData(userProfile) {
  if (userProfile?.sun_sign || userProfile?.moon_sign || userProfile?.rising_sign) {
    return {
      sun: {
        sign: userProfile.sun_sign || NATAL.sun.sign,
        lon: SIGN_LONGITUDES[userProfile.sun_sign] || NATAL.sun.lon,
      },
      moon: {
        sign: userProfile.moon_sign || NATAL.moon.sign,
        lon: SIGN_LONGITUDES[userProfile.moon_sign] || NATAL.moon.lon,
      },
      rising: {
        sign: userProfile.rising_sign || NATAL.rising.sign,
        lon: SIGN_LONGITUDES[userProfile.rising_sign] || NATAL.rising.lon,
      },
    };
  }
  return NATAL;
}

// Calculate approximate moon longitude (0-360)
function getCurrentMoonLongitude(date = new Date()) {
  const age = getMoonAge(date);
  // Moon starts each cycle at 0° (roughly) and travels ~12.2° per day
  // This is simplified - actual longitude depends on cycle start position
  // For resonance detection, we use the natal moon's base longitude + offset
  return (age / SYNODIC) * 360;
}

// Calculate angular difference between two longitudes
function getAngularDiff(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Get aspect between current moon and a natal placement
function getAspect(currentLon, natalLon) {
  const diff = getAngularDiff(currentLon, natalLon);

  // Conjunction (0°) - within 8°
  if (diff <= 8) {
    return { type: 'conjunction', strength: 'HIGH', meaning: 'Intense focus and activation' };
  }

  // Approaching conjunction - within 15°
  if (diff <= 15) {
    return { type: 'approaching', strength: 'MEDIUM', meaning: 'Building toward activation' };
  }

  // Sextile (60°) - within 6°
  if (Math.abs(diff - 60) <= 6) {
    return { type: 'sextile', strength: 'LOW', meaning: 'Gentle opportunity' };
  }

  // Square (90°) - within 8°
  if (Math.abs(diff - 90) <= 8) {
    return { type: 'square', strength: 'MEDIUM', meaning: 'Creative tension' };
  }

  // Trine (120°) - within 8°
  if (Math.abs(diff - 120) <= 8) {
    return { type: 'trine', strength: 'LOW', meaning: 'Easy flow' };
  }

  // Opposition (180°) - within 8°
  if (Math.abs(diff - 180) <= 8) {
    return { type: 'opposition', strength: 'HIGH', meaning: 'Awareness and polarity' };
  }

  return null;
}

// Check if current moon is in same sign as a natal placement
function isSameSign(currentSign, natalSign) {
  return currentSign.toLowerCase() === natalSign.toLowerCase();
}

// Get all current natal resonances
export function getNatalResonance(date = new Date(), userProfile = null) {
  const natal = getNatalData(userProfile);
  const lunar = getLunarData(date);
  const currentMoonLon = getCurrentMoonLongitude(date);
  const currentSign = lunar.zodiac.sign;
  const resonances = [];

  // Check moon to natal moon
  const moonToMoon = getAspect(currentMoonLon, natal.moon.lon);
  if (moonToMoon) {
    resonances.push({
      transit: 'Moon',
      natal: 'Moon',
      natalSign: natal.moon.sign,
      ...moonToMoon,
      description: `Moon ${moonToMoon.type} your natal Moon`,
    });
  }

  // Check same sign as natal moon
  if (isSameSign(currentSign, natal.moon.sign) && !moonToMoon) {
    resonances.push({
      transit: 'Moon',
      natal: 'Moon',
      natalSign: natal.moon.sign,
      type: 'same-sign',
      strength: 'MEDIUM',
      meaning: 'Emotional resonance',
      description: 'Moon in your natal Moon sign',
    });
  }

  // Check moon to natal sun
  const moonToSun = getAspect(currentMoonLon, natal.sun.lon);
  if (moonToSun) {
    resonances.push({
      transit: 'Moon',
      natal: 'Sun',
      natalSign: natal.sun.sign,
      ...moonToSun,
      description: `Moon ${moonToSun.type} your natal Sun`,
    });
  }

  // Check same sign as natal sun
  if (isSameSign(currentSign, natal.sun.sign) && !moonToSun) {
    resonances.push({
      transit: 'Moon',
      natal: 'Sun',
      natalSign: natal.sun.sign,
      type: 'same-sign',
      strength: 'MEDIUM',
      meaning: 'Identity activation',
      description: 'Moon moving through your Sun sign',
    });
  }

  // Check Full Moon on natal moon
  if (lunar.phase.isFull && isSameSign(currentSign, natal.moon.sign)) {
    resonances.push({
      transit: 'Full Moon',
      natal: 'Moon',
      natalSign: natal.moon.sign,
      type: 'full-moon-natal',
      strength: 'HIGH',
      meaning: 'Deep emotional illumination',
      description: 'Full Moon on your natal Moon',
    });
  }

  // Sort by strength
  const strengthOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
  resonances.sort((a, b) => strengthOrder[a.strength] - strengthOrder[b.strength]);

  return resonances;
}

// Get summary of current resonance state
export function getResonanceSummary(date = new Date(), userProfile = null) {
  const resonances = getNatalResonance(date, userProfile);

  if (resonances.length === 0) {
    return {
      hasResonance: false,
      intensity: 'quiet',
      message: 'A quiet cosmic day. The sky makes no strong aspects to your chart.',
    };
  }

  const hasHigh = resonances.some(r => r.strength === 'HIGH');
  const strongest = resonances[0];

  return {
    hasResonance: true,
    intensity: hasHigh ? 'active' : 'moderate',
    strongest,
    count: resonances.length,
    message: strongest.description,
    all: resonances,
  };
}
