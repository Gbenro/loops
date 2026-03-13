// Luna Loops - Moon Phase Content
// Deep wisdom, guidance, and keywords for each of the 8 lunar phases

// ─── Threshold phase tides — each phase has its own set ──────────────────────

const NEW_MOON_TIDES = {
  opening:    'The dark has just begun. Let the silence be enough for now.',
  flowing:    'You are inside the new moon. Hold your intention quietly — do not rush it into the light.',
  completing: 'The darkness is thinning. What seed did you plant? Feel it before it surfaces.',
  closing:    'The crescent is coming. Carry your intention forward into the growing light.',
};

const NEW_MOON_DEEP_TIDES = {
  opening:    'The new moon has just opened. This is the most interior moment of the cycle — something is forming that does not yet have a name.',
  flowing:    'You are in the dark. This is not emptiness — it is gestation. What you hold quietly now will shape the whole cycle ahead.',
  completing: 'The new moon is finishing its work. The intention you have seeded is ready to meet the light. Trust what formed in the silence.',
  closing:    'The crescent is nearly here. The dark has done what it came to do. Move forward with what the stillness gave you.',
};

const FIRST_QUARTER_TIDES = {
  opening:    'The tension is arriving. Something in you knows what needs to be decided.',
  flowing:    'You are at the crossroads. The decision this phase is asking for will not make itself.',
  completing: 'The quarter is resolving. What you commit to now sets the direction for the full moon.',
  closing:    'The decision has been made, or it is being made. Move forward — the gibbous will refine what you chose.',
};

const FIRST_QUARTER_DEEP_TIDES = {
  opening:    'The first quarter has arrived. Half-lit, half-dark — the same tension lives in you. Something is being asked for that cannot be halfway.',
  flowing:    'You are inside the decision. The obstacle this phase brings is not against you — it is testing whether your intention has roots.',
  completing: 'The quarter threshold is completing its work. What you have committed to is now real. What you have avoided is also visible.',
  closing:    'The first quarter is passing. Whatever was decided here — consciously or not — is already in motion. The waxing gibbous will show you what it means.',
};

const FULL_MOON_TIDES = {
  opening:    'The peak is arriving. What this cycle has been building is becoming visible.',
  flowing:    'You are at maximum light. What the cycle has grown is fully illuminated now.',
  completing: 'The full moon is at its height. What has been revealed cannot be unseen.',
  closing:    'The light is beginning to wane. Take what was illuminated with you into the release.',
};

const FULL_MOON_DEEP_TIDES = {
  opening:    'The full moon is opening. Everything the cycle has built is rising to the surface — what arrives now was seeded at the new moon.',
  flowing:    'You are at the peak. The light shows what is true. Some of what you see will be welcome; some will not. Both are the harvest.',
  completing: 'The full moon is completing its work. What it has revealed is yours to reckon with. This is not the time to look away.',
  closing:    'The full moon is passing. The light has shown what it came to show. Carry the truth of it into the waning — that is what release is made from.',
};

const LAST_QUARTER_TIDES = {
  opening:    'The release is beginning. What did not complete wants to be let go now.',
  flowing:    'You are inside the clearing. What you release here makes room for the new cycle.',
  completing: 'The last quarter is finishing its work. What are you still holding that no longer serves?',
  closing:    'The crescent of darkness is coming. Set down what belongs to this cycle. The new moon will ask for only what is true.',
};

const LAST_QUARTER_DEEP_TIDES = {
  opening:    'The last quarter has opened. Half the light remains — and with it, a clear-eyed reckoning. What from this cycle needs to end before the dark arrives?',
  flowing:    'You are in the release. This is not failure — it is completion. What you let go of here is an act of care for the cycle that follows.',
  completing: 'The last quarter is closing. The clearing is nearly done. What you surrender now is not lost — it becomes the compost for the next beginning.',
  closing:    'The last quarter is nearly past. The waning crescent and then the dark await. Whatever remains to release, release it now. The new moon does not carry old weight.',
};

// ─── Flow phase tides — each phase has its own set ───────────────────────────

const WAXING_CRESCENT_TIDES = {
  opening:    'The crescent is just forming. You have the full phase ahead — begin with one step.',
  flowing:    'The build is underway. What you put in now compounds.',
  completing: 'The crescent is thinning toward the quarter. Close what you opened before the decision phase arrives.',
  closing:    'The first quarter is near. Bring your early movement to a point.',
};

