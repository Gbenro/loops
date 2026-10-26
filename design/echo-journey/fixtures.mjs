import { AUDIO_FIXTURES } from './audio-fixtures.mjs';
// This module is imported ONLY by the isolated preview. No live adapter exists here.
const record = (id, title, occurredAt, phaseId, phaseLabel, cycle, audio, unavailable = false) => ({
  id: `preview-${id}`, title, occurredAt, kind: 'voice', availability: unavailable ? 'unavailable' : 'available',
  context: { cycleId: `preview-2026-${cycle}`, cycleLabel: `${cycle === '09' ? 'September' : 'October'} cycle · illustrative`, phaseId, phaseLabel },
  audio, duration: AUDIO_FIXTURES[audio].duration, waveform: AUDIO_FIXTURES[audio].waveform,
});
export const fixtures = [
  record('1', 'A question worth keeping', '2026-09-05T09:10:00-05:00', 'waxing-crescent', 'Waxing Crescent', '09', 'question'),
  record('2', 'A little room between things', '2026-09-05T18:42:00-05:00', 'waxing-crescent', 'Waxing Crescent', '09', 'water'),
  record('3', 'An unavailable recording', '2026-09-09T08:00:00-05:00', 'first-quarter', 'First Quarter', '09', 'water', true),
  record('4', 'A question, encountered again', '2026-09-17T21:06:00-05:00', 'full', 'Full Moon', '09', 'question'),
  record('5', 'Returning to the water', '2026-10-05T18:42:00-05:00', 'waxing-crescent', 'Waxing Crescent', '10', 'water'),
  record('6', 'Leaving the question open', '2026-10-09T07:40:00-05:00', 'first-quarter', 'First Quarter', '10', 'question'),
];
export async function resolveFixture(id, signal) {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const echo = fixtures.find(e => e.id === id);
  if (!echo || echo.availability === 'unavailable') return { status: 'unavailable' };
  return { status: 'ready', url: `./assets/${echo.audio}.mp3` };
}
