// Luna Living Field - Sky Astronomical Wisdom & Ephemeris Data
// Grounded in Classic Luna's verified content (phaseContent, lunarMonths, zodiacMeanings, solar)

export interface PhaseWisdom {
  title: string;
  symbol: string;
  energy: string;
  phaseType: 'threshold' | 'flow';
  guidance: string;
  deep: string;
  keywords: string[];
  asks: string;
  loopAdvice: string;
  tides: {
    opening: string[];
    flowing: string[];
    completing: string[];
    closing: string[];
  };
  questions: string[];
}

export function pickForToday(pool: string[]): string {
  if (!Array.isArray(pool) || !pool.length) return '';
  const seed = new Date().toDateString() + (pool[0] || '').slice(0, 8);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  return pool[hash % pool.length];
}

export const PHASE_WISDOM: Record<string, PhaseWisdom> = {
  new: {
    title: 'New Moon',
    symbol: '🌑',
    energy: 'Seed',
    phaseType: 'threshold',
    guidance: 'Plant intentions. What do you want to call into this cycle?',
    deep: 'The dark between cycles. Seeds germinate in darkness. Set intentions privately. Let them form before light reveals them.',
    keywords: ['Intention', 'Darkness', 'Reset', 'Silence', 'Potential'],
    asks: 'What seeds do you want to plant?',
    loopAdvice: 'Open new loops. Set fresh intentions. Start quiet.',
    tides: {
      opening: [
        'The dark has just begun. Let the silence be enough for now.',
        'Darkness arrives. There is nowhere to go yet — just be here.',
        'The new moon opens. Rest inside the not-yet-knowing.',
        'The cycle has reset. Let what is forming in you form slowly.'
      ],
      flowing: [
        'You are inside the new moon. Hold your intention quietly — do not rush it into the light.',
        'The darkness is full. What you carry inside it now will shape the whole cycle.',
        'You are in the quiet centre. Stay with your intention without forcing it forward.'
      ],
      completing: [
        'The darkness is thinning. What seed did you plant? Feel it before it surfaces.',
        'The new moon is nearly done. What intention formed in the quiet?',
        'The dark is releasing. Your seed is near the surface.'
      ],
      closing: [
        'The crescent is coming. Carry your intention forward into the growing light.',
        'The dark is ending. What you held in silence is ready to meet the light.',
        'First light is near. Your intention is ready. Step into the waxing.'
      ]
    },
    questions: [
      'What wants to begin in the quiet, without an audience?',
      'What intention can you hold without needing to explain it yet?',
      'Where can you allow empty space in your life this cycle?'
    ]
  },

  'waxing-crescent': {
    title: 'Waxing Crescent',
    symbol: '🌒',
    energy: 'Build',
    phaseType: 'flow',
    guidance: 'The energy is rising. Push forward. Open new loops.',
    deep: 'First light after darkness. The cycle begins. Take small steps forward. Build momentum. Trust your direction.',
    keywords: ['Emergence', 'Momentum', 'Courage', 'Beginning', 'Growth'],
    asks: 'What first step can you take today?',
    loopAdvice: 'Build momentum. Add structure to your intentions.',
    tides: {
      opening: [
        'First light emerges. The smallest action now counts as movement.',
        'The crescent appears. The direction is set; now take the first stride.',
        'A sliver of light. Energy turns outward into concrete beginnings.'
      ],
      flowing: [
        'You are building momentum. Protect the seedling from premature doubts.',
        'The crescent is waxing. Give daily attention to what you want to grow.',
        'Steady outward movement. Trust the quiet progress of routine.'
      ],
      completing: [
        'The light is broadening. The first hurdle is coming into view.',
        'Momentum is established. Prepare to meet the decision of the quarter.',
        'The crescent nears the half-mark. Consolidate what you have started.'
      ],
      closing: [
        'The first quarter threshold approaches. Ground your effort before the test.',
        'The crescent gives way to decision. What you started now demands commitment.'
      ]
    },
    questions: [
      'What small concrete step can you take today toward your intention?',
      'What gentle structure will support your focus this week?',
      'How does your body feel as the creative energy begins to rise?'
    ]
  },

  'first-quarter': {
    title: 'First Quarter',
    symbol: '🌓',
    energy: 'Decide',
    phaseType: 'threshold',
    guidance: 'Commit. Decisions made now carry real weight.',
    deep: 'Half-lit, half-dark. Tension and decision. Obstacles test your intention. Commit fully or let go.',
    keywords: ['Decision', 'Tension', 'Commitment', 'Action', 'Challenge'],
    asks: 'What are you willing to commit to fully?',
    loopAdvice: 'Face obstacles. Make decisions. Push through.',
    tides: {
      opening: [
        'The tension is arriving. Something in you knows what needs to be decided.',
        'The quarter opens. Half-lit, half-dark — the same lives in you.',
        'A decision point has arrived. Do not look away from it.',
        'The threshold of decision. Something is being asked that cannot be halfway.'
      ],
      flowing: [
        'You are at the crossroads. The decision this phase is asking for will not make itself.',
        'Inside the decision. The obstacle this phase brings is not against you — it tests your roots.',
        'The quarter is live. What you commit to now carries the weight of the whole cycle.',
        'You are inside the tension. Stay with it — the answer is in here, not out there.'
      ],
      completing: [
        'The quarter is resolving. What you commit to now sets the direction for the full moon.',
        'The decision is crystallising. What have you been avoiding that this phase asks you to face?',
        'The quarter threshold is nearly past. What has been clarified?'
      ],
      closing: [
        'The decision has been made, or it is being made. Move forward with conviction.',
        'The quarter passes. What you committed to is real now. The waxing gibbous begins.',
        'The threshold closes. Take what was clarified and build upon it.'
      ]
    },
    questions: [
      'What decision have you been postponing that is ready to be made?',
      'Where is resistance showing you exactly where your growth lives?',
      'What are you willing to commit to in action today?'
    ]
  },

  'waxing-gibbous': {
    title: 'Waxing Gibbous',
    symbol: '🌔',
    energy: 'Refine',
    phaseType: 'flow',
    guidance: "You're close. Adjust, trust, keep going.",
    deep: "Almost full. Refine, don't revolutionize. Adjust the details. The peak approaches. Trust what you've built.",
    keywords: ['Refinement', 'Anticipation', 'Adjustment', 'Nearing', 'Clarity'],
    asks: 'What needs refining before completion?',
    loopAdvice: 'Refine loops. Adjust details. Trust progress.',
    tides: {
      opening: [
        'The decision is behind you. Now comes the craft of refinement.',
        'The light swells past half. Pay close attention to the fine details.',
        'Almost full. Polish what is working rather than starting afresh.'
      ],
      flowing: [
        'You are in the final build. Patience and precision will carry you to the peak.',
        'Anticipation grows. Trust the foundation you established.',
        'Refining and adjusting. Keep your eyes on the horizon.'
      ],
      completing: [
        'The full moon is hours away. Step back and see what is taking shape.',
        'The swelling light is nearly complete. Prepare to receive the harvest.',
        'Final adjustments. Allow what is about to be revealed to arrive.'
      ],
      closing: [
        'The threshold of maximum light is here. Put down your tools.',
        'The gibbous completes. Open yourself to clear seeing.'
      ]
    },
    questions: [
      'What small adjustment will bring greater harmony to your work?',
      'Where can you practice patience as the culmination approaches?',
      'What needs to be polished rather than remade?'
    ]
  },

  full: {
    title: 'Full Moon',
    symbol: '🌕',
    energy: 'Illuminate',
    phaseType: 'threshold',
    guidance: 'Peak. What has this cycle revealed about you?',
    deep: 'Maximum light. Everything illuminated. Harvest what has grown. See clearly. Feel fully. Let truth arrive.',
    keywords: ['Revelation', 'Harvest', 'Illumination', 'Completion', 'Truth'],
    asks: 'What has this cycle revealed?',
    loopAdvice: 'Celebrate completions. See clearly. Let go of what the light reveals.',
    tides: {
      opening: [
        'The full moon is opening. Everything the cycle has built is rising to the surface.',
        'Maximum light is near. The peak asks not for more doing, but for honest seeing.',
        'The illumination begins. What was seeded in the dark is visible now.'
      ],
      flowing: [
        'You are at the peak. The light shows what is true — both what worked and what did not.',
        'Maximum visibility. Celebrate what has ripened and acknowledge what is complete.',
        'You are inside the full moon. Honor the harvest of your efforts.'
      ],
      completing: [
        'The full moon completes its illumination. What was clarified belongs to you.',
        'The peak has passed its height. Let the revelation settle into wisdom.',
        'The light begins its slow return. Carry the truth forward.'
      ],
      closing: [
        'The peak gives way to waning. What was illuminated becomes the compass for release.',
        'The full moon closes. Turn from gathering toward sharing and integration.'
      ]
    },
    questions: [
      'What truth is fully illuminated in your life right now?',
      'What accomplishment or growth from this cycle can you celebrate?',
      'What has completed its purpose and is ready to be released?'
    ]
  },

  'waning-gibbous': {
    title: 'Waning Gibbous',
    symbol: '🌖',
    energy: 'Integrate',
    phaseType: 'flow',
    guidance: 'Share what you have learned. Teach, give, integrate.',
    deep: 'The peak has passed. The cycle turns toward generosity. Offer your insights outward and integrate the harvest.',
    keywords: ['Gratitude', 'Sharing', 'Integration', 'Generosity', 'Teaching'],
    asks: 'What can you offer to others from this experience?',
    loopAdvice: 'Close completed loops. Express gratitude. Share what you learned.',
    tides: {
      opening: [
        'The peak is behind you. The cycle turns toward generosity — what do you have to give?',
        'The waning begins. The work now moves outward: share, teach, give back.'
      ],
      flowing: [
        'You are in the integration. What the full moon revealed is becoming an offering.',
        'The waning gibbous flows. Share what you know. Teach what arrived.'
      ],
      completing: [
        'The sharing phase is completing. Ground your insights before the next threshold.',
        'The integration deepens. What did you learn that will stay with you?'
      ],
      closing: [
        'The last quarter approaches. Finish giving; a reckoning is coming.',
        'The gibbous closes. Prepare for the clarity of conscious release.'
      ]
    },
    questions: [
      'Who in your life would benefit from the insights you gained recently?',
      'What lesson from this cycle feels most grounded in your bones?',
      'How can you express gratitude for what has unfolded?'
    ]
  },

  'last-quarter': {
    title: 'Last Quarter',
    symbol: '🌗',
    energy: 'Release',
    phaseType: 'threshold',
    guidance: 'Clear the path. Consciously close what no longer serves.',
    deep: 'Half-lit again, but turning toward the dark. Forgive, release, and consciously clear what you will not carry forward.',
    keywords: ['Release', 'Clearing', 'Forgiveness', 'Closure', 'Surrender'],
    asks: 'What are you ready to let go of?',
    loopAdvice: 'Consciously close open loops. Clear mental clutter.',
    tides: {
      opening: [
        'The release is beginning. What did not complete wants to be let go now.',
        'The last quarter opens. A clear-eyed letting go is being asked of you.'
      ],
      flowing: [
        'You are inside the clearing. What you release here makes room for the new cycle.',
        'This is not failure — it is completion. Surrender what is finished.'
      ],
      completing: [
        'The clearing is nearly done. What you surrender becomes compost for the next beginning.',
        'The last quarter completes its work. Release is an act of care.'
      ],
      closing: [
        'The threshold closes. The waning crescent nears — bring the clearing to rest.',
        'The release is behind you. Prepare to enter the sacred quiet.'
      ]
    },
    questions: [
      'What expectation or attachment are you ready to surrender?',
      'Which loop or commitment can you consciously close today?',
      'What forgiveness can you offer yourself or another before the cycle ends?'
    ]
  },

  'waning-crescent': {
    title: 'Waning Crescent',
    symbol: '🌘',
    energy: 'Rest',
    phaseType: 'flow',
    guidance: 'Rest deeply. Do not start anything new. Surrender to stillness.',
    deep: 'The final sliver of light before the new moon. Recuperate, dream, and allow the mind to become fallow.',
    keywords: ['Rest', 'Stillness', 'Surrender', 'Dreaming', 'Fallow'],
    asks: 'How can you deeply rest today?',
    loopAdvice: 'Do not open new loops. Rest and let the field go fallow.',
    tides: {
      opening: [
        'The final phase opens. Let the cycle breathe down into stillness.',
        'The waning crescent begins. Rest is the primary work now.'
      ],
      flowing: [
        'You are in the fallow time. The cycle integrates everything it held. Rest with it.',
        'The darkness is gathering softly. Trust the quiet.'
      ],
      completing: [
        'The sliver is vanishing. What wants to drop away before the new moon?',
        'The dark is very close. Be gentle with your thoughts and energy.'
      ],
      closing: [
        'The crescent closes. The new moon is arriving. Arrive at it empty and open.',
        'The old cycle is finished. Everything is at rest.'
      ]
    },
    questions: [
      'Where can you soften and surrender effort today?',
      'What does your body need in order to feel completely restored?',
      'Can you allow yourself to not know what comes next?'
    ]
  }
};

