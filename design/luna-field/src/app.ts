import { ECHO_PAGE_SIZE, echoTimeQuery, matchesEchoQuery } from './echo-browse.ts';
import { mergeChatHistory, replyForTurn } from './chat-recovery.ts';
import { prepareChatSpeech } from './speech-text.ts';
import { voiceCaptureConstraints, createVoiceRecorder } from './audio-capture.ts';
import { createFieldRealtime } from './realtime-sync.ts';
import { mountJourney } from './journey-ui.mjs';
import { journeyMarkup } from './journey-view.ts';
import type { Echo, Scenario, LoopStatus } from './contracts.ts';
import { createMockServices, makeId, filterEchoes } from './mock-services.ts';
import { createLiveLunaServices, saveDraftAudio, getDraftAudio, listDraftRecordings, getAuthSession, ECHOES_KEY } from './live-services.ts';
import { getLiveLunarData } from './lunar-engine.ts';
import { initialState, parseRoute } from './state.ts';
import { PHASES, DEMO_CONTEXT } from './fixtures.ts';
import { escapeHtml, icon, waveform, liveWave, playbackWave, orbitRings, timecode, formatMoment } from './visuals.ts';
import { shell, echoRow, emptyState } from './components.ts';
import { routeView, echoesView } from './views.ts';
import { RecordingSession } from './recording-session.ts';
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
let isScrubbing=false;
let chatLoadingPromise:Promise<void>|null=null;
let lastUserMessage='';
let lastChatContext:string[]=[];
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
let captureCompact=false;
let recordingStarting=false;
let captureTapTimer:ReturnType<typeof setTimeout>|null=null;
function cancelCaptureTap(){if(captureTapTimer)clearTimeout(captureTapTimer);captureTapTimer=null;}
function captureIsRecording(){return captureActive&&(recordingStarting||recorder?.state==='recording');}
function allowPlayback(){if(!captureIsRecording())return true;toast('Finish your recording before playing audio.');return false;}
let recordedSaved=false;
let focusBeforeModal:HTMLElement|null=null;
let submitting=false;
let wakeLock:any=null;
let wakeLockToken=0;
let currentDraftId='';
let recordingSession:RecordingSession|null=null;
let recordingOwner:string|null=null;
let recordingStartedAt='';
let storageError='';
let recoveryItems:Awaited<ReturnType<typeof listDraftRecordings>>=[];
async function refreshRecovery(){
  recoveryItems=(await listDraftRecordings()).filter(d=>d.id.startsWith('draft_')&&['draft','recording','captured','interrupted'].includes(d.status||''));
  document.getElementById('draft-recovery')?.remove();
  if(recoveryItems.length){const button=document.createElement('button');button.id='draft-recovery';button.className='nav-item';button.dataset.action='recover-list';button.textContent='Recover recording ('+recoveryItems.length+')';root.querySelector('#menu-recovery')?.append(button);}
}
async function openRecovery(){
  await refreshRecovery();
  showModal('Recover a recording', '<p class="dialog-description">These recordings have not been kept as Echoes. Listen before keeping or discarding.</p>'+recoveryItems.map(d=>'<div class="form-foot"><span>'+escapeHtml(formatMoment(d.startedAt||d.updatedAt||''))+' · '+timecode(d.duration||0)+'</span><button class="btn" data-action="recover-draft" data-id="'+escapeHtml(d.id)+'">Listen and recover</button><button class="text-link" data-action="discard-draft" data-id="'+escapeHtml(d.id)+'">Discard</button></div>').join(''));
}
async function recoverDraft(id:string){
  const owner=getAuthSession().userId;
  const item=recoveryItems.find(d=>d.id===id),draft=await getDraftAudio(id,owner);
  if(owner!==getAuthSession().userId||!draft?.blob)throw new Error('This recording is not available in this account.');
  openCapture('voice');currentDraftId=id;recordingOwner=owner;recordingStartedAt=item?.startedAt||item?.updatedAt||new Date().toISOString();
  recordingBlob=draft.blob;recordingDuration=draft.duration||0;recordingUrl=URL.createObjectURL(draft.blob);localAudioUrls.add(recordingUrl);
  recordingAnalysis=await voiceEngine.analyse(draft.blob,recordingDuration);
  if(owner!==getAuthSession().userId)return;
  renderCapture();
}


type PendingChatTurn={id:string;message:string;echoIds:string[];modelKey:string;sessionId:string;owner:string;startedAt:number};
let pendingChatTurn:PendingChatTurn|null=null;
let chatRequest:AbortController|null=null;
let chatHistoryLoading=false;
let chatPollTimer:ReturnType<typeof setTimeout>|undefined;
function renderChatUpdate(){
 if(state.route.name!=='chat')return;
 const input=document.activeElement as HTMLTextAreaElement|null,editing=input?.id==='chat-input';
 const selection=editing?[input!.selectionStart,input!.selectionEnd]:null;
 render();
 if(editing){const next=document.getElementById('chat-input') as HTMLTextAreaElement|null;next?.focus({preventScroll:true});if(selection)next?.setSelectionRange(selection[0],selection[1]);}
}
function stopChatRecovery(){
 clearTimeout(chatPollTimer);pendingChatTurn=null;chatRequest?.abort();chatRequest=null;state.chatStatus=null;
}
function scheduleChatRecovery(){
 clearTimeout(chatPollTimer);
 if(!pendingChatTurn)return;
 chatPollTimer=setTimeout(()=>{void refreshChatHistory().finally(()=>{
  if(pendingChatTurn&&Date.now()-pendingChatTurn.startedAt<360000)scheduleChatRecovery();
 });},5000);
}
async function refreshChatHistory(){
 const sessionId=state.chatSessionId,owner=services.auth.getUser()?.id,token=generation;
 if(chatHistoryLoading||!sessionId||!owner||!services.chat.getMessages||document.visibilityState==='hidden')return;
 chatHistoryLoading=true;
 try{
  const messages=await services.chat.getMessages(sessionId);
  if(token!==generation||owner!==services.auth.getUser()?.id||sessionId!==state.chatSessionId)return;
  const before=JSON.stringify(state.chat);
  state.chat=mergeChatHistory(state.chat,messages);
  const pending=pendingChatTurn;
  if(pending&&pending.sessionId===sessionId&&replyForTurn(messages,pending.id)){
   stopChatRecovery();state.chatBusy=false;state.chatError=null;renderChatUpdate();
  }else if(before!==JSON.stringify(state.chat))renderChatUpdate();
 }catch{/* Preserve locally displayed turns on a read failure. */}
 finally{chatHistoryLoading=false;}
}
async function sendChatTurn(turn:PendingChatTurn){
 if(state.chatBusy)return;
 pendingChatTurn=turn;turn.startedAt=Date.now();state.chatBusy=true;state.chatError=null;state.chatStatus=null;
 const token=generation,controller=new AbortController();chatRequest=controller;
 renderChatUpdate();scheduleChatRecovery();
 const notice=setTimeout(()=>{if(pendingChatTurn===turn&&state.chatBusy){state.chatStatus='Still waiting for Luna’s reply…';renderChatUpdate();}},20000);
 try{
  const response=await services.chat.respond(turn.message,turn.echoIds,{sessionId:turn.sessionId,clientTurnId:turn.id,modelKey:turn.modelKey,signal:controller.signal});
  if(token!==generation||pendingChatTurn!==turn||turn.owner!==services.auth.getUser()?.id)return;
  state.chat=state.chat.filter(m=>m.id!==response.id);state.chat.push(response);
  stopChatRecovery();state.chatBusy=false;state.chatError=null;renderChatUpdate();
 }catch(error:any){
  if(token!==generation||pendingChatTurn!==turn||turn.owner!==services.auth.getUser()?.id)return;
  state.chatBusy=false;state.chatStatus=null;
  state.chatError=/empty response|no reply/i.test(error.message||'')
   ?'Luna returned no reply. Retry will use your existing message.'
   :error.message||'The connection was interrupted. Checking for a saved reply…';
  renderChatUpdate();await refreshChatHistory();
 }finally{clearTimeout(notice);if(chatRequest===controller)chatRequest=null;}
}

function currentDb(){const db=services.snapshot();if(state.scenario==='empty'){db.echoes=db.echoes.filter(e=>e.provenance==='local-session');db.loops=db.loops.filter(l=>l.provenance==='local-session');db.reflections=db.reflections.filter(r=>r.provenance==='local-session');db.threads=[];}return db;}
async function initChatSessionIfNeeded(){
  const user=services.auth?.getUser?.();
  if(!user){state.chatInitialized=true;return;}
  if(chatLoadingPromise)return chatLoadingPromise;
  if(state.chatInitialized)return;
  const initGeneration=generation;
  chatLoadingPromise=(async()=>{
    try{
      if(services.chat.getActiveSession){
        const sessionId=await services.chat.getActiveSession();
        if(initGeneration!==generation||user.id!==services.auth.getUser()?.id)return;
        state.chatSessionId=sessionId;
        if(state.chatSessionId&&services.chat.getMessages){
          const msgs=await services.chat.getMessages(state.chatSessionId);
          if(initGeneration!==generation||user.id!==services.auth.getUser()?.id)return;
          if(Array.isArray(msgs)&&msgs.length){
            state.chat=msgs;
            const last=msgs.at(-1);
            if(last?.role==='person'){
              lastUserMessage=last.content;lastChatContext=last.echoIds;
              state.chatError='Your last message has no reply yet. Checking for a saved reply…';
              pendingChatTurn={id:last.id,message:last.content,echoIds:last.echoIds,modelKey:state.chatModel,sessionId:state.chatSessionId!,owner:user.id,startedAt:Date.now()};
              scheduleChatRecovery();
            }
          }
        }
      }
    }catch(err){
      console.warn('Failed to load initial chat history:',err);
    }finally{
      if(initGeneration!==generation)return;
      state.chatInitialized=true;
      chatLoadingPromise=null;
      if(state.route.name==='chat')render();
    }
  })();
  return chatLoadingPromise;
}


