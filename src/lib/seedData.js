// Luna Loops - Seed Data Generator for Testing
// Creates realistic dummy data across all app features

import { getMoonAge, getPhaseInfo, getLunarMonthName, getMoonZodiac, getIllumination } from './lunar.js';

const SYNODIC = 29.53058867;

// Phase keys in order
const PHASE_KEYS = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'
];

// Phase names map
const PHASE_NAMES = {
  'new': 'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous',
  'full': 'Full Moon',
  'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

// Sample loop titles by type
const LOOP_TITLES = {
  cycle: [
    'Deep self-care reset',
    'Creative writing project',
    'Home organization',
    'Learning guitar basics',
    'Morning routine overhaul',
    'Digital detox month',
  ],
  phase: [
    'Finish book chapter',
    'Clean out closet',
    'Plan birthday party',
    'Update resume',
    'Plant spring garden',
    'Weekly meal prep',
  ],
};

// Sample subtasks
const SUBTASKS = [
  'Research and brainstorm',
  'Draft initial plan',
  'Gather materials',
  'First iteration',
  'Review and refine',
  'Final touches',
  'Celebrate completion',
];

// Sample echo texts by phase energy
const ECHO_TEXTS = {
  'new': [
    'Setting intentions for this cycle. Feeling hopeful about what might emerge.',
    'Planting seeds of change today. The darkness feels generative.',
    'Starting fresh. Sometimes the void is exactly what I need.',
  ],
  'waxing-crescent': [
    'First steps taken. Small progress, but it counts.',
    'Building momentum slowly. Trusting the process.',
    'The initial resistance is fading. Movement feels good.',
  ],
  'first-quarter': [
    'Decision point reached. Choosing to commit fully.',
    'Obstacles appearing, but so is my resolve.',
    'Half-lit moon, half-formed plans. Time to decide.',
  ],
  'waxing-gibbous': [
    'Refining the details now. Almost there.',
    'The vision is clearer. Polishing what I have.',
    'Patience with the process. Growth takes time.',
  ],
  'full': [
    'Everything illuminated. I can see what I built.',
    'Full expression of this cycle energy.',
    'Celebrating what has come to fruition.',
  ],
  'waning-gibbous': [
    'Time to share what I have learned.',
    'Gratitude for this cycle journey.',
    'Integrating the lessons of fullness.',
  ],
  'last-quarter': [
    'Letting go of what no longer serves.',
    'Release feels lighter than I expected.',
    'Clearing space for what comes next.',
  ],
  'waning-crescent': [
    'Resting in the dark moon time.',
    'Surrender and stillness before renewal.',
    'The quiet before the next beginning.',
  ],
};

// Sample rhythm names
const RHYTHM_NAMES = [
  'Morning meditation',
  'Evening journaling',
  'Movement practice',
  'Creative time',
  'Nature connection',
  'Reading ritual',
  'Gratitude practice',
  'Breathwork',
];

// Engagement levels
const ENGAGEMENT_LEVELS = ['none', 'light', 'moderate', 'deep', 'ceremonial'];

// Tag options
const TAGS = ['personal', 'work', 'creative', 'health', 'relationships', 'growth', 'rest'];

// Generate a unique ID
function generateId(prefix = 'seed') {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
}

// Get lunar data for a specific date
function getLunarDataForDate(date) {
  const age = getMoonAge(date);
  const phase = getPhaseInfo(age);
  const lunarMonth = getLunarMonthName(date);
  const zodiac = getMoonZodiac(date);
  const illumination = getIllumination(date);
  const cycleStart = new Date(date.getTime() - age * 24 * 60 * 60 * 1000);

  return {
    age,
    dayOfCycle: Math.floor(age) + 1,
    phase,
    lunarMonth,
    zodiac,
    illumination,
    cycleStart: cycleStart.toISOString(),
  };
}

// Random element from array
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random number in range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate loops across multiple cycles
function generateLoops(cycleCount = 3) {
  const loops = [];
  const now = new Date();

  for (let c = 0; c < cycleCount; c++) {
    // Go back c cycles
    const cycleOffset = c * SYNODIC;
    const cycleDate = new Date(now.getTime() - cycleOffset * 24 * 60 * 60 * 1000);
    const lunar = getLunarDataForDate(cycleDate);

    // Create 1-2 cycle loops per cycle
    if (c > 0 || Math.random() > 0.3) {
      const cycleLoop = {
        id: generateId('l'),
        title: randomFrom(LOOP_TITLES.cycle),
        type: 'cycle',
        status: c === 0 ? (Math.random() > 0.5 ? 'active' : 'closed') : randomFrom(['closed', 'released']),
        color: randomFrom(['#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24']),
        subtasks: SUBTASKS.slice(0, randomInt(3, 6)).map((text, i) => ({
          id: generateId('st'),
          text,
          done: c > 0 || i < 2,
        })),
        linkedTo: null,
        phaseOpened: 'new',
        phaseName: 'New Moon',
        lunarMonthOpened: lunar.lunarMonth,
        moonAgeOpened: 0.5,
        zodiacOpened: lunar.zodiac.sign,
        windowEnd: null,
        openedAt: new Date(cycleDate.getTime() - lunar.age * 24 * 60 * 60 * 1000).toISOString(),
        closedAt: c > 0 ? new Date(cycleDate.getTime() + (SYNODIC - lunar.age - 2) * 24 * 60 * 60 * 1000).toISOString() : null,
        releasedAt: null,
        phaseClosed: c > 0 ? 'waning-crescent' : null,
        phaseNameClosed: c > 0 ? 'Waning Crescent' : null,
        lunarMonthClosed: c > 0 ? lunar.lunarMonth : null,
        note: c === 0 ? null : 'Completed this cycle intention with awareness.',
        isEncrypted: false,
        tags: [randomFrom(TAGS), randomFrom(TAGS)].filter((v, i, a) => a.indexOf(v) === i),
        focus: null,
        createdAt: new Date(cycleDate.getTime() - lunar.age * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      loops.push(cycleLoop);
    }

    // Create 2-4 phase loops per cycle
    const phaseLoopCount = randomInt(2, 4);
    for (let p = 0; p < phaseLoopCount; p++) {
      const phaseIdx = randomInt(0, 7);
      const phaseKey = PHASE_KEYS[phaseIdx];
      const phaseName = PHASE_NAMES[phaseKey];
      const phaseOffset = phaseIdx * 3.69; // Approx days per phase
      const phaseDate = new Date(cycleDate.getTime() - (lunar.age - phaseOffset) * 24 * 60 * 60 * 1000);
      const phaseLunar = getLunarDataForDate(phaseDate);

      const isClosed = c > 0 || (p < phaseLoopCount - 1);
      const phaseLoop = {
        id: generateId('l'),
        title: randomFrom(LOOP_TITLES.phase),
        type: 'phase',
        status: isClosed ? randomFrom(['closed', 'released']) : 'active',
        color: randomFrom(['#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#F87171']),
        subtasks: SUBTASKS.slice(0, randomInt(2, 4)).map((text, i) => ({
          id: generateId('st'),
          text,
          done: isClosed || i === 0,
        })),
        linkedTo: null,
        phaseOpened: phaseKey,
        phaseName: phaseName,
        lunarMonthOpened: phaseLunar.lunarMonth,
        moonAgeOpened: phaseOffset + 1,
        zodiacOpened: phaseLunar.zodiac.sign,
        windowEnd: new Date(phaseDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        openedAt: phaseDate.toISOString(),
        closedAt: isClosed ? new Date(phaseDate.getTime() + randomInt(2, 5) * 24 * 60 * 60 * 1000).toISOString() : null,
        releasedAt: null,
        phaseClosed: isClosed ? phaseKey : null,
        phaseNameClosed: isClosed ? phaseName : null,
        lunarMonthClosed: isClosed ? phaseLunar.lunarMonth : null,
        note: isClosed ? 'Phase work complete.' : null,
        isEncrypted: false,
        tags: [randomFrom(TAGS)],
        focus: null,
        createdAt: phaseDate.toISOString(),
        updatedAt: new Date().toISOString(),
      };
      loops.push(phaseLoop);
    }
  }

  return loops;
}

// Generate echoes across multiple cycles
function generateEchoes(cycleCount = 3) {
  const echoes = [];
  const now = new Date();

  for (let c = 0; c < cycleCount; c++) {
    const cycleOffset = c * SYNODIC;

    // Create 8-15 echoes per cycle (spread across phases)
    const echoCount = randomInt(8, 15);
    for (let e = 0; e < echoCount; e++) {
      const dayOffset = cycleOffset + randomInt(0, 28);
      const echoDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const lunar = getLunarDataForDate(echoDate);

      const echo = {
        id: generateId('e'),
        text: randomFrom(ECHO_TEXTS[lunar.phase.key] || ECHO_TEXTS['new']),
        source: Math.random() > 0.8 ? 'voice' : 'text',
        phase: lunar.phase.key,
        phaseName: lunar.phase.name,
        phaseType: lunar.phase.phaseType,
        lunarMonth: lunar.lunarMonth,
        dayOfCycle: lunar.dayOfCycle,
        zodiac: lunar.zodiac.sign,
        illumination: lunar.illumination,
        isEncrypted: false,
        audio_path: null,
        tags: Math.random() > 0.6 ? [randomFrom(TAGS)] : [],
        linkedLoopId: null,
        createdAt: echoDate.toISOString(),
      };
      echoes.push(echo);
    }
  }

  return echoes;
}

// Generate rhythms with cycle instances and observations
function generateRhythms(cycleCount = 2) {
  const rhythms = [];
  const instances = [];
  const observations = [];
  const now = new Date();

  // Create 2-4 rhythms
  const rhythmCount = randomInt(2, 4);
  const usedNames = new Set();

  for (let r = 0; r < rhythmCount; r++) {
    let name;
    do {
      name = randomFrom(RHYTHM_NAMES);
    } while (usedNames.has(name));
    usedNames.add(name);

    const rhythm = {
      id: generateId('r'),
      name,
      scope: Math.random() > 0.3 ? 'ongoing' : 'this-cycle',
      active: true,
      createdAt: new Date(now.getTime() - cycleCount * SYNODIC * 24 * 60 * 60 * 1000).toISOString(),
    };
    rhythms.push(rhythm);

    // Create instances for each cycle
    for (let c = 0; c < cycleCount; c++) {
      const cycleOffset = c * SYNODIC;
      const cycleDate = new Date(now.getTime() - cycleOffset * 24 * 60 * 60 * 1000);
      const lunar = getLunarDataForDate(cycleDate);
      const cycleStartDate = new Date(cycleDate.getTime() - lunar.age * 24 * 60 * 60 * 1000);

      const instance = {
        id: generateId('ri'),
        rhythmId: rhythm.id,
        userId: null,
        cycleStart: cycleStartDate.toISOString(),
        intentionType: Math.random() > 0.5 ? 'whole' : 'phase',
        wholeIntention: null,
        phaseIntentions: {},
        reportGenerated: c > 0,
        createdAt: cycleStartDate.toISOString(),
      };

      if (instance.intentionType === 'whole') {
        instance.wholeIntention = randomFrom(ENGAGEMENT_LEVELS.slice(1));
      } else {
        // Set intentions for some phases
        PHASE_KEYS.forEach(phase => {
          if (Math.random() > 0.3) {
            instance.phaseIntentions[phase] = randomFrom(ENGAGEMENT_LEVELS.slice(1));
          }
        });
      }

      instances.push(instance);

      // Create observations for this instance (more for past cycles)
      const obsCount = c === 0 ? randomInt(2, 5) : randomInt(5, 8);
      const observedPhases = new Set();

      for (let o = 0; o < obsCount; o++) {
        let phase;
        do {
          phase = randomFrom(PHASE_KEYS);
        } while (observedPhases.has(phase) && observedPhases.size < 8);
        observedPhases.add(phase);

        const phaseIdx = PHASE_KEYS.indexOf(phase);
        const phaseOffset = phaseIdx * 3.69;
        const obsDate = new Date(cycleStartDate.getTime() + phaseOffset * 24 * 60 * 60 * 1000);
        const dateKey = obsDate.toISOString().slice(0, 10);

        const observation = {
          id: generateId('ro'),
          cycleInstanceId: instance.id,
          userId: null,
          phase,
          engagement: randomFrom(ENGAGEMENT_LEVELS),
          note: Math.random() > 0.6 ? randomFrom([
            'Felt present today.',
            'Challenging but worth it.',
            'Easier than expected.',
            'Rest day.',
            'Deep practice.',
          ]) : null,
          loggedAt: obsDate.toISOString(),
          dateKey,
          dayInPhase: randomInt(1, 3),
        };
        observations.push(observation);
      }
    }
  }

  return { rhythms, instances, observations };
}

// Main seed function - populates localStorage
export function seedAllData(options = {}) {
  const {
    cycleCount = 3,
    clearExisting = true,
  } = options;

  if (clearExisting) {
    // Clear existing data
    localStorage.removeItem('cosmic_loops_v1');
    localStorage.removeItem('cosmic_echoes_v1');
    localStorage.removeItem('cosmic_rhythms_v1');
    localStorage.removeItem('cosmic_rhythm_instances_v1');
    localStorage.removeItem('cosmic_rhythm_observations_v1');
    localStorage.removeItem('cosmic_phase_summaries_v1');
    localStorage.removeItem('cosmic_cycle_summaries_v1');
    // Clear onboarding to show fresh state
    localStorage.removeItem('onboardingCompleted');
    localStorage.removeItem('toursCompleted');
  }

  // Generate data
  const loops = generateLoops(cycleCount);
  const echoes = generateEchoes(cycleCount);
  const { rhythms, instances, observations } = generateRhythms(cycleCount);

  // Save to localStorage
  localStorage.setItem('cosmic_loops_v1', JSON.stringify(loops));
  localStorage.setItem('cosmic_echoes_v1', JSON.stringify(echoes));
  localStorage.setItem('cosmic_rhythms_v1', JSON.stringify(rhythms));
  localStorage.setItem('cosmic_rhythm_instances_v1', JSON.stringify(instances));
  localStorage.setItem('cosmic_rhythm_observations_v1', JSON.stringify(observations));

  console.log('[Seed] Generated test data:', {
    loops: loops.length,
    echoes: echoes.length,
    rhythms: rhythms.length,
    instances: instances.length,
    observations: observations.length,
  });

  return {
    loops,
    echoes,
    rhythms,
    instances,
    observations,
  };
}

// Seed specific data types
export function seedLoops(cycleCount = 3) {
  const loops = generateLoops(cycleCount);
  localStorage.setItem('cosmic_loops_v1', JSON.stringify(loops));
  console.log('[Seed] Generated', loops.length, 'loops');
  return loops;
}

export function seedEchoes(cycleCount = 3) {
  const echoes = generateEchoes(cycleCount);
  localStorage.setItem('cosmic_echoes_v1', JSON.stringify(echoes));
  console.log('[Seed] Generated', echoes.length, 'echoes');
  return echoes;
}

export function seedRhythms(cycleCount = 2) {
  const data = generateRhythms(cycleCount);
  localStorage.setItem('cosmic_rhythms_v1', JSON.stringify(data.rhythms));
  localStorage.setItem('cosmic_rhythm_instances_v1', JSON.stringify(data.instances));
  localStorage.setItem('cosmic_rhythm_observations_v1', JSON.stringify(data.observations));
  console.log('[Seed] Generated rhythms:', {
    rhythms: data.rhythms.length,
    instances: data.instances.length,
    observations: data.observations.length,
  });
  return data;
}

// Clear all app data
export function clearAllData() {
  const keys = [
    'cosmic_loops_v1',
    'cosmic_echoes_v1',
    'cosmic_rhythms_v1',
    'cosmic_rhythm_instances_v1',
    'cosmic_rhythm_observations_v1',
    'cosmic_phase_summaries_v1',
    'cosmic_cycle_summaries_v1',
  ];
  keys.forEach(key => localStorage.removeItem(key));
  console.log('[Seed] Cleared all app data');
}

// Export for browser console access
if (typeof window !== 'undefined') {
  window.seedData = {
    seedAll: seedAllData,
    seedLoops,
    seedEchoes,
    seedRhythms,
    clearAll: clearAllData,
  };
  console.log('[Seed] Available: window.seedData.seedAll(), .seedLoops(), .seedEchoes(), .seedRhythms(), .clearAll()');
}
