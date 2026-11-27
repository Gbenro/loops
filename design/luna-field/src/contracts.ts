/** Frontend domain contracts, NOT claims about Luna's existing backend schema. */
export type PhaseId = 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous' | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
export type LoopStatus = 'open' | 'evolving' | 'completed' | 'carried-forward' | 'closed';
export type Scenario = 'ready' | 'loading' | 'empty' | 'error' | 'denied' | 'offline';
export type Provenance = 'synthetic' | 'local-session';
export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'failed';
export interface LunarContext { cycleId: string; cycleLabel?: string; phaseId: PhaseId; label: string; source: 'fixture' | 'backend'; }
export interface Echo { id: string; title: string; body: string; occurredAt: string; kind: 'voice' | 'text'; isEncrypted?: boolean; locked?: boolean; audioKey?: string; audioUrl?: string; audio_path?: string; duration?: number; waveform?: number[]; waveformSource?: 'decoded-audio'|'capture-levels'|'unavailable'; context: LunarContext; threadIds: string[]; provenance: Provenance; user_id?: string; syncStatus?: SyncStatus; audioSyncStatus?: SyncStatus; }
export interface Loop { id: string; title: string; note: string; status: LoopStatus; isEncrypted?: boolean; locked?: boolean; subtasks?: {id:string;text:string;done:boolean;isPhaseCheckpoint?:boolean;[key:string]:unknown}[]; echoId?: string; history: {status: LoopStatus; at: string}[]; provenance: Provenance; user_id?: string; syncStatus?: SyncStatus; }
export interface Thread { id: string; title: string; description: string; echoIds: string[]; loopIds: string[]; }
export interface Reflection { id: string; echoId: string; author: 'person' | 'ai-assisted'; body: string; createdAt: string; provenance: Provenance; user_id?: string; }
export interface Phase { id: PhaseId; name: string; shortName: string; index: number; light: number; fixtureDate: string; }
export interface Cycle { id: string; name: string; world: 'ocean'; range: string; phases: Phase[]; }
export interface ChatMessage { id: string; replyTo?: string; role: 'person' | 'luna'; content: string; echoIds: string[]; servingModel?: string; fallbackUsed?: boolean; fallbackNotice?: string; }
export interface FieldSnapshot { echoes: Echo[]; loops: Loop[]; threads: Thread[]; reflections: Reflection[]; cycles: Cycle[]; current: LunarContext; }
export interface Page<T> { items: T[]; nextCursor?: string; }
export interface EchoQuery { order?: 'newest'|'oldest'; since?: string; until?: string; kind?: 'voice'|'text'; cursor?: string; limit?: number; cycleId?: string; phaseId?: PhaseId; threadId?: string; search?: string; }
export interface CaptureInput { occurredAt?: string; title?: string; body?: string; kind: 'voice' | 'text'; audioUrl?: string; audioBlob?: Blob; duration?: number; waveform?: number[]; waveformSource?: 'decoded-audio'|'capture-levels'|'unavailable'; context: LunarContext; }
export interface AuthUser { id: string; email?: string; }
export interface AuthAdapter { getSession(): Promise<{mode:'demo'|'authenticated'; subject?:string}>; getUser(): AuthUser | null; signIn(email: string, password: string): Promise<AuthUser>; signOut(): Promise<void>; }
export interface EchoAdapter { list(query?: EchoQuery): Promise<Page<Echo>>; get(id:string): Promise<Echo>; create(input:CaptureInput): Promise<Echo>; }
export interface LoopAdapter { list():Promise<Loop[]>; create(title:string,note?:string):Promise<Loop>; transition(id:string,status:LoopStatus):Promise<Loop>; checklist?(id:string,action:'add'|'toggle'|'remove'|'up'|'down',itemId?:string,text?:string):Promise<Loop>; }
export interface CycleAdapter { list():Promise<Cycle[]>; current():Promise<LunarContext>; }
export interface ThreadAdapter { list():Promise<Thread[]>; linkEcho(threadId:string,echoId:string):Promise<Thread>; }
export interface SpeechSynthesisResult { audioUrl?: string; audioBase64?: string; contentType?: string; useClientFallback?: boolean; fallbackUsed?: boolean; provider?: string; model?: string; voiceId?: string; error?: string; }
export interface ChatAdapter { respond(message:string,echoIds:string[],options?:{sessionId?:string;clientTurnId?:string;modelKey?:string;signal?:AbortSignal}):Promise<ChatMessage>; getActiveSession?():Promise<string>; getMessages?(sessionId:string):Promise<ChatMessage[]>; synthesizeSpeech?(text:string,options?:{voiceId?:string;model?:string;messageId?:string;signal?:AbortSignal}):Promise<SpeechSynthesisResult>; }
export interface AudioAdapter { resolve(echo:Echo,options?:{signal?:AbortSignal;refresh?:boolean}):Promise<string | null>; }
export interface LunaServices { privacy?:{unlocked():boolean;unlock(passphrase:string):Promise<void>;lock():void}; auth:AuthAdapter; echoes:EchoAdapter; loops:LoopAdapter; cycles:CycleAdapter; threads:ThreadAdapter; reflections:ReflectionAdapter; chat:ChatAdapter; audio:AudioAdapter; snapshot():FieldSnapshot; reset():void; mode?: string; isSampleMode?: () => boolean; setSampleMode?: (enabled: boolean) => void; sync?: () => Promise<void>; }