let echoBrowseToken=0;
let echoSearchTimer:ReturnType<typeof setTimeout>|undefined;
function browseQuery():any{
 const q=state.route.query;
 const search=state.route.name==='echoes'?state.search:'';
 const period=q.get('period')||(search&&!q.get('cycle')&&!q.get('phase')&&!q.get('day')?'all':'cycle');
 const query=echoTimeQuery(period,q.get('cycle')||'',q.get('phase')||'',q.get('day')||'');
 if(state.route.name==='cycles')Object.assign(query,echoTimeQuery('cycle',state.cycleId,state.phase));
 if(state.route.name==='thread')return {threadId:state.route.id,limit:ECHO_PAGE_SIZE};
 if(search)query.search=search;
 if(state.echoKind!=='all'&&state.route.name==='echoes')query.kind=state.echoKind;
 return query;
}
function renderEchoBrowse(resultsOnly=false){
 if(!['echoes','cycles','thread'].includes(state.route.name))return;
 if(resultsOnly&&state.route.name==='echoes'&&document.getElementById('echo-results')){
  const template=document.createElement('template');template.innerHTML=echoesView(currentDb(),state);
  const results=template.content.querySelector('#echo-results');
  if(results)document.getElementById('echo-results')!.replaceWith(results);
  return;
 }
 const input=document.activeElement as HTMLInputElement|null,focused=input?.id==='echo-search';
 render();
 if(focused)document.getElementById('echo-search')?.focus({preventScroll:true});
}
async function loadEchoBrowse(more=false,force=false){
 if(!['echoes','cycles','thread'].includes(state.route.name))return;
 const query=browseQuery(),owner=services.auth.getUser()?.id;
 const key=JSON.stringify([owner,state.route.name,query]);
 if(!more&&!force&&state.echoBrowseKey===key)return;
 if(more&&(!state.echoNextCursor||state.echoLoading))return;
 const token=++echoBrowseToken,account=generation;
 const same=state.echoBrowseKey===key;
 state.echoBrowseKey=key;state.echoLoading=true;state.echoLoadError='';
 if(!more){
  state.echoResults=currentDb().echoes.filter(e=>matchesEchoQuery(e,query)).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,ECHO_PAGE_SIZE);
  state.echoNextCursor=undefined;
 }
 renderEchoBrowse();
 try{
  const result=await services.echoes.list({...query,cursor:more&&same?state.echoNextCursor:undefined});
  if(token!==echoBrowseToken||account!==generation||owner!==services.auth.getUser()?.id)return;
  state.echoResults=more?[...new Map([...(state.echoResults||[]),...result.items].map(e=>[e.id,e])).values()]:result.items;
  state.echoNextCursor=result.nextCursor;
 }catch{
  if(token!==echoBrowseToken||account!==generation)return;
  state.echoLoadError='Could not load this view. Your saved Echoes are safe. Try again when connected.';
 }finally{
  if(token===echoBrowseToken&&account===generation){state.echoLoading=false;renderEchoBrowse(true);}
 }
}
function changeEchoFilter(key:string,value:string){
 const q=new URLSearchParams(state.route.query);if(value)q.set(key,value);else q.delete(key);
 if(key==='period'){q.delete('cycle');q.delete('phase');q.delete('day');state.search='';}
 if(key==='cycle'){q.set('period',value==='all'?'all':'cycle');if(value==='all')q.delete('cycle');}
 go('echoes'+(q.size?'?'+q:''));
}
async function loadEchoDetail(id:string){
 const token=generation;
 try{await services.echoes.get(id);if(token===generation&&state.route.name==='echo'&&state.route.id===id)render();}
 catch{/* The detail view retains its honest unavailable state. */}
}

function applyRoute(){state.route=parseRoute(location.hash);const p=state.route.query.get('phase');const c=state.route.query.get('cycle');if(p&&PHASES.some(x=>x.id===p))state.phase=p as any;if(c&&services.snapshot().cycles.some(x=>x.id===c))state.cycleId=c;if(state.route.name==='chat')void initChatSessionIfNeeded();if(['echoes','cycles','thread'].includes(state.route.name))void loadEchoBrowse(false,true);if(state.route.name==='echo'&&state.route.id)void loadEchoDetail(state.route.id);}
function isSampleMode():boolean{return Boolean(services.isSampleMode&&services.isSampleMode());}
let journeyView:ReturnType<typeof mountJourney>|null=null;
function render(focusMain=false){
  if(state.route.name==='listen'&&!isSampleMode()&&journeyView&&journeyView.owner===services.auth.getUser()?.id){journeyView.refresh();return;}
  journeyView?.dispose();journeyView=null;
  const sample=isSampleMode();
  const user=services.auth?.getUser?.()||null;
  const isAuthenticated=Boolean(user);
  const expandedDetails=Array.from(root.querySelectorAll<HTMLDetailsElement>('details[id][open]')).map(el=>el.id);
  root.innerHTML=shell(state.route.name,state.route.name==='listen'?(isAuthenticated&&!sample?journeyMarkup:emptyState('Return to your Original Voice.','Sign in to listen to your authentic Echoes.','open-auth','Sign in')):routeView(currentDb(),state,sample,isAuthenticated),sample,user,currentDb().threads.length);
  for(const id of expandedDetails){const el=document.getElementById(id);if(el instanceof HTMLDetailsElement)el.open=true;}
  for(const [id,value] of Object.entries(drafts)){const el=document.getElementById(id);if(el instanceof HTMLTextAreaElement)el.value=value;}
  if(focusMain)document.getElementById('main')?.focus({preventScroll:true});
  if(state.route.name==='listen'&&isAuthenticated&&!sample)journeyView=mountJourney(root.querySelector('.echo-journey'),services,allowPlayback);
  bindSeekSurfaceEvents();
  syncAudioUI();
  void primeEchoAudio();
  void refreshRecovery();
  document.title=`Luna · ${state.route.name==='field'?'A living personal field':state.route.name.charAt(0).toUpperCase()+state.route.name.slice(1)}`;
}
function toast(message:string){clearTimeout(toastTimer);toastEl.textContent=message;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),4800);}
function go(path:string){if(location.hash===`#/${path}`){applyRoute();render(true);}else location.hash=`/${path}`;}
function showModal(title:string,content:string,nonModal=false){
  cancelCaptureTap();
  if(captureCompact&&captureActive&&!nonModal&&title!=='Enter through your voice.') {cleanupCapture();toast('Your recording is available under Recover recording.');}
  if(!modal.open)focusBeforeModal=document.activeElement as HTMLElement;
  modal.innerHTML=`<div class="dialog-inner"><header class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></header>${content}</div>`;
  modal.classList.remove('capture-dialog','capture-compact');
  modal.setAttribute('aria-labelledby','dialog-title');
  if(modal.open&&modal.matches(':modal')===nonModal)modal.close();
  if(!modal.open){if(nonModal)modal.show();else modal.showModal();}
}
function closeModal(){if(modal.open)modal.close();}
modal.addEventListener('close',()=>{if(modal.open)return;cleanupCapture();focusBeforeModal?.focus?.({preventScroll:true});});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
let captureTranscribing = false;
let captureTranscript = '';
let captureTranscriptionError = '';
let captureSttAbortController: AbortController | null = null;

