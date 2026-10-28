import { Journey, ordered, groups } from './journey.mjs';
import { fixtures, resolveFixture } from './fixtures.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const stamp = date => new Date(date).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'long', day: 'numeric' });
const storageKey = 'luna.echo-journey.PREVIEW.place.v1';

// Cycles in fixtures
const cycles = [
  { id: 'preview-2026-10', label: "Hunter's Moon · 2026", name: "Hunter's Moon", range: 'Oct 11 – Nov 9, 2026', isCurrent: true },
  { id: 'preview-2026-09', label: 'Harvest Moon · 2026', name: 'Harvest Moon', range: 'Sep 10 – Oct 10, 2026', isCurrent: false }
];

let selectedCycleId = 'preview-2026-10'; // Default to current
let selectedPhase = '';
let selectedDay = '';
let groupBy = 'day';
let shownId = '';
let saved = null;
let skippedCount = 0;

try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Storage denied */ }

const journey = new Journey([], resolveFixture, () => new Audio(), update);
$('timezone').textContent = zone;

function getCurrentCycleObj() {
  return cycles.find(c => c.id === selectedCycleId) || cycles[0];
}

function getCycleEchoes() {
  return fixtures.filter(e => e.context.cycleId === selectedCycleId);
}

function getFilteredEchoes() {
  let list = getCycleEchoes();
  if (selectedPhase) {
    list = list.filter(e => e.context.phaseId === selectedPhase);
  }
  if (selectedDay) {
    list = list.filter(e => dayFmt.format(new Date(e.occurredAt)) === selectedDay);
  }
  return list;
}

function drawWave(values) {
  if (!values || values.length < 2) return '<line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>';
  const upper = values.map((v, i) => `${i * 600 / (values.length - 1)},${36 - v * 31}`).join(' ');
  const lower = [...values].reverse().map((v, i) => `${600 - i * 600 / (values.length - 1)},${36 + v * 31}`).join(' ');
  return `<defs><path id="envelope" d="M${upper} L${lower} Z"/><clipPath id="heard"><rect id="heard-width" width="0" height="72"/></clipPath></defs><use href="#envelope" fill="currentColor" opacity=".27"/><use href="#envelope" fill="currentColor" clip-path="url(#heard)"/><line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>`;
}

function renderCycleNav() {
  const cycle = getCurrentCycleObj();
  const currIdx = cycles.findIndex(c => c.id === selectedCycleId);
  const cycleEchoes = getCycleEchoes();

  $('cycle-select').innerHTML = cycles.map(c => {
    const cnt = fixtures.filter(e => e.context.cycleId === c.id).length;
    return `<option value="${esc(c.id)}" ${c.id === selectedCycleId ? 'selected' : ''}>${esc(c.label)}${c.isCurrent ? ' (Current)' : ''} · ${cnt} ${cnt === 1 ? 'recording' : 'recordings'}</option>`;
  }).join('');

  $('cycle-range-label').textContent = `${cycle.range}${cycle.isCurrent ? ' · Current lunar cycle' : ''}`;
  $('path-cycle-eyebrow').textContent = `${cycle.name.toUpperCase()} · 2026`;

  $('prev-cycle').disabled = currIdx >= cycles.length - 1;
  $('next-cycle').disabled = currIdx <= 0;
}

function updateFilterOptions() {
  const cycleEchoes = getCycleEchoes();
  const phaseCounts = new Map();
  for (const e of cycleEchoes) {
    const pid = e.context.phaseId;
    const plabel = e.context.phaseLabel;
    if (!phaseCounts.has(pid)) phaseCounts.set(pid, { label: plabel, count: 0 });
    phaseCounts.get(pid).count++;
  }

  $('phase-filter').innerHTML = `<option value="">All phases (${cycleEchoes.length})</option>` +
    [...phaseCounts.entries()].map(([pid, p]) => `<option value="${esc(pid)}">${esc(p.label)} (${p.count})</option>`).join('');
  $('phase-filter').value = selectedPhase;

  updateDayFilterOptions();
}

