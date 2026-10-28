import { Journey, ordered, groups } from '../../echo-journey/journey.mjs';
import { createJourneyService, getCycleInfoForLunation } from './journey-service.ts';

export function mountJourney(host, services) {
  const adapter = createJourneyService(services);
  const resolveAudio = (id, signal, options) => adapter.resolve(id, signal, options);
  const abort = new AbortController();
  const on = (el, type, fn) => el && el.addEventListener(type, fn, { signal: abort.signal });
  const $ = id => host.querySelector('#' + id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stamp = date => new Date(date).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'long', day: 'numeric' });

  // 1. Cycle Discovery & Initial State
  let cycles = adapter.getCycles();
  const currentCycleId = adapter.currentCycleId();
  let selectedCycleId = currentCycleId;

  // Ensure selected cycle exists in cycles list
  if (!cycles.some(c => c.id === selectedCycleId)) {
    const lunNum = Number(selectedCycleId.replace('lunation-', ''));
    if (Number.isFinite(lunNum)) {
      cycles.unshift(getCycleInfoForLunation(lunNum, adapter.currentLunation()));
    }
  }

  let cycleEchoes = adapter.items(selectedCycleId);
  let selectedPhase = '';
  let selectedDay = '';
  let groupBy = 'day';
  let shownId = '';
  let skippedCount = 0;

  let saved = adapter.loadPlace();
  let saveEnabled = true;
  const resume = adapter.loadPlace(true) || saved;

  const journey = new Journey([], resolveAudio, () => new Audio(), update);
  $('timezone').textContent = zone;

  function getCurrentCycleObj() {
    return cycles.find(c => c.id === selectedCycleId) || getCycleInfoForLunation(Number(selectedCycleId.replace('lunation-', '')) || adapter.currentLunation(), adapter.currentLunation());
  }

  function drawWave(values) {
    if (!values || values.length < 2) return '<line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>';
    const upper = values.map((v, i) => `${i * 600 / (values.length - 1)},${36 - v * 31}`).join(' ');
    const lower = [...values].reverse().map((v, i) => `${600 - i * 600 / (values.length - 1)},${36 + v * 31}`).join(' ');
    return `<defs><path id="envelope" d="M${upper} L${lower} Z"/><clipPath id="heard"><rect id="heard-width" width="0" height="72"/></clipPath></defs><use href="#envelope" fill="currentColor" opacity=".27"/><use href="#envelope" fill="currentColor" clip-path="url(#heard)"/><line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>`;
  }

  function getFilteredEchoes() {
    let list = cycleEchoes;
    if (selectedPhase) {
      list = list.filter(e => e.context.phaseId === selectedPhase);
    }
    if (selectedDay) {
      list = list.filter(e => dayFmt.format(new Date(e.occurredAt)) === selectedDay);
    }
    return list;
  }

  function renderCycleNav() {
    const cycle = getCurrentCycleObj();
    const currIdx = cycles.findIndex(c => c.id === selectedCycleId);

    $('cycle-select').innerHTML = cycles.map(c =>
      `<option value="${esc(c.id)}" ${c.id === selectedCycleId ? 'selected' : ''}>${esc(c.label)}${c.isCurrent ? ' (Current)' : ''} · ${c.count} ${c.count === 1 ? 'recording' : 'recordings'}</option>`
    ).join('');

    $('cycle-range-label').textContent = `${cycle.range}${cycle.isCurrent ? ' · Current lunar cycle' : ''}`;
    $('path-cycle-eyebrow').textContent = `${cycle.name.toUpperCase()} · ${cycle.year}`;

    // Previous step moves to older cycle (higher index in descending cycles array, or next older lunation)
    $('prev-cycle').disabled = false;
    // Next step moves to newer cycle (lower index; disabled if at top/newest)
    $('next-cycle').disabled = currIdx <= 0;
  }

  function updateFilterOptions() {
    // Populate Phase filter within this cycle
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

    // Populate Day filter within this cycle (and current phase if selected)
    updateDayFilterOptions();
  }

  function updateDayFilterOptions() {
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

    // 1. Empty State Handling (Cycle has 0 recordings or active filter returned 0)
    if (filtered.length === 0) {
      if (cycleEchoes.length === 0) {
        $('groups').innerHTML = `<div class="empty-cycle" id="empty-cycle-state"><div class="empty-icon">◐</div><h3>No recordings in this cycle</h3><p>${esc(cycle.name)} spans ${esc(cycle.range)}. Step back to earlier cycles to listen to past moments, or return to the Field to speak.</p></div>`;
        $('available-count').textContent = '0 recordings in this cycle';
      } else {
        $('groups').innerHTML = `<div class="empty-cycle" id="empty-cycle-state"><div class="empty-icon">◐</div><h3>No recordings match this filter</h3><p>No moments in ${esc(cycle.name)} match the selected phase or day. Clear the filter to show all ${cycleEchoes.length} recordings in this cycle.</p></div>`;
        $('available-count').textContent = `0 of ${cycleEchoes.length} recordings in this cycle`;
      }
      host.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));
      return;
    }

    // 2. Render grouped recordings
    const sorted = ordered(filtered, journey.order);
    $('groups').innerHTML = groups(sorted, groupBy, zone).map(group => `<section class="group"><h3>${esc(group.label)}${group.context ? `<small>${esc(group.context)}</small>` : ''}</h3>${group.items.map(e => {
      const n = journey.queue.findIndex(item => item.id === e.id);
      return `<button class="echo" data-echo="${esc(e.id)}" ${e.availability === 'unavailable' || journey.skipped.has(e.id) ? 'disabled' : ''} aria-current="${e.id === journey.id}"><span class="echo-index">${n >= 0 ? String(n + 1).padStart(2, '0') : '—'}</span><span class="echo-body"><span class="echo-name">${esc(e.title)}</span><span class="echo-meta"><span>${esc(new Date(e.occurredAt).toLocaleTimeString('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }))}</span><span>·</span><span>${esc(groupBy === 'day' ? e.context.phaseLabel : new Date(e.occurredAt).toLocaleDateString('en-US', { timeZone: zone, month: 'short', day: 'numeric' }))}</span></span></span><span class="echo-length">${n < 0 ? 'Unavailable' : time(e.duration)}</span></button>`;
    }).join('')}</section>`).join('');

    host.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));

    // Accurate count display
    if (filtered.length === cycleEchoes.length) {
      $('available-count').textContent = `${cycleEchoes.length} ${cycleEchoes.length === 1 ? 'recording' : 'recordings'} in this cycle`;
    } else {
      $('available-count').textContent = `${filtered.length} of ${cycleEchoes.length} recordings in this cycle`;
    }
  }

  function update() {
    const cycle = getCurrentCycleObj();
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
      $('return').disabled = !saved || !adapter.items().some(f => f.id === saved.echoId && f.availability !== 'unavailable');
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

    const duration = journey.duration || e.duration || 0;
    $('seek').max = duration;
    $('seek').value = journey.time;
    $('seek').setAttribute('aria-valuetext', `${time(journey.time)} of ${time(duration)}`);
    $('elapsed').textContent = time(journey.time);
    $('duration').textContent = time(duration);
    $('heard-width')?.setAttribute('width', String(600 * Math.min(1, journey.time / (duration || 1))));
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
    $('queue-progress').value = journey.status === 'complete' ? journey.queue.length : Math.max(0, index) + Math.min(1, journey.time / (duration || 1));
    $('queue-progress').setAttribute('aria-valuetext', `Recording ${index + 1} of ${journey.queue.length}`);
    $('up-next').textContent = journey.queue[index + 1] ? `Next · ${journey.queue[index + 1].title}` : 'The last moment in this cycle.';
    host.querySelectorAll('[data-echo]').forEach(b => b.setAttribute('aria-current', String(b.dataset.echo === e.id)));
    $('return').disabled = !saved || !adapter.items().some(f => f.id === saved.echoId && f.availability !== 'unavailable');
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
    if (cycleId === selectedCycleId && cycleEchoes.length > 0) return;
    selectedCycleId = cycleId;
    cycleEchoes = adapter.items(selectedCycleId);
    selectedPhase = '';
    selectedDay = '';
    updateFilterOptions();
    applyFilter();
  }

  // Event Listeners
  $('play').addEventListener('click', () => void journey.toggle());
  $('previous').addEventListener('click', () => void journey.step(-1));
  $('next').addEventListener('click', () => void journey.step(1));
  $('dock-play').addEventListener('click', () => void journey.toggle());
  $('dock-previous').addEventListener('click', () => void journey.step(-1));
  $('dock-next').addEventListener('click', () => void journey.step(1));
  $('dock-return').addEventListener('click', () => { host.querySelector('.listening').scrollIntoView({ block: 'start' }); $('play').focus({ preventScroll: true }); });

  const observer = new IntersectionObserver(([entry]) => { $('mobile-dock').hidden = entry.isIntersecting; }, { threshold: 0 });
  observer.observe(host.querySelector('.listening'));

  $('seek').addEventListener('input', e => journey.seek(Number(e.target.value)));
  $('order').addEventListener('change', e => {
    journey.setOrder(e.target.value);
    renderPath();
  });

  host.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
    groupBy = b.dataset.group;
    renderPath();
  }));

  $('groups').addEventListener('click', e => {
    const b = e.target.closest('[data-echo]');
    if (b && !b.disabled) void journey.select(b.dataset.echo, true);
  });

  // Cycle navigation events
  on($('cycle-select'), 'change', e => {
    selectCycle(e.target.value);
  });

  on($('prev-cycle'), 'click', () => {
    const currIdx = cycles.findIndex(c => c.id === selectedCycleId);
    if (currIdx >= 0 && currIdx < cycles.length - 1) {
      selectCycle(cycles[currIdx + 1].id);
    } else {
      // Step back one lunation astronomically
      const currentLun = Number(selectedCycleId.replace('lunation-', ''));
      if (Number.isFinite(currentLun)) {
        const prevLun = currentLun - 1;
        const prevInfo = getCycleInfoForLunation(prevLun, adapter.currentLunation());
        cycles.push(prevInfo);
        selectCycle(prevInfo.id);
      }
    }
  });

  on($('next-cycle'), 'click', () => {
    const currIdx = cycles.findIndex(c => c.id === selectedCycleId);
    if (currIdx > 0) {
      selectCycle(cycles[currIdx - 1].id);
    }
  });

  // Sub-filter events
  on($('phase-filter'), 'change', e => {
    selectedPhase = e.target.value;
    updateDayFilterOptions();
    applyFilter();
  });

  on($('day-filter'), 'change', e => {
    selectedDay = e.target.value;
    applyFilter();
  });

  // Context button filters by the playing Echo's phase
  $('context').addEventListener('click', () => {
    if (!journey.current) return;
    selectedPhase = journey.current.context.phaseId;
    $('phase-filter').value = selectedPhase;
    updateDayFilterOptions();
    applyFilter();
    const active = host.querySelector('[data-echo][aria-current=true]');
    active?.scrollIntoView({ block: 'center' });
    active?.focus({ preventScroll: true });
  });

  // Bookmark / Save Place actions
  $('save').addEventListener('click', () => {
    saveEnabled = true;
    saved = { ...journey.place(), cycleId: selectedCycleId };
    let persisted = adapter.savePlace(saved);
    $('save-note').textContent = `Place kept at ${time(saved.seconds)} · ${persisted ? 'saved for this account in this browser' : 'held for this tab only'}.`;
    update();
  });

  $('return').addEventListener('click', async () => {
    if (!saved) return;
    const all = adapter.items();
    const targetEcho = all.find(f => f.id === saved.echoId);
    if (targetEcho && targetEcho.context.cycleId !== selectedCycleId) {
      selectCycle(targetEcho.context.cycleId);
    }
    await journey.restore(saved);
    renderPath();
    $('save-note').textContent = 'Returned to your kept place. Press play when ready.';
  });

  $('clear').addEventListener('click', () => {
    saved = null;
    saveEnabled = false;
    adapter.clearPlace();
    $('save-note').textContent = 'Saved listening place cleared.';
    update();
  });

  on(window, 'pagehide', () => {
    saveAutomatically();
    journey.pause();
  });

  function saveAutomatically() {
    if (saveEnabled && journey.id && journey.status !== 'idle') {
      adapter.savePlace({ ...journey.place(), cycleId: selectedCycleId }, true);
    }
  }

  const saveTimer = setInterval(saveAutomatically, 2000);

  // Initialize view
  updateFilterOptions();
  applyFilter();

  if (saved && adapter.items().some(f => f.id === saved.echoId)) {
    $('save-note').textContent = `A place is kept at ${time(saved.seconds)}. Use “Return to saved place”.`;
  }

  if (resume) {
    const all = adapter.items();
    const target = all.find(f => f.id === resume.echoId);
    if (target) {
      if (target.context.cycleId !== selectedCycleId) {
        selectCycle(target.context.cycleId);
      }
      void journey.restore(resume).then(() => renderPath());
    }
  }

  return {
    owner: adapter.owner,
    pause() { journey.pause(); },
    refresh() {
      cycles = adapter.getCycles();
      cycleEchoes = adapter.items(selectedCycleId);
      updateFilterOptions();
      applyFilter();
    },
    dispose() {
      saveAutomatically();
      clearInterval(saveTimer);
      abort.abort();
      observer.disconnect();
      journey.dispose();
    }
  };
}