function cleanupCapture(){
  cancelCaptureTap();captureCompact=false;recordingStarting=false;modal.classList.remove('capture-compact');
  if(wakeLock){wakeLock.release?.().catch?.(()=>{});wakeLock=null;}
  clearInterval(recordInterval);voiceEngine.stop();cancelAnimationFrame(previewFrame);
  if(captureSttAbortController){captureSttAbortController.abort();captureSttAbortController=null;}
  captureTranscribing=false;captureTranscript='';captureTranscriptionError='';
  if(recordingSession&&recorder?.state!=='inactive')void recordingSession.stop(true).then(()=>refreshRecovery());
  // RecordingSession owns tracks and final events until stop has persisted them.
  stream=null;recorder=null;recordingSession=null;
  captureToken++;captureActive=false;
  currentDraftId='';
  modal.querySelector<HTMLAudioElement>('#recording-preview')?.pause();
  recordingAnalysis={waveform:[],source:'unavailable',duration:0};recordingFinalizing=false;inputVisualAvailable=false;
  if(recordingUrl&&!recordedSaved){URL.revokeObjectURL(recordingUrl);localAudioUrls.delete(recordingUrl);}
  recordingUrl='';recordingBlob=null;recordingDuration=0;recordedSaved=false;storageError='';
}
function keepCaptureInputs(){const title=modal.querySelector<HTMLInputElement>('#capture-title');const body=modal.querySelector<HTMLTextAreaElement>('#capture-body');if(title)captureTitle=title.value;if(body)captureText=body.value;}
function openCapture(mode:'voice'|'text',compact=false){journeyView?.pause();stopPlayback();stopChatVoicePlayback();cancelChatDictation();cleanupCapture();captureCompact=compact;captureMode=mode;captureTitle='';captureText='';captureTranscript='';captureTranscribing=false;captureActive=true;recordingOwner=getAuthSession().userId;recordingStartedAt=new Date().toISOString();renderCapture();}
function captureNavTap(event:MouseEvent){
  if(captureActive){renderCapture();modal.querySelector<HTMLButtonElement>('[data-action="record-stop"]')?.focus();return;}
  if(event.detail===0){openCapture('voice');void startRecording();return;}
  if(captureTapTimer){cancelCaptureTap();openCapture('voice',true);void startRecording();return;}
  const owner=getAuthSession().userId,route=location.hash;
  captureTapTimer=setTimeout(()=>{
    captureTapTimer=null;
    if(owner!==getAuthSession().userId||route!==location.hash||modal.open)return;
    openCapture('voice');void startRecording();
  },320);
}
function changeCaptureSize(compact:boolean){
  if(!captureActive)return;
  keepCaptureInputs();modal.querySelector<HTMLAudioElement>('#recording-preview')?.pause();captureCompact=compact;renderCapture();
  voiceEngine.attach(modal.querySelector<HTMLElement>('#capture-orbit'));
}
function renderCompactCapture(error=''){
  const running=recorder?.state==='recording',ready=!!recordingUrl&&!recordingFinalizing;
  const busy=recordingStarting||recordingFinalizing||captureTranscribing;
  const status=recordingStarting?'Connecting microphone…':recordingFinalizing?'Preparing recording…':captureTranscribing?'Transcribing…':running?'Recording':ready?'Ready to keep':'Ready to record';
  showModal('Quick Echo',`<div class="quick-capture-row" id="capture-orbit"><div class="quick-capture-status"><span class="quick-record-dot ${running?'active':''}" aria-hidden="true"></span><span id="recording-source" role="status">${status}</span><strong id="record-timer">${timecode(recordingDuration)}</strong></div>${running?'<button class="btn primary" data-action="record-stop">Stop</button>':!ready?`<button class="btn primary" data-action="record-start" ${busy?'disabled':''}>Record</button>`:''}</div>${ready?`<audio id="recording-preview" controls src="${recordingUrl}" aria-label="Preview your recording"></audio>`:''}${captureText?`<p class="quick-transcript">${escapeHtml(captureText)}</p>`:''}<p id="capture-error" class="form-error" role="alert">${escapeHtml(error||storageError||captureTranscriptionError)}</p>${captureTranscriptionError&&ready&&!captureTranscribing?'<button class="text-link" data-action="retry-capture-transcription">Retry transcription</button>':''}<div class="quick-capture-actions"><button class="text-link" data-action="capture-expand">Expand</button>${ready?`<form data-form="capture"><button type="submit" class="btn primary" ${busy?'disabled':''}>Keep Echo</button></form>`:''}</div>`,true);
  modal.classList.add('capture-compact');
  if(ready)bindRecordingPreview();
}
function renderCapture(error=''){
  keepCaptureInputs();
  if(captureCompact){renderCompactCapture(error);return;}
  const running=recorder?.state==='recording';
  const ready=!!recordingUrl&&!recordingFinalizing;
  const action=running?'record-stop':ready?'preview-toggle':'record-start';
  const label=running?'Finish recording':ready?'Play your recording':'Begin recording';
  const source=running?(inputVisualAvailable?'Live microphone waveform':'Recording · waveform unavailable'):recordingFinalizing?'Preparing your waveform…':ready?(recordingAnalysis.source==='decoded-audio'?'Waveform derived from your recording':recordingAnalysis.source==='capture-levels'?'Measured input envelope':'Playback ready'):'Your voice, in its own time.';
  showModal('Enter through your voice.',`<p class="dialog-description">A moment begins with you.</p><div class="capture-mode"><div class="segmented" aria-label="Echo format"><button type="button" data-action="capture-mode" data-value="voice" aria-pressed="${captureMode==='voice'}">${icon('mic',14)} Speak</button><button type="button" data-action="capture-mode" data-value="text" aria-pressed="${captureMode==='text'}">${icon('write',14)} Write</button></div></div><form data-form="capture">${captureMode==='voice'?`<section class="recording-stage circular-stage ${running?'active':''}"><div class="capture-orbit" id="capture-orbit"><button class="record-orb" type="button" data-action="${action}" aria-label="${label}" ${recordingFinalizing?'disabled':''}>${orbitRings(running?((recordingDuration%60)/60*100):0)}<span class="record-orb-icon">${icon(running?'stop':ready?'play':'mic',21)}</span><span class="orb-wave">${ready?playbackWave(recordingAnalysis.waveform,'capture-wave'):liveWave()}</span><span class="record-time" id="record-timer">${timecode(recordingDuration)}</span><span class="record-orb-label">${recordingFinalizing?'Preparing':running?'Tap to finish':ready?'Listen again':'Tap to begin'}</span></button><span class="recording-orbit-dot" aria-hidden="true"></span><div data-voice-level class="voice-level" aria-hidden="true">${running?'Listening to input':ready?'A moment, held in your voice':'Ready when you are'}</div></div><p class="record-source" id="recording-source" role="status">${source}</p>${ready?`<audio id="recording-preview" controls src="${recordingUrl}" aria-label="Preview and seek in your recording"></audio><button class="text-link" type="button" data-action="record-again">${icon('return',14)}Record again</button>`:''}<p class="audio-caption">Speak freely · saved to your field<br>${storageError?'Device storage failed. Keep this page open.':running?'Saving audio checkpoints on this device.':'Microphone access is requested when you begin.'}</p></section>`:''}<label class="form-field"><span>A few words to find this again <span class="muted">(optional)</span></span><input id="capture-title" name="title" class="text-input" maxlength="120" placeholder="A title, if one comes to mind" value="${escapeHtml(captureTitle)}"></label><label class="form-field"><span>${captureMode==='text'?'What is here?':'A note or your own transcript (optional)'}</span><textarea id="capture-body" name="body" maxlength="6000" placeholder="${captureMode==='text'?'Start anywhere…':'Add words alongside your recording…'}" ${captureMode==='text'?'required':''}>${escapeHtml(captureText)}</textarea></label>${captureTranscribing?`<p class="capture-transcription-status small" style="color:var(--color-focus, #ddc697);margin:4px 0" role="status"><span class="thinking-dot"></span> ✦ Transcribing your recording…</p>`:''}${captureTranscript&&captureText.trim()!==captureTranscript.trim()?`<div style="margin:4px 0 8px"><button type="button" class="text-link" data-action="insert-capture-transcript" style="font-size:12px;color:var(--color-focus, #ddc697)">${icon('write',12)} Spoken transcript ready · Tap to insert</button></div>`:''}<div id="capture-error" class="form-error" role="alert">${escapeHtml(error||storageError||captureTranscriptionError)}</div>${captureTranscriptionError&&ready&&!captureTranscribing?'<button type="button" class="text-link" data-action="retry-capture-transcription">Retry transcription</button>':''}${ready?`<button type="button" class="text-link" data-action="download-capture" style="display:inline-flex;align-items:center;gap:6px;margin:8px 0;background:none;border:none;cursor:pointer;color:var(--color-focus, #ddc697);font-size:12px">${icon('download',13)}Download original audio</button>`:''}<div class="form-foot"><small>${services.privacy?.unlocked()?'Echo text will be encrypted. Original audio is unchanged.':'Saved to your personal living field.'}<br>Held in real-time astronomical rhythm.</small><button class="btn primary" type="submit" ${captureMode==='voice'&&(!ready||running||captureTranscribing)?'disabled':''}>Keep this Echo ${icon('arrow',15)}</button></div></form>`);
  modal.classList.toggle('capture-dialog',captureMode==='voice');
  if(captureMode==='voice')modal.querySelector('.dialog-head button')?.insertAdjacentHTML('beforebegin','<button class="text-link capture-minimize" type="button" data-action="capture-minimize">Minimize</button>');
  if(captureMode==='text')modal.querySelector<HTMLTextAreaElement>('#capture-body')?.focus();
  if(ready)bindRecordingPreview();
}
async function transcribeCapturedAudio(blob:Blob,token=captureToken){
  if(token!==captureToken||!captureActive||captureTranscribing)return;
  keepCaptureInputs();
  captureTranscribing=true;captureTranscriptionError='';
  const controller=new AbortController();
  captureSttAbortController=controller;
  renderCapture();
  try{
    const result=await transcribeVoice(blob,{signal:controller.signal});
    if(token!==captureToken||!captureActive||controller.signal.aborted)return;
    keepCaptureInputs();
    if(result.status==='ok'&&result.text){
      captureTranscript=result.text;
      if(!captureText.trim()){
        captureText=result.text;drafts['capture-body']=result.text;
        const input=modal.querySelector<HTMLTextAreaElement>('#capture-body');
        if(input)input.value=result.text;
      }
    }else if(result.status!=='aborted'){
      captureTranscriptionError=result.status==='no-speech'
        ?'No speech was detected. You can retry transcription or keep the original audio.'
        :(result.error||'Transcription could not finish.')+' You can retry or keep the original audio.';
    }
  }catch{
    if(token===captureToken&&!controller.signal.aborted)captureTranscriptionError='Transcription could not finish. You can retry or keep the original audio.';
  }finally{
    if(token===captureToken&&captureActive){
      captureTranscribing=false;
      if(captureSttAbortController===controller)captureSttAbortController=null;
      renderCapture();
    }
  }
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
  if(recordingStarting||recorder?.state==='recording')return;
  stopChatVoicePlayback();
  keepCaptureInputs();
  if(state.forceMicDenied){renderCapture('Microphone permission denied — simulated review state. Choose Write, or turn this simulation off in review notes.');return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){renderCapture('Recording is unavailable in this browser context. Writing still works. For microphone access, open the prototype from localhost or a supported secure browser context.');return;}
  const button=modal.querySelector<HTMLButtonElement>('[data-action="record-start"]');if(button){button.disabled=true;button.setAttribute('aria-label','Requesting microphone access');const label=button.querySelector('.record-orb-label');if(label)label.textContent='Connecting…';}const pendingSource=document.getElementById('recording-source');if(pendingSource)pendingSource.textContent='Waiting for microphone access…';
  const token=++captureToken;recordingStarting=true;
  if(captureCompact)renderCapture();
  await voiceEngine.prepare();
  if(token!==captureToken||!captureActive){if(!captureActive)voiceEngine.stop();return;}
  try{
    const requested=await navigator.mediaDevices.getUserMedia(voiceCaptureConstraints());
    if(token!==captureToken||!captureActive||!modal.open){requested.getTracks().forEach(t=>t.stop());return;}
    stream=requested;chunks=[];recordingDuration=0;
    currentDraftId='draft_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    wakeLockToken=token;
    if('wakeLock' in navigator&&(navigator as any).wakeLock){
      (navigator as any).wakeLock.request('screen').then((lock:any)=>{
        if(wakeLockToken!==captureToken||!captureActive||recorder?.state!=='recording'){
          lock.release?.().catch?.(()=>{});
          return;
        }
        wakeLock=lock;
        lock.addEventListener?.('release',()=>{
          if(wakeLock===lock) wakeLock=null;
        });
      }).catch((err:any)=>{
        console.warn('Wake lock request failed, continuing recording without lock:', err);
      });
    }
    recorder=createVoiceRecorder(stream);
    const activeRecorder=recorder;
    const session=new RecordingSession(activeRecorder,currentDraftId,recordingOwner,saveDraftAudio,()=>{
      if(token!==captureToken)return;
      storageError=session.error;
      const errorEl=document.getElementById('capture-error');if(errorEl)errorEl.textContent=storageError;
      const caption=modal.querySelector('.audio-caption');if(caption)caption.textContent=session.error?'Device storage failed. Keep this page open.':'Audio checkpoints saved on this device.';
    });
    recordingSession=session;recordingStartedAt=session.startedAt;
    activeRecorder.onstop=async()=>{
      await session.finished;
      if(token===captureToken){clearInterval(recordInterval);if(wakeLock){wakeLock.release?.().catch?.(()=>{});wakeLock=null;}}
      const blob=session.blob||new Blob([]);
      if(token!==captureToken||!captureActive)return;
      recordingBlob=blob;recordingDuration=session.duration;storageError=session.error;
      voiceEngine.stop();
      if(!blob.size){recorder=null;renderCapture('No audio was captured. Please try again or write instead.');return;}
      recordingUrl=URL.createObjectURL(blob);localAudioUrls.add(recordingUrl);recorder=null;recordingFinalizing=true;renderCapture();
      const analysis=await voiceEngine.analyse(blob,recordingDuration);
      if(token!==captureToken||!captureActive)return;
      recordingAnalysis=analysis;recordingDuration=analysis.duration;recordingFinalizing=false;renderCapture();
      void transcribeCapturedAudio(blob,token);
    };
    recordingStarting=false;activeRecorder.start(250);recordStarted=performance.now();renderCapture();
    inputVisualAvailable=voiceEngine.start(requested,document.getElementById('capture-orbit')!);
    const recordSource=document.getElementById('recording-source');if(recordSource&&!captureCompact)recordSource.textContent=inputVisualAvailable?(matchMedia('(prefers-reduced-motion: reduce)').matches?'Live microphone level · reduced motion':'Live microphone waveform'):'Recording · live visualization unavailable in this browser';
    modal.querySelector<HTMLButtonElement>('[data-action="record-stop"]')?.focus();
    recordInterval=setInterval(()=>{
      recordingDuration=(performance.now()-recordStarted)/1000;
      const timer=document.getElementById('record-timer');
      if(timer)timer.textContent=timecode(recordingDuration);
      const arc=modal.querySelector('[data-orbit-progress]');
      arc?.setAttribute('stroke-dasharray',`${((recordingDuration%60)/60)*100} 100`);
      if(recordingDuration>=300){
        const notice=document.getElementById('recording-source');
        if(notice&&!captureCompact&&!notice.dataset.longNotice){
          notice.dataset.longNotice='true';
          notice.textContent=storageError||'Take your time — recording continues.';
        }
      }
    },200);
  }catch(error){recordingStarting=false;voiceEngine.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;if(token!==captureToken)return;const name=(error as Error).name;renderCapture(name==='NotAllowedError'||name==='SecurityError'?'Microphone access was not granted. You can write instead, or allow microphone access in your browser and try again.':name==='NotFoundError'?'No microphone was found. You can write instead or connect a microphone.':'The microphone could not be started. Try again or write this Echo.');}
}
function stopRecording(){keepCaptureInputs();if(recorder?.state==='recording'){recordingDuration=(performance.now()-recordStarted)/1000;recorder.stop();clearInterval(recordInterval);}}
function openNewLoop(){showModal('Leave an intention.',`<p class="dialog-description">A small gesture, a question, a direction to follow.</p><form data-form="loop"><label class="form-field"><span>What would you like to leave open?</span><input class="text-input" name="title" maxlength="120" placeholder="Something I want to return to…" required autofocus></label><label class="form-field"><span>A little context (optional)</span><textarea name="note" maxlength="600" placeholder="There is no deadline here."></textarea></label><div class="form-foot"><small>Held in your personal field.</small><button class="btn primary" type="submit">Leave it open ${icon('loop',15)}</button></div></form>`);}
function openContextPicker(){const db=currentDb();showModal('Bring a moment with you.',`<p class="dialog-description">Select the Echoes you want to explore with Luna.</p><form data-form="chat-context"><div class="checkbox-list">${db.echoes.map(e=>`<label class="checkbox-row"><input type="checkbox" name="echo" value="${e.id}" ${state.chatContext.includes(e.id)?'checked':''}><span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(formatMoment(e.occurredAt))} · ${escapeHtml(e.context.label)}</small></span></label>`).join('')||'<p class="small muted">No Echoes available in this view.</p>'}</div><div class="form-foot"><small>Select Echoes to include in this reflection.</small><button class="btn primary" type="submit">Use selected context</button></div></form>`);}
function openThreadPicker(id:string){const db=currentDb();showModal('Make a connection.',`<p class="dialog-description">Choose a Thread that feels relevant. The connection comes from you.</p><form data-form="thread-link" data-id="${id}"><label class="form-field"><span>Thread</span><select name="thread" class="inline-select" required>${db.threads.map(t=>`<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('')}</select></label><div class="form-foot"><small>Held in your personal field.</small><button class="btn primary" type="submit" ${db.threads.length?'':'disabled'}>Connect Echo ${icon('thread',15)}</button></div></form>`);}
function openReview(){showModal('Luna Field Guide & Shortcuts',`<p class="dialog-description">One field. Many ways of seeing.</p><div class="notice"><strong>Luna Living Field</strong><br>Real-time Jean Meeus ephemeris, live recording, and personalized cycles. In live mode, your data synchronizes two-way with Classic Luna and Supabase.</div><h3 style="margin-top:20px">How to explore</h3><p class="small muted" style="margin-top:8px">Visit <strong>Sky</strong> for the realistic photographic moon, cosmic tide, and wisdom sheet. Begin with <strong>Speak</strong> in the Field to capture an Echo with live waveforms. Follow your intentions in <strong>Loops</strong> or see how moments weave together across cycles in <strong>Returns</strong>.</p><div class="review-divider"><h3>Keyboard & Touch Shortcuts</h3><p class="small muted"><strong>1-4</strong> or <strong>Arrow keys</strong> in Cycles view change phases. <strong>Double-tap the central microphone</strong> to record without leaving your page. Use <strong>Expand</strong> to review, or <strong>Minimize</strong> to return to the small recorder. <strong>Esc</strong> closes dialogs. <strong>Theme toggle</strong> switches between Dark and Light.</p></div><div class="review-divider"><p class="small muted">Desktop: use the left navigation. Mobile: Sky, Field, Voice, Echoes, and Luna are in the bottom bar.</p><button class="text-link" data-action="reset-open">${icon('return',15)}Reset session draft cache</button></div>`);}
function openSignInModal(){showModal('Sign in to Luna',`<p class="dialog-description">Connect to your Luna account to access your personal Field, Echoes, and Loops.</p><form data-form="auth" style="display:flex;flex-direction:column;gap:14px;margin-top:12px"><label class="form-field"><span>Email</span><input class="text-input" name="email" type="email" autocomplete="email" required placeholder="you@domain.com" autofocus></label><label class="form-field"><span>Password</span><input class="text-input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label><div id="auth-error" style="color:#ef4444;font-size:12px;min-height:16px"></div><div class="form-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Sign in & Sync</button></div><p style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:8px">Or visit <a href="/" class="gold" style="text-decoration:none">Classic Luna</a> (Sky tab) to create an account.</p></form>`);}
function openPrivacyUnlock(){
  showModal('Unlock private Echoes',`<p class="dialog-description">Use the encryption passphrase you set in Classic Luna. It stays on this device and is forgotten when you lock or leave. While unlocked, new Echo text is encrypted; original audio is unchanged.</p><form data-form="privacy-unlock"><label class="form-field"><span>Encryption passphrase</span><input class="text-input" name="passphrase" type="password" autocomplete="off" required autofocus></label><div class="form-foot"><button class="btn primary" type="submit">Unlock this session</button></div></form>`);
}
function openAccountModal(user:{id:string;email?:string}){showModal('Your Luna Account',`<div style="display:flex;flex-direction:column;gap:16px;margin-top:8px"><div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:50%;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);color:#34d399;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px">${(user.email?user.email.charAt(0):'U').toUpperCase()}</div><div><div style="font-weight:500;font-size:14px">${escapeHtml(user.email||'Luna Member')}</div><div style="font-size:11px;color:var(--color-text-muted)">Connected to your Luna account</div></div></div><div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;font-size:12px"><div style="display:flex;justify-content:space-between"><span style="color:var(--color-text-muted)">User ID</span><span style="font-family:monospace;font-size:11px">${escapeHtml(user.id.slice(0,12))}…</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--color-text-muted)">Sync status</span><span style="color:#34d399">Updates while this app is open</span></div></div><div class="form-foot" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><button type="button" class="btn" data-action="${services.privacy?.unlocked()?'privacy-lock':'privacy-unlock'}">${services.privacy?.unlocked()?'Lock private text':'Unlock private Echoes'}</button><button type="button" class="btn" data-action="auth-sync">Sync Now</button><button type="button" class="btn" data-action="auth-signout" style="background:rgba(239,68,68,0.15);color:#ef4444;border-color:rgba(239,68,68,0.25)">Sign out</button></div></div>`);}
function updateWaveProgress(container:ParentNode,progress:number){
  const ratio=clamp01(progress);
  container.querySelectorAll('[data-wave-progress]').forEach(el=>el.setAttribute('width',String(ratio*720)));
  container.querySelectorAll('[data-wave-cursor]').forEach(el=>{
    el.setAttribute('x1',String(ratio*720));
    el.setAttribute('x2',String(ratio*720));
  });
  container.querySelectorAll<HTMLElement>('[data-honest-fill]').forEach(el=>{
    el.style.width=`${ratio*100}%`;
  });
  container.querySelectorAll<HTMLElement>('[data-honest-thumb]').forEach(el=>{
    el.style.left=`${ratio*100}%`;
  });
  container.querySelectorAll('[data-orbit-progress]').forEach(el=>el.setAttribute('stroke-dasharray',`${ratio*100} 100`));
}

function bindSeekSurfaceEvents(){
  const surfaces=document.querySelectorAll<HTMLElement>('[data-seek-surface]');
  surfaces.forEach(surface=>{
    if((surface as any)._seekBound)return;
    (surface as any)._seekBound=true;
    const handleSeek=(e:PointerEvent|MouseEvent)=>{
      const rect=surface.getBoundingClientRect();
      if(!rect.width)return 0;
      const x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));
      const ratio=x/rect.width;
      const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;
      const targetTime=ratio*(duration||30);
      updateWaveProgress(surface,ratio);
      const currentEl=document.getElementById('audio-current');
      if(currentEl)currentEl.textContent=timecode(targetTime);
      surface.setAttribute('aria-valuenow',String(targetTime.toFixed(1)));
      const input=document.getElementById('audio-seek') as HTMLInputElement|null;
      if(input)input.value=String(targetTime);
      return targetTime;
    };
    surface.addEventListener('pointerdown',(e:PointerEvent)=>{
      if(!audioEchoId&&!audio.src)return;
      isScrubbing=true;
      try{surface.setPointerCapture(e.pointerId);}catch{}
      const targetTime=handleSeek(e);
      try{audio.currentTime=targetTime;}catch{pendingSeek=targetTime;}
    });
    surface.addEventListener('pointermove',(e:PointerEvent)=>{
      if(!isScrubbing)return;
      const targetTime=handleSeek(e);
      try{audio.currentTime=targetTime;}catch{pendingSeek=targetTime;}
    });
    const finishScrub=(e:PointerEvent)=>{
      if(!isScrubbing)return;
      isScrubbing=false;
      try{surface.releasePointerCapture(e.pointerId);}catch{}
      const targetTime=handleSeek(e);
      try{audio.currentTime=targetTime;}catch{pendingSeek=targetTime;}
      syncAudioUI();
    };
    surface.addEventListener('pointerup',finishScrub);
    surface.addEventListener('pointercancel',finishScrub);
    surface.addEventListener('keydown',(e:KeyboardEvent)=>{
      const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;
      if(!duration)return;
      let target=audio.currentTime||0;
      const step=5;
      if(e.key==='ArrowLeft')target=Math.max(0,target-step);
      else if(e.key==='ArrowRight')target=Math.min(duration,target+step);
      else if(e.key==='Home')target=0;
      else if(e.key==='End')target=duration;
      else return;
      e.preventDefault();
      try{audio.currentTime=target;}catch{pendingSeek=target;}
      syncAudioUI();
    });
  });
}

