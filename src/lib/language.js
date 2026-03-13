// Luna Loops - Generative Language Layer
// Fresh phrases each session via Anthropic API

const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours in ms
const CACHE_KEY = 'phrases_v1';

// Supabase edge function URL (deployed with --no-verify-jwt)
const GENERATE_PHRASES_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/generate-phrases';

// Pools of fallback phrases — one is picked randomly each time
const FALLBACK_POOLS = {
  phaseGuidance: [
    "Move with what the phase allows.",
    "The phase has its own logic. Trust it.",
    "Work with the energy that is present, not the energy you wish for.",
    "This phase asks something specific of you. Listen.",
    "Let the cycle guide the pace.",
    "The phase knows what it is doing. Follow.",
  ],
  cosmicSynthesis: [
    "The cycles converge. Pay attention.",
    "Something larger is in motion.",
    "The patterns are speaking. Be still enough to hear.",
    "The sky and the cycle are aligned. Notice what that stirs.",
    "Layers of rhythm are moving together right now.",
    "There is a weave here. You are part of it.",
  ],
  energyDescription: [
    "Something is moving through you.",
    "A current is present. Let it move.",
    "There is a quality in the air today.",
    "The energy is available. What will you do with it?",
    "Something wants to come through if you let it.",
    "Notice what is stirring beneath the surface.",
  ],
  phaseBanner: [
    "Follow the energy of this phase.",
    "This phase has its own invitation.",
    "Let the phase do its work through you.",
    "The phase is the teacher. You are the student.",
    "Stay close to what this phase is asking.",
    "The cycle is speaking. This is its current word.",
  ],
  addLoopPrompt: [
    "What wants to open?",
    "What are you ready to begin?",
    "What intention wants to take form?",
    "What is calling for your attention?",
    "What loop wants to be opened?",
  ],
  newMoonQuestion: [
    "What wants to be born through you this cycle?",
    "What seed are you planting in the dark?",
    "What intention wants to take root?",
    "What are you calling into being?",
    "What do you want to grow this lunar cycle?",
  ],
  echoesWritePrompt: [
    "What is alive in you right now?",
    "What arrived today?",
    "What are you noticing?",
    "What wants to be spoken?",
    "What is moving in you that hasn't been named yet?",
    "What truth is present right now?",
  ],
  echoesVoicePrompt: [
    "Speak what is present...",
    "Let the words come...",
    "Say what is true right now...",
    "Speak before you think...",
    "What is alive — speak it...",
    "Voice what is moving in you...",
  ],
  transitionInvitation: [
    "A shift is coming. Orient before it arrives.",
    "The phase is turning. Prepare yourself.",
    "Something is completing. Something new is near.",
    "The cycle is about to change its quality.",
    "A threshold is approaching. Meet it consciously.",
    "The energy is about to shift. Notice how you feel.",
  ],
  deepSheetArcs: [
    "Larger patterns move beneath your days.",
    "You are inside rhythms older than you.",
    "The longer cycles carry what the shorter ones cannot hold.",
    "Something vast is in motion beneath the surface.",
    "Your life moves inside cycles you can feel but not always name.",
    "The larger arcs are patient. They do not rush.",
  ],
  deepSheetNatal: [
    "The sky speaks to your chart.",
    "The current sky is in conversation with your birth moment.",
    "What is above resonates with what you were born into.",
    "Your natal imprint is being activated by the sky.",
    "The heavens and your chart are in dialogue.",
    "Something in the current sky recognises you.",
  ],
};

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildRandomFallback() {
  return {
    phaseGuidance:       pick(FALLBACK_POOLS.phaseGuidance),
    cosmicSynthesis:     pick(FALLBACK_POOLS.cosmicSynthesis),
    energyDescription:   pick(FALLBACK_POOLS.energyDescription),
    phaseBanner:         pick(FALLBACK_POOLS.phaseBanner),
    addLoopPrompt:       pick(FALLBACK_POOLS.addLoopPrompt),
    newMoonQuestion:     pick(FALLBACK_POOLS.newMoonQuestion),
    echoesWritePrompt:   pick(FALLBACK_POOLS.echoesWritePrompt),
    echoesVoicePrompt:   pick(FALLBACK_POOLS.echoesVoicePrompt),
    transitionInvitation:pick(FALLBACK_POOLS.transitionInvitation),
    deepSheetPhase:      null,
    deepSheetMoon:       null,
    deepSheetSign:       null,
    deepSheetSeason:     null,
    deepSheetWeave:      null,
    deepSheetArcs:       pick(FALLBACK_POOLS.deepSheetArcs),
    deepSheetNatal:      pick(FALLBACK_POOLS.deepSheetNatal),
  };
}

// Static export for components that need a reference shape (keys only)
export const FALLBACK_PHRASES = buildRandomFallback();

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

  const progress = lunarData.phaseProgress || 0;
  const tideStage = progress < 0.20 ? 'opening'
    : progress < 0.62 ? 'flowing'
    : progress < 0.88 ? 'completing'
    : 'closing';

  return {
    phase: lunarData.phase.name,
    moonAge: lunarData.age,
    pct: lunarData.illumination,
    zodiac: lunarData.zodiac.sign,
    phaseType: lunarData.phase.isThreshold ? 'threshold' : 'flow',
    phaseStatus,
    tideStage,
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
