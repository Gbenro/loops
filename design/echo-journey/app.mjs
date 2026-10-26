import { Journey, ordered, groups } from './journey.mjs';
import { fixtures, resolveFixture } from './fixtures.mjs';
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const stamp = date => new Date(date).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const storageKey = 'luna.echo-journey.PREVIEW.place.v1';
let groupBy = 'day', shownId = '', saved = null, skippedCount = 0;
try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Storage denied: preview still works in memory. */ }
const journey = new Journey(fixtures, resolveFixture, () => new Audio(), update);
$('timezone').textContent = zone;
function drawWave(values) {
  const upper = values.map((v, i) => `${i * 600 / (values.length - 1)},${36 - v * 31}`).join(' ');
  const lower = [...values].reverse().map((v, i) => `${600 - i * 600 / (values.length - 1)},${36 + v * 31}`).join(' ');
  return `<defs><path id="envelope" d="M${upper} L${lower} Z"/><clipPath id="heard"><rect id="heard-width" width="0" height="72"/></clipPath></defs><use href="#envelope" fill="currentColor" opacity=".27"/><use href="#envelope" fill="currentColor" clip-path="url(#heard)"/><line x1="0" y1="36" x2="600" y2="36" stroke="currentColor" opacity=".3"/>`;
}
function renderPath() {
  const sorted = ordered(fixtures, journey.order);
  $('groups').innerHTML = groups(sorted, groupBy, zone).map(group => `<section class="group"><h3>${esc(group.label)}${group.context ? `<small>${esc(group.context)}</small>` : ''}</h3>${group.items.map(e => {
    const n = journey.queue.findIndex(item => item.id === e.id);
    return `<button class="echo" data-echo="${esc(e.id)}" ${e.availability === 'unavailable' || journey.skipped.has(e.id) ? 'disabled' : ''} aria-current="${e.id === journey.id}"><span class="echo-index">${n >= 0 ? String(n + 1).padStart(2,'0') : '—'}</span><span class="echo-body"><span class="echo-name">${esc(e.title)}</span><span class="echo-meta"><span>${esc(new Date(e.occurredAt).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}))}</span><span>·</span><span>${esc(groupBy === 'day' ? e.context.phaseLabel : new Date(e.occurredAt).toLocaleDateString('en-US',{timeZone:zone,month:'short',day:'numeric'}))}</span></span></span><span class="echo-length">${n < 0 ? 'Unavailable' : time(e.duration)}</span></button>`;
  }).join('')}</section>`).join('');
  document.querySelectorAll('[data-group]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === groupBy)));
  $('available-count').textContent = `${journey.queue.length} recordings`;
}
function update() {
  const e = journey.current; if (!e) return;
  if (skippedCount !== journey.skipped.size) { skippedCount = journey.skipped.size; renderPath(); }
  if (shownId !== e.id) {
    shownId = e.id;
    $('voice-title').textContent = e.title;
    $('moment-date').textContent = stamp(e.occurredAt);
    $('context').textContent = `◐ ${e.context.phaseLabel} · ${e.context.cycleLabel.split(' · ')[0]} ↗`;
    $('wave').innerHTML = drawWave(e.waveform);
  }
  const duration = journey.duration || e.duration;
  $('seek').max = duration; $('seek').value = journey.time;
  $('seek').setAttribute('aria-valuetext', `${time(journey.time)} of ${time(duration)}`);
  $('elapsed').textContent = time(journey.time); $('duration').textContent = time(duration);
  $('heard-width')?.setAttribute('width', String(600 * Math.min(1, journey.time / duration)));
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
  document.querySelectorAll('[data-echo]').forEach(b => b.setAttribute('aria-current',String(b.dataset.echo === e.id)));
  $('return').disabled = !saved || !fixtures.some(f => f.id === saved.echoId && f.availability !== 'unavailable');
  $('order').value = journey.order;
}
$('play').addEventListener('click', () => void journey.toggle());
$('previous').addEventListener('click', () => void journey.step(-1));
$('next').addEventListener('click', () => void journey.step(1));
$('dock-play').addEventListener('click', () => void journey.toggle());
$('dock-previous').addEventListener('click', () => void journey.step(-1));
$('dock-next').addEventListener('click', () => void journey.step(1));
$('dock-return').addEventListener('click', () => { document.querySelector('.listening').scrollIntoView({block:'start'}); $('play').focus({preventScroll:true}); });
new IntersectionObserver(([entry]) => { $('mobile-dock').hidden = entry.isIntersecting; }, {threshold:0}).observe(document.querySelector('.listening'));
$('seek').addEventListener('input', e => journey.seek(Number(e.target.value)));
$('order').addEventListener('change', e => { journey.setOrder(e.target.value); renderPath(); });
document.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => { groupBy = b.dataset.group; renderPath(); }));
$('groups').addEventListener('click', e => { const b = e.target.closest('[data-echo]'); if (b && !b.disabled) void journey.select(b.dataset.echo, true); });
$('context').addEventListener('click', () => { groupBy = 'phase'; renderPath(); const active = document.querySelector('[data-echo][aria-current=true]'); active?.scrollIntoView({block:'center'}); active?.focus({preventScroll:true}); });
$('save').addEventListener('click', () => {
  saved = journey.place(); let persisted = false;
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); persisted = true; } catch { /* In-memory bookmark remains usable. */ }
  $('save-note').textContent = `Place kept at ${time(saved.seconds)} · ${persisted ? 'saved in this preview browser' : 'held for this tab only'}.`; update();
});
$('return').addEventListener('click', async () => { await journey.restore(saved); renderPath(); $('save-note').textContent = 'Returned to your kept place. Press play when ready.'; });
$('clear').addEventListener('click', () => { saved = null; try { localStorage.removeItem(storageKey); } catch {} $('save-note').textContent = 'Saved preview place cleared.'; update(); });
$('theme').addEventListener('click', () => { const light = document.documentElement.dataset.theme !== 'light'; document.documentElement.dataset.theme = light ? 'light' : 'dark'; $('theme').setAttribute('aria-label',`Switch to ${light ? 'dark' : 'light'} theme`); });
window.addEventListener('pagehide', () => journey.pause());
// No live adapter, sign-in, network API, microphone, or audio persistence is imported.
renderPath(); update();
if (saved && fixtures.some(f => f.id === saved.echoId)) $('save-note').textContent = `A place is kept at ${time(saved.seconds)}. Use “Return to saved place”.`;