export const ZODIAC_LORE: Record<string, { element: string; modality: string; ruler: string; meaning: string; focus: string }> = {
  Aries: { element: 'Fire', modality: 'Cardinal', ruler: 'Mars', meaning: 'Spontaneous spark, courage, initiative', focus: 'Action and courageous beginnings' },
  Taurus: { element: 'Earth', modality: 'Fixed', ruler: 'Venus', meaning: 'Sensory grounding, stability, physical presence', focus: 'Patience, the body, and simple pleasures' },
  Gemini: { element: 'Air', modality: 'Mutable', ruler: 'Mercury', meaning: 'Curiosity, perception, mental agility', focus: 'Inquiry, conversation, and multiple angles' },
  Cancer: { element: 'Water', modality: 'Cardinal', ruler: 'Moon', meaning: 'Emotional sanctuary, instinct, deep roots', focus: 'Home, tenderness, and honoring feelings' },
  Leo: { element: 'Fire', modality: 'Fixed', ruler: 'Sun', meaning: 'Creative sovereignty, warmth, heartfelt expression', focus: 'Play, dignity, and radiant self-expression' },
  Virgo: { element: 'Earth', modality: 'Mutable', ruler: 'Mercury', meaning: 'Devotion, discernment, subtle craft', focus: 'Simplification, refining daily rhythms, and care' },
  Libra: { element: 'Air', modality: 'Cardinal', ruler: 'Venus', meaning: 'Relational balance, aesthetic harmony, justice', focus: 'Reciprocity, perspective, and finding center' },
  Scorpio: { element: 'Water', modality: 'Fixed', ruler: 'Pluto', meaning: 'Depth, psychic honesty, regeneration', focus: 'Emotional truth, shedding armor, and rebirth' },
  Sagittarius: { element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', meaning: 'Expansive vision, quest for meaning, faith', focus: 'Philosophy, horizon-seeking, and truth' },
  Capricorn: { element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', meaning: 'Enduring integrity, mastery, sacred boundary', focus: 'Architectural commitment, patience, and honoring time' },
  Aquarius: { element: 'Air', modality: 'Fixed', ruler: 'Uranus', meaning: 'Visionary perspective, community, liberation', focus: 'Insight, authentic originality, and the long future' },
  Pisces: { element: 'Water', modality: 'Mutable', ruler: 'Neptune', meaning: 'Compassion, oceanic feeling, mystical connection', focus: 'Surrender, dreams, poetry, and boundless empathy' }
};

export const LUNAR_MONTH_LORE: Record<string, { name: string; meaning: string; keywords: string[] }> = {
  Wolf: { name: 'Wolf Moon', meaning: 'Deep midwinter cold. The wolves howl together. Survival depends on community.', keywords: ['Community', 'Endurance', 'Loyalty', 'Silence'] },
  Snow: { name: 'Snow Moon', meaning: 'Heavy snowfall blankets the earth. Deep interior patience and quiet reflection.', keywords: ['Patience', 'Stillness', 'Sanctuary', 'Waiting'] },
  Worm: { name: 'Worm Moon', meaning: 'The ground begins to thaw. Microscopic life stirs in the dark soil before spring.', keywords: ['Awakening', 'Thaw', 'Emergence', 'Renewal'] },
  Pink: { name: 'Pink Moon', meaning: 'Wild moss phlox blooms across meadows. Color returns after long dormancy.', keywords: ['Color', 'Blossoming', 'Beauty', 'Vitality'] },
  Flower: { name: 'Flower Moon', meaning: 'Abundant blossoms and fertile warmth. The peak of natural creativity and scent.', keywords: ['Abundance', 'Fertility', 'Creativity', 'Celebration'] },
  Strawberry: { name: 'Strawberry Moon', meaning: 'First sweet wild berries ripen for the gathering. Reward for gentle patience.', keywords: ['Sweetness', 'Harvest', 'Reward', 'Delight'] },
  Buck: { name: 'Buck Moon', meaning: 'Young deer grow new velvet antlers. Rapid growth, nobility, and testing strength.', keywords: ['Regeneration', 'Strength', 'Growth', 'Sovereignty'] },
  Sturgeon: { name: 'Sturgeon Moon', meaning: 'Ancient fish swim the deep waters. Reaching into old depths and enduring wisdom.', keywords: ['Ancient Memory', 'Depth', 'Resilience', 'Ancestry'] },
  Harvest: { name: 'Harvest Moon', meaning: 'Bright golden light that lingers at dusk. Bringing in the primary harvest of the year.', keywords: ['Fulfillment', 'Abundance', 'Gratitude', 'Completion'] },
  "Hunter's": { name: "Hunter's Moon", meaning: 'Leaves fall and fields are clear. Gathering winter stores and focusing vision.', keywords: ['Focus', 'Preparation', 'Discernment', 'Sanctuary'] },
  Beaver: { name: 'Beaver Moon', meaning: 'Beavers prepare lodges for ice and cold. Building strong shelters and boundaries.', keywords: ['Shelter', 'Foundation', 'Readiness', 'Security'] },
  Cold: { name: 'Cold Moon', meaning: 'The longest nights of the year. The sun reaches its lowest point before turning.', keywords: ['Solstice', 'Turning', 'Deep Rest', 'Mystery'] }
};

export interface SolarSeason {
  name: string;
  dayOfYear: number;
  seasonProgress: number; // 0 to 1
  daysToNextSolsticeOrEquinox: number;
  nextEventName: string;
  description: string;
  guidance: string;
}

export function getSolarSeason(date: Date = new Date()): SolarSeason {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / 86400000) + 1;

  // Northern hemisphere calendar approximations
  if (dayOfYear >= 80 && dayOfYear < 172) {
    const total = 172 - 80;
    const elapsed = dayOfYear - 80;
    return {
      name: 'Spring',
      dayOfYear,
      seasonProgress: elapsed / total,
      daysToNextSolsticeOrEquinox: 172 - dayOfYear,
      nextEventName: 'Summer Solstice',
      description: 'The world stirs. Sap rises. Creative force returns to the surface.',
      guidance: 'Plant and water. What you start in spring has natural momentum behind it.'
    };
  } else if (dayOfYear >= 172 && dayOfYear < 266) {
    const total = 266 - 172;
    const elapsed = dayOfYear - 172;
    return {
      name: 'Summer',
      dayOfYear,
      seasonProgress: elapsed / total,
      daysToNextSolsticeOrEquinox: 266 - dayOfYear,
      nextEventName: 'Autumn Equinox',
      description: 'Full heat, full light, outward action. The peak of the outward arc.',
      guidance: 'Act with warmth. Bring ideas into the full light of day.'
    };
  } else if (dayOfYear >= 266 && dayOfYear < 355) {
    const total = 355 - 266;
    const elapsed = dayOfYear - 266;
    return {
      name: 'Autumn',
      dayOfYear,
      seasonProgress: elapsed / total,
      daysToNextSolsticeOrEquinox: 355 - dayOfYear,
      nextEventName: 'Winter Solstice',
      description: 'Light retreats. The harvest is gathered. What was built is sorted.',
      guidance: 'Harvest and clarify. Notice what was gained and what is ready to be released.'
    };
  } else {
    // Winter
    let elapsed = 0;
    let total = 89;
    if (dayOfYear >= 355) {
      elapsed = dayOfYear - 355;
    } else {
      elapsed = (365 - 355) + dayOfYear;
    }
    const daysToSpring = dayOfYear < 80 ? (80 - dayOfYear) : (365 - dayOfYear + 80);
    return {
      name: 'Winter',
      dayOfYear,
      seasonProgress: Math.min(1, elapsed / total),
      daysToNextSolsticeOrEquinox: daysToSpring,
      nextEventName: 'Spring Equinox',
      description: 'The land rests. Energy draws inward. Internal tending shapes the next year.',
      guidance: 'Rest without apology. The roots grow strongest in the quiet cold.'
    };
  }
}

export function getWeaveSynthesis(phaseId: string, date: Date = new Date()): string {
  const season = getSolarSeason(date);
  const phase = PHASE_WISDOM[phaseId] || PHASE_WISDOM.new;

  const pairKey = `${phaseId}-${season.name.toLowerCase()}`;
  const weaves: Record<string, string> = {
    'first-quarter-autumn': 'A decision in the season of harvest. What you commit to now determines what you store for winter.',
    'first-quarter-winter': 'Clarity in the cold quiet. A decision that asks for internal conviction, not external praise.',
    'first-quarter-spring': 'A decisive turn as the green rises. Committing outward to what you planted in the dark.',
    'first-quarter-summer': 'Bold action under open skies. The momentum is here — choose your path with courage.',
    'full-autumn': 'The full harvest illuminated. Look with clear eyes at what this year has yielded.',
    'new-autumn': 'A quiet seed planted in the turning leaves. Rest before the gathering begins.',
    'last-quarter-autumn': 'A deep letting go as the trees release their foliage. Free yourself from what is done.'
  };

  return weaves[pairKey] || `${phase.title} in ${season.name}. ${phase.energy} energy meeting the ${season.description.toLowerCase()}`;
}
