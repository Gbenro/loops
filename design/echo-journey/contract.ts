/** Proposed read-only boundary. Gemini review pending; not a live adapter. */
export interface JourneyEcho {
  id: string;
  title: string;
  occurredAt: string; // ISO instant; server remains authority
  kind: 'voice';
  duration?: number;
  waveform?: number[]; // measured from original audio, never fabricated in live mode
  availability: 'available' | 'unknown' | 'unavailable';
  context: {
    cycleId: string; // unique across years, not just month name
    cycleLabel: string;
    phaseId: string;
    phaseLabel: string;
  };
}
export interface JourneyCycle {
  id: string; // e.g. "lunation-331"
  lunation: number;
  label: string;
  name: string;
  monthName: string;
  year: number;
  range: string;
  cycleStart: string;
  cycleEnd: string;
  isCurrent: boolean;
  count: number;
}
export type AudioResolution =
  | { status: 'ready'; url: string }
  | { status: 'unavailable' }
  | { status: 'authentication-required' | 'forbidden' | 'retryable-error' };
export interface JourneyService {
  mode: 'authenticated';
  list(query: { cursor?: string; limit: number; signal: AbortSignal }): Promise<{
    items: JourneyEcho[]; nextCursor?: string;
  }>;
  resolve(id: string, signal: AbortSignal): Promise<AudioResolution>;
}
// Position persistence is optional and separately scoped by authenticated account.
// Never persist signed URLs, voice, transcripts, or credentials in this record.
export interface JourneyPlace {
  echoId: string;
  seconds: number;
  order: 'oldest' | 'newest';
  cycleId?: string;
}
