import { echoPageCursor } from './echo-browse.ts';
import { moonDisc } from './visuals.ts';
import { PHASES } from './fixtures.ts';
import { Journey, ordered, groups } from '../../echo-journey/journey.mjs';
import { createJourneyService, getCycleInfoForLunation, journeyEcho } from './journey-service.ts';

export function mountJourney(host, services, canPlay = () => true) {
  const adapter = createJourneyService(services);
  const resolveAudio = (id, signal, options) => adapter.resolve(id, signal, options);
  const abort = new AbortController();
  const on = (el, type, fn) => el && el.addEventListener(type, fn, { signal: abort.signal });
  const $ = id => host.querySelector('#' + id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stamp = date => new Date(date).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

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

  let saved = adapter.loadPlace() || adapter.loadPlace(true);
  let saveEnabled = true;


  let chimeEnabled = true, chimeContext;
  const chimeKey = 'luna.echo-journey.chime.' + adapter.owner;
  try { chimeEnabled = localStorage.getItem(chimeKey) !== 'off'; } catch {}
  function prepareChime() {
    if (!chimeEnabled) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context && !chimeContext) chimeContext = new Context();
      void chimeContext?.resume().catch(() => {});
    } catch {}
  }
  function betweenRecordings(signal) {
    return new Promise(resolve => {
      if (signal.aborted) return resolve();
      let oscillator, gain;
      const finish = () => {
        clearTimeout(timer); signal.removeEventListener('abort', finish);
        try { oscillator?.stop(); oscillator?.disconnect(); gain?.disconnect(); } catch {}
        resolve();
      };
      const timer = setTimeout(finish, 700);
      signal.addEventListener('abort', finish, {once:true});
      if (chimeEnabled && chimeContext?.state === 'running') {
        try {
          const now = chimeContext.currentTime;
          oscillator = chimeContext.createOscillator(); gain = chimeContext.createGain();
          oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(660, now);
          gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.055, now + .025);
          gain.gain.exponentialRampToValueAtTime(.0001, now + .42);
          oscillator.connect(gain); gain.connect(chimeContext.destination);
          oscillator.start(now); oscillator.stop(now + .45);
        } catch {}
      }
    });
  }
  const journey = new Journey([], resolveAudio, () => new Audio(), update, {
    between: betweenRecordings,
    loadMore: async signal => {
      if (pageRequest) await pageRequest;
      while (pageCursor && !signal.aborted) {
        const before = journey.queue.length;
        if (!await loadJourneyPage(true)) throw new Error('Page unavailable');
        if (journey.queue.length > before) return;
      }
      if (pageError) throw new Error('Page unavailable');
    }
  });
  $('transition-sound').checked = chimeEnabled;
  on($('transition-sound'), 'change', e => {
    chimeEnabled = e.target.checked;
    try { localStorage.setItem(chimeKey, chimeEnabled ? 'on' : 'off'); } catch {}
    prepareChime();
  });
  $('timezone').textContent = zone;

  function getCurrentCycleObj() {
    return cycles.find(c => c.id === selectedCycleId) || getCycleInfoForLunation(Number(selectedCycleId.replace('lunation-', '')) || adapter.currentLunation(), adapter.currentLunation());
  }


  let pageCursor;
  let pageLoading=false,pageError='',pageToken=0,pageRequest,pageFailedMore=false;
  function loadJourneyPage(more=false) {
    if(more && pageLoading) return pageRequest;
    pageRequest = fetchJourneyPage(more);
    return pageRequest;
  }
  const pageStatus=document.createElement('div');
  pageStatus.className='echo-page-status';
  $('groups').after(pageStatus);
  function renderPageStatus(){
    pageStatus.innerHTML=pageLoading?'<p role="status">Loading recordings…</p>':pageError?'<p>Could not load this cycle. Your recordings are safe.</p><button class="btn" id="journey-retry">Try again</button>':pageCursor?'<button class="btn" id="journey-more">Load more recordings</button>':'';
    pageStatus.querySelector('#journey-more')?.addEventListener('click',()=>void loadJourneyPage(true));
    pageStatus.querySelector('#journey-retry')?.addEventListener('click',()=>void loadJourneyPage(pageFailedMore));
  }
  async function fetchJourneyPage(more=false){
    if(!adapter.valid()||(more&&pageLoading))return;
    const token=++pageToken,cycle=getCurrentCycleObj(),phase=selectedPhase,day=selectedDay;
    pageLoading=true;pageError='';pageFailedMore=more;renderPageStatus();
    const query={since:cycle.cycleStart,until:cycle.cycleEnd,kind:'voice',limit:30,phaseId:phase||undefined,cursor:more?pageCursor:undefined,order:journey.order};
    if(day){const start=new Date(day+'T00:00:00');start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);query.since=start.toISOString();query.until=end.toISOString();}
    try{
      const result=await services.echoes.list(query);
      if(abort.signal.aborted||!adapter.valid()||token!==pageToken)return;
      const items=result.items.map(journeyEcho);
      cycleEchoes=more?[...new Map([...cycleEchoes,...items].map(e=>[e.id,e])).values()]:items;
      pageCursor=result.nextCursor;
      updateFilterOptions();applyFilter();return true;
    }catch{if(token===pageToken&&!abort.signal.aborted)pageError='failed';return false;}
    finally{if(token===pageToken&&!abort.signal.aborted){pageLoading=false;renderPageStatus();update();}}
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
      list = list.filter(e => localDay(e.occurredAt) === selectedDay);
    }
    return list;
  }

  function renderCycleNav() {
    const cycle = getCurrentCycleObj();
    const currIdx = cycles.findIndex(c => c.id === selectedCycleId);

    $('cycle-select').innerHTML = cycles.map(c =>
      `<option value="${esc(c.id)}" ${c.id === selectedCycleId ? 'selected' : ''}>${esc(c.label)}${c.isCurrent ? ' (Current)' : ''}</option>`
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
      PHASES.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    $('phase-filter').value = selectedPhase;

    // Populate Day filter within this cycle (and current phase if selected)
    updateDayFilterOptions();
  }

  function localDay(value) {
    const d=new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function updateDayFilterOptions() {
    const cycle=getCurrentCycleObj();
    $('day-filter').min=localDay(cycle.cycleStart);
    $('day-filter').max=localDay(new Date(Date.parse(cycle.cycleEnd)-1));
    $('day-filter').value=selectedDay;
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
        $('groups').innerHTML = `<div class="empty-cycle" id="empty-cycle-state"><div class="empty-icon">◐</div><h3>No recordings match this filter</h3><p>No moments in ${esc(cycle.name)} match the selected phase or day. Clear the filter to explore other recordings in this cycle.</p></div>`;
        $('available-count').textContent = `0 of ${cycleEchoes.length} recordings loaded`;
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
      $('available-count').textContent = `${cycleEchoes.length} ${cycleEchoes.length === 1 ? 'recording' : 'recordings'} loaded`;
    } else {
      $('available-count').textContent = `${filtered.length} of ${cycleEchoes.length} recordings loaded`;
    }
  }

  function update() {
    const cycle = getCurrentCycleObj();
    const e = journey.current;
    $('order').value = journey.order;

    if (!e) {
      shownId='';
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
      for (const id of ['play', 'transport-play', 'previous', 'next', 'dock-play', 'dock-previous', 'dock-next', 'save', 'seek']) $(id).disabled = true;
      $('return').disabled = !saved;
      return;
    }

    for (const id of ['play', 'transport-play', 'save', 'seek', 'dock-play']) $(id).disabled = false;
    if (skippedCount !== journey.skipped.size) {
      skippedCount = journey.skipped.size;
      renderPath();
    }

    if (shownId !== e.id) {
      shownId = e.id;
      $('voice-title').textContent = e.title;
      $('moment-date').textContent = stamp(e.occurredAt);
      $('context').innerHTML = moonDisc(Math.max(0,PHASES.findIndex(p=>p.id===e.context.phaseId)),24)+`<span>${esc(e.context.phaseLabel)} · ${esc(cycle.name)} ↗</span>`;
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
    $('transport-play').textContent = journey.desired ? 'Ⅱ Pause' : '▶ Play';
    $('transport-play').setAttribute('aria-label', journey.desired ? 'Pause recordings' : 'Play recordings');
    $('dock-title').textContent = e.title;
    $('dock-play').textContent = journey.desired ? 'Ⅱ' : '▶';
    $('dock-play').setAttribute('aria-label', journey.desired ? 'Pause journey' : 'Play journey');

    const index = journey.queue.findIndex(item => item.id === e.id);
    const status = journey.message || ({
      idle: 'Ready when you are',
      loading: 'Finding the recording…',
      transition: 'Next recording…',
      playing: 'Listening · continues automatically',
      paused: 'Paused · your place is held',
      buffering: 'Waiting for audio…',
      complete: 'Journey complete',
      unavailable: 'Recording unavailable'
    }[journey.status] || 'Ready');

    if ($('player-status').textContent !== status) $('player-status').textContent = status;
    $('previous').disabled = index <= 0;
    $('next').disabled = index >= journey.queue.length - 1 && !pageCursor;
    $('dock-previous').disabled = $('previous').disabled;
    $('dock-next').disabled = $('next').disabled;

    $('queue-count').textContent = `${Math.max(0, index + 1)} of ${journey.queue.length}${pageCursor ? '+' : ''} in this selection`;
    $('queue-progress').max = journey.queue.length;
    $('queue-progress').value = journey.status === 'complete' ? journey.queue.length : Math.max(0, index) + Math.min(1, journey.time / (duration || 1));
    $('queue-progress').setAttribute('aria-valuetext', `Recording ${index + 1} of ${journey.queue.length}`);
    $('up-next').textContent = journey.queue[index + 1] ? `Next · ${journey.queue[index + 1].title}` : pageCursor ? 'More recordings continue automatically.' : 'The last moment in this selection.';
    host.querySelectorAll('[data-echo]').forEach(b => b.setAttribute('aria-current', String(b.dataset.echo === e.id)));
    $('return').disabled = !saved;
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
    pageCursor=undefined; journey.pause();
    selectedCycleId = cycleId;
    cycleEchoes = adapter.items(selectedCycleId);
    selectedPhase = '';
    selectedDay = '';
    updateFilterOptions();
    applyFilter();
    return loadJourneyPage();
  }

  // Event Listeners
  const togglePlayback = () => { if(!journey.desired&&!canPlay())return;prepareChime(); void journey.toggle(); };
  $('play').addEventListener('click', togglePlayback);
  $('transport-play').addEventListener('click', togglePlayback);
  $('previous').addEventListener('click', () => void journey.step(-1));
  $('next').addEventListener('click', () => void journey.step(1));
  $('dock-play').addEventListener('click', togglePlayback);
  $('dock-previous').addEventListener('click', () => void journey.step(-1));
  $('dock-next').addEventListener('click', () => void journey.step(1));
  $('dock-return').addEventListener('click', () => { host.querySelector('.listening').scrollIntoView({ block: 'start' }); $('play').focus({ preventScroll: true }); });

  const observer = new IntersectionObserver(([entry]) => { $('mobile-dock').hidden = entry.isIntersecting; }, { threshold: 0 });
  observer.observe(host.querySelector('.listening'));

  $('seek').addEventListener('input', e => journey.seek(Number(e.target.value)));
  $('order').addEventListener('change', e => {
    const order=e.target.value;saveAutomatically(); journey.pause(); journey.setOrder(order);
    cycleEchoes=[]; pageCursor=undefined; applyFilter(); void loadJourneyPage();
  });

  host.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
    groupBy = b.dataset.group;
    renderPath();
  }));

  $('groups').addEventListener('click', e => {
    const b = e.target.closest('[data-echo]');
    if (b && !b.disabled && canPlay()) { prepareChime(); void journey.select(b.dataset.echo, true); }
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
    selectedPhase = e.target.value;selectedDay='';pageCursor=undefined;journey.pause();
    updateDayFilterOptions();
    applyFilter();void loadJourneyPage();
  });

  on($('day-filter'), 'change', e => {
    selectedDay = e.target.value;pageCursor=undefined;journey.pause();
    applyFilter();void loadJourneyPage();
  });

  // Context button filters by the playing Echo's phase
  $('context').addEventListener('click', () => {
    if (!journey.current) return;
    selectedPhase = journey.current.context.phaseId;selectedDay='';pageCursor=undefined;journey.pause();
    $('phase-filter').value = selectedPhase;
    updateDayFilterOptions();
    applyFilter();void loadJourneyPage();
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
    await services.echoes.get(saved.echoId).catch(()=>null);
    const all = adapter.items();
    const targetEcho = all.find(f => f.id === saved.echoId);
    if(!targetEcho){$('save-note').textContent='This recording could not be loaded. Try returning again.';return;}
    journey.pause();
    if (targetEcho && targetEcho.context.cycleId !== selectedCycleId) {
      await selectCycle(targetEcho.context.cycleId);
    }
    cycleEchoes=[...new Map([...cycleEchoes,targetEcho].filter(Boolean).map(e=>[e.id,e])).values()];applyFilter();
    selectedPhase='';selectedDay='';journey.setOrder(saved.order);
    await loadJourneyPage();
    if(targetEcho&&!cycleEchoes.some(e=>e.id===targetEcho.id)){
      cycleEchoes=[targetEcho];pageCursor=echoPageCursor(targetEcho);applyFilter();await loadJourneyPage(true);
    }
    const restored=await journey.restore(saved);
    renderPath();
    if(!restored){$('save-note').textContent='This recording could not be loaded. Try returning again.';return;}
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

  // Initialize only the selected cycle. Earlier cycles load on navigation.
  updateFilterOptions();
  applyFilter();
  void loadJourneyPage();

  if (saved && adapter.items().some(f => f.id === saved.echoId)) {
    $('save-note').textContent = `A place is kept at ${time(saved.seconds)}. Use “Return to saved place”.`;
  }


  return {
    owner: adapter.owner,
    pause() { journey.pause(); },
    refresh() {
      const discovered=adapter.getCycles();cycles=[...new Map([...cycles,...discovered].map(c=>[c.id,c])).values()].sort((a,b)=>b.lunation-a.lunation);
      const currentItems=adapter.items(selectedCycleId);cycleEchoes=cycleEchoes.map(e=>currentItems.find(item=>item.id===e.id)||e);
      updateFilterOptions();
      applyFilter();
    },
    dispose() {
      saveAutomatically();
      clearInterval(saveTimer);
      pageToken++;abort.abort();
      observer.disconnect();
      journey.dispose();
      void chimeContext?.close().catch(() => {});
    }
  };
}
