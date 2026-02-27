// Cosmic Loops - Moon Phase Content
// Deep wisdom, guidance, and keywords for each of the 8 lunar phases
// Includes phase rhythm (threshold vs flow) context

// Threshold opening (brief, pivotal phases)
const THRESHOLD_OPENING = 'This is a threshold moment — brief, clear, potent.';
// Flow opening (sustained, unfolding phases)
const FLOW_OPENING = 'You have time. This phase gives you room to move.';

export const phaseContent = {
  'new': {
    title: 'New Moon',
    symbol: '🌑',
    energy: 'Seed',
    phaseType: 'threshold',
    typeOpening: THRESHOLD_OPENING,
    guidance: 'Plant intentions. What do you want to call into this cycle?',
    deep: `The New Moon is the dark between cycles — the pause before the next breath. In darkness, seeds germinate. This is not emptiness, but potential. Ancient traditions honored this as a time for setting intentions in private, letting them gestate before the light reveals them. What do you truly want to cultivate?`,
    keywords: ['Intention', 'Darkness', 'Reset', 'Silence', 'Potential'],
    asks: 'What seeds do you want to plant?',
    loopAdvice: 'Open new loops. Set fresh intentions. Start quiet.',
  },

  'waxing-crescent': {
    title: 'Waxing Crescent',
    symbol: '🌒',
    energy: 'Build',
    phaseType: 'flow',
    typeOpening: FLOW_OPENING,
    guidance: 'The energy is rising. Push forward. Open new loops.',
    deep: `The first sliver of light after the dark. The cycle has begun, and what was planted in the New Moon now takes its first breath. This is the phase of commitment and first steps — not grand gestures, but the courage to begin. The energy is rising. Trust the direction you've chosen.`,
    keywords: ['Emergence', 'Momentum', 'Courage', 'Beginning', 'Growth'],
    asks: 'What first step can you take today?',
    loopAdvice: 'Build momentum. Add structure to your intentions.',
  },

  'first-quarter': {
    title: 'First Quarter',
    symbol: '🌓',
    energy: 'Decide',
    phaseType: 'threshold',
    typeOpening: THRESHOLD_OPENING,
    guidance: 'Commit. Decisions made now carry real weight.',
    deep: `The moon is exactly half-illuminated — a moment of tension and decision. The initial excitement has faded, and now comes the choice: continue or abandon? This is the crisis point of the waxing phase. What you commit to now will determine what the Full Moon reveals. Obstacles are not signs to stop — they are tests of your intention.`,
    keywords: ['Decision', 'Tension', 'Commitment', 'Action', 'Challenge'],
    asks: 'What are you willing to commit to fully?',
    loopAdvice: 'Face obstacles. Make decisions. Push through.',
  },

  'waxing-gibbous': {
    title: 'Waxing Gibbous',
    symbol: '🌔',
    energy: 'Refine',
    phaseType: 'flow',
    typeOpening: FLOW_OPENING,
    guidance: "You're close. Adjust, trust, keep going.",
    deep: `The moon is almost full — large, bright, nearly complete. The work is almost done. This is not a time for new starts, but for refinement. What adjustments do your intentions need? What final preparations? Trust the process. The peak is approaching. Anticipation builds.`,
    keywords: ['Refinement', 'Anticipation', 'Adjustment', 'Nearing', 'Clarity'],
    asks: 'What needs refining before completion?',
    loopAdvice: 'Refine loops. Adjust details. Trust progress.',
  },

  'full': {
    title: 'Full Moon',
    symbol: '🌕',
    energy: 'Illuminate',
    phaseType: 'threshold',
    typeOpening: THRESHOLD_OPENING,
    guidance: 'Peak. What has this cycle revealed about you?',
    deep: `Maximum light. Everything is illuminated — including things you might not have wanted to see. The Full Moon is harvest time: the culmination of the cycle's work. What has come to fruition? What truths have been revealed? This is also a moment of heightened emotion and energy. Let yourself feel it all. The moon asks for nothing but awareness.`,
    keywords: ['Revelation', 'Harvest', 'Illumination', 'Completion', 'Truth'],
    asks: 'What has this cycle revealed?',
    loopAdvice: 'Celebrate completions. See clearly. Let go of what the light reveals.',
  },

  'waning-gibbous': {
    title: 'Waning Gibbous',
    symbol: '🌖',
    energy: 'Share',
    phaseType: 'flow',
    typeOpening: FLOW_OPENING,
    guidance: 'Give back what you have gathered. Reflect and release.',
    deep: `The peak has passed. The moon begins its long release back to darkness. This is the phase of gratitude and dissemination — sharing what you've learned, giving back to others. The ego relaxes its grip. Wisdom is meant to flow outward. What have you gathered that others need?`,
    keywords: ['Gratitude', 'Sharing', 'Integration', 'Generosity', 'Wisdom'],
    asks: 'What can you share with others?',
    loopAdvice: 'Share progress. Teach what you learned. Begin releasing.',
  },

  'last-quarter': {
    title: 'Last Quarter',
    symbol: '🌗',
    energy: 'Release',
    phaseType: 'threshold',
    typeOpening: THRESHOLD_OPENING,
    guidance: "Let go of what didn't close. Clear space.",
    deep: `The second half-moon — another moment of tension, but this time toward release. What didn't work? What loops remain incomplete? This is the phase for honest evaluation and letting go. Not every intention bears fruit, and that's part of the cycle. Make space for what's next by clearing what's finished.`,
    keywords: ['Release', 'Forgiveness', 'Clearing', 'Surrender', 'Space'],
    asks: 'What do you need to release?',
    loopAdvice: 'Close incomplete loops. Clear what blocks you. Forgive.',
  },

  'waning-crescent': {
    title: 'Waning Crescent',
    symbol: '🌘',
    energy: 'Rest',
    phaseType: 'flow',
    typeOpening: FLOW_OPENING,
    guidance: 'The cycle completes. Be still. Restore.',
    deep: `The final sliver before darkness. Ancient traditions called this the Balsamic Moon — a time of profound rest and healing. The cycle is ending. Do not start new things now. Instead, rest deeply. Dream. Let go completely. The next New Moon will bring new seeds. For now, be empty. Be still.`,
    keywords: ['Rest', 'Mystery', 'Restoration', 'Endings', 'Surrender'],
    asks: 'How can you rest more deeply?',
    loopAdvice: 'Rest. Do not open new loops. Let the cycle complete.',
  },
};

// Get content for a phase by key
export function getPhaseContent(key) {
  return phaseContent[key] || phaseContent['new'];
}
