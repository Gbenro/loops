import type { Echo, Scenario, LoopStatus } from './contracts.ts';
import { createMockServices, makeId, filterEchoes } from './mock-services.ts';
import { createLiveLunaServices } from './live-services.ts';
import { getLiveLunarData } from './lunar-engine.ts';
import { initialState, parseRoute } from './state.ts';
import { PHASES, DEMO_CONTEXT } from './fixtures.ts';
import { escapeHtml, icon, waveform, liveWave, playbackWave, orbitRings, timecode, formatMoment } from './visuals.ts';
import { shell, echoRow, emptyState } from './components.ts';
import { routeView } from './views.ts';
import { VoiceEngine } from './voice-engine.ts';
import { sampleEnvelope, clamp01 } from './audio-geometry.ts';
import type { WaveAnalysis } from './audio-geometry.ts';

declare const LUNA_AUDIO_ASSETS: Record<string,string>;
const services=createLiveLunaServices(LUNA_AUDIO_ASSETS);
const state=initialState();
const root=document.getElementById('app')!;
const modal=document.getElementById('modal') as HTMLDialogElement;
const toastEl=document.getElementById('toast')!;
let toastTimer:ReturnType<typeof setTimeout>;
let generation=0;
const drafts:Record<string,string>={};
const localAudioUrls=new Set<string>();
const audio=new Audio();
audio.preload='metadata';
let audioEchoId='';
let activeWaveform:number[]=[];
let activeDuration=0;
let playbackFrame=0;
let previewFrame=0;
let pendingSeek:number|null=null;
const voiceEngine=new VoiceEngine();
let recordingAnalysis:WaveAnalysis={waveform:[],source:'unavailable',duration:0};
let recordingFinalizing=false;
let inputVisualAvailable=false;
let audioAttempt=0;
let captureMode:'voice'|'text'='voice';
let captureTitle='';
let captureText='';
let recorder:MediaRecorder|null=null;
let stream:MediaStream|null=null;
let chunks:BlobPart[]=[];
let recordingBlob:Blob|null=null;
let recordingUrl='';
let recordingDuration=0;
let recordStarted=0;
let recordInterval:ReturnType<typeof setInterval>|undefined;
let captureToken=0;
let captureActive=false;
let recordedSaved=false;
let focusBeforeModal:HTMLElement|null=null;
let submitting=false;