async function deriveEchoWaveformIfNeeded(echo:Echo):Promise<void>{
  if(Array.isArray(echo.waveform)&&echo.waveform.length>0&&echo.waveform.some(v=>v>0.01))return;
  let blob:Blob|null=null;
  const owner=getAuthSession().userId;
  try{
    const draft=await getDraftAudio(echo.id,owner);
    if(draft&&draft.blob)blob=draft.blob;
  }catch{}
  if(!blob){
    const source=await services.audio.resolve(echo);
    if(source){
      try{
        const resp=await fetch(source);
        if(resp.ok)blob=await resp.blob();
      }catch{}
    }
  }
  if(!blob||!blob.size)return;
  try{
    await voiceEngine.prepare();
    const duration=echo.duration||0;
    const analysis=await voiceEngine.analyse(blob,duration);
    if(analysis&&analysis.waveform&&analysis.waveform.length){
      echo.waveform=analysis.waveform;
      echo.waveformSource=analysis.source;
      if(analysis.duration&&(!echo.duration||Math.abs(echo.duration-analysis.duration)>1)){
        echo.duration=analysis.duration;
      }
      try{
        const raw=localStorage.getItem(ECHOES_KEY);
        if(raw){
          const stored=JSON.parse(raw);
          const idx=stored.findIndex((x:any)=>x.id===echo.id);
          if(idx!==-1){
            stored[idx].waveform=analysis.waveform;
            stored[idx].waveform_levels=analysis.waveform;
            localStorage.setItem(ECHOES_KEY,JSON.stringify(stored));
          }
        }
      }catch{}
      if(state.route.name==='echo'&&state.route.id===echo.id){
        const playerSec=document.querySelector<HTMLElement>('.original-voice[data-echo-id="'+echo.id+'"]');
        if(playerSec){
          const seekEl=playerSec.querySelector<HTMLElement>('[data-seek-surface]');
          if(seekEl&&seekEl.dataset.seekSurface==='slider'){
            seekEl.outerHTML=`<div class="wave-seek" data-seek-surface="waveform" role="slider" aria-label="Seek in Original Voice recording" aria-valuemin="0" aria-valuemax="${echo.duration||30}" aria-valuenow="${audio.currentTime||0}" tabindex="0">${playbackWave(analysis.waveform,'player-'+echo.id)}<input id="audio-seek" aria-label="Seek in Original Voice recording" type="range" min="0" max="${echo.duration||30}" step=".05" value="${audio.currentTime||0}"></div>`;
            const caption=playerSec.querySelector<HTMLElement>('.audio-caption');
            if(caption){
              const desc=analysis.source==='decoded-audio'?'Waveform derived from this audio':'Measured live input envelope';
              caption.textContent=`${desc}. ${echo.provenance==='synthetic'?'Demonstration audio.':echo.syncStatus==='synced'?'Available from your synchronized Field.':'Cloud synchronization is pending; local audio is used when available.'}`;
            }
            bindSeekSurfaceEvents();
            syncAudioUI();
          }
        }
      }
    }
  }catch(err){
    console.warn('Waveform analysis failed for echo:',echo.id,err);
  }
}

