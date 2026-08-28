// Luna Loops - Voice Architecture & Continuity Layer
// Principle: Luna owns durable voice continuity & expression policy.
// Underlying STT (Whisper, etc.) and TTS providers supply interchangeable acoustic capacity.

export interface VoiceInputProvenance {
  inputType: 'voice' | 'text';
  audioPath?: string | null;
  durationMs?: number;
  provider: string; // e.g. 'groq_whisper'
  timestamp: string;
  isOriginalAudioRetained: boolean;
  status: 'success' | 'edited' | 'fallback';
}

export interface LunaVoiceExpressionPolicy {
  // Voice expression parameters held above interchangeable TTS engines
  register: 'poet_astronomer'; // spare, grounded, warm
  brevity: 'concise' | 'standard'; // spoken turns favor higher restraint
  cadence: 'grounded_rhythmic';
  rateModifier: number; // e.g. 0.95 for contemplative pacing
  returnToLifeGuidance: boolean; // gently guides back to lived action
  silenceRespect: boolean; // avoids nervous verbal filling
}

export interface VoiceSynthesisCapacity {
  provider: 'elevenlabs' | 'openai_tts' | 'google_tts' | 'local_tts';
  modelId: string;
  voiceId: string;
  sampleRate: number;
}

export const DEFAULT_LUNA_VOICE_POLICY: LunaVoiceExpressionPolicy = {
  register: 'poet_astronomer',
  brevity: 'concise',
  cadence: 'grounded_rhythmic',
  rateModifier: 0.95,
  returnToLifeGuidance: true,
  silenceRespect: true,
};

// Format voice provenance cleanly for storage and observability
export function formatVoiceInputProvenance(raw: any): VoiceInputProvenance {
  if (!raw || raw.inputType !== 'voice') {
    return {
      inputType: 'text',
      provider: 'keyboard',
      timestamp: new Date().toISOString(),
      isOriginalAudioRetained: false,
      status: 'success'
    };
  }

  return {
    inputType: 'voice',
    audioPath: raw.audioPath || null,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    provider: raw.provider || 'groq_whisper',
    timestamp: raw.timestamp || new Date().toISOString(),
    isOriginalAudioRetained: !!raw.audioPath,
    status: raw.status || 'success'
  };
}