function currentDb(){const db=services.snapshot();if(state.scenario==='empty'){db.echoes=db.echoes.filter(e=>e.provenance==='local-session');db.loops=db.loops.filter(l=>l.provenance==='local-session');db.reflections=db.reflections.filter(r=>r.provenance==='local-session');db.threads=[];}return db;}
function applyRoute(){state.route=parseRoute(location.hash);const p=state.route.query.get('phase');const c=state.route.query.get('cycle');if(p&&PHASES.some(x=>x.id===p))state.phase=p as any;if(c&&services.snapshot().cycles.some(x=>x.id===c))state.cycleId=c;}
function isSampleMode():boolean{return Boolean(services.isSampleMode&&services.isSampleMode());}
function render(focusMain=false){
  const sample=isSampleMode();
  const user=services.auth?.getUser?.()||null;
  const isAuthenticated=Boolean(user);
  root.innerHTML=shell(state.route.name,routeView(currentDb(),state,sample,isAuthenticated),sample,user);
  for(const [id,value] of Object.entries(drafts)){const el=document.getElementById(id);if(el instanceof HTMLTextAreaElement)el.value=value;}
  if(focusMain)document.getElementById('main')?.focus({preventScroll:true});
  syncAudioUI();
  void primeEchoAudio();
  document.title=`Luna · ${state.route.name==='field'?'A living personal field':state.route.name.charAt(0).toUpperCase()+state.route.name.slice(1)}`;
}
function toast(message:string){clearTimeout(toastTimer);toastEl.textContent=message;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),4800);}
function go(path:string){if(location.hash===`#/${path}`){applyRoute();render(true);}else location.hash=`/${path}`;}
function showModal(title:string,content:string){
  if(!modal.open)focusBeforeModal=document.activeElement as HTMLElement;
  modal.innerHTML=`<div class="dialog-inner"><header class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></header>${content}</div>`;
  modal.classList.remove('capture-dialog');
  modal.setAttribute('aria-labelledby','dialog-title');
  if(!modal.open)modal.showModal();
}
function closeModal(){if(modal.open)modal.close();}
modal.addEventListener('close',()=>{cleanupCapture();focusBeforeModal?.focus?.({preventScroll:true});});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
function cleanupCapture(){
  captureToken++;captureActive=false;clearInterval(recordInterval);voiceEngine.stop();cancelAnimationFrame(previewFrame);
  modal.querySelector<HTMLAudioElement>('#recording-preview')?.pause();
  recordingAnalysis={waveform:[],source:'unavailable',duration:0};recordingFinalizing=false;inputVisualAvailable=false;
  if(recorder&&recorder.state!=='inactive')recorder.stop();
  stream?.getTracks().forEach(track=>track.stop());stream=null;recorder=null;
  if(recordingUrl&&!recordedSaved){URL.revokeObjectURL(recordingUrl);localAudioUrls.delete(recordingUrl);}
  recordingUrl='';recordingBlob=null;recordingDuration=0;recordedSaved=false;
}
function keepCaptureInputs(){const title=modal.querySelector<HTMLInputElement>('#capture-title');const body=modal.querySelector<HTMLTextAreaElement>('#capture-body');if(title)captureTitle=title.value;if(body)captureText=body.value;}
function openCapture(mode:'voice'|'text'){stopPlayback();cleanupCapture();captureMode=mode;captureTitle='';captureText='';captureActive=true;renderCapture();}
function renderCapture(error=''){
  const running=recorder?.state==='recording';
  const ready=!!recordingUrl&&!recordingFinalizing;
  const action=running?'record-stop':ready?'preview-toggle':'record-start';
  const label=running?'Finish recording':ready?'Play your recording':'Begin recording';
  const source=running?(inputVisualAvailable?'Live microphone waveform':'Recording · waveform unavailable'):recordingFinalizing?'Preparing your waveform…':ready?(recordingAnalysis.source==='decoded-audio'?'Waveform derived from your recording':recordingAnalysis.source==='capture-levels'?'Measured input envelope':'Playback ready'):'Your voice, in its own time.';
  showModal('Enter through your voice.',`<p class="dialog-description">A moment begins with you.</p><div class="capture-mode"><div class="segmented" aria-label="Echo format"><button type="button" data-action="capture-mode" data-value="voice" aria-pressed="${captureMode==='voice'}">${icon('mic',14)} Speak</button><button type="button" data-action="capture-mode" data-value="text" aria-pressed="${captureMode==='text'}">${icon('write',14)} Write</button></div></div><form data-form="capture">${captureMode==='voice'?`<section class="recording-stage circular-stage ${running?'active':''}"><div class="capture-orbit" id="capture-orbit"><button class="record-orb" type="button" data-action="${action}" aria-label="${label}" ${recordingFinalizing?'disabled':''}>${orbitRings(running?recordingDuration/120*100:0)}<span class="record-orb-icon">${icon(running?'stop':ready?'play':'mic',21)}</span><span class="orb-wave">${ready?playbackWave(recordingAnalysis.waveform,'capture-wave'):liveWave()}</span><span class="record-time" id="record-timer">${timecode(recordingDuration)}</span><span class="record-orb-label">${recordingFinalizing?'Preparing':running?'Tap to finish':ready?'Listen again':'Tap to begin'}</span></button><span class="recording-orbit-dot" aria-hidden="true"></span><div data-voice-level class="voice-level" aria-hidden="true">${running?'Listening to input':ready?'A moment, held in your voice':'Ready when you are'}</div></div><p class="record-source" id="recording-source" role="status">${source}</p>${ready?`<audio id="recording-preview" controls src="${recordingUrl}" aria-label="Preview and seek in your recording"></audio><button class="text-link" type="button" data-action="record-again">${icon('return',14)}Record again</button>`:''}<p class="audio-caption">Up to 2 minutes · saved to your field<br>${running?'Audio is held safely on your device.':'Microphone access is requested when you begin.'}</p></section>`:''}<label class="form-field"><span>A few words to find this again <span class="muted">(optional)</span></span><input id="capture-title" name="title" class="text-input" maxlength="120" placeholder="A title, if one comes to mind" value="${escapeHtml(captureTitle)}"></label><label class="form-field"><span>${captureMode==='text'?'What is here?':'A note or your own transcript (optional)'}</span><textarea id="capture-body" name="body" maxlength="6000" placeholder="${captureMode==='text'?'Start anywhere…':'Add words alongside your recording…'}" ${captureMode==='text'?'required':''}>${escapeHtml(captureText)}</textarea></label><div id="capture-error" class="form-error" role="alert">${escapeHtml(error)}</div><div class="form-foot"><small>Saved to your personal living field.<br>Held in real-time astronomical rhythm.</small><button class="btn primary" type="submit" ${captureMode==='voice'&&(!ready||running)?'disabled':''}>Keep this Echo ${icon('arrow',15)}</button></div></form>`);
  modal.classList.toggle('capture-dialog',captureMode==='voice');
  if(captureMode==='text')modal.querySelector<HTMLTextAreaElement>('#capture-body')?.focus();
  if(ready)bindRecordingPreview();
}
function bindRecordingPreview(){
  const preview=modal.querySelector<HTMLAudioElement>('#recording-preview');if(!preview)return;
  const update=()=>{const root=modal.querySelector<HTMLElement>('#capture-orbit');if(!root)return;const duration=Number.isFinite(preview.duration)&&preview.duration>0?preview.duration:recordingDuration;const progress=duration?preview.currentTime/duration:0;updateWaveProgress(root,progress);const active=!preview.paused;root.style.setProperty('--voice-energy',String(active&&!matchMedia('(prefers-reduced-motion: reduce)').matches?sampleEnvelope(recordingAnalysis.waveform,progress):0));const glyph=root.querySelector('.record-orb-icon');if(glyph)glyph.innerHTML=icon(active?'pause':'play',21);const btn=root.querySelector('button');btn?.setAttribute('aria-label',active?'Pause your recording':'Play your recording');const timer=document.getElementById('record-timer');if(timer)timer.textContent=timecode(preview.currentTime||0);};
  let last=0;const tick=(now:number)=>{if(preview.paused||!preview.isConnected)return;if(now-last>33){last=now;update();}previewFrame=requestAnimationFrame(tick);};
  preview.addEventListener('play',()=>{cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(tick);update();});
  for(const event of ['timeupdate','seeked','loadedmetadata','pause','ended'])preview.addEventListener(event,()=>{if(preview.paused)cancelAnimationFrame(previewFrame);update();});
  preview.addEventListener('error',()=>toast('This recording cannot be played by this browser. You can keep the local Echo or record again.'));
}
async function startRecording(){
  keepCaptureInputs();
  if(state.forceMicDenied){renderCapture('Microphone permission denied — simulated review state. Choose Write, or turn this simulation off in review notes.');return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){renderCapture('Recording is unavailable in this browser context. Writing still works. For microphone access, open the prototype from localhost or a supported secure browser context.');return;}
  const button=modal.querySelector<HTMLButtonElement>('[data-action="record-start"]');if(button){button.disabled=true;button.setAttribute('aria-label','Requesting microphone access');const label=button.querySelector('.record-orb-label');if(label)label.textContent='Connecting…';}const pendingSource=document.getElementById('recording-source');if(pendingSource)pendingSource.textContent='Waiting for microphone access…';
  const token=++captureToken;
  await voiceEngine.prepare();
  if(token!==captureToken||!captureActive){if(!captureActive)voiceEngine.stop();return;}
  try{
    const requested=await navigator.mediaDevices.getUserMedia({audio:true});
    if(token!==captureToken||!captureActive||!modal.open){requested.getTracks().forEach(t=>t.stop());return;}
    stream=requested;chunks=[];recordingDuration=0;
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    const activeRecorder=recorder;
    activeRecorder.ondataavailable=e=>{if(token===captureToken&&e.data.size)chunks.push(e.data);};
    activeRecorder.onerror=()=>{requested.getTracks().forEach(t=>t.stop());if(token!==captureToken)return;captureToken++;clearInterval(recordInterval);voiceEngine.stop();recorder=null;renderCapture('Recording stopped unexpectedly. Please try again, or write this Echo.');};
    activeRecorder.onstop=async()=>{
      clearInterval(recordInterval);requested.getTracks().forEach(t=>t.stop());
      if(token!==captureToken||!captureActive)return;
      voiceEngine.stop();
      const blob=new Blob(chunks,{type:activeRecorder.mimeType||'audio/webm'});
      recordingBlob=blob;
      if(!blob.size){recorder=null;renderCapture('No audio was captured. Please try again or write instead.');return;}
      recordingUrl=URL.createObjectURL(blob);localAudioUrls.add(recordingUrl);recorder=null;recordingFinalizing=true;renderCapture();
      const analysis=await voiceEngine.analyse(blob,recordingDuration);
      if(token!==captureToken||!captureActive)return;
      recordingAnalysis=analysis;recordingDuration=analysis.duration;recordingFinalizing=false;renderCapture();
    };
    activeRecorder.start(250);recordStarted=performance.now();renderCapture();
    inputVisualAvailable=voiceEngine.start(requested,document.getElementById('capture-orbit')!);
    const recordSource=document.getElementById('recording-source');if(recordSource)recordSource.textContent=inputVisualAvailable?(matchMedia('(prefers-reduced-motion: reduce)').matches?'Live microphone level · reduced motion':'Live microphone waveform'):'Recording · live visualization unavailable in this browser';
    modal.querySelector<HTMLButtonElement>('[data-action="record-stop"]')?.focus();
    recordInterval=setInterval(()=>{recordingDuration=(performance.now()-recordStarted)/1000;const timer=document.getElementById('record-timer');if(timer)timer.textContent=timecode(recordingDuration);const arc=modal.querySelector('[data-orbit-progress]');arc?.setAttribute('stroke-dasharray',`${recordingDuration/120*100} 100`);if(recordingDuration>=120)stopRecording();},200);
  }catch(error){voiceEngine.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;if(token!==captureToken)return;const name=(error as Error).name;renderCapture(name==='NotAllowedError'||name==='SecurityError'?'Microphone access was not granted. You can write instead, or allow microphone access in your browser and try again.':name==='NotFoundError'?'No microphone was found. You can write instead or connect a microphone.':'The microphone could not be started. Try again or write this Echo.');}
}
function stopRecording(){keepCaptureInputs();if(recorder?.state==='recording'){recordingDuration=Math.min(120,(performance.now()-recordStarted)/1000);recorder.stop();clearInterval(recordInterval);}}
function openNewLoop(){showModal('Leave an intention.',`<p class="dialog-description">A small gesture, a question, a direction to follow.</p><form data-form="loop"><label class="form-field"><span>What would you like to leave open?</span><input class="text-input" name="title" maxlength="120" placeholder="Something I want to return to…" required autofocus></label><label class="form-field"><span>A little context (optional)</span><textarea name="note" maxlength="600" placeholder="There is no deadline here."></textarea></label><div class="form-foot"><small>Held in your personal field.</small><button class="btn primary" type="submit">Leave it open ${icon('loop',15)}</button></div></form>`);}
function openContextPicker(){const db=currentDb();showModal('Bring a moment with you.',`<p class="dialog-description">Select the Echoes you want to explore with Luna.</p><form data-form="chat-context"><div class="checkbox-list">${db.echoes.map(e=>`<label class="checkbox-row"><input type="checkbox" name="echo" value="${e.id}" ${state.chatContext.includes(e.id)?'checked':''}><span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(formatMoment(e.occurredAt))} · ${escapeHtml(e.context.label)}</small></span></label>`).join('')||'<p class="small muted">No Echoes available in this view.</p>'}</div><div class="form-foot"><small>Select Echoes to include in this reflection.</small><button class="btn primary" type="submit">Use selected context</button></div></form>`);}
function openThreadPicker(id:string){const db=currentDb();showModal('Make a connection.',`<p class="dialog-description">Choose a Thread that feels relevant. The connection comes from you.</p><form data-form="thread-link" data-id="${id}"><label class="form-field"><span>Thread</span><select name="thread" class="inline-select" required>${db.threads.map(t=>`<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('')}</select></label><div class="form-foot"><small>Held in your personal field.</small><button class="btn primary" type="submit" ${db.threads.length?'':'disabled'}>Connect Echo ${icon('thread',15)}</button></div></form>`);}
function openReview(){showModal('Luna Field Guide & Shortcuts',`<p class="dialog-description">One field. Many ways of seeing.</p><div class="notice"><strong>Luna Living Field</strong><br>Real-time Jean Meeus ephemeris, live recording, and personalized cycles. In live mode, your data synchronizes two-way with Classic Luna and Supabase.</div><h3 style="margin-top:20px">How to explore</h3><p class="small muted" style="margin-top:8px">Visit <strong>Sky</strong> for the realistic photographic moon, cosmic tide, and wisdom sheet. Begin with <strong>Speak</strong> in the Field to capture an Echo with live waveforms. Follow your intentions in <strong>Loops</strong> or see how moments weave together across cycles in <strong>Returns</strong>.</p><div class="review-divider"><h3>Keyboard & Touch Shortcuts</h3><p class="small muted"><strong>1-4</strong> or <strong>Arrow keys</strong> in Cycles view change phases. <strong>Esc</strong> closes dialogs. <strong>Theme toggle</strong> switches between Dark and Light.</p></div><div class="review-divider"><p class="small muted">Desktop: use the left navigation. Mobile: Sky, Field, Voice, Echoes, and Luna are in the bottom bar.</p><button class="text-link" data-action="reset-open">${icon('return',15)}Reset session draft cache</button></div>`);}
function openSignInModal(){showModal('Sign in to Luna',`<p class="dialog-description">Connect to your Luna account to access your personal Field, Echoes, and Loops.</p><form data-form="auth" style="display:flex;flex-direction:column;gap:14px;margin-top:12px"><label class="form-field"><span>Email</span><input class="text-input" name="email" type="email" autocomplete="email" required placeholder="you@domain.com" autofocus></label><label class="form-field"><span>Password</span><input class="text-input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label><div id="auth-error" style="color:#ef4444;font-size:12px;min-height:16px"></div><div class="form-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Sign in & Sync</button></div><p style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:8px">Or visit <a href="/" class="gold" style="text-decoration:none">Classic Luna</a> (Sky tab) to create an account.</p></form>`);}
function openAccountModal(user:{id:string;email?:string}){showModal('Your Luna Account',`<div style="display:flex;flex-direction:column;gap:16px;margin-top:8px"><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);color:#34d399;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px">${(user.email?user.email.charAt(0):'U').toUpperCase()}</div><div><div style="font-weight:500;font-size:14px">${escapeHtml(user.email||'Luna Member')}</div><div style="font-size:11px;color:var(--color-text-muted)">Connected to Supabase Live Sync</div></div></div><div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:12px"><div style="display:flex;justify-content:space-between"><span style="color:var(--color-text-muted)">User ID</span><span style="font-family:monospace;font-size:11px">${escapeHtml(user.id.slice(0,12))}…</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--color-text-muted)">Sync status</span><span style="color:#34d399">Active · Two-way with Classic Luna</span></div></div><div class="form-foot" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><button type="button" class="btn" data-action="auth-sync">Sync Now</button><button type="button" class="btn" data-action="auth-signout" style="background:rgba(239,68,68,0.15);color:#ef4444;border-color:rgba(239,68,68,0.25)">Sign out</button></div></div>`);}
function updateWaveProgress(container:ParentNode,progress:number){const ratio=clamp01(progress);container.querySelectorAll('[data-wave-progress]').forEach(el=>el.setAttribute('width',String(ratio*720)));container.querySelectorAll('[data-wave-cursor]').forEach(el=>{el.setAttribute('x1',String(ratio*720));el.setAttribute('x2',String(ratio*720));});container.querySelectorAll('[data-orbit-progress]').forEach(el=>el.setAttribute('stroke-dasharray',`${ratio*100} 100`));}
function stopPlayback(){audioAttempt++;cancelAnimationFrame(playbackFrame);audio.pause();try{audio.currentTime=0;}catch{}audioEchoId='';activeWaveform=[];activeDuration=0;pendingSeek=null;}
async function primeEchoAudio(){
  if(state.route.name!=='echo')return;const echo=currentDb().echoes.find(e=>e.id===state.route.id);if(!echo||echo.kind!=='voice'||audioEchoId===echo.id)return;
  const attempt=++audioAttempt;const source=await services.audio.resolve(echo);if(attempt!==audioAttempt||state.route.name!=='echo'||state.route.id!==echo.id||!source)return;
  audio.pause();audioEchoId=echo.id;activeWaveform=echo.waveform||[];activeDuration=echo.duration||0;audio.src=source;syncAudioUI();
}
async function playEcho(id:string){
  if(audioEchoId===id&&audio.src){if(audio.paused){try{await audio.play();}catch{toast('Playback could not start. Try again in a supported browser.');}}else audio.pause();syncAudioUI();return;}
  const attempt=++audioAttempt;audio.pause();
  try{const echo=await services.echoes.get(id);const source=await services.audio.resolve(echo);if(attempt!==audioAttempt)return;if(!source){toast('No playable audio is available for this Echo.');return;}audioEchoId=id;activeWaveform=echo.waveform||[];activeDuration=echo.duration||0;audio.src=source;audio.currentTime=0;await audio.play();syncAudioUI();}catch{toast('Audio could not be played. Your original words remain available.');}
}
function syncAudioUI(){
  const currentButton=document.querySelector<HTMLButtonElement>('[data-action="play"]');if(!currentButton)return;const active=currentButton.dataset.id===audioEchoId;const playing=active&&!audio.paused;currentButton.innerHTML=icon(playing?'pause':'play',23);currentButton.setAttribute('aria-label',`${playing?'Pause':'Play'} Original Voice`);
  if(!active)return;const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;const current=audio.currentTime||0;const progress=duration?current/duration:0;const input=document.getElementById('audio-seek') as HTMLInputElement|null;if(input){input.max=String(duration||30);input.value=String(current);input.setAttribute('aria-valuetext',`${timecode(current)} of ${timecode(duration)}`);}const currentEl=document.getElementById('audio-current');if(currentEl&&currentEl.textContent!==timecode(current))currentEl.textContent=timecode(current);const durationEl=document.getElementById('audio-duration');if(durationEl&&duration)durationEl.textContent=timecode(duration);
  const player=document.querySelector<HTMLElement>('.original-voice');if(player){updateWaveProgress(player,progress);player.classList.toggle('is-playing',playing);player.style.setProperty('--voice-energy',String(playing&&!matchMedia('(prefers-reduced-motion: reduce)').matches?sampleEnvelope(activeWaveform,progress):0));}
}
let lastPlaybackDraw=0;
function drawPlayback(now:number){if(audio.paused)return;if(now-lastPlaybackDraw>33){lastPlaybackDraw=now;if(!document.hidden)syncAudioUI();}playbackFrame=requestAnimationFrame(drawPlayback);}
for(const event of ['timeupdate','loadedmetadata','play','pause','ended','seeked'])audio.addEventListener(event,syncAudioUI);
audio.addEventListener('play',()=>{cancelAnimationFrame(playbackFrame);playbackFrame=requestAnimationFrame(drawPlayback);});
for(const event of ['pause','ended'])audio.addEventListener(event,()=>cancelAnimationFrame(playbackFrame));
audio.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){try{audio.currentTime=pendingSeek;pendingSeek=null;}catch{}}});
audio.addEventListener('error',()=>toast('This audio could not be loaded. You can still read the transcript.'));