function stopPlayback(){audioAttempt++;cancelAnimationFrame(playbackFrame);audio.pause();try{audio.currentTime=0;}catch{}audioEchoId='';activeWaveform=[];activeDuration=0;pendingSeek=null;isScrubbing=false;}

async function primeEchoAudio(){
  if(state.route.name!=='echo')return;const echo=currentDb().echoes.find(e=>e.id===state.route.id);if(!echo||echo.kind!=='voice'||audioEchoId===echo.id)return;
  const attempt=++audioAttempt;const source=await services.audio.resolve(echo);if(attempt!==audioAttempt||state.route.name!=='echo'||state.route.id!==echo.id||!source)return;
  audio.pause();audioEchoId=echo.id;activeWaveform=echo.waveform||[];activeDuration=echo.duration||0;audio.src=source;syncAudioUI();
  void deriveEchoWaveformIfNeeded(echo);
}

async function playEcho(id:string){
  if(!allowPlayback())return;
  stopChatVoicePlayback();
  if(audioEchoId===id&&audio.src){if(audio.paused){try{await audio.play();}catch{toast('Playback could not start. Try again in a supported browser.');}}else audio.pause();syncAudioUI();return;}
  const attempt=++audioAttempt;audio.pause();
  try{const echo=await services.echoes.get(id);const source=await services.audio.resolve(echo);if(attempt!==audioAttempt)return;if(!source){toast('No playable audio is available for this Echo.');return;}audioEchoId=id;activeWaveform=echo.waveform||[];activeDuration=echo.duration||0;audio.src=source;audio.currentTime=0;await audio.play();syncAudioUI();void deriveEchoWaveformIfNeeded(echo);}catch{toast('Audio could not be played. Your original words remain available.');}
}

function syncAudioUI(){
  const currentButton=document.querySelector<HTMLButtonElement>('[data-action="play"]');if(!currentButton)return;const active=currentButton.dataset.id===audioEchoId;const playing=active&&!audio.paused;currentButton.innerHTML=icon(playing?'pause':'play',23);currentButton.setAttribute('aria-label',`${playing?'Pause':'Play'} Original Voice`);
  if(!active)return;if(isScrubbing)return;const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;const current=audio.currentTime||0;const progress=duration?current/duration:0;const input=document.getElementById('audio-seek') as HTMLInputElement|null;if(input){input.max=String(duration||30);input.value=String(current);input.setAttribute('aria-valuetext',`${timecode(current)} of ${timecode(duration)}`);}const seekSurface=document.querySelector<HTMLElement>('[data-seek-surface]');if(seekSurface){seekSurface.setAttribute('aria-valuemax',String(duration||30));seekSurface.setAttribute('aria-valuenow',String(current.toFixed(1)));}const currentEl=document.getElementById('audio-current');if(currentEl&&currentEl.textContent!==timecode(current))currentEl.textContent=timecode(current);const durationEl=document.getElementById('audio-duration');if(durationEl&&duration)durationEl.textContent=timecode(duration);
  const player=document.querySelector<HTMLElement>('.original-voice');if(player){updateWaveProgress(player,progress);player.classList.toggle('is-playing',playing);player.style.setProperty('--voice-energy',String(playing&&!matchMedia('(prefers-reduced-motion: reduce)').matches?sampleEnvelope(activeWaveform,progress):0));}
}
let lastPlaybackDraw=0;
function drawPlayback(now:number){if(audio.paused)return;if(now-lastPlaybackDraw>33){lastPlaybackDraw=now;if(!document.hidden)syncAudioUI();}playbackFrame=requestAnimationFrame(drawPlayback);}
for(const event of ['timeupdate','loadedmetadata','play','pause','ended','seeked'])audio.addEventListener(event,syncAudioUI);
audio.addEventListener('play',()=>{cancelAnimationFrame(playbackFrame);playbackFrame=requestAnimationFrame(drawPlayback);});
for(const event of ['pause','ended'])audio.addEventListener(event,()=>cancelAnimationFrame(playbackFrame));
audio.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){try{audio.currentTime=pendingSeek;pendingSeek=null;}catch{}}});
audio.addEventListener('error',()=>toast('This audio could not be loaded. You can still read the transcript.'));

function sanitizeFilename(name:string,fallback='luna-recording'):string{
  const cleaned=(name||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/[. ]+$/,'');
  return cleaned.slice(0,80)||fallback;
}

async function getBlobHeaderBytes(blob:Blob):Promise<Uint8Array>{
  try{
    const slice=blob.slice(0,32);
    if(typeof slice.arrayBuffer==='function'){
      return new Uint8Array(await slice.arrayBuffer());
    }
  }catch{}
  return new Promise((resolve)=>{
    try{
      const reader=new FileReader();
      reader.onloadend=()=>{
        resolve(reader.result instanceof ArrayBuffer?new Uint8Array(reader.result):new Uint8Array());
      };
      reader.onerror=()=>resolve(new Uint8Array());
      reader.readAsArrayBuffer(blob.slice(0,32));
    }catch{
      resolve(new Uint8Array());
    }
  });
}

