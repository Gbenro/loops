// Luna Loops - Moon Phase Content
// Deep wisdom, guidance, and keywords for each of the 8 lunar phases

// typeOpening varies by where you are within the phase (tide position)
const THRESHOLD_TIDES = {
  opening:    'This is a threshold moment — brief, clear, potent.',
  flowing:    'You are inside the threshold. Stay with what it is asking.',
  completing: 'The threshold is reaching its edge. What has it clarified?',
  closing:    'The threshold is passing. Move forward with what was revealed.',
};

const FLOW_TIDES = {
  opening:    'You have time. This phase gives you room to move.',
  flowing:    'You are in it. Follow where the energy leads.',
  completing: 'This phase is in its final stretch. Land what needs landing.',
  closing:    'The phase is closing. Take what you have moved through with you.',
};

// deepTides — deeper, more contemplative. Used in the deep sheet.
// Distinct from typeOpening: these invite reflection on what the stage calls forth.
const THRESHOLD_DEEP_TIDES = {
  opening:    'The threshold has just opened. Something is being asked of you — let it come into focus before you move.',
  flowing:    'You are inside the threshold. The question it carries is live. Stay with it — do not resolve it prematurely.',
  completing: 'The threshold is finishing its work. What it clarified in you is becoming visible.',
  closing:    'The threshold is nearly past. Carry what was revealed, and release the tension that no longer serves.',
};

const FLOW_DEEP_TIDES = {
  opening:    'The phase has just opened. The energy is available — orient before the momentum builds.',
  flowing:    'You are in the current of this phase. Work with what is moving rather than forcing something new.',
  completing: 'The phase is in its final arc. What was opened is reaching completion — land it before the shift.',
  closing:    'This phase is nearly done. What you moved through belongs to you now. The next phase will ask something different.',
};

export const phaseContent = {
  'new': {
    title: 'New Moon',
    symbol: '🌑',
    energy: 'Seed',
    phaseType: 'threshold',
    typeOpening: THRESHOLD_TIDES,
    deepTides: THRESHOLD_DEEP_TIDES,
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
    typeOpening: FLOW_TIDES,
    deepTides: FLOW_DEEP_TIDES,
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
    typeOpening: THRESHOLD_TIDES,
    deepTides: THRESHOLD_DEEP_TIDES,
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
    typeOpening: FLOW_TIDES,
    deepTides: FLOW_DEEP_TIDES,
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
    typeOpening: THRESHOLD_TIDES,
    deepTides: THRESHOLD_DEEP_TIDES,
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
    typeOpening: FLOW_TIDES,
    deepTides: FLOW_DEEP_TIDES,
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
    typeOpening: THRESHOLD_TIDES,
    deepTides: THRESHOLD_DEEP_TIDES,
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
    typeOpening: FLOW_TIDES,
    deepTides: FLOW_DEEP_TIDES,
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