function updateDayFilterOptions() {
  const cycleEchoes = getCycleEchoes();
  const subset = selectedPhase ? cycleEchoes.filter(e => e.context.phaseId === selectedPhase) : cycleEchoes;
  const dayCounts = new Map();
  for (const e of subset) {
    const dayStr = dayFmt.format(new Date(e.occurredAt));
    dayCounts.set(dayStr, (dayCounts.get(dayStr) || 0) + 1);
  }

  $('day-filter').innerHTML = `<option value="">All days (${subset.length})</option>` +
    [...dayCounts.entries()].map(([dayStr, cnt]) => `<option value="${esc(dayStr)}">${esc(dayStr)} (${cnt})</option>`).join('');
  $('day-filter').value = selectedDay;
}

function renderPath() {
  const filtered = getFilteredEchoes();
  const cycle = getCurrentCycleObj();
  const cycleEchoes = getCycleEchoes();

  if (filtered.length === 0) {
    if (cycleEchoes.length === 0) {
      $('groups').innerHTML = `<div class="empty-cycle"><div class="empty-icon">◐</div><h3>No recordings in this cycle</h3><p>${esc(cycle.name)} spans ${esc(cycle.range)}. Step back to earlier cycles to listen to past moments.</p></div>`;
      $('available-count').textContent = '0 recordings in this cycle';
    } else {
      $('groups').innerHTML = `<div class="empty-cycle"><div class="empty-icon">◐</div><h3>No recordings match this filter</h3><p>Clear the filter to show all ${cycleEchoes.length} recordings in this cycle.</p></div>`;
      $('available-count').textContent = `0 of ${cycleEchoes.length} recordings in this cycle`;
    }
    document.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));
    return;
  }

  const sorted = ordered(filtered, journey.order);
  $('groups').innerHTML = groups(sorted, groupBy, zone).map(group => `<section class="group"><h3>${esc(group.label)}${group.context ? `<small>${esc(group.context)}</small>` : ''}</h3>${group.items.map(e => {
    const n = journey.queue.findIndex(item => item.id === e.id);
    return `<button class="echo" data-echo="${esc(e.id)}" ${e.availability === 'unavailable' || journey.skipped.has(e.id) ? 'disabled' : ''} aria-current="${e.id === journey.id}"><span class="echo-index">${n >= 0 ? String(n + 1).padStart(2, '0') : '—'}</span><span class="echo-body"><span class="echo-name">${esc(e.title)}</span><span class="echo-meta"><span>${esc(new Date(e.occurredAt).toLocaleTimeString('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }))}</span><span>·</span><span>${esc(groupBy === 'day' ? e.context.phaseLabel : new Date(e.occurredAt).toLocaleDateString('en-US', { timeZone: zone, month: 'short', day: 'numeric' }))}</span></span></span><span class="echo-length">${n < 0 ? 'Unavailable' : time(e.duration)}</span></button>`;
  }).join('')}</section>`).join('');

  document.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));

  if (filtered.length === cycleEchoes.length) {
    $('available-count').textContent = `${cycleEchoes.length} ${cycleEchoes.length === 1 ? 'recording' : 'recordings'} in this cycle`;
  } else {
    $('available-count').textContent = `${filtered.length} of ${cycleEchoes.length} recordings in this cycle`;
  }
}

function update() {
  const cycle = getCurrentCycleObj();
  const cycleEchoes = getCycleEchoes();
  const e = journey.current;

  if (!e) {
    if (cycleEchoes.length === 0) {
      $('voice-title').textContent = `No voice Echoes in ${cycle.name}`;
      $('player-status').textContent = `No recordings found for the ${cycle.name} cycle.`;
    } else {
      $('voice-title').textContent = 'No recordings in this selection';
      $('player-status').textContent = 'Adjust phase or day filter to continue listening.';
    }
    $('moment-date').textContent = cycle.range;
    $('context').textContent = `◐ ${cycle.name}`;
    $('wave').innerHTML = drawWave([]);
    $('queue-count').textContent = `0 of ${cycleEchoes.length} recordings`;
    $('queue-progress').value = 0;
    $('queue-progress').max = 1;
    $('up-next').textContent = cycleEchoes.length === 0 ? 'Choose another cycle to begin listening.' : 'Clear filters to play all recordings.';
    for (const id of ['play', 'previous', 'next', 'dock-play', 'dock-previous', 'dock-next', 'save', 'seek']) $(id).disabled = true;
    $('return').disabled = !saved || !fixtures.some(f => f.id === saved.echoId && f.availability !== 'unavailable');
    return;
  }

  for (const id of ['play', 'save', 'seek', 'dock-play']) $(id).disabled = false;
  if (skippedCount !== journey.skipped.size) {
    skippedCount = journey.skipped.size;
    renderPath();
  }

  if (shownId !== e.id) {
    shownId = e.id;
    $('voice-title').textContent = e.title;
    $('moment-date').textContent = stamp(e.occurredAt);
    $('context').textContent = `◐ ${e.context.phaseLabel} · ${cycle.name} ↗`;
    $('wave').innerHTML = drawWave(e.waveform);
  }

  const duration = journey.duration || e.duration;
  $('seek').max = duration;
  $('seek').value = journey.time;
  $('seek').setAttribute('aria-valuetext', `${time(journey.time)} of ${time(duration)}`);
  $('elapsed').textContent = time(journey.time);
  $('duration').textContent = time(duration);
  $('heard-width')?.setAttribute('width', String(600 * Math.min(1, journey.time / duration)));
  $('play-glyph').textContent = journey.desired ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', journey.desired ? 'Pause recording' : 'Play recording');
  $('dock-title').textContent = e.title;
  $('dock-play').textContent = journey.desired ? 'Ⅱ' : '▶';
  $('dock-play').setAttribute('aria-label', journey.desired ? 'Pause journey' : 'Play journey');

  const index = journey.queue.findIndex(item => item.id === e.id);
  const status = journey.message || ({
    idle: 'Ready when you are',
    loading: 'Finding the recording…',
    playing: 'Listening · continues automatically',
    paused: 'Paused · your place is held',
    buffering: 'Waiting for audio…',
    complete: 'Journey complete',
    unavailable: 'Recording unavailable'
  }[journey.status] || 'Ready');

  if ($('player-status').textContent !== status) $('player-status').textContent = status;
  $('previous').disabled = index <= 0;
  $('next').disabled = index >= journey.queue.length - 1;
  $('dock-previous').disabled = $('previous').disabled;
  $('dock-next').disabled = $('next').disabled;
  $('queue-count').textContent = `${Math.max(0, index + 1)} of ${journey.queue.length} in this cycle`;
  $('queue-progress').max = journey.queue.length;
  $('queue-progress').value = journey.status === 'complete' ? journey.queue.length : Math.max(0, index) + Math.min(1, journey.time / duration);
  $('queue-progress').setAttribute('aria-valuetext', `Recording ${index + 1} of ${journey.queue.length}`);
  $('up-next').textContent = journey.queue[index + 1] ? `Next · ${journey.queue[index + 1].title}` : 'The last moment in this cycle.';
  document.querySelectorAll('[data-echo]').forEach(b => b.setAttribute('aria-current', String(b.dataset.echo === e.id)));
  $('return').disabled = !saved || !fixtures.some(f => f.id === saved.echoId && f.availability !== 'unavailable');
  $('order').value = journey.order;
}

function applyFilter() {
  const filtered = getFilteredEchoes();
  journey.setItems(filtered);
  renderCycleNav();
  renderPath();
  update();
}

function selectCycle(cycleId) {
  if (cycleId === selectedCycleId && getCycleEchoes().length > 0) return;
  selectedCycleId = cycleId;
  selectedPhase = '';
  selectedDay = '';
  updateFilterOptions();
  applyFilter();
}

$('play').addEventListener('click', () => void journey.toggle());
$('previous').addEventListener('click', () => void journey.step(-1));
$('next').addEventListener('click', () => void journey.step(1));
$('dock-play').addEventListener('click', () => void journey.toggle());
$('dock-previous').addEventListener('click', () => void journey.step(-1));
$('dock-next').addEventListener('click', () => void journey.step(1));
$('dock-return').addEventListener('click', () => { document.querySelector('.listening').scrollIntoView({ block: 'start' }); $('play').focus({ preventScroll: true }); });

new IntersectionObserver(([entry]) => { $('mobile-dock').hidden = entry.isIntersecting; }, { threshold: 0 }).observe(document.querySelector('.listening'));

$('seek').addEventListener('input', e => journey.seek(Number(e.target.value)));
$('order').addEventListener('change', e => {
  journey.setOrder(e.target.value);
  renderPath();
});

document.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
  groupBy = b.dataset.group;
  renderPath();
}));

$('groups').addEventListener('click', e => {
  const b = e.target.closest('[data-echo]');
  if (b && !b.disabled) void journey.select(b.dataset.echo, true);
});

$('cycle-select').addEventListener('change', e => {
  selectCycle(e.target.value);
});

$('prev-cycle').addEventListener('click', () => {
  const currIdx = cycles.findIndex(c => c.id === selectedCycleId);
  if (currIdx < cycles.length - 1) {
    selectCycle(cycles[currIdx + 1].id);
  }
});

$('next-cycle').addEventListener('click', () => {
  const currIdx = cycles.findIndex(c => c.id === selectedCycleId);
  if (currIdx > 0) {
    selectCycle(cycles[currIdx - 1].id);
  }
});

$('phase-filter').addEventListener('change', e => {
  selectedPhase = e.target.value;
  updateDayFilterOptions();
  applyFilter();
});

$('day-filter').addEventListener('change', e => {
  selectedDay = e.target.value;
  applyFilter();
});

$('context').addEventListener('click', () => {
  if (!journey.current) return;
  selectedPhase = journey.current.context.phaseId;
  $('phase-filter').value = selectedPhase;
  updateDayFilterOptions();
  applyFilter();
  const active = document.querySelector('[data-echo][aria-current=true]');
  active?.scrollIntoView({ block: 'center' });
  active?.focus({ preventScroll: true });
});

$('save').addEventListener('click', () => {
  saved = { ...journey.place(), cycleId: selectedCycleId };
  let persisted = false;
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); persisted = true; } catch { /* In-memory */ }
  $('save-note').textContent = `Place kept at ${time(saved.seconds)} · ${persisted ? 'saved in this preview browser' : 'held for this tab only'}.`;
  update();
});

$('return').addEventListener('click', async () => {
  if (!saved) return;
  const target = fixtures.find(e => e.id === saved.echoId);
  if (target && target.context.cycleId !== selectedCycleId) {
    selectCycle(target.context.cycleId);
  }
  await journey.restore(saved);
  renderPath();
  $('save-note').textContent = 'Returned to your kept place. Press play when ready.';
});

$('clear').addEventListener('click', () => {
  saved = null;
  try { localStorage.removeItem(storageKey); } catch {}
  $('save-note').textContent = 'Saved preview place cleared.';
  update();
});

$('theme').addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  $('theme').setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
});

window.addEventListener('pagehide', () => journey.pause());

// Initialize preview
updateFilterOptions();
applyFilter();

if (saved && fixtures.some(f => f.id === saved.echoId)) {
  $('save-note').textContent = `A place is kept at ${time(saved.seconds)}. Use “Return to saved place”.`;
}