function detectAudioExt(bytes:Uint8Array,mime=''):string{
  if(bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return 'webm';
  if(bytes.length>=8&&bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70)return 'm4a';
  if(bytes.length>=4&&bytes[0]===0x4f&&bytes[1]===0x67&&bytes[2]===0x67&&bytes[3]===0x53)return 'ogg';
  if(bytes.length>=3&&bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)return 'mp3';
  if(bytes.length>=2&&bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0&&(bytes[1]&0x06)===0x02)return 'mp3';
  if(bytes.length>=12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x41&&bytes[10]===0x56&&bytes[11]===0x45)return 'wav';
  if(bytes.length>=4&&bytes[0]===0x66&&bytes[1]===0x4c&&bytes[2]===0x61&&bytes[3]===0x43)return 'flac';
  const lower=(mime||'').toLowerCase();
  if(lower.includes('webm'))return 'webm';
  if(lower.includes('mp4')||lower.includes('m4a')||lower.includes('aac'))return 'm4a';
  if(lower.includes('ogg')||lower.includes('opus'))return 'ogg';
  if(lower.includes('mpeg')||lower.includes('mp3'))return 'mp3';
  if(lower.includes('wav'))return 'wav';
  return 'webm';
}

async function downloadAudioBlob(blob:Blob,rawTitle:string):Promise<void>{
  const bytes=await getBlobHeaderBytes(blob);
  const ext=detectAudioExt(bytes,blob.type);
  const base=sanitizeFilename(rawTitle,'luna-recording');
  const filename=`${base}.${ext}`;
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  anchor.style.display='none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast(`Downloading original audio as ${filename}`);
}

async function downloadEchoAudio(id:string):Promise<void>{
  const echo=await services.echoes.get(id);
  if(!echo){
    toast('Echo could not be found.');
    return;
  }
  let blob:Blob|null=null;
  if(echo.audioBlob){
    blob=echo.audioBlob;
  }else{
    try{
      const owner=getAuthSession().userId;
      const draft=await getDraftAudio(echo.id,owner);
      if(draft&&draft.blob)blob=draft.blob;
    }catch{}
    if(!blob){
      const source=await services.audio.resolve(echo);
      if(source){
        toast('Fetching original audio...');
        try{
          const resp=await fetch(source);
          if(resp.ok){
            blob=await resp.blob();
          }
        }catch(e){
          console.error('Failed to fetch echo audio source',e);
        }
      }
    }
  }
  if(!blob||!blob.size){
    toast('No downloadable audio is available for this Echo.');
    return;
  }
  await downloadAudioBlob(blob,echo.title||'Echo');
}

// --- CHAT VOICE, TTS & TRANSCRIPTION CONTROLS ---

let chatPlayAttempt = 0;
let chatTtsAbortController: AbortController | null = null;
let chatAudio: HTMLAudioElement | null = null;
let chatSpeechUtterance: SpeechSynthesisUtterance | null = null;
let chatDictationToken = 0;
let chatDictationRecorder: MediaRecorder | null = null;
let chatDictationStream: MediaStream | null = null;
let chatDictationChunks: BlobPart[] = [];
let chatDictationTimer: any = null;
let chatDictationStartedAt = 0;
let chatSttAbortController: AbortController | null = null;
let chatDictationOwner = '';

interface TranscriptionResult {
  text: string;
  status: 'ok' | 'no-speech' | 'error' | 'aborted';
  error?: string;
}

async function transcribeVoice(blob: Blob, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<TranscriptionResult> {
  if (!blob || blob.size < 500) return { text: '', status: 'no-speech' };
  const apiBase = 'https://loops-production-e1d5.up.railway.app';
  const edgeUrl = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/transcribe-audio';
  const anonKey = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';
  const mime = blob.type || 'audio/webm';
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';

  const timeoutMs = options?.timeoutMs || 20000;
  const { signal: activeSignal, cleanup } = composeTimeoutSignal(options?.signal, timeoutMs);

  let lastError = '';

  try {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (options?.signal?.aborted) return { text: '', status: 'aborted' };
      if (activeSignal.aborted) {
        return { text: '', status: 'error', error: 'Transcription timed out. Please try again.' };
      }
      const res = await fetch(`${apiBase}/api/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': mime,
          'x-audio-filename': `recording.${ext}`
        },
        body: arrayBuffer,
        signal: activeSignal
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data?.text || '').trim();
        return text ? { text, status: 'ok' } : { text: '', status: 'no-speech' };
      } else {
        lastError = `Backend HTTP ${res.status}`;
      }
    } catch (e: any) {
      if (options?.signal?.aborted) return { text: '', status: 'aborted' };
      if (activeSignal.aborted || e?.name === 'TimeoutError') {
        return { text: '', status: 'error', error: 'Transcription timed out. Please try again.' };
      }
      lastError = e?.message || 'Network error';
      console.warn('[Transcription] Primary backend failed, trying edge fallback:', e);
    }

    try {
      if (options?.signal?.aborted) return { text: '', status: 'aborted' };
      if (activeSignal.aborted) {
        return { text: '', status: 'error', error: 'Transcription timed out. Please try again.' };
      }
      const formData = new FormData();
      formData.append('audio', blob, `audio.${ext}`);
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'apikey': anonKey
        },
        body: formData,
        signal: activeSignal
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data?.text || '').trim();
        return text ? { text, status: 'ok' } : { text: '', status: 'no-speech' };
      } else {
        lastError = `Edge HTTP ${res.status}`;
      }
    } catch (e: any) {
      if (options?.signal?.aborted) return { text: '', status: 'aborted' };
      if (activeSignal.aborted || e?.name === 'TimeoutError') {
        return { text: '', status: 'error', error: 'Transcription timed out. Please try again.' };
      }
      lastError = e?.message || 'Network error';
      console.warn('[Transcription] Edge fallback failed:', e);
    }

    return { text: '', status: 'error', error: lastError || 'Transcription failed' };
  } finally {
    cleanup();
  }
}

function stopChatVoicePlayback() {
  chatPlayAttempt++;
  if (chatTtsAbortController) {
    chatTtsAbortController.abort();
    chatTtsAbortController = null;
  }
  if (chatAudio) {
    chatAudio.pause();
    chatAudio.onended = null;
    chatAudio.onerror = null;
    chatAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
  chatSpeechUtterance = null;
  if (state.chatPlayingMessageId !== null || state.chatVoiceFallbackMessageId !== null || state.chatVoiceFallbackLabel !== null) {
    state.chatPlayingMessageId = null;
    state.chatVoiceFallbackMessageId = null;
    state.chatVoiceFallbackLabel = null;
    render();
  }
}

function playBrowserSpeech(text: string, messageId: string, isFallback = false) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    toast(isFallback ? 'Voice service unavailable and browser speech not supported.' : 'Speech playback is not supported in this browser.');
    state.chatPlayingMessageId = null;
    state.chatVoiceFallbackMessageId = null;
    state.chatVoiceFallbackLabel = null;
    render();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.onend = () => {
      if (state.chatPlayingMessageId === messageId) {
        state.chatPlayingMessageId = null;
        state.chatVoiceFallbackMessageId = null;
        state.chatVoiceFallbackLabel = null;
        render();
      }
    };
    utter.onerror = () => {
      if (state.chatPlayingMessageId === messageId) {
        state.chatPlayingMessageId = null;
        state.chatVoiceFallbackMessageId = null;
        state.chatVoiceFallbackLabel = null;
        render();
      }
    };
    chatSpeechUtterance = utter;
    state.chatVoiceFallbackMessageId = isFallback ? messageId : null;
    state.chatVoiceFallbackLabel = isFallback ? 'Device Voice…' : null;
    window.speechSynthesis.speak(utter);
    if (isFallback) {
      toast('Selected voice unavailable; speaking with device voice.');
    }
    render();
  } catch {
    state.chatPlayingMessageId = null;
    state.chatVoiceFallbackMessageId = null;
    state.chatVoiceFallbackLabel = null;
    render();
  }
}

async function handlePlayChatVoice(messageId: string) {
  if(!allowPlayback())return;
  if(state.chatVoiceRecording||captureActive){toast('Finish recording before playing Luna’s voice.');return;}
  if (state.chatPlayingMessageId === messageId) {
    stopChatVoicePlayback();
    return;
  }

  stopPlayback();
  stopChatVoicePlayback();
  const msg = state.chat.find(m => m.id === messageId);
  if (!msg || !msg.content) return;

  const textToSpeak = prepareChatSpeech(msg.content,[...msg.echoIds,...currentDb().echoes.map(e=>e.id)]);
  if (!textToSpeak) return;

  const attempt = ++chatPlayAttempt;
  const ttsController = new AbortController();
  chatTtsAbortController = ttsController;

  state.chatPlayingMessageId = messageId;
  state.chatVoiceFallbackMessageId = null;
  state.chatVoiceFallbackLabel = null;
  render();

  if (state.chatVoice === 'browser-web-speech') {
    playBrowserSpeech(textToSpeak, messageId, false);
    return;
  }

  try {
    const voiceId = state.chatVoice;
    const model = state.chatVoiceModel;
    const res = await services.chat.synthesizeSpeech?.(textToSpeak, {
      voiceId,
      model,
      messageId,
      signal: ttsController.signal
    });

    if (attempt !== chatPlayAttempt || state.chatPlayingMessageId !== messageId || ttsController.signal.aborted) {
      return;
    }

    if (res?.audioUrl && !res.useClientFallback) {
      if (res.fallbackUsed) {
        state.chatVoiceFallbackMessageId = messageId;
        const fallbackVoiceName = getVoiceDisplayName(res.voiceId) || res.voiceId || 'Fallback Voice';
        state.chatVoiceFallbackLabel = `${fallbackVoiceName} (Fallback)…`;
        render();
        toast(`Voice service unavailable; speaking with ${fallbackVoiceName}.`);
      } else {
        state.chatVoiceFallbackMessageId = null;
        state.chatVoiceFallbackLabel = null;
      }
      const audio = new Audio(res.audioUrl);
      audio.onended = () => {
        if (state.chatPlayingMessageId === messageId && attempt === chatPlayAttempt) {
          state.chatPlayingMessageId = null;
          state.chatVoiceFallbackMessageId = null;
          state.chatVoiceFallbackLabel = null;
          render();
        }
      };
      audio.onerror = () => {
        if (attempt === chatPlayAttempt && state.chatPlayingMessageId === messageId) {
          playBrowserSpeech(textToSpeak, messageId, true);
        }
      };

      if (attempt !== chatPlayAttempt || ttsController.signal.aborted) return;
      chatAudio = audio;
      await audio.play();
      return;
    }
  } catch (err: any) {
    if (attempt !== chatPlayAttempt || ttsController.signal.aborted) return;
    console.warn('[Chat Voice] Synthesis failed, falling back to browser speech:', err);
  }

  if (attempt === chatPlayAttempt && state.chatPlayingMessageId === messageId && !ttsController.signal.aborted) {
    playBrowserSpeech(textToSpeak, messageId, true);
  }
}

function cancelChatDictation() {
  chatDictationToken++;
  if (chatSttAbortController) {
    chatSttAbortController.abort();
    chatSttAbortController = null;
  }
  if (chatDictationStream) {
    chatDictationStream.getTracks().forEach(t => t.stop());
    chatDictationStream = null;
  }
  if (chatDictationTimer) {
    clearInterval(chatDictationTimer);
    chatDictationTimer = null;
  }
  chatDictationChunks = [];
  if (chatDictationRecorder) {
    chatDictationRecorder.ondataavailable = null;
    chatDictationRecorder.onstop = null;
    try {
      if (chatDictationRecorder.state !== 'inactive') chatDictationRecorder.stop();
    } catch {}
    chatDictationRecorder = null;
  }
  state.chatVoiceRecording = false;
  state.chatVoiceDuration = 0;
  state.chatTranscribing = false;
  chatDictationOwner = '';
}

async function startChatDictation() {
  if(captureIsRecording()){toast('Finish your Echo recording before dictating a message.');return;}
  if (state.chatVoiceRecording) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Microphone access is not supported in this browser.');
    return;
  }

  stopChatVoicePlayback();
  stopPlayback();
  cancelChatDictation();
  const token = ++chatDictationToken;
  const currentOwner = getAuthSession().userId;
  chatDictationOwner = currentOwner;

  try {
    const stream = await navigator.mediaDevices.getUserMedia(voiceCaptureConstraints());

    if (token !== chatDictationToken || state.route.name !== 'chat' || currentOwner !== getAuthSession().userId) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    chatDictationStream = stream;
    chatDictationChunks = [];

    const mr = createVoiceRecorder(stream);
    mr.ondataavailable = (e) => {
      if (token === chatDictationToken && e.data && e.data.size > 0) {
        chatDictationChunks.push(e.data);
      }
    };

    mr.onstop = async () => {
      if (token !== chatDictationToken) return;

      if (chatDictationStream) {
        chatDictationStream.getTracks().forEach(t => t.stop());
        chatDictationStream = null;
      }
      if (chatDictationTimer) {
        clearInterval(chatDictationTimer);
        chatDictationTimer = null;
      }
      state.chatVoiceRecording = false;
      state.chatVoiceDuration = 0;

      const blob = new Blob(chatDictationChunks, { type: mr.mimeType || chatDictationChunks[0]?.type || 'audio/webm' });
      chatDictationChunks = [];
      if (!blob || blob.size < 500) {
        render();
        return;
      }

      state.chatTranscribing = true;
      render();

      const sttController = new AbortController();
      chatSttAbortController = sttController;

      try {
        const result = await transcribeVoice(blob, { signal: sttController.signal });

        if (token !== chatDictationToken || currentOwner !== getAuthSession().userId || sttController.signal.aborted) {
          return;
        }

        state.chatTranscribing = false;

        if (result.status === 'ok' && result.text) {
          const input = document.getElementById('chat-input') as HTMLTextAreaElement | null;
          const current = (input?.value || drafts['chat-input'] || '').trim();
          const combined = current ? `${current} ${result.text}` : result.text;
          if (input) {
            input.value = combined;
            input.focus();
          }
          drafts['chat-input'] = combined;
          toast('Voice transcribed into message.');
        } else if (result.status === 'no-speech') {
          toast('No speech detected in recording.');
        } else if (result.status === 'error') {
          toast(result.error||'Transcription could not finish. Please try recording again.');
        }
      } catch {
        if (token === chatDictationToken) {
          state.chatTranscribing = false;
          toast('Transcription could not finish.');
        }
      }
      if (token === chatDictationToken) {
        render();
      }
    };

    chatDictationRecorder = mr;
    mr.start(250);
    chatDictationStartedAt = Date.now();
    state.chatVoiceRecording = true;
    state.chatVoiceDuration = 0;
    render();

    chatDictationTimer = setInterval(() => {
      if (token !== chatDictationToken) return;
      state.chatVoiceDuration = Math.floor((Date.now() - chatDictationStartedAt) / 1000);
      const pill = document.querySelector('.chat-voice-btn .recording-pill');
      if (pill) pill.textContent = `${state.chatVoiceDuration}s`;
    }, 1000);
  } catch (err: any) {
    if (token !== chatDictationToken) return;
    chatDictationStream?.getTracks().forEach(track=>track.stop());
    chatDictationStream=null;
    console.error('Dictation error:', err);
    toast(err.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Could not start microphone.');
    state.chatVoiceRecording = false;
    state.chatVoiceDuration = 0;
    render();
  }
}

async function stopChatDictation() {
  if (chatDictationRecorder && chatDictationRecorder.state === 'recording') {
    chatDictationRecorder.stop();
  }
}

async function handleToggleChatDictation() {
  if (state.chatVoiceRecording) {
    await stopChatDictation();
  } else {
    await startChatDictation();
  }
}

document.addEventListener('click',async(event)=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action!;const value=target.dataset.value||'';const id=target.dataset.id||'';
  try{
    switch(action){
      case 'download-voice':await downloadEchoAudio(id);break;
      case 'download-capture':if(recordingBlob){keepCaptureInputs();await downloadAudioBlob(recordingBlob,captureTitle||captureText||'luna-recording');}break;
      case 'skip':document.getElementById('main')?.focus();document.getElementById('main')?.scrollIntoView({block:'start'});break;
      case 'close-menu':{document.getElementById('sidebar')?.classList.remove('mobile-open');const trigger=document.querySelector<HTMLButtonElement>('[data-action="menu"]');trigger?.setAttribute('aria-expanded','false');trigger?.focus();break;}
      case 'menu':{const open=document.getElementById('sidebar')?.classList.toggle('mobile-open');target.setAttribute('aria-expanded',String(open));break;}
      case 'theme':{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('luna-exploration-theme',theme);}catch{}render();break;}
      case 'privacy-unlock':openPrivacyUnlock();break;
      case 'privacy-lock':services.privacy?.lock();closeModal();render();toast('Private text locked.');break;
      case 'step-toggle':case 'step-remove':case 'step-up':case 'step-down':{
        if(!services.loops.checklist){toast('Steps are available in your personal field.');break;}
        await services.loops.checklist(id,action.slice(5) as 'toggle'|'remove'|'up'|'down',target.dataset.step);
        render();break;
      }
      case 'review':openReview();break;
      case 'open-auth':{const u=services.auth?.getUser?.();if(u)openAccountModal(u);else openSignInModal();break;}
      case 'auth-signout':{stopPlayback();stopChatVoicePlayback();cancelChatDictation();cleanupCapture();await services.auth?.signOut?.();state.chat=[];state.chatSessionId=null;state.chatInitialized=false;state.chatError=null;state.chatContext=[];closeModal();render(true);toast('Signed out of your Luna Field.');break;}
      case 'toggle-chat-controls':state.chatControlsOpen=!state.chatControlsOpen;render();break;
      case 'play-chat-voice':await handlePlayChatVoice(id);break;
      case 'chat-voice-record':await handleToggleChatDictation();break;
      case 'retry-capture-transcription':{if(recordingBlob)await transcribeCapturedAudio(recordingBlob);break;}
      case 'insert-capture-transcript':{
        keepCaptureInputs();
        if(captureTranscript){
          const combined=captureText.trim()?`${captureText.trim()}\n\n${captureTranscript}`:captureTranscript;
          captureText=combined;
          drafts['capture-body']=combined;
          const ta=modal.querySelector<HTMLTextAreaElement>('#capture-body');
          if(ta)ta.value=combined;
          renderCapture();
        }
        break;
      }
      case 'toggle-transcript':{
        const targetId=target.dataset.target;
        const container=targetId?document.getElementById(targetId):target.previousElementSibling;
        if(container){
          const isCollapsed=container.classList.contains('collapsed');
          if(isCollapsed){
            container.classList.remove('collapsed');
            container.classList.add('expanded');
            target.setAttribute('aria-expanded','true');
            target.innerHTML=`${icon('up',13)}<span>Show less</span>`;
          }else{
            container.classList.remove('expanded');
            container.classList.add('collapsed');
            target.setAttribute('aria-expanded','false');
            target.innerHTML=`${icon('down',13)}<span>Show more</span>`;
            container.scrollIntoView({behavior:'smooth',block:'nearest'});
          }
        }
        break;
      }
      case 'retry-chat':{
        if(!lastUserMessage||state.chatBusy||!pendingChatTurn)return;
        await refreshChatHistory();
        if(pendingChatTurn)await sendChatTurn(pendingChatTurn);
        break;
      }
      case 'auth-sync':{closeModal();toast('Synchronizing with your Luna account...');await services.sync?.();render(true);toast(services.snapshot().echoes.some(e=>e.user_id===services.auth.getUser()?.id&&e.syncStatus!=='synced')?'Sync checked. Some Echoes still need synchronization.':'Your Field is synchronized.');break;}
      case 'toggle-sample-mode':{const active=isSampleMode();services.setSampleMode?.(!active);render(true);toast(!active?'Exploring sample field with illustrative data.':'Returned to your personal living field.');break;}
      case 'close-modal':closeModal();break;
      case 'recover-list':await openRecovery();break;
      case 'recover-draft':await recoverDraft(id);break;
      case 'discard-draft':{const owner=getAuthSession().userId;const draft=await getDraftAudio(id,owner);if(draft)await saveDraftAudio(id,draft.blob,{duration:draft.duration,status:'discarded'},owner);await openRecovery();break;}
      case 'capture-voice':if(target.classList.contains('capture-nav'))captureNavTap(event);else{openCapture('voice');await startRecording();}break;
      case 'capture-expand':changeCaptureSize(false);break;
      case 'capture-minimize':changeCaptureSize(true);break;
      case 'capture-entrance':openCapture('voice');break;
      case 'capture-text':openCapture('text');break;
      case 'capture-mode':keepCaptureInputs();cleanupCapture();captureActive=true;captureMode=value as any;renderCapture();break;
      case 'record-start':await startRecording();break;
      case 'record-stop':stopRecording();break;
      case 'preview-toggle':{const preview=modal.querySelector<HTMLAudioElement>('#recording-preview');if(preview){if(preview.paused)await preview.play();else preview.pause();}break;}
      case 'record-again':keepCaptureInputs();cleanupCapture();captureActive=true;renderCapture();break;
      case 'new-loop':openNewLoop();break;
      case 'echo-period':changeEchoFilter('period',value);break;
      case 'echo-more':await loadEchoBrowse(true);break;
      case 'echo-retry':await loadEchoBrowse(false,true);break;
      case 'echo-clear':state.echoKind='all';state.search='';state.echoBrowseKey=undefined;go('echoes');break;
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
      case 'reset-confirm':generation++;stopChatRecovery();stopPlayback();stopChatVoicePlayback();cancelChatDictation();closeModal();localAudioUrls.forEach(url=>URL.revokeObjectURL(url));localAudioUrls.clear();services.reset();Object.keys(drafts).forEach(key=>delete drafts[key]);state.chat=[];state.chatContext=[];state.chatBusy=false;state.scenario='ready';state.search='';state.echoKind='all';state.loopFilter='unfolding';go('field');render(true);toast('Local session cache cleared.');break;
    }
  }catch(error){toast((error as Error).message||'That action could not finish. Please try again.');}
});

document.addEventListener('input',event=>{
  const el=event.target as HTMLInputElement|HTMLTextAreaElement;
  if(el instanceof HTMLTextAreaElement&&el.id&&!modal.contains(el))drafts[el.id]=el.value;
  if(el.id==='echo-search'){
    state.search=el.value;clearTimeout(echoSearchTimer);echoBrowseToken++;state.echoBrowseKey=undefined;
    echoSearchTimer=setTimeout(()=>void loadEchoBrowse(false,true),300);
  }
  if(el.id==='audio-seek'&&audioEchoId){const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:activeDuration;const target=Math.min(duration,Number(el.value));try{audio.currentTime=target;}catch{pendingSeek=target;}syncAudioUI();}
});
document.addEventListener('change',async(event)=>{
  const el=event.target as HTMLSelectElement|HTMLInputElement;
  try{
    if(el.dataset.loopId){await services.loops.transition(el.dataset.loopId,el.value as LoopStatus);render();toast('Your intention has room to change.');}
    if(el.id==='echo-cycle-select'){changeEchoFilter('cycle',el.value);return;}
    if(el.id==='echo-phase-select'){changeEchoFilter('phase',el.value);return;}
    if(el.id==='echo-day-filter'){changeEchoFilter('day',el.value);return;}
    if(el.id==='echo-kind-select'){state.echoKind=el.value as any;void loadEchoBrowse(false,true);return;}
    if(el.id==='cycle-select'&&state.route.name!=='listen'){state.cycleId=el.value;go(`cycles?cycle=${state.cycleId}&phase=${state.phase}`);}
    if(el.id==='mic-denial')state.forceMicDenied=(el as HTMLInputElement).checked;
    if(el.id==='chat-model-select'||el.dataset.action==='select-chat-model'){
      state.chatModel=el.value;
      try{localStorage.setItem('luna_model_key',el.value);}catch{}
      render();
    }
    if(el.id==='chat-voice-select'||el.dataset.action==='select-chat-voice'){
      state.chatVoice=el.value;
      try{localStorage.setItem('luna_voice_key',el.value);}catch{}
      render();
    }
    if(el.id==='chat-voice-tier-select'||el.dataset.action==='select-chat-voice-tier'){
      state.chatVoiceModel=el.value;
      try{localStorage.setItem('luna_voice_model_key',el.value);}catch{}
      render();
    }
  }catch(error){toast((error as Error).message);}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&captureCompact&&modal.open){event.preventDefault();closeModal();return;}
  if(event.key==='Escape'&&document.getElementById('sidebar')?.classList.contains('mobile-open')){document.getElementById('sidebar')?.classList.remove('mobile-open');const trigger=document.querySelector<HTMLButtonElement>('[data-action="menu"]');trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
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
          toast('Welcome back. Your personal Field is ready.');
        }catch(err){
          if(errorEl)errorEl.textContent=(err as Error).message||'Invalid email or password.';
          toast('Sign in failed: '+((err as Error).message||'Invalid credentials'));
        }
        break;
      }
      case 'capture':{
        if(captureTranscribing)throw new Error('Please wait for transcription to finish before keeping this Echo.');
        keepCaptureInputs();
        if(recordingOwner!==getAuthSession().userId)throw new Error('Account changed. Recover this recording in its original account.');
        const echo=await services.echoes.create({occurredAt:recordingStartedAt,title:captureTitle,body:captureText,kind:captureMode,audioUrl:recordingUrl||undefined,audioBlob:recordingBlob||undefined,duration:recordingDuration||undefined,waveform:recordingAnalysis.waveform,waveformSource:recordingAnalysis.source,context:services.snapshot().current});
        recordedSaved=true;
        if(currentDraftId&&recordingBlob){
          await saveDraftAudio(currentDraftId,recordingBlob,{echoId:echo.id,duration:recordingDuration,status:'saved',startedAt:recordingStartedAt},recordingOwner);
        }
        const stayHere=captureCompact;
        closeModal();
        if(stayHere)render();else go(`echo/${echo.id}`);
        toast('Your Echo is here.');
        break;
      }
      case 'privacy-unlock':{
        if(!services.privacy)throw new Error('Private Echoes are available in your personal field.');
        await services.privacy.unlock(String(data.get('passphrase')||''));
        form.reset();closeModal();render();toast('Private text unlocked for this session.');break;
      }
      case 'loop-step':{
        if(!services.loops.checklist)throw new Error('Steps are available in your personal field.');
        await services.loops.checklist(form.dataset.id!,'add','',String(data.get('text')||''));
        render();break;
      }
      case 'loop':{await services.loops.create(String(data.get('title')||''),String(data.get('note')||''));closeModal();state.loopFilter='unfolding';go('loops');render();toast('An intention held in your field.');break;}
      case 'reflection':{await services.reflections.add(form.dataset.id!,String(data.get('body')||''));const input=form.querySelector<HTMLTextAreaElement>('textarea')!;delete drafts[input.id];input.value='';render();toast('Your reflection is alongside the original.');break;}
      case 'thread-link':{await services.threads.linkEcho(String(data.get('thread')),form.dataset.id!);closeModal();render();toast('Connected by you.');break;}
      case 'chat-context':state.chatContext=data.getAll('echo').map(String);closeModal();render();break;
      case 'chat':{
        const message=String(data.get('message')||'').trim();if(!message)return;
        lastUserMessage=message;
        lastChatContext=[...state.chatContext];
        const user=services.auth?.getUser?.();
        if(!user){
          toast('Sign in to converse with Luna.');
          openSignInModal();
          return;
        }
        if(state.chatBusy)return;
        await initChatSessionIfNeeded();
        if(!state.chatSessionId||user.id!==services.auth.getUser()?.id)return;
        const context=[...state.chatContext],clientTurnId=makeId('turn');
        stopChatRecovery();
        state.chat.push({id:clientTurnId,role:'person',content:message,echoIds:context});
        delete drafts['chat-input'];
        await sendChatTurn({id:clientTurnId,message,echoIds:context,modelKey:state.chatModel,sessionId:state.chatSessionId,owner:user.id,startedAt:Date.now()});
        break;
      }
    }
  }catch(error){state.chatBusy=false;const errorEl=document.getElementById('capture-error');if(modal.open&&errorEl)errorEl.textContent=(error as Error).message;else toast((error as Error).message||'That could not be kept. Please try again.');}
  finally{submitting=false;if(submit?.isConnected)submit.disabled=false;}
});
window.addEventListener('luna-account-changed',()=>{
  generation++;
  echoBrowseToken++;clearTimeout(echoSearchTimer);state.echoResults=undefined;state.echoBrowseKey=undefined;state.echoNextCursor=undefined;state.echoLoading=false;state.echoLoadError='';
  stopChatRecovery();state.chatBusy=false;chatLoadingPromise=null;
  stopPlayback();
  stopChatVoicePlayback();
  cancelChatDictation();
  cleanupCapture();
  closeModal();
  state.chat=[];
  state.chatSessionId=null;
  state.chatInitialized=false;
  state.chatError=null;
  state.chatContext=[];
  lastUserMessage='';
  lastChatContext=[];
  Object.keys(drafts).forEach(key=>delete drafts[key]);
  render();
});
window.addEventListener('hashchange',()=>{cancelCaptureTap();stopPlayback();stopChatVoicePlayback();cancelChatDictation();applyRoute();render(true);window.scrollTo({top:0,behavior:'instant'});});
window.addEventListener('offline',()=>render());window.addEventListener('online',()=>render());
window.addEventListener('pagehide',()=>{clearTimeout(chatPollTimer);cleanupCapture();stopChatVoicePlayback();cancelChatDictation();voiceEngine.dispose();cancelAnimationFrame(playbackFrame);audio.pause();localAudioUrls.forEach(url=>URL.revokeObjectURL(url));});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&captureActive&&recorder?.state==='recording'&&!wakeLock){
    const reacquireToken=captureToken;
    if('wakeLock' in navigator&&(navigator as any).wakeLock){
      (navigator as any).wakeLock.request('screen').then((lock:any)=>{
        if(reacquireToken!==captureToken||!captureActive||recorder?.state!=='recording'){
          lock.release?.().catch?.(()=>{});
          return;
        }
        wakeLock=lock;
        lock.addEventListener?.('release',()=>{
          if(wakeLock===lock) wakeLock=null;
        });
      }).catch(()=>{});
    }
  }
});
try{const theme=localStorage.getItem('luna-exploration-theme');if(theme==='light')document.documentElement.dataset.theme='light';}catch{}
applyRoute();render();

if(services.sync){services.sync().then(()=>{if(state.route.name==='echoes')renderEchoBrowse(true);else render();}).catch(()=>{});}
window.addEventListener('online',()=>{services.sync?.().then(()=>render()).catch(()=>{});});

// Refresh the Field after returning from Classic or an Android background pause.
let resumeSync: Promise<void> | null = null;
function syncOnReturn() {
  if(state.route.name==='chat'&&document.visibilityState==='visible')void refreshChatHistory();
  if (document.visibilityState === 'visible') fieldRealtime.start();
  if (
    document.visibilityState !== 'visible' ||
    captureActive ||
    state.chatVoiceRecording ||
    state.chatTranscribing ||
    state.chatPlayingMessageId !== null ||
    modal.open ||
    state.chatBusy ||
    resumeSync ||
    document.activeElement?.matches('input,textarea,select,[contenteditable=true]')
  ) return;
  resumeSync = Promise.resolve(services.sync?.()).then(() => {
    if (
      !captureActive &&
      !state.chatVoiceRecording &&
      !state.chatTranscribing &&
      state.chatPlayingMessageId === null &&
      !modal.open &&
      !document.activeElement?.matches('input,textarea,select,[contenteditable=true]')
    ) render();
  }).catch(() => {}).finally(() => { resumeSync = null; });
}
const fieldRealtime=createFieldRealtime({
  url:'https://eyxvsbqyzeodsjajfqsj.supabase.co',
  apiKey:'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr',
  session:getAuthSession, changed:syncOnReturn
});
window.addEventListener('luna-account-changed',()=>fieldRealtime.start());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')fieldRealtime.stop();});
window.addEventListener('pagehide',()=>fieldRealtime.stop());
window.addEventListener('pageshow',syncOnReturn);
fieldRealtime.start();
// Quiet refresh also brings changes from other devices without requiring a tab switch.
setInterval(syncOnReturn, 30000);
document.addEventListener('visibilitychange', syncOnReturn);
window.addEventListener('focus', syncOnReturn);
window.addEventListener('storage', event => {
  if (event.key === 'cosmic_echoes_v1' || event.key === 'cosmic_loops_v1') syncOnReturn();
});
