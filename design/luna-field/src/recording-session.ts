/** Recorder lifetime is independent of its dialog. Final events always belong to
 * the original draft and owner, including after close, pagehide or account change. */
export class RecordingSession {
  readonly chunks: Blob[] = [];
  readonly startedAt = new Date().toISOString();
  readonly started = performance.now();
  private writes = Promise.resolve();
  private finish!: () => void;
  readonly finished = new Promise<void>(resolve => { this.finish = resolve; });
  error = '';
  durable = false;
  blob: Blob | null = null;
  duration = 0;
  interrupted = false;
  readonly recorder: MediaRecorder;
  readonly id: string;
  readonly owner: string | null;
  private persist: (id: string, blob: Blob, meta: {duration:number;status:string;userId:string|null;startedAt:string}, owner:string|null) => Promise<void>;
  private changed: () => void;
  constructor(recorder: MediaRecorder, id: string, owner: string | null,
    persist: RecordingSession['persist'], changed: () => void) {
    this.recorder=recorder;this.id=id;this.owner=owner;this.persist=persist;this.changed=changed;
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size) { this.chunks.push(event.data); this.checkpoint('recording'); }
    });
    recorder.addEventListener('stop', async () => {
      this.checkpoint(this.interrupted ? 'interrupted' : 'captured');
      await this.writes;
      recorder.stream.getTracks().forEach(track => track.stop());
      this.finish();
    });
    recorder.addEventListener('error', () => this.stop(true));
  }
  private checkpoint(status: string) {
    this.duration = (performance.now() - this.started) / 1000;
    this.blob = new Blob(this.chunks, {type:this.recorder.mimeType || 'audio/webm'});
    const blob = this.blob, duration = this.duration;
    if (!blob.size) return;
    this.writes = this.writes.then(async () => {
      try {
        await this.persist(this.id, blob, {duration,status,userId:this.owner,startedAt:this.startedAt}, this.owner);
        this.durable = true; this.error = '';
      } catch {
        this.durable = false;
        this.error = 'Audio could not be saved on this device. Keep this page open. Finish, then retry Keep this Echo or download your recording.';
      }
      this.changed();
    });
  }
  stop(interrupted = false) {
    this.interrupted ||= interrupted;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    return this.finished;
  }
}