document.addEventListener('click',async(event)=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action!;const value=target.dataset.value||'';const id=target.dataset.id||'';
  try{
    switch(action){
      case 'skip':document.getElementById('main')?.focus();document.getElementById('main')?.scrollIntoView({block:'start'});break;
      case 'menu':{const open=document.getElementById('sidebar')?.classList.toggle('mobile-open');target.setAttribute('aria-expanded',String(open));break;}
      case 'theme':{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('luna-exploration-theme',theme);}catch{}render();break;}
      case 'review':openReview();break;
      case 'open-auth':{const u=services.auth?.getUser?.();if(u)openAccountModal(u);else openSignInModal();break;}
      case 'auth-signout':{await services.auth?.signOut?.();closeModal();render(true);toast('Signed out of your Luna Field.');break;}
      case 'auth-sync':{closeModal();toast('Synchronizing with your Luna account...');await services.sync?.();render(true);toast('Your Field is synchronized.');break;}
      case 'toggle-sample-mode':{const active=isSampleMode();services.setSampleMode?.(!active);render(true);toast(!active?'Exploring sample field with illustrative data.':'Returned to your personal living field.');break;}
      case 'close-modal':closeModal();break;
      case 'capture-voice':openCapture('voice');await startRecording();break;
      case 'capture-entrance':openCapture('voice');break;
      case 'capture-text':openCapture('text');break;
      case 'capture-mode':keepCaptureInputs();cleanupCapture();captureActive=true;captureMode=value as any;renderCapture();break;
      case 'record-start':await startRecording();break;
      case 'record-stop':stopRecording();break;
      case 'preview-toggle':{const preview=modal.querySelector<HTMLAudioElement>('#recording-preview');if(preview){if(preview.paused)await preview.play();else preview.pause();}break;}
      case 'record-again':keepCaptureInputs();cleanupCapture();captureActive=true;renderCapture();break;
      case 'new-loop':openNewLoop();break;
      case 'echo-kind':state.echoKind=value as any;render();document.querySelector<HTMLElement>(`[data-action="echo-kind"][data-value="${value}"]`)?.focus();break;
      case 'loop-filter':state.loopFilter=value as any;render();document.querySelector<HTMLElement>(`[data-action="loop-filter"][data-value="${value}"]`)?.focus();break;
      case 'phase':state.phase=value as any;history.replaceState(null,'',`#/cycles?cycle=${state.cycleId}&phase=${state.phase}`);applyRoute();render();document.querySelector<HTMLElement>(`[data-action="phase"][data-value="${value}"]`)?.focus();break;
      case 'time':state.time=value;render();document.querySelector<HTMLElement>(`[data-action="time"][data-value="${value}"]`)?.focus();break;
      case 'connect-thread':openThreadPicker(id);break;
      case 'play':await playEcho(id);break;
      case 'chat-about':state.chatContext=[id];go('chat');break;
      case 'chat-return':{const pair=(target.dataset.pair||'').split(',').filter(Boolean);state.chatContext=pair;go('chat');break;}
      case 'chat-context':openContextPicker();break;
      case 'remove-context':state.chatContext=state.chatContext.filter(x=>x!==id);render();break;
      case 'chat-prompt':{const input=document.getElementById('chat-input') as HTMLTextAreaElement;input.value=value;drafts['chat-input']=value;input.focus();break;}
      case 'scenario':state.scenario=value as Scenario;closeModal();stopPlayback();go('field');render(true);toast(value==='ready'?'Field restored.':`Reviewing the ${value} state.`);break;
      case 'retry':state.scenario='ready';render(true);toast('Your Field is available again.');break;
      case 'go-echoes':go('echoes');break;
      case 'go-threads':go('threads');break;
      case 'go-field':go('field');break;
      case 'open-deep-sheet':state.deepSheetOpen=true;render();break;
      case 'close-deep-sheet':state.deepSheetOpen=false;render();break;
      case 'deep-sheet-tab':state.deepSheetTab=value as any;render();break;
      case 'reset-open':showModal('Clear local session cache?',`<p class="dialog-description">This resets local draft caches held in memory.</p><div class="form-foot"><button class="btn" data-action="close-modal">Keep exploring</button><button class="btn primary" data-action="reset-confirm">Reset cache</button></div>`);break;
      case 'reset-confirm':generation++;stopPlayback();closeModal();localAudioUrls.forEach(url=>URL.revokeObjectURL(url));localAudioUrls.clear();services.reset();Object.keys(drafts).forEach(key=>delete drafts[key]);state.chat=[];state.chatContext=[];state.chatBusy=false;state.scenario='ready';state.search='';state.echoKind='all';state.loopFilter='unfolding';go('field');render(true);toast('Local session cache cleared.');break;
    }
  }catch(error){toast((error as Error).message||'That action could not finish. Please try again.');}
});

