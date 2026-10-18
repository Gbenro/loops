import voiceOne from './assets/sample-voice.wav';
import voiceTwo from './assets/sample-return.wav';
import voiceThree from './assets/sample-morning.wav';
import samples from './assets/audio-peaks.json';

// Original invented content for this study. No personal records or API clients.
// Dates/phase assignments are fixed design fixtures, not live lunar calculations.
export const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
export const CYCLES = [
  { id: 'hunter', name: "Hunter’s", month: 'October 2026', range: '10 Oct — 8 Nov', world: 'ridge', description: 'A quiet ridge, open to the changing light.' },
  { id: 'harvest', name: 'Harvest', month: 'September 2026', range: '11 Sep — 9 Oct', world: 'coast', description: 'A low coastline, held by a wide horizon.' },
  { id: 'sturgeon', name: 'Sturgeon', month: 'August 2026', range: '12 Aug — 10 Sep', world: 'ridge', description: 'The same ridge, encountered in another cycle.' },
];
export const DEMO_TEXT = 'I stepped outside just as the light was changing. For a moment, there was nothing I needed to finish. Just the sound of the wind, and the space between things. I wanted to keep a little of that with me.';
export const INITIAL_ECHOES = [
  { id: 'space', label: 'The space between things', text: DEMO_TEXT, source: 'voice', audio: voiceOne, ...samples.one, date: '17 October 2026', shortDate: '17 Oct', time: '6:42 pm', cycle: 'hunter', phase: 2, day: 7, tags: ['evening', 'a pause'], connected: ['walk', 'window'], reflection: 'I hear how slowly I was speaking. I had more room than I remembered.', reflectionDate: '18 October · added on returning' },
  { id: 'window', label: 'Leave a little room', text: 'I left the afternoon unplanned. Nothing remarkable happened. I think that was the part I wanted to remember.', source: 'text', date: '16 October 2026', shortDate: '16 Oct', time: '3:18 pm', cycle: 'hunter', phase: 1, day: 6, tags: ['space'], connected: ['space'], loop: 'Make room for unplanned mornings' },
  { id: 'morning', label: 'Before the day begins', text: 'The house was quiet this morning. I sat by the window with my tea, before opening anything on my phone. The light moved across the table. I stayed until the tea had cooled.', source: 'voice', audio: voiceThree, ...samples.three, date: '14 October 2026', shortDate: '14 Oct', time: '7:06 am', cycle: 'hunter', phase: 1, day: 4, tags: ['morning'], connected: ['walk'], loop: 'Make room for unplanned mornings' },
  { id: 'beginning', label: 'Something to come back to', text: 'A note for this cycle: make a little space to listen to what I am actually saying, before deciding what to do with it.', source: 'text', date: '10 October 2026', shortDate: '10 Oct', time: '9:12 am', cycle: 'hunter', phase: 0, day: 1, tags: ['intention'], connected: [] },
  { id: 'walk', label: 'The longer way home', text: 'I took the longer way home today. I had walked this road many times, but I had never noticed how the trees lean toward the water. I wonder what else is here when I stop rushing.', source: 'voice', audio: voiceTwo, ...samples.two, date: '19 September 2026', shortDate: '19 Sep', time: '5:34 pm', cycle: 'harvest', phase: 2, day: 8, tags: ['walking', 'noticing'], connected: ['space', 'morning'] },
  { id: 'table', label: 'An open table', text: 'The table is clear again. I do not have a plan for what will go here next. For now, I like being able to see the wood.', source: 'text', date: '15 September 2026', shortDate: '15 Sep', time: '10:22 am', cycle: 'harvest', phase: 1, day: 4, tags: ['home'], connected: [] },
  { id: 'question', label: 'A question I am keeping', text: 'What happens when I let an unfinished thought stay unfinished for a while?', source: 'text', date: '20 August 2026', shortDate: '20 Aug', time: '8:10 pm', cycle: 'sturgeon', phase: 2, day: 9, tags: ['question'], connected: ['space'] },
];
export const cycleFor = id => CYCLES.find(cycle => cycle.id === id) || CYCLES[0];
export const secondsLabel = seconds => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, '0')}`;

export function createPreviewEcho({ text, source, cycle, phase }) {
  const sample = INITIAL_ECHOES[0];
  return {
    ...(source === 'voice' ? { audio: sample.audio, duration: sample.duration, peaks: sample.peaks } : {}),
    id: `preview-${Date.now()}`, label: source === 'voice' ? 'A new sample Echo' : text.trim().slice(0, 55),
    text: source === 'voice' ? DEMO_TEXT : text.trim(), source,
    date: '17 October 2026', shortDate: '17 Oct', time: 'Just added in this preview',
    cycle, phase, day: 7, tags: [], connected: [], isPreviewAddition: true,
  };
}
