// Luna Loops - Phase Text Resolver
// Deterministic, offline text resolution based on current phase and tide
// No API calls - instant, works offline

import { getPhaseContent, pickForToday } from '../data/phaseContent.js';

// Slot definitions with phase-specific text pools
// Each slot has: a fallback, and optionally phase-keyed variants
const TEXT_SLOTS = {
  // Form placeholders
  loopTitlePlaceholder: {
    fallback: 'Name this loop...',
    phases: {
      'new': ['An intention for this cycle...', 'What seed are you planting...', 'Name what wants to begin...'],
      'waxing-crescent': ['What are you building...', 'A first step toward...', 'Momentum for...'],
      'first-quarter': ['A commitment to...', 'What you will see through...', 'The decision is...'],
      'waxing-gibbous': ['What needs finishing...', 'Refining...', 'Almost ready...'],
      'full': ['What the light reveals...', 'The truth of...', 'What is illuminated...'],
      'waning-gibbous': ['What you are sharing...', 'Giving back...', 'Passing on...'],
      'last-quarter': ['What you are releasing...', 'Letting go of...', 'Clearing...'],
      'waning-crescent': ['Before rest...', 'The last thing...', 'Completing...'],
    },
  },

  subtaskPlaceholder: {
    fallback: 'Add a step...',
    phases: {
      'new': ['A first small action...', 'One quiet step...'],
      'waxing-crescent': ['The next step...', 'Build on this...'],
      'first-quarter': ['Commit to this...', 'A concrete action...'],
      'waxing-gibbous': ['One more detail...', 'A refinement...'],
      'full': ['What the light shows needs doing...', 'A clear action...'],
      'waning-gibbous': ['Something to share...', 'Pass this on...'],
      'last-quarter': ['Clear this...', 'Release this...'],
      'waning-crescent': ['A final task...', 'Before rest...'],
    },
  },

  notePlaceholder: {
    fallback: 'A note to yourself...',
    phases: {
      'new': ['What you want to remember about this seed...', 'The quiet around this intention...'],
      'waxing-crescent': ['What is building...', 'The momentum feels like...'],
      'first-quarter': ['The tension here is...', 'What the decision taught...'],
      'waxing-gibbous': ['What needs adjusting...', 'Notes before the peak...'],
      'full': ['What the full moon reveals about this...', 'The illumination shows...'],
      'waning-gibbous': ['What you learned...', 'What wants to be shared...'],
      'last-quarter': ['What you are releasing...', 'The clearing...'],
      'waning-crescent': ['Before rest...', 'The completion...'],
    },
  },

  // Empty states
  noLoopsMessage: {
    fallback: 'No loops yet.',
    phases: {
      'new': ['No loops yet. The dark is full of potential.', 'Empty — like the new moon. What wants to form?'],
      'waxing-crescent': ['No loops yet. The crescent has energy for beginning.', 'Start something. The waxing supports it.'],
      'first-quarter': ['No loops yet. What are you willing to commit to?', 'Empty at the threshold. A decision could change that.'],
      'waxing-gibbous': ['No loops yet. What are you building toward the peak?', 'The gibbous is for finishing. What do you have to finish?'],
      'full': ['No loops at full moon. What does the light illuminate without you doing anything?', 'Empty at the peak. Witness what is present without creating.'],
      'waning-gibbous': ['No loops in the giving phase. What do you have to share?', 'Empty — that can be a gift too.'],
      'last-quarter': ['No loops to close. Perhaps the clearing is complete.', 'Empty at last quarter. Sometimes that is the release.'],
      'waning-crescent': ['No loops. Good. The waning crescent asks for rest, not action.', 'Empty before the dark. Let it be.'],
    },
  },

  noLoopsSubtext: {
    fallback: 'Open loops for regular tasks, or phase loops to align with the moon.',
    phases: {
      'new': ['The new moon asks: what seed wants planting?', 'Name an intention. Let it take root.'],
      'waxing-crescent': ['Start with momentum. The crescent is building.', 'Create a phase loop to ride the waxing energy.'],
      'first-quarter': ['The threshold demands commitment. What will you choose?', 'Phase loops close with the moon. Choose wisely.'],
      'waxing-gibbous': ['The peak approaches. What work needs finishing?', 'A phase loop now means completing by full moon.'],
      'full': ['The light reveals. Perhaps rest is the action.', 'Witnessing is also a loop. What do you see?'],
      'waning-gibbous': ['The waning shares. What have you learned?', 'Open loops can close. Phase loops can release.'],
      'last-quarter': ['Release takes no tracking. But you could name what goes.', 'A phase loop now means letting go.'],
      'waning-crescent': ['Rest asks for stillness. Creating can wait.', 'The new moon is coming. Prepare in quiet.'],
    },
  },

  noEchoesMessage: {
    fallback: 'No echoes yet. What is alive in you?',
    phases: {
      'new': ['No echoes yet. The silence is full.', 'Nothing recorded. What is forming in the dark?'],
      'waxing-crescent': ['No echoes yet. What is beginning to stir?', 'Empty journal. The crescent invites first words.'],
      'first-quarter': ['No echoes yet. What decision is pressing?', 'The threshold has questions. What are yours?'],
      'waxing-gibbous': ['No echoes yet. What are you noticing as the peak approaches?', 'Almost at full moon. What do you see?'],
      'full': ['No echoes at full moon. The light reveals without words too.', 'Nothing recorded at the peak. That is also a witness.'],
      'waning-gibbous': ['No echoes yet. What wants to be expressed?', 'The sharing phase is open. What do you have to say?'],
      'last-quarter': ['No echoes at last quarter. The silence can be release.', 'Nothing to say. That is valid at the clearing.'],
      'waning-crescent': ['No echoes. Rest does not require recording.', 'Silence before the dark. Let it be quiet.'],
    },
  },

  noRhythmsMessage: {
    fallback: 'No rhythms yet. A rhythm is a practice you witness across the cycle.',
    phases: {
      'new': ['No rhythms yet. The new moon is a good time to name what you want to track.', 'No practices being observed. What wants your attention this cycle?'],
      'waxing-crescent': ['No rhythms yet. What practice is building?', 'Name something you are doing. Watch how it moves.'],
      'first-quarter': ['No rhythms yet. What practice needs commitment?', 'The quarter asks: what are you actually doing?'],
      'waxing-gibbous': ['No rhythms yet. What practice carries you to the peak?', 'Name what you are already doing. Observe it.'],
      'full': ['No rhythms tracked. At full moon, see what practices you actually have.', 'What do you do without tracking it? That is the rhythm.'],
      'waning-gibbous': ['No rhythms yet. What practice could you share?', 'The giving phase. What are you already practicing?'],
      'last-quarter': ['No rhythms. Perhaps the practice is releasing.', 'No practices to observe. Let that be the observation.'],
      'waning-crescent': ['No rhythms. Rest is also a rhythm.', 'No practices tracked. The waning asks for stillness.'],
    },
  },

  noRhythmsSubtext: {
    fallback: 'A rhythm is a named practice you track across the lunar cycle — not a task, just witnessing.',
    phases: {
      'new': ['Name what you do. Watch it through the cycle.', 'The dark is for naming. What practice will you observe?'],
      'waxing-crescent': ['Start observing. The crescent momentum will carry it.', 'Not a task — a witness. What are you already doing?'],
      'first-quarter': ['Commit to observing. Not doing more — just watching.', 'The practice exists or it does not. Name it.'],
      'waxing-gibbous': ['Almost at the peak. What practice are you bringing there?', 'Observation reveals rhythm. What do you repeat?'],
      'full': ['Witnessing, not tracking. What do you see yourself doing?', 'The full moon illuminates patterns. What is yours?'],
      'waning-gibbous': ['What practice wants sharing? Name it, observe it.', 'Teaching is a rhythm. What do you pass on?'],
      'last-quarter': ['Release can be a practice. Name what you let go of.', 'Clearing as rhythm. What do you repeatedly release?'],
      'waning-crescent': ['Rest is a practice. Sleep is a rhythm.', 'Stillness observed is still a rhythm.'],
    },
  },

  rhythmContinuePrompt: {
    fallback: 'This rhythm continues into a new cycle. Same intention, or does something want to shift?',
    phases: {
      'new': [
        'A new cycle begins. Does this rhythm carry forward as it is?',
        'The dark asks: same practice, or something wants to change?',
        'New moon, same rhythm? Or does this cycle ask something different?',
      ],
    },
  },

  openLoopPrompt: {
    fallback: 'What do you want to track?',
    phases: {
      'new': ['What wants tracking as the cycle begins?', 'An open thread in the dark...'],
      'waxing-crescent': ['What thread are you following?', 'Track the momentum building...'],
      'first-quarter': ['What commitment needs tracking?', 'An open thread at the threshold...'],
      'waxing-gibbous': ['What details need attention?', 'Track what needs finishing...'],
      'full': ['What is illuminated to track?', 'An open thread in full light...'],
      'waning-gibbous': ['What are you sharing?', 'Track what you are giving...'],
      'last-quarter': ['What are you releasing?', 'An open thread to close...'],
      'waning-crescent': ['What rests in your hands?', 'A quiet thread before the dark...'],
    },
  },
};

