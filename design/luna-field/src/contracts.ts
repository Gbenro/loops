/** Frontend domain contracts, NOT claims about Luna's existing backend schema. */
export type PhaseId = 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous' | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
export type LoopStatus = 'open' | 'evolving' | 'completed' | 'carried-forward' | 'closed';
export type Scenario = 'ready' | 'loading' | 'empty' | 'error' | 'denied' | 'offline';
export type Provenance = 'synthetic' | 'local-session';
export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'failed';
export interface LunarContext { cycleId: string; phaseId: PhaseId; label: string; source: 'fixture' | 'backend'; }
export interface Echo { id: string; title: string; body: string; occurredAt: string; kind: 'voice' | 'text'; audioKey?: string; audioUrl?: string; audio_path?: string; duration?: number; waveform?: number[]; waveformSource?: 'decoded-audio'|'capture-levels'|'unavailable'; context: LunarContext; threadIds: string[]; provenance: Provenance; user_id?: string; syncStatus?: SyncStatus; audioSyncStatus?: SyncStatus; }
export interface Loop { id: string; title: string; note: string; status: LoopStatus; echoId?: string; history: {status: LoopStatus; at: string}[]; provenance: Provenance; user_id?: string; syncStatus?: SyncStatus; }
export interface Thread { id: string; title: string; description: string; echoIds: string[]; loopIds: string[]; }
export interface Reflection { id: string; echoId: string; author: 'person' | 'ai-assisted'; body: string; createdAt: string; provenance: Provenance; user_id?: string; }
export interface Phase { id: PhaseId; name: string; shortName: string; index: number; light: number; fixtureDate: string; }
export interface Cycle { id: string; name: string; world: 'ocean'; range: string; phases: Phase[]; }
export interface ChatMessage { id: string; role: 'person' | 'luna'; content: string; echoIds: string[]; }
export interface FieldSnapshot { echoes: Echo[]; loops: Loop[]; threads: Thread[]; reflections: Reflection[]; cycles: Cycle[]; current: LunarContext; }
export interface Page<T> { items: T[]; nextCursor?: string; }
export interface EchoQuery { cursor?: string; limit?: number; cycleId?: string; phaseId?: PhaseId; threadId?: string; search?: string; }
export interface CaptureInput { title?: string; body?: string; kind: 'voice' | 'text'; audioUrl?: string; audioBlob?: Blob; duration?: number; waveform?: number[]; waveformSource?: 'decoded-audio'|'capture-levels'|'unavailable'; context: LunarContext; }
export interface AuthUser { id: string; email?: string; }
export interface AuthAdapter { getSession(): Promise<{mode:'demo'|'authenticated'; subject?:string}>; getUser(): AuthUser | null; signIn(email: string, password: string): Promise<AuthUser>; signOut(): Promise<void>; }
export interface EchoAdapter { list(query?: EchoQuery): Promise<Page<Echo>>; get(id:string): Promise<Echo>; create(input:CaptureInput): Promise<Echo>; }
export interface LoopAdapter { list():Promise<Loop[]>; create(title:string,note?:string):Promise<Loop>; transition(id:string,status:LoopStatus):Promise<Loop>; }
export interface CycleAdapter { list():Promise<Cycle[]>; current():Promise<LunarContext>; }
export interface ThreadAdapter { list():Promise<Thread[]>; linkEcho(threadId:string,echoId:string):Promise<Thread>; }
export interface ReflectionAdapter { list(echoId?:string):Promise<Reflection[]>; add(echoId:string,body:string):Promise<Reflection>; }
export interface ChatAdapter { respond(message:string,echoIds:string[]):Promise<ChatMessage>; }
export interface AudioAdapter { resolve(echo:Echo):Promise<string | null>; }
export interface LunaServices { auth:AuthAdapter; echoes:EchoAdapter; loops:LoopAdapter; cycles:CycleAdapter; threads:ThreadAdapter; reflections:ReflectionAdapter; chat:ChatAdapter; audio:AudioAdapter; snapshot():FieldSnapshot; reset():void; mode?: string; isSampleMode?: () => boolean; setSampleMode?: (enabled: boolean) => void; sync?: () => Promise<void>; }
