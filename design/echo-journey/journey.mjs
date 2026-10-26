export function ordered(items, order = 'oldest') {
  const unique = [...new Map(items.filter(e => e.kind === 'voice' && Number.isFinite(Date.parse(e.occurredAt))).map(e => [e.id, e])).values()];
  return unique.sort((a, b) => (Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id)) * (order === 'newest' ? -1 : 1));
}

// Contiguous phase occurrences stay in their own cycle. Grouping never reorders time.
export function groups(items, by, timeZone) {
  const date = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'long', day: 'numeric' });
  const result = [];
  for (const echo of items) {
    const day = date.format(new Date(echo.occurredAt));
    const key = by === 'day' ? day : by === 'cycle' ? echo.context.cycleId : `${echo.context.cycleId}:${echo.context.phaseId}`;
    const label = by === 'day' ? day : by === 'cycle' ? echo.context.cycleLabel : echo.context.phaseLabel;
    const last = result.at(-1);
    if (last?.key === key) last.items.push(echo);
    else result.push({ key, label, context: by === 'phase' ? echo.context.cycleLabel : '', items: [echo] });
  }
  return result;
}

export class Journey {
  constructor(items, resolve, createAudio, onChange = () => {}) {
    this.items = ordered(items); this.resolve = resolve; this.createAudio = createAudio; this.onChange = onChange;
    this.order = 'oldest'; this.status = 'idle';
    this.time = 0; this.duration = 0; this.positions = new Map(); this.skipped = new Set(); this.version = 0;
    this.message = ''; this.desired = false; this.cleanups = []; this.id = this.queue[0]?.id ?? null;
  }
  get queue() { return ordered(this.items, this.order).filter(e => e.availability !== 'unavailable' && !this.skipped.has(e.id)); }
  get current() { return this.items.find(e => e.id === this.id); }
  emit() { this.onChange(this); }
  release() {
    this.abort?.abort(); this.cleanups.forEach(fn => fn()); this.cleanups = [];
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); }
    this.audio = null;
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
  }
  remember() { if (this.id) this.positions.set(this.id, this.time); }
  setOrder(order) { this.order = order === 'newest' ? 'newest' : 'oldest'; this.emit(); }
  async select(id, autoplay = false, position = this.positions.get(id) || 0, refresh = false) {
    if (!this.queue.some(e => e.id === id)) return;
    this.remember(); this.release(); const version = ++this.version;
    this.id = id; this.time = Math.max(0, Number.isFinite(position) ? position : 0);
    this.duration = this.current?.duration || 0; this.status = 'loading'; this.desired = autoplay; this.message = ''; this.emit();
    this.abort = new AbortController();
    try {
      const result = await this.resolve(id, this.abort.signal, {refresh});
      if (version !== this.version) { if (result.url?.startsWith('blob:')) URL.revokeObjectURL(result.url); return; }
      if (result.status === 'unavailable') {
        const next = this.queue[this.queue.findIndex(e => e.id === id) + 1];
        this.skipped.add(id);
        if (next && this.desired) return this.select(next.id, true, 0);
        this.status = 'unavailable'; this.desired = false; this.message = 'This recording is unavailable. Choose another moment.'; this.emit(); return;
      }
      if (result.status !== 'ready') {
        this.desired = false; this.status = 'blocked';
        this.message = result.status === 'authentication-required' ? 'Sign in again to continue listening.' : result.status === 'forbidden' ? 'Access to this recording is no longer available.' : 'Could not load this recording. Press play to retry.';
        this.emit(); return;
      }
      if (result.url.startsWith('blob:')) this.objectUrl = result.url;
      const audio = this.createAudio(); this.audio = audio; audio.preload = 'metadata';
      const listen = (type, fn) => { const safe = () => { if (version === this.version && this.audio === audio) fn(); }; audio.addEventListener(type, safe); this.cleanups.push(() => audio.removeEventListener(type, safe)); };
      let measuringDuration = false;
      const resumeTime = this.time;
      listen('loadedmetadata', () => {
        // MediaRecorder WebM can omit a duration header. Ask the media decoder to
        // find the end before exposing seeking; this changes no recorded bytes.
        if (!Number.isFinite(audio.duration) && !this.duration) {
          measuringDuration = true; audio.pause(); audio.currentTime = 1e10; return;
        }
        this.duration = Number.isFinite(audio.duration) ? audio.duration : this.duration;
        this.time = Math.min(this.time, Math.max(0, this.duration - .05)); audio.currentTime = this.time; this.emit();
      });
      listen('durationchange', () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        this.duration = audio.duration;
        if (measuringDuration) { measuringDuration=false; this.time=Math.min(resumeTime,Math.max(0,this.duration-.05));audio.currentTime=this.time;if(this.desired)void this.play(); }
        this.emit();
      });
      listen('timeupdate', () => { if(measuringDuration)return;this.time = audio.currentTime; this.remember(); this.emit(); });
      listen('play', () => { this.status = 'playing'; this.emit(); });
      listen('pause', () => { if (this.status !== 'complete') this.status = 'paused'; this.emit(); });
      listen('waiting', () => { if (this.desired) { this.status = 'buffering'; this.emit(); } });
      listen('playing', () => { this.status = 'playing'; this.emit(); });
      listen('ended', () => {
        if(measuringDuration)return;
        this.time = 0; this.positions.set(id, 0);
        const next = this.queue[this.queue.findIndex(e => e.id === id) + 1];
        if (next) void this.select(next.id, true, 0);
        else { this.desired = false; this.status = 'complete'; this.message = 'You have reached the end of this listening journey.'; this.emit(); }
      });
      listen('error', () => { if (!refresh && result.url.startsWith('http')) { void this.select(id, this.desired, this.time, true); return; } this.desired = false; this.status = 'blocked'; this.message = 'Audio could not be played. Press play to retry this moment.'; this.emit(); });
      audio.src = result.url;
      this.status = 'paused'; this.emit();
      if (this.desired) await this.play();
    } catch (error) {
      if (version !== this.version || error?.name === 'AbortError') return;
      this.desired = false; this.status = 'blocked'; this.message = 'Connection interrupted. Press play to retry this moment.'; this.emit();
    }
  }
  async play() {
    if (this.status === 'loading') { this.desired = true; return; }
    if (!this.audio || this.status === 'blocked') return this.select(this.queue.find(e => e.id === this.id)?.id || this.queue[0]?.id, true, this.time, this.status === 'blocked');
    if (this.status === 'complete') this.seek(0);
    this.desired = true; this.message = ''; const audio = this.audio; const version = this.version;
    try { await audio.play(); if (version === this.version && !this.desired) audio.pause(); }
    catch { if (version !== this.version) return; this.desired = false; this.status = 'paused'; this.message = 'Playback paused by the browser. Press play to continue.'; this.emit(); }
  }
  pause() { this.desired = false; this.audio?.pause(); this.status = this.status === 'loading' ? 'loading' : 'paused'; this.remember(); this.emit(); }
  toggle() { return this.desired ? this.pause() : this.play(); }
  step(delta) {
    const index = this.queue.findIndex(e => e.id === this.id); const next = this.queue[index + delta];
    if (next) return this.select(next.id, this.desired);
  }
  seek(seconds) {
    this.time = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, this.duration || this.current?.duration || 0));
    if (this.audio?.readyState >= 1) this.audio.currentTime = this.time;
    this.remember(); this.emit();
  }
  setItems(items) {
    this.items=ordered(items);
    if(!this.items.some(e=>e.id===this.id)){this.remember();this.release();++this.version;this.id=this.queue[0]?.id||null;this.time=0;this.duration=0;this.desired=false;this.status='idle';}
    this.emit();
  }
  place() { return { echoId: this.id, seconds: this.time, order: this.order }; }
  async restore(place) {
    if (!place || !this.queue.some(e => e.id === place.echoId)) return false;
    this.setOrder(place.order); await this.select(place.echoId, false, place.seconds); return true;
  }
  dispose() { ++this.version; this.release(); this.positions.clear(); this.skipped.clear(); this.items = []; this.id = null; this.time = 0; this.duration = 0; this.desired = false; this.status = 'idle'; this.message = ''; }
}
