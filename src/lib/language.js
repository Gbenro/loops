// Cosmic Loops - Generative Language Layer
// Fresh phrases each session via Anthropic API

const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours in ms
const CACHE_KEY = 'phrases_v1';

// Supabase edge function URL (deployed with --no-verify-jwt)
const GENERATE_PHRASES_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/generate-phrases';

export const FALLBACK_PHRASES = {
  phaseGuidance:       "Move with what the phase allows.",
  cosmicSynthesis:     "The cycles converge. Pay attention.",
  energyDescription:   "Something is moving through you.",
  phaseBanner:         "Follow the energy of this phase.",
  addLoopPrompt:       "What wants to open?",
  newMoonQuestion:     "What wants to be born through you this cycle?",
  echoesWritePrompt:   "What is alive in you right now?",
  echoesVoicePrompt:   "Speak what is present...",
  transitionInvitation:"A shift is coming. Orient before it arrives.",
  deepSheetPhase:      "You are in the arc of this phase.",
};

function buildCycleState(lunarData, solarData) {
  // Get next phase info
  const phases = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];
  const currentIdx = phases.indexOf(lunarData.phase.key);
  const nextIdx = (currentIdx + 1) % phases.length;
  const nextPhaseKey = phases[nextIdx];

  const nextPhaseNames = {
    'new': 'New Moon',
    'waxing-crescent': 'Waxing Crescent',
    'first-quarter': 'First Quarter',
    'waxing-gibbous': 'Waxing Gibbous',
    'full': 'Full Moon',
    'waning-gibbous': 'Waning Gibbous',
    'last-quarter': 'Last Quarter',
    'waning-crescent': 'Waning Crescent',
  };

  const nextEnergies = {
    'new': 'Seed',
    'waxing-crescent': 'Build',
    'first-quarter': 'Decide',
    'waxing-gibbous': 'Refine',
    'full': 'Illuminate',
    'waning-gibbous': 'Share',
    'last-quarter': 'Release',
    'waning-crescent': 'Rest',
  };

  // Calculate phase position
  const remainingHours = (lunarData.phaseRemaining || 3) * 24;
  let phaseStatus = 'mid-phase';
  if (remainingHours < 24) {
    phaseStatus = 'approaching transition';
  } else if (remainingHours > 72) {
    phaseStatus = 'early in phase';
  }

  return {
    phase: lunarData.phase.name,
    moonAge: lunarData.age,
    pct: lunarData.illumination,
    zodiac: lunarData.zodiac.sign,
    phaseType: lunarData.phase.isThreshold ? 'threshold' : 'flow',
    phaseStatus,
    remainingHours,
    nextPhase: nextPhaseNames[nextPhaseKey],
    nextEnergy: nextEnergies[nextPhaseKey],
    season: solarData?.season?.name || 'unknown',
    daysFromLastThreshold: solarData?.daysFromLastThreshold,
    daysToNextThreshold: solarData?.daysToNextThreshold,
  };
}

export async function getSessionPhrases(lunarData, solarData) {
  const cycleState = buildCycleState(lunarData, solarData);
  console.log('[Phrases] Cycle state:', cycleState);

  // 1. Check cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const age = Date.now() - cached.generatedAt;
      const samePhase = cached.phaseWhenGenerated === cycleState.phase;
      console.log('[Phrases] Cache found, age:', Math.round(age / 1000 / 60), 'min, samePhase:', samePhase);
      if (age < SESSION_TTL && samePhase) {
        console.log('[Phrases] Using cached phrases');
        return cached.phrases;
      }
    }
  } catch (e) {
    console.warn('[Phrases] Cache read error:', e);
  }

  // 2. Generate fresh via edge function
  console.log('[Phrases] Fetching fresh phrases from:', GENERATE_PHRASES_URL);
  try {
    const res = await fetch(GENERATE_PHRASES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cycleState })
    });

    console.log('[Phrases] Response status:', res.status);

    if (!res.ok) {
      const error = await res.text();
      console.error('[Phrases] Edge function error:', res.status, error);
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    console.log('[Phrases] Response data:', data);

    if (data.error) {
      console.error('[Phrases] API returned error:', data.error);
      throw new Error(data.error);
    }

    const phrases = data.phrases;
    console.log('[Phrases] Generated phrases:', phrases);

    // 3. Cache it
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      phrases,
      generatedAt: Date.now(),
      phaseWhenGenerated: cycleState.phase
    }));

    return phrases;
  } catch (e) {
    console.error('[Phrases] Phrase generation failed:', e);
    console.log('[Phrases] Using fallback phrases');
    // 4. Fallback — return hardcoded phrases
    return FALLBACK_PHRASES;
  }
}

export function clearPhraseCache() {
  localStorage.removeItem(CACHE_KEY);
}

// Check if cache is stale (phase changed)
export function isCacheStale(currentPhase) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const cached = JSON.parse(raw);
    return cached.phaseWhenGenerated !== currentPhase;
  } catch {
    return true;
  }
}