const WAXING_CRESCENT_DEEP_TIDES = {
  opening:    'The crescent is opening. The full arc of this phase lies ahead — plant yourself in it before the momentum takes over.',
  flowing:    'You are building. What you sustain now becomes the foundation the full moon will illuminate.',
  completing: 'The crescent is ending. What you set in motion here will meet its first real test at the quarter. Consolidate before that threshold.',
  closing:    'The first quarter is arriving. Bring your intentions to a point. The next phase demands a decision.',
};

const WAXING_GIBBOUS_TIDES = {
  opening:    'The gibbous opens wide. You are close — use this phase to refine, not rebuild.',
  flowing:    'Refinement is the work now. Adjust the details. The full moon is coming.',
  completing: 'The peak is near. What needs one last adjustment before the light arrives?',
  closing:    'The full moon is hours away. What you have refined is ready. Stop changing it.',
};

const WAXING_GIBBOUS_DEEP_TIDES = {
  opening:    'The gibbous phase opens. Most of the work has been done — now the task is trust and precision, not effort.',
  flowing:    'You are refining. Resist the urge to start something new. What exists is nearly ready.',
  completing: 'The full moon is close. Refinement should be finishing, not beginning. Let what you have be enough.',
  closing:    'The peak is upon you. The gibbous has done its work. Step into the full moon with what you have built.',
};

const WANING_GIBBOUS_TIDES = {
  opening:    'The peak has just passed. You have the whole waning gibbous to integrate and share what arose.',
  flowing:    'The light is slowly leaving. Give back what the cycle has given you.',
  completing: 'The gibbous is closing. What you have learned needs to land — share it before the last quarter.',
  closing:    'The last quarter threshold is near. Finish sharing. A reckoning is coming.',
};

const WANING_GIBBOUS_DEEP_TIDES = {
  opening:    'The full moon has passed. This phase is the cycle\'s most generous — let what you received begin to move outward.',
  flowing:    'You are integrating. What the full moon revealed wants to become something you can offer. Share, teach, pass on.',
  completing: 'The gibbous waning is closing. What was shared and integrated now approaches its release. Prepare to let go.',
  closing:    'The last quarter threshold is near. What was gathered and given in this phase now asks to be released. Let the tide turn.',
};

const WANING_CRESCENT_TIDES = {
  opening:    'The final phase opens. Let the cycle breathe down.',
  flowing:    'You are in the slowest, darkest part. This is not a time to push.',
  completing: 'The darkness is almost complete. What remains can wait for the new cycle.',
  closing:    'The new moon is near. Release the last of what this cycle held.',
};

const WANING_CRESCENT_DEEP_TIDES = {
  opening:    'The last phase begins. The cycle is completing itself — your work now is restoration, not production.',
  flowing:    'You are in the fallow period. The darkness before the new moon has its own intelligence. Trust what rises in stillness.',
  completing: 'The new moon is approaching. What this cycle has taught you is settling in. Do not force conclusions.',
  closing:    'The new moon is nearly here. The old cycle is done. Allow the darkness to complete its work — something new is forming in the quiet.',
};

