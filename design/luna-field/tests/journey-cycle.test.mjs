import './idb-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

import { createLiveLunaServices } from '../src/live-services.ts';
import {
  createJourneyService,
  journeyEcho,
  getCurrentLunation,
  getLunationForDate,
  getCycleInfoForLunation
} from '../src/journey-service.ts';
import { Journey, ordered } from '../../echo-journey/journey.mjs';

const AUTH = 'sb-eyxvsbqyzeodsjajfqsj-auth-token';
const ECHOES = 'cosmic_echoes_v1';
const login = (id) => mockStorage.set(AUTH, JSON.stringify({ access_token: 'fixture-' + id, user: { id } }));

function setupService() {
  mockStorage.clear();
  globalThis.fetch = async () => Response.json([]);
  return createLiveLunaServices();
}

const mockVoiceEcho = (id, dateStr, extra = {}) => ({
  id,
  title: 'Spoken ' + id,
  source: 'voice',
  kind: 'voice',
  created_at: dateStr,
  occurredAt: dateStr,
  user_id: 'user-a',
  provenance: 'local-session',
  duration: 30,
  ...extra
});

class MockMedia extends EventTarget {
  currentTime = 0;
  duration = 30;
  readyState = 1;
  paused = true;
  plays = 0;
  async play() {
    this.plays++;
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  load() {}
  removeAttribute() {}
  event(type) {
    this.dispatchEvent(new Event(type));
  }
}

test('astronomical cycle boundaries & lunation calculation across years', () => {
  const currentLun = getCurrentLunation();
  assert.ok(Number.isInteger(currentLun) && currentLun > 300);

  // Oct 2026: Hunter's Moon (lunation 331)
  const hunters = getCycleInfoForLunation(331);
  assert.equal(hunters.id, 'lunation-331');
  assert.equal(hunters.name, "Hunter's Moon");
  assert.equal(hunters.year, 2026);
  assert.match(hunters.range, /Oct/);

  // Sep 2026: Harvest Moon (lunation 330)
  const harvest2026 = getCycleInfoForLunation(330);
  assert.equal(harvest2026.id, 'lunation-330');
  assert.equal(harvest2026.name, 'Harvest Moon');
  assert.equal(harvest2026.year, 2026);

  // 2025 cycles possess distinct stable identifiers
  const date2025 = new Date('2025-09-10T12:00:00Z');
  const lun2025 = getLunationForDate(date2025);
  const harvest2025 = getCycleInfoForLunation(lun2025);
  assert.notEqual(harvest2025.id, harvest2026.id, 'Same named moon in 2025 must have distinct lunation ID');
  assert.equal(harvest2025.year, 2025);
});

test('default selection of current lunar cycle with 0 recordings', () => {
  const services = setupService();
  login('user-a');
  // User has no recordings in current cycle, only older ones
  const pastEchoes = [
    mockVoiceEcho('past-1', '2026-08-15T12:00:00Z'), // Sturgeon Moon (lunation 329)
    mockVoiceEcho('past-2', '2026-09-15T12:00:00Z')  // Harvest Moon (lunation 330)
  ];
  mockStorage.set(ECHOES, JSON.stringify(pastEchoes));

  const journeyService = createJourneyService(services);
  const currentLun = getCurrentLunation();
  const currentCycleId = journeyService.currentCycleId();
  assert.equal(currentCycleId, `lunation-${currentLun}`);

  const cycles = journeyService.getCycles();
  assert.ok(cycles.length >= 3, 'Must discover historical cycles plus current cycle');

  const currentCycleObj = cycles.find(c => c.id === currentCycleId);
  assert.ok(currentCycleObj, 'Current cycle must always be in cycles list');
  assert.equal(currentCycleObj.isCurrent, true);
  assert.equal(currentCycleObj.count, 0, 'Current cycle with no recordings reports count: 0');

  // Querying items for current cycle returns empty array
  const currentItems = journeyService.items(currentCycleId);
  assert.equal(currentItems.length, 0);

  // Querying past cycle returns only that cycle's echoes
  const harvestItems = journeyService.items('lunation-330');
  assert.equal(harvestItems.length, 1);
  assert.equal(harvestItems[0].id, 'past-2');
});

test('cycle switching replaces echoes and bounds playback queue', async () => {
  const services = setupService();
  login('user-a');
  const echoes = [
    mockVoiceEcho('h-1', '2026-10-15T10:00:00Z'), // Hunter's
    mockVoiceEcho('h-2', '2026-10-16T11:00:00Z'), // Hunter's
    mockVoiceEcho('sep-1', '2026-09-15T12:00:00Z'), // Harvest
    mockVoiceEcho('sep-2', '2026-09-16T14:00:00Z')  // Harvest
  ];
  mockStorage.set(ECHOES, JSON.stringify(echoes));
  const journeyService = createJourneyService(services);

  // 1. Load Hunter's Moon (lunation 331)
  const huntersEchoes = journeyService.items('lunation-331');
  assert.equal(huntersEchoes.length, 2);
  assert.deepEqual(huntersEchoes.map(e => e.id), ['h-1', 'h-2']);

  const ready = async () => ({ status: 'ready', url: 'test.mp3' });
  const mediaList = [];
  const j = new Journey(huntersEchoes, ready, () => {
    const m = new MockMedia();
    mediaList.push(m);
    return m;
  });

  assert.equal(j.queue.length, 2);
  assert.equal(j.queue[0].id, 'h-1');

  // 2. Continuous playback within Hunter's Moon
  await j.select('h-1', true);
  assert.equal(j.id, 'h-1');
  assert.equal(j.status, 'playing');

  // Echo 1 ends -> advances to Echo 2
  mediaList[0].event('ended');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(j.id, 'h-2');
  assert.equal(j.status, 'playing');

  // Echo 2 ends -> reaches end of queue, STOPS cleanly without playing September echoes!
  mediaList[1].event('ended');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(j.status, 'complete');
  assert.match(j.message, /end of this listening journey/i);

  // 3. Switch cycle to Harvest Moon (lunation 330)
  const harvestEchoes = journeyService.items('lunation-330');
  assert.equal(harvestEchoes.length, 2);
  assert.deepEqual(harvestEchoes.map(e => e.id), ['sep-1', 'sep-2']);

  j.setItems(harvestEchoes);
  assert.equal(j.queue.length, 2);
  assert.equal(j.queue[0].id, 'sep-1');
  assert.equal(j.queue[1].id, 'sep-2');
});

test('hierarchical phase and day filtering operates strictly within selected cycle', () => {
  const services = setupService();
  login('user-a');
  const echoes = [
    mockVoiceEcho('h-new-1', '2026-10-11T12:00:00Z', { phase: 'new', phase_name: 'New Moon' }),
    mockVoiceEcho('h-new-2', '2026-10-12T14:00:00Z', { phase: 'new', phase_name: 'New Moon' }),
    mockVoiceEcho('h-full-1', '2026-10-26T18:00:00Z', { phase: 'full', phase_name: 'Full Moon' }),
    mockVoiceEcho('sep-new-1', '2026-09-11T12:00:00Z', { phase: 'new', phase_name: 'New Moon' }) // different cycle!
  ];
  mockStorage.set(ECHOES, JSON.stringify(echoes));
  const journeyService = createJourneyService(services);

  const huntersCycleId = 'lunation-331';
  const cycleEchoes = journeyService.items(huntersCycleId);
  assert.equal(cycleEchoes.length, 3);

  // Filter within cycle by phase: 'new'
  const newPhaseEchoes = cycleEchoes.filter(e => e.context.phaseId === 'new');
  assert.equal(newPhaseEchoes.length, 2);
  assert.deepEqual(newPhaseEchoes.map(e => e.id), ['h-new-1', 'h-new-2']);
  assert.ok(!newPhaseEchoes.some(e => e.id === 'sep-new-1'), 'Must not include September new moon');

  // Filter within cycle by calendar day: Oct 11, 2026
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  const dayEchoes = cycleEchoes.filter(e => dayFmt.format(new Date(e.occurredAt)) === 'October 11, 2026');
  assert.equal(dayEchoes.length, 1);
  assert.equal(dayEchoes[0].id, 'h-new-1');
});

test('reverse playback order within selected cycle', async () => {
  const ready = async () => ({ status: 'ready', url: 'test.mp3' });
  const mediaList = [];
  const items = [
    mockVoiceEcho('e-1', '2026-10-12T10:00:00Z'),
    mockVoiceEcho('e-2', '2026-10-15T10:00:00Z')
  ].map(journeyEcho);

  const j = new Journey(items, ready, () => {
    const m = new MockMedia();
    mediaList.push(m);
    return m;
  });

  j.setOrder('newest');
  assert.equal(j.order, 'newest');
  assert.deepEqual(j.queue.map(e => e.id), ['e-2', 'e-1']);

  await j.select('e-2', true);
  mediaList[0].event('ended');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(j.id, 'e-1');
});

test('restoring bookmarks across cycle boundaries preserves cycle association', () => {
  const services = setupService();
  login('user-a');
  const journeyService = createJourneyService(services);

  const savedPlace = {
    echoId: 'sep-1',
    seconds: 14.5,
    order: 'oldest',
    cycleId: 'lunation-330'
  };

  assert.equal(journeyService.savePlace(savedPlace), true);
  const loaded = journeyService.loadPlace();
  assert.equal(loaded.echoId, 'sep-1');
  assert.equal(loaded.seconds, 14.5);
  assert.equal(loaded.cycleId, 'lunation-330');
});