// Stable daily pick — same result for the day, different per slot
function stablePick(pool, slotName) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  const seed = new Date().toDateString() + slotName;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return pool[hash % pool.length];
}

/**
 * Resolve phase-aware text for a given slot
 * @param {string} slotName - The name of the text slot (e.g., 'loopTitlePlaceholder')
 * @param {string} phaseKey - The current lunar phase key (e.g., 'waxing-crescent')
 * @returns {string} The resolved text
 */
export function resolvePhaseText(slotName, phaseKey) {
  const slot = TEXT_SLOTS[slotName];
  if (!slot) return '';

  const phasePool = slot.phases?.[phaseKey];
  if (phasePool && phasePool.length > 0) {
    return stablePick(phasePool, slotName);
  }

  return slot.fallback;
}

/**
 * Get phase-specific guidance text from phaseContent.js
 * @param {string} phaseKey - The current lunar phase key
 * @param {string} tideKey - The tide within the phase ('opening', 'flowing', 'completing', 'closing')
 * @returns {object} Object with various phase content
 */
export function getPhaseGuidanceText(phaseKey, tideKey = 'flowing') {
  const content = getPhaseContent(phaseKey);

  return {
    title: content.title,
    energy: content.energy,
    guidance: content.guidance,
    asks: content.asks,
    loopAdvice: content.loopAdvice,
    deep: content.deep,
    keywords: content.keywords,
    // Tide-specific opening
    tideOpening: pickForToday(content.typeOpening?.[tideKey] || content.typeOpening?.opening),
    // Deep tide text
    deepTide: pickForToday(content.deepTides?.[tideKey] || content.deepTides?.flowing),
  };
}

/**
 * Get energy-matched preset tags based on current phase
 * @param {string} phaseKey - The current lunar phase key
 * @returns {string[]} Tags that are particularly relevant for this phase energy
 */
export function getPhaseRelevantTags(phaseKey) {
  const tagMap = {
    'new': ['intention', 'seed', 'question', 'vision', 'rest'],
    'waxing-crescent': ['clarity', 'intention', 'body', 'work', 'breakthrough'],
    'first-quarter': ['tension', 'work', 'fear', 'breakthrough', 'insight'],
    'waxing-gibbous': ['clarity', 'work', 'insight', 'body', 'vision'],
    'full': ['clarity', 'insight', 'revelation', 'gratitude', 'joy'],
    'waning-gibbous': ['gratitude', 'insight', 'relationship', 'joy', 'vision'],
    'last-quarter': ['release', 'grief', 'shadow', 'fear', 'question'],
    'waning-crescent': ['rest', 'release', 'dream', 'prayer', 'shadow'],
  };

  return tagMap[phaseKey] || tagMap['new'];
}

export { TEXT_SLOTS };