export const phaseContent = {
  'new': {
    title: 'New Moon',
    symbol: '🌑',
    energy: 'Seed',
    phaseType: 'threshold',
    typeOpening: NEW_MOON_TIDES,
    deepTides: NEW_MOON_DEEP_TIDES,
    guidance: 'Plant intentions. What do you want to call into this cycle?',
    deep: 'The dark between cycles. Seeds germinate in darkness. Set intentions privately. Let them form before light reveals them.',
    keywords: ['Intention', 'Darkness', 'Reset', 'Silence', 'Potential'],
    asks: 'What seeds do you want to plant?',
    loopAdvice: 'Open new loops. Set fresh intentions. Start quiet.',
  },

  'waxing-crescent': {
    title: 'Waxing Crescent',
    symbol: '🌒',
    energy: 'Build',
    phaseType: 'flow',
    typeOpening: WAXING_CRESCENT_TIDES,
    deepTides: WAXING_CRESCENT_DEEP_TIDES,
    guidance: 'The energy is rising. Push forward. Open new loops.',
    deep: 'First light after darkness. The cycle begins. Take small steps forward. Build momentum. Trust your direction.',
    keywords: ['Emergence', 'Momentum', 'Courage', 'Beginning', 'Growth'],
    asks: 'What first step can you take today?',
    loopAdvice: 'Build momentum. Add structure to your intentions.',
  },

  'first-quarter': {
    title: 'First Quarter',
    symbol: '🌓',
    energy: 'Decide',
    phaseType: 'threshold',
    typeOpening: FIRST_QUARTER_TIDES,
    deepTides: FIRST_QUARTER_DEEP_TIDES,
    guidance: 'Commit. Decisions made now carry real weight.',
    deep: 'Half-lit, half-dark. Tension and decision. Obstacles test your intention. Commit fully or let go.',
    keywords: ['Decision', 'Tension', 'Commitment', 'Action', 'Challenge'],
    asks: 'What are you willing to commit to fully?',
    loopAdvice: 'Face obstacles. Make decisions. Push through.',
  },

  'waxing-gibbous': {
    title: 'Waxing Gibbous',
    symbol: '🌔',
    energy: 'Refine',
    phaseType: 'flow',
    typeOpening: WAXING_GIBBOUS_TIDES,
    deepTides: WAXING_GIBBOUS_DEEP_TIDES,
    guidance: "You're close. Adjust, trust, keep going.",
    deep: 'Almost full. Refine, don\'t revolutionize. Adjust the details. The peak approaches. Trust what you\'ve built.',
    keywords: ['Refinement', 'Anticipation', 'Adjustment', 'Nearing', 'Clarity'],
    asks: 'What needs refining before completion?',
    loopAdvice: 'Refine loops. Adjust details. Trust progress.',
  },

  'full': {
    title: 'Full Moon',
    symbol: '🌕',
    energy: 'Illuminate',
    phaseType: 'threshold',
    typeOpening: FULL_MOON_TIDES,
    deepTides: FULL_MOON_DEEP_TIDES,
    guidance: 'Peak. What has this cycle revealed about you?',
    deep: 'Maximum light. Everything illuminated. Harvest what has grown. See clearly. Feel fully. Let truth arrive.',
    keywords: ['Revelation', 'Harvest', 'Illumination', 'Completion', 'Truth'],
    asks: 'What has this cycle revealed?',
    loopAdvice: 'Celebrate completions. See clearly. Let go of what the light reveals.',
  },

  'waning-gibbous': {
    title: 'Waning Gibbous',
    symbol: '🌖',
    energy: 'Share',
    phaseType: 'flow',
    typeOpening: WANING_GIBBOUS_TIDES,
    deepTides: WANING_GIBBOUS_DEEP_TIDES,
    guidance: 'Give back what you have gathered. Reflect and release.',
    deep: 'The peak has passed. Share what you\'ve learned. Give back. Gratitude flows naturally now.',
    keywords: ['Gratitude', 'Sharing', 'Integration', 'Generosity', 'Wisdom'],
    asks: 'What can you share with others?',
    loopAdvice: 'Share progress. Teach what you learned. Begin releasing.',
  },

  'last-quarter': {
    title: 'Last Quarter',
    symbol: '🌗',
    energy: 'Release',
    phaseType: 'threshold',
    typeOpening: LAST_QUARTER_TIDES,
    deepTides: LAST_QUARTER_DEEP_TIDES,
    guidance: "Let go of what didn't close. Clear space.",
    deep: 'Half-lit again, but releasing. What didn\'t work? Let it go. Clear the field for what\'s next.',
    keywords: ['Release', 'Forgiveness', 'Clearing', 'Surrender', 'Space'],
    asks: 'What do you need to release?',
    loopAdvice: 'Close incomplete loops. Clear what blocks you. Forgive.',
  },

  'waning-crescent': {
    title: 'Waning Crescent',
    symbol: '🌘',
    energy: 'Rest',
    phaseType: 'flow',
    typeOpening: WANING_CRESCENT_TIDES,
    deepTides: WANING_CRESCENT_DEEP_TIDES,
    guidance: 'The cycle completes. Be still. Restore.',
    deep: 'Final sliver before darkness. Rest deeply. Dream. Don\'t start new things. Let the cycle complete.',
    keywords: ['Rest', 'Mystery', 'Restoration', 'Endings', 'Surrender'],
    asks: 'How can you rest more deeply?',
    loopAdvice: 'Rest. Do not open new loops. Let the cycle complete.',
  },
};

export function getPhaseContent(key) {
  return phaseContent[key] || phaseContent['new'];
}
