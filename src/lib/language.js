// Luna Loops - Generative Language Layer
// Fresh phrases each session via Anthropic API

const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours in ms
const CACHE_KEY = 'phrases_v1';

// Supabase edge function URL (deployed with --no-verify-jwt)
const GENERATE_PHRASES_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/generate-phrases';

// Generic fallback pools — used when no phase context is available
const FALLBACK_POOLS = {
  cosmicSynthesis: [
    "The cycles converge. Pay attention.",
    "Something larger is in motion.",
    "The patterns are speaking. Be still enough to hear.",
    "The sky and the cycle are aligned. Notice what that stirs.",
    "Layers of rhythm are moving together right now.",
    "There is a weave here. You are part of it.",
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
  tapDeeperInvitation: [
    "Tap to see what the sky is saying.",
    "There is more here. Tap to find it.",
    "The moon has layers. Tap to go deeper.",
    "What else is moving? Tap to find out.",
    "The cycles speak. Tap to listen.",
    "More to discover. Tap the moon.",
  ],
  loopCreationContext: [
    "What wants your attention right now?",
    "What needs to open?",
    "What is asking to be tracked?",
    "Name what you want to move.",
    "What loop is forming in you?",
    "What practice needs a container?",
  ],
  rhythmContinuePrompt: [
    "Does this practice want to continue as it was, or shift?",
    "Same intention, or does something want to change?",
    "What does this rhythm need for the new cycle?",
    "Carry forward, or recalibrate?",
    "How does this practice want to meet the new moon?",
    "Continue the thread, or tie it off and start fresh?",
  ],
  formPlaceholder: [
    "Write what is present...",
    "Name what is here...",
    "Let it take shape...",
    "What wants to be said...",
    "Put words to it...",
    "Speak it into form...",
  ],
  emptyStateGuidance: [
    "Nothing here yet. The space is waiting.",
    "Empty, but ready. What wants to begin?",
    "A blank slate. The cycle is young.",
    "No entries yet. That is also information.",
    "The field is clear. What will you plant?",
    "Nothing recorded. Start when you are ready.",
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

// Phase-specific pools for messages that must match the current energy
const PHASE_ENERGY_DESCRIPTION = {
  'new': [
    "Something is forming in the quiet.",
    "The dark holds what cannot yet be named.",
    "A seed is germinating. Stillness is the work.",
    "Something is beginning that cannot yet be seen.",
    "The potential is here. Let it form slowly.",
    "The dark is full. Trust what is forming inside it.",
  ],
  'waxing-crescent': [
    "The energy is rising. Use it.",
    "Something is building. Keep going.",
    "Momentum is available. Give it direction.",
    "The current is with you. Move.",
    "First light. The build has begun.",
    "Rising energy. What will you do with it?",
  ],
  'first-quarter': [
    "A decision is asking to be made.",
    "Tension is information. What is it telling you?",
    "Something in you already knows. Commit to it.",
    "The crossroads is here. Choose.",
    "The pressure is purposeful. Stay with it.",
    "Half-lit, half-dark. The decision lives in the tension.",
  ],
  'waxing-gibbous': [
    "You are close. Trust what you have built.",
    "Refinement is the work. Not rebuilding — adjusting.",
    "The peak is near. Sharpen what exists.",
    "Almost there. Small adjustments now.",
    "The details matter here. Attend to them.",
    "Close to the full moon. Make it ready.",
  ],
  'full': [
    "Maximum light. What does it reveal?",
    "The truth of the cycle is visible now.",
    "Everything is illuminated. See clearly.",
    "The peak is here. Receive what it brings.",
    "What has grown is fully visible now.",
    "The harvest is in. What did the cycle produce?",
  ],
  'waning-gibbous': [
    "What you gathered wants to move outward.",
    "The light recedes. Give what it left you.",
    "Share what arrived. Pass it on.",
    "Integration is the work. Let it move through you.",
    "Generosity is the energy now. Give back.",
    "The cycle's most generous phase. What can you offer?",
  ],
  'last-quarter': [
    "What needs to go is ready to go.",
    "The clearing is underway. Let it complete.",
    "Release is the work. What are you still holding?",
    "Something wants to be set down. Let it.",
    "The reckoning has arrived. Be honest with yourself.",
    "Clearing energy. What from this cycle no longer serves?",
  ],
  'waning-crescent': [
    "The cycle is completing. Rest inside it.",
    "Stillness is the work now. Not doing.",
    "The dark is coming. Let it.",
    "Rest is not absence — it is the final phase.",
    "The cycle breathes down. Follow it.",
    "Almost dark. The new moon is near. Rest and release.",
  ],
};

const PHASE_GUIDANCE = {
  'new': [
    "Plant something true in the dark.",
    "The seed you set here shapes the whole cycle.",
    "Intention in silence. Let it form before it speaks.",
    "What you plant now, you will harvest at the full moon.",
    "The dark is not empty. Set your intention in it.",
    "Hold your intention quietly. The cycle will do the rest.",
  ],
  'waxing-crescent': [
    "Begin. The crescent has energy for it.",
    "Each step you take now builds toward the full moon.",
    "The momentum is with you. Keep going.",
    "Build something real while the energy is rising.",
    "Act. The waxing rewards movement.",
    "One step at a time. The crescent is long enough.",
  ],
  'first-quarter': [
    "The obstacle is the threshold. Go through it.",
    "Commit to what you started. The cycle demands it now.",
    "Do not retreat. The first quarter asks for decision.",
    "What you commit to here shapes the rest of the cycle.",
    "Half-lit, half-dark — choose which half you stand in.",
    "The tension is pointing at the decision. Follow it.",
  ],
  'waxing-gibbous': [
    "You are close. Refine, don't rebuild.",
    "Trust what you have built. Make it better, not bigger.",
    "The full moon is coming. Get what you have ready.",
    "Small adjustments now make large differences at the peak.",
    "Almost there. Stay the course.",
    "Finishing is the work. Not starting.",
  ],
  'full': [
    "The peak shows everything. Look honestly.",
    "What the cycle has built is illuminated now. Receive it.",
    "The truth of this cycle is here. Do not look away.",
    "Maximum light. What does it reveal about where you are?",
    "Everything is visible at the full moon. See what is true.",
    "Harvest what is real. Release what is not.",
  ],
  'waning-gibbous': [
    "Give back what the cycle gave you.",
    "Share what the full moon revealed.",
    "The generosity of the waning gibbous is real. Use it.",
    "What you learned this cycle wants to move through you to others.",
    "Give. Teach. Share. The cycle is in its most generous phase.",
    "The harvest is for sharing. Who needs what you have learned?",
  ],
  'last-quarter': [
    "What did not close needs to be released now.",
    "Clear the field. The new cycle needs clean ground.",
    "Let go of what the full moon revealed as unnecessary.",
    "Release is not failure. It is how cycles complete.",
    "What you surrender now becomes the seed of the next cycle.",
    "The clearing is the work. Do it with honesty.",
  ],
  'waning-crescent': [
    "Rest. The cycle is completing without your help.",
    "Do not start new things. Let what is unfinished wait.",
    "The cycle completes in the dark. Trust that.",
    "Stillness and restoration. Nothing else is needed now.",
    "The waning crescent asks only that you let the cycle end.",
    "Be still. The new moon will come. Let this one close.",
  ],
};

// Phase-specific tap deeper invitations
const PHASE_TAP_DEEPER = {
  'new': [
    "The dark holds more. Tap to enter.",
    "Seeds form in silence. Tap to listen.",
    "There is depth in the dark. Tap.",
    "The new moon has secrets. Tap to find them.",
    "Stillness speaks. Tap to hear it.",
  ],
  'waxing-crescent': [
    "First light reveals. Tap to see more.",
    "The crescent is building. Tap to go deeper.",
    "Energy is rising. Tap to feel it.",
    "Something is forming. Tap to witness.",
    "The build has begun. Tap for guidance.",
  ],
  'first-quarter': [
    "The tension has meaning. Tap to understand.",
    "A decision is forming. Tap for clarity.",
    "Half-lit, half-dark. Tap to see both.",
    "The threshold speaks. Tap to hear it.",
    "What is being asked? Tap to find out.",
  ],
  'waxing-gibbous': [
    "You are close. Tap to refine.",
    "Almost there. Tap for the details.",
    "The peak approaches. Tap to prepare.",
    "Fine-tuning time. Tap for insight.",
    "What needs adjustment? Tap to see.",
  ],
  'full': [
    "Maximum light. Tap to see clearly.",
    "Everything illuminated. Tap to look.",
    "The truth is visible. Tap to receive it.",
    "The peak is here. Tap to witness.",
    "What does the full moon show? Tap.",
  ],
  'waning-gibbous': [
    "What wants to be shared? Tap to find out.",
    "The harvest is in. Tap to see it.",
    "Integration is underway. Tap for guidance.",
    "The light recedes with gifts. Tap.",
    "What did you receive? Tap to reflect.",
  ],
  'last-quarter': [
    "What needs to go? Tap to see.",
    "Release is the work. Tap for clarity.",
    "The clearing is underway. Tap to help it.",
    "What are you still holding? Tap.",
    "The reckoning has insight. Tap.",
  ],
  'waning-crescent': [
    "Rest is speaking. Tap to listen.",
    "The dark returns. Tap to welcome it.",
    "The cycle completes. Tap to honour it.",
    "Stillness before renewal. Tap.",
    "What wants to rest? Tap to find out.",
  ],
};

// Phase-specific form placeholders
const PHASE_FORM_PLACEHOLDER = {
  'new': [
    "What intention is forming in the quiet...",
    "Name what wants to begin...",
    "A seed of thought...",
    "What is stirring in the dark...",
  ],
  'waxing-crescent': [
    "What is building...",
    "The next step is...",
    "What wants momentum...",
    "What are you moving toward...",
  ],
  'first-quarter': [
    "What decision is forming...",
    "The choice before you...",
    "What needs commitment...",
    "What the tension is showing...",
  ],
  'waxing-gibbous': [
    "What needs refinement...",
    "A small adjustment...",
    "What is almost ready...",
    "The finishing touch...",
  ],
  'full': [
    "What the light reveals...",
    "What is being shown...",
    "The truth of this moment...",
    "What you see clearly...",
  ],
  'waning-gibbous': [
    "What wants to be shared...",
    "What you are giving back...",
    "The gratitude is for...",
    "What moves through you...",
  ],
  'last-quarter': [
    "What you are releasing...",
    "What no longer serves...",
    "What you are letting go...",
    "What wants to end...",
  ],
  'waning-crescent': [
    "What wants to rest...",
    "The quiet holds...",
    "Before the dark...",
    "What is completing...",
  ],
};

// Phase-specific empty state guidance
const PHASE_EMPTY_STATE = {
  'new': [
    "The new moon is for planting, not harvesting. Start a seed when ready.",
    "Nothing here yet. The dark is full of potential.",
    "Empty — like the new moon. Something will form.",
    "A blank space in the quiet. Let it fill naturally.",
  ],
  'waxing-crescent': [
    "Nothing started yet. The crescent has energy for beginning.",
    "Empty, but the momentum is available. Use it.",
    "No loops yet. The waxing supports opening them.",
    "Start something. The crescent rewards first steps.",
  ],
  'first-quarter': [
    "Nothing here. What are you willing to commit to?",
    "Empty at the threshold. A decision could fill it.",
    "No entries. The first quarter asks for action.",
    "The space is waiting. What will you put in it?",
  ],
  'waxing-gibbous': [
    "Nothing to refine yet. What are you building toward?",
    "Empty near the peak. What do you want illuminated?",
    "No loops. The gibbous is for finishing, not starting.",
    "The field is clear. Consider what to bring to the full moon.",
  ],
  'full': [
    "Nothing recorded at the peak. What does the light show?",
    "Empty at full moon. Witness what is already present.",
    "No entries. The full moon is for receiving, not doing.",
    "The harvest is not here. What did this cycle actually grow?",
  ],
  'waning-gibbous': [
    "Nothing shared yet. What wants to move outward?",
    "Empty in the giving phase. What do you have to offer?",
    "No echoes. The waning gibbous supports expression.",
    "The space is quiet. What did the full moon reveal?",
  ],
  'last-quarter': [
    "Nothing to release. Or everything is already gone.",
    "Empty at the clearing. Let it be clean.",
    "No entries. Sometimes nothing needs to be said.",
    "The field is clear. That is also completion.",
  ],
  'waning-crescent': [
    "Nothing here. Good. Rest does not require content.",
    "Empty before the dark. Let it stay that way.",
    "No entries. The waning crescent asks for stillness.",
    "The quiet is enough. Do not fill it unnecessarily.",
  ],
};

const PHASE_BANNER = {
  'new': [
    "Set one true intention for this cycle.",
    "The new moon is the time for planting, not harvesting.",
    "What do you want this cycle to grow?",
    "One seed. Set it with intention.",
    "The cycle has reset. What do you call into it?",
    "Dark and quiet. Plant something worthy of 29 days.",
  ],
  'waxing-crescent': [
    "Build toward your intention. One step at a time.",
    "The energy is rising. Use it for what matters.",
    "Take the next action. The crescent supports it.",
    "Momentum wants to build. Give it direction.",
    "This phase rewards those who begin.",
    "The crescent is open. What is your next move?",
  ],
  'first-quarter': [
    "Commit to what you started. No more waiting.",
    "The cycle asks for decision. Give it one.",
    "Face the obstacle. That is what the first quarter is for.",
    "What you are willing to commit to — commit to it now.",
    "Decision made here shapes the rest of the cycle.",
    "The tension is asking for a choice. Make it.",
  ],
  'waxing-gibbous': [
    "Refine what exists. Stop adding new things.",
    "Trust what you built. Make it better, not bigger.",
    "The full moon is coming. Get your loops ready.",
    "You are close to the peak. Stay focused.",
    "Finishing is the work now. Not starting.",
    "Almost there. What needs one last adjustment?",
  ],
  'full': [
    "The cycle has illuminated what it came to illuminate.",
    "See clearly what this cycle produced. Honour what is true.",
    "The full moon is not a time for new loops.",
    "The peak is here. Be honest about what it shows.",
    "Maximum light. Look at what you built.",
    "What the cycle grew is visible now. Receive it.",
  ],
  'waning-gibbous': [
    "Share the work of this cycle with others.",
    "What the full moon revealed wants to be given away.",
    "This phase rewards generosity. Give what you can.",
    "Pass on what you learned. The cycle flows outward now.",
    "Integrate. Share. Let the harvest move through you.",
    "The giving phase is open. Who needs what you have?",
  ],
  'last-quarter': [
    "Close what needs to close. Clear the field.",
    "Release what the cycle could not complete.",
    "The last quarter is for letting go, not adding on.",
    "What incomplete loops can you close or forgive?",
    "Clearing now creates space for the next new moon.",
    "The reckoning is here. Let go with honesty.",
  ],
  'waning-crescent': [
    "Rest. No new loops. Let the cycle complete.",
    "The dark is coming. Nothing needs to be started now.",
    "This is the cycle's completion, not its beginning.",
    "Rest inside the closing. The new moon will ask for action — not yet.",
    "Let the cycle breathe down. You have done enough.",
    "Be still. The waning crescent asks for nothing more.",
  ],
};

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickPhase(phaseMap, phaseKey) {
  const pool = phaseMap[phaseKey] || phaseMap['new'];
  return pick(pool);
}

function buildRandomFallback(cycleState) {
  const phase = cycleState?.phaseKey || 'new';

  return {
    phaseGuidance:       pickPhase(PHASE_GUIDANCE, phase),
    cosmicSynthesis:     pick(FALLBACK_POOLS.cosmicSynthesis),
    energyDescription:   pickPhase(PHASE_ENERGY_DESCRIPTION, phase),
    phaseBanner:         pickPhase(PHASE_BANNER, phase),
    addLoopPrompt:       pick(FALLBACK_POOLS.addLoopPrompt),
    newMoonQuestion:     pick(FALLBACK_POOLS.newMoonQuestion),
    echoesWritePrompt:   pick(FALLBACK_POOLS.echoesWritePrompt),
    echoesVoicePrompt:   pick(FALLBACK_POOLS.echoesVoicePrompt),
    transitionInvitation:pick(FALLBACK_POOLS.transitionInvitation),
    tapDeeperInvitation: pickPhase(PHASE_TAP_DEEPER, phase),
    loopCreationContext: pick(FALLBACK_POOLS.loopCreationContext),
    rhythmContinuePrompt:pick(FALLBACK_POOLS.rhythmContinuePrompt),
    formPlaceholder:     pickPhase(PHASE_FORM_PLACEHOLDER, phase),
    emptyStateGuidance:  pickPhase(PHASE_EMPTY_STATE, phase),
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
    phaseKey: lunarData.phase.key,
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

  // 1. Check cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const age = Date.now() - cached.generatedAt;
      const samePhase = cached.phaseWhenGenerated === cycleState.phase;
      if (age < SESSION_TTL && samePhase) {
        return cached.phrases;
      }
    }
  } catch (_e) {
    // Cache read failed, continue to fetch
  }

  // 2. Generate fresh via edge function
  try {
    const res = await fetch(GENERATE_PHRASES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cycleState })
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const phrases = data.phrases;

    // 3. Cache it
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      phrases,
      generatedAt: Date.now(),
      phaseWhenGenerated: cycleState.phase
    }));

    return phrases;
  } catch (_e) {
    // 4. Fallback — build phase-aware phrases from pools
    return buildRandomFallback(cycleState);
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
