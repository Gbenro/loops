import { Journey, ordered, groups } from '../../echo-journey/journey.mjs';
import { createJourneyService } from './journey-service.ts';
export function mountJourney(host, services) {
const adapter = createJourneyService(services);
let items = adapter.items();
const resolveAudio = (id, signal, options) => adapter.resolve(id,signal,options);
const abort = new AbortController();
const on = (el,type,fn) => el.addEventListener(type,fn,{signal:abort.signal});
const $ = id => host.querySelector('#'+id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const stamp = date => new Date(date).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
let filterKey = '';
let groupBy = 'day', shownId = '', saved = null, skippedCount = 0;
saved = adapter.loadPlace();
let saveEnabled=true;const resume=adapter.loadPlace(true)||saved;
const journey = new Journey(items, resolveAudio, () => new Audio(), update);
$('timezone').textContent = zone;
function drawWave(values) {
  if (!values || values.length < 2) return '<line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>';
  const upper = values.map((v, i) => `${i * 600 / (values.length - 1)},${36 - v * 31}`).join(' ');
  const lower = [...values].reverse().map((v, i) => `${600 - i * 600 / (values.length - 1)},${36 + v * 31}`).join(' ');
  return `<defs><path id="envelope" d="M${upper} L${lower} Z"/><clipPath id="heard"><rect id="heard-width" width="0" height="72"/></clipPath></defs><use href="#envelope" fill="currentColor" opacity=".27"/><use href="#envelope" fill="currentColor" clip-path="url(#heard)"/><line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>`;
}
function renderPath() {
  const sorted = ordered(journey.items, journey.order);
  $('groups').innerHTML = groups(sorted, groupBy, zone).map(group => `<section class="group"><h3>${esc(group.label)}${group.context ? `<small>${esc(group.context)}</small>` : ''}</h3>${group.items.map(e => {
    const n = journey.queue.findIndex(item => item.id === e.id);
    return `<button class="echo" data-echo="${esc(e.id)}" ${e.availability === 'unavailable' || journey.skipped.has(e.id) ? 'disabled' : ''} aria-current="${e.id === journey.id}"><span class="echo-index">${n >= 0 ? String(n + 1).padStart(2,'0') : '—'}</span><span class="echo-body"><span class="echo-name">${esc(e.title)}</span><span class="echo-meta"><span>${esc(new Date(e.occurredAt).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}))}</span><span>·</span><span>${esc(groupBy === 'day' ? e.context.phaseLabel : new Date(e.occurredAt).toLocaleDateString('en-US',{timeZone:zone,month:'short',day:'numeric'}))}</span></span></span><span class="echo-length">${n < 0 ? 'Unavailable' : time(e.duration)}</span></button>`;
  }).join('')}</section>`).join('');
  host.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));
  $('available-count').textContent = `${journey.queue.length} recordings`;
}
function update() {
  const e = journey.current;
  if (!e) { $('voice-title').textContent = items.length?'No recordings in this selection':'No voice Echoes are available yet';$('player-status').textContent='Your original recordings will appear here.';for(const id of ['play','previous','next','dock-play','dock-previous','dock-next','save','return','seek'])$(id).disabled=true;return; }
  for(const id of ['play','save','seek','dock-play'])$(id).disabled=false;
  if (skippedCount !== journey.skipped.size) { skippedCount = journey.skipped.size; renderPath(); }
  if (shownId !== e.id) {
    shownId = e.id;
    $('voice-title').textContent = e.title;
    $('moment-date').textContent = stamp(e.occurredAt);
    $('context').textContent = `◐ ${e.context.phaseLabel} · ${e.context.cycleLabel.split(' · ')[0]} ↗`;
    $('wave').innerHTML = drawWave(e.waveform);
  }
  const duration = journey.duration || e.duration || 0;
  $('seek').max = duration; $('seek').value = journey.time;
  $('seek').setAttribute('aria-valuetext', `${time(journey.time)} of ${time(duration)}`);
  $('elapsed').textContent = time(journey.time); $('duration').textContent = time(duration);
  $('heard-width')?.setAttribute('width', String(600 * Math.min(1, journey.time / (duration || 1))));
  $('play-glyph').textContent = journey.desired ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', journey.desired ? 'Pause recording' : 'Play recording');
  $('dock-title').textContent = e.title;
  $('dock-play').textContent = journey.desired ? 'Ⅱ' : '▶';
  $('dock-play').setAttribute('aria-label', journey.desired ? 'Pause journey' : 'Play journey');
  const index = journey.queue.findIndex(item => item.id === e.id);
  const status = journey.message || ({idle:'Ready when you are',loading:'Finding the recording…',playing:'Listening · continues automatically',paused:'Paused · your place is held',buffering:'Waiting for audio…',complete:'Journey complete',unavailable:'Recording unavailable'}[journey.status] || 'Ready');
  if ($('player-status').textContent !== status) $('player-status').textContent = status;
  $('previous').disabled = index <= 0; $('next').disabled = index >= journey.queue.length - 1;
  $('dock-previous').disabled = $('previous').disabled; $('dock-next').disabled = $('next').disabled;
  $('queue-count').textContent = `${Math.max(0,index + 1)} of ${journey.queue.length} recordings`;
  $('queue-progress').max = journey.queue.length;
  $('queue-progress').value = journey.status === 'complete' ? journey.queue.length : Math.max(0,index) + Math.min(1,journey.time / duration);
  $('queue-progress').setAttribute('aria-valuetext', `Recording ${index+1} of ${journey.queue.length}`);
  $('up-next').textContent = journey.queue[index+1] ? `Next · ${journey.queue[index+1].title}` : 'The last moment in this listening path.';
  host.querySelectorAll('[data-echo]').forEach(b => b.setAttribute('aria-current',String(b.dataset.echo === e.id)));
  $('return').disabled = !saved || !items.some(f => f.id === saved.echoId && f.availability !== 'unavailable');
  $('order').value = journey.order;
}
$('play').addEventListener('click', () => void journey.toggle());
$('previous').addEventListener('click', () => void journey.step(-1));
$('next').addEventListener('click', () => void journey.step(1));
$('dock-play').addEventListener('click', () => void journey.toggle());
$('dock-previous').addEventListener('click', () => void journey.step(-1));
$('dock-next').addEventListener('click', () => void journey.step(1));
$('dock-return').addEventListener('click', () => { host.querySelector('.listening').scrollIntoView({block:'start'}); $('play').focus({preventScroll:true}); });
const observer=new IntersectionObserver(([entry]) => { $('mobile-dock').hidden = entry.isIntersecting; }, {threshold:0});observer.observe(host.querySelector('.listening'));
$('seek').addEventListener('input', e => journey.seek(Number(e.target.value)));
$('order').addEventListener('change', e => { journey.setOrder(e.target.value); renderPath();filterOptions(); });
host.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => { groupBy = b.dataset.group;filterKey='';filterOptions();applyFilter(); }));
$('groups').addEventListener('click', e => { const b = e.target.closest('[data-echo]'); if (b && !b.disabled) void journey.select(b.dataset.echo, true); });
$('context').addEventListener('click', () => { groupBy = 'phase';filterKey='';filterOptions();applyFilter(); const active = host.querySelector('[data-echo][aria-current=true]'); active?.scrollIntoView({block:'center'}); active?.focus({preventScroll:true}); });
$('save').addEventListener('click', () => {
  saveEnabled=true;saved = journey.place(); let persisted = false;
  persisted = adapter.savePlace(saved);
  $('save-note').textContent = `Place kept at ${time(saved.seconds)} · ${persisted ? 'saved for this account in this browser' : 'held for this tab only'}.`; update();
});
$('return').addEventListener('click', async () => { await journey.restore(saved); renderPath(); $('save-note').textContent = 'Returned to your kept place. Press play when ready.'; });
$('clear').addEventListener('click', () => { saved = null; saveEnabled=false;adapter.clearPlace(); $('save-note').textContent = 'Saved listening place cleared.'; update(); });
on(window,'pagehide',()=>{saveAutomatically();journey.pause();});
function filterOptions(){
 const options=groups(ordered(items,journey.order),groupBy,zone);
 $('group-filter').innerHTML='<option value="">All moments</option>'+[...new Map(options.map(g=>[g.key,g])).values()].map(g=>'<option value="'+esc(g.key)+'">'+esc(g.label+(g.context?' · '+g.context:''))+'</option>').join('');$('group-filter').value=filterKey;
}
function applyFilter(){const selected=filterKey?groups(ordered(items,journey.order),groupBy,zone).filter(g=>g.key===filterKey).flatMap(g=>g.items):items;journey.setItems(selected);renderPath();update();}
on($('group-filter'),'change',()=>{filterKey=$('group-filter').value;applyFilter();});
function saveAutomatically(){if(saveEnabled&&journey.id&&journey.status!=='idle')adapter.savePlace(journey.place(),true);}
const saveTimer=setInterval(saveAutomatically,2000);
filterOptions();
renderPath(); update();
if (saved && items.some(f => f.id === saved.echoId)) $('save-note').textContent = `A place is kept at ${time(saved.seconds)}. Use “Return to saved place”.`;

if(resume&&items.some(f=>f.id===resume.echoId))void journey.restore(resume).then(()=>renderPath());
return {owner:adapter.owner,pause(){journey.pause();},refresh(){items=adapter.items();applyFilter();filterOptions();},dispose(){saveAutomatically();clearInterval(saveTimer);abort.abort();observer.disconnect();journey.dispose();}};
}