document.addEventListener('input',event=>{
  const el=event.target as HTMLInputElement|HTMLTextAreaElement;
  if(el instanceof HTMLTextAreaElement&&el.id&&!modal.contains(el))drafts[el.id]=el.value;
  if(el.id==='echo-search'){
    state.search=el.value;const db=currentDb();const query=state.route.query;let list=filterEchoes(db.echoes,{search:state.search,cycleId:query.get('cycle')||undefined,phaseId:(query.get('phase')||undefined) as any});if(state.echoKind!=='all')list=list.filter(e=>e.kind===state.echoKind);const results=document.getElementById('echo-results');if(results)results.innerHTML=list.length?list.map(e=>echoRow(e)).join(''):emptyState('No Echoes match those words.','Try another word, or clear your search.','','');
  }
  if(el.id==='audio-seek'&&audioEchoId){const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;const target=Math.min(duration,Number(el.value));try{audio.currentTime=target;}catch{pendingSeek=target;}syncAudioUI();}
});
document.addEventListener('change',async(event)=>{
  const el=event.target as HTMLSelectElement|HTMLInputElement;
  try{
    if(el.dataset.loopId){await services.loops.transition(el.dataset.loopId,el.value as LoopStatus);render();toast('Your intention has room to change.');}
    if(el.id==='cycle-select'){state.cycleId=el.value;go(`cycles?cycle=${state.cycleId}&phase=${state.phase}`);}
    if(el.id==='mic-denial')state.forceMicDenied=(el as HTMLInputElement).checked;
  }catch(error){toast((error as Error).message);}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.getElementById('sidebar')?.classList.remove('mobile-open');
  const target=event.target as HTMLElement;if(target.dataset.action==='phase'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const i=PHASES.findIndex(p=>p.id===state.phase);const next=event.key==='Home'?0:event.key==='End'?7:(i+(event.key==='ArrowRight'?1:7))%8;document.querySelector<HTMLButtonElement>(`[data-action="phase"][data-value="${PHASES[next].id}"]`)?.click();}
});
document.addEventListener('submit',async(event)=>{
  const form=(event.target as HTMLElement).closest<HTMLFormElement>('form[data-form]');if(!form)return;event.preventDefault();if(submitting)return;
  const data=new FormData(form);const submit=form.querySelector<HTMLButtonElement>('[type="submit"]');submitting=true;if(submit)submit.disabled=true;
  try{
    switch(form.dataset.form){
      case 'auth':{
        const email=String(data.get('email')||'').trim();
        const password=String(data.get('password')||'');
        const errorEl=document.getElementById('auth-error');
        if(errorEl)errorEl.textContent='';
        try{
          toast('Signing in to Luna...');
          await services.auth?.signIn?.(email,password);
          closeModal();
          render(true);
          toast('Welcome back! Your personal Field is synchronized.');
        }catch(err){
          if(errorEl)errorEl.textContent=(err as Error).message||'Invalid email or password.';
          toast('Sign in failed: '+((err as Error).message||'Invalid credentials'));
        }
        break;
      }
      case 'capture':{keepCaptureInputs();const echo=await services.echoes.create({title:captureTitle,body:captureText,kind:captureMode,audioUrl:recordingUrl||undefined,audioBlob:recordingBlob||undefined,duration:recordingDuration||undefined,waveform:recordingAnalysis.waveform,waveformSource:recordingAnalysis.source,context:services.snapshot().current});recordedSaved=true;closeModal();go(`echo/${echo.id}`);toast('Your Echo is here.');break;}
      case 'loop':{await services.loops.create(String(data.get('title')||''),String(data.get('note')||''));closeModal();state.loopFilter='unfolding';go('loops');render();toast('An intention held in your field.');break;}
      case 'reflection':{await services.reflections.add(form.dataset.id!,String(data.get('body')||''));const input=form.querySelector<HTMLTextAreaElement>('textarea')!;delete drafts[input.id];input.value='';render();toast('Your reflection is alongside the original.');break;}
      case 'thread-link':{await services.threads.linkEcho(String(data.get('thread')),form.dataset.id!);closeModal();render();toast('Connected by you.');break;}
      case 'chat-context':state.chatContext=data.getAll('echo').map(String);closeModal();render();break;
      case 'chat':{
        const message=String(data.get('message')||'').trim();if(!message)return;const token=generation;const context=[...state.chatContext];state.chat.push({id:makeId('message'),role:'person',content:message,echoIds:context});delete drafts['chat-input'];state.chatBusy=true;render();
        await new Promise(resolve=>setTimeout(resolve,550));const response=await services.chat.respond(message,context);if(token!==generation)return;state.chat.push(response);state.chatBusy=false;if(state.route.name==='chat'){render();document.getElementById('chat-input')?.focus({preventScroll:true});document.getElementById('chat-input')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}break;
      }
    }
  }catch(error){state.chatBusy=false;const errorEl=document.getElementById('capture-error');if(modal.open&&errorEl)errorEl.textContent=(error as Error).message;else toast((error as Error).message||'That could not be kept. Please try again.');}
  finally{submitting=false;if(submit?.isConnected)submit.disabled=false;}
});
window.addEventListener('hashchange',()=>{stopPlayback();applyRoute();render(true);window.scrollTo({top:0,behavior:'instant'});});
window.addEventListener('offline',()=>render());window.addEventListener('online',()=>render());
window.addEventListener('pagehide',()=>{cleanupCapture();voiceEngine.dispose();cancelAnimationFrame(playbackFrame);audio.pause();localAudioUrls.forEach(url=>URL.revokeObjectURL(url));});
try{const theme=localStorage.getItem('luna-exploration-theme');if(theme==='light')document.documentElement.dataset.theme='light';}catch{}
applyRoute();render();

if(services.sync){services.sync().then(()=>render()).catch(()=>{});}
window.addEventListener('online',()=>{services.sync?.().then(()=>render()).catch(()=>{});});
