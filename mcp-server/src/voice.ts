// Luna Loops - Voice Architecture & Continuity Layer
// Principle: Luna owns durable voice continuity & expression policy.
// Underlying STT (Whisper, etc.) and TTS providers supply interchangeable acoustic capacity.

export interface VoiceInputProvenance {
  participated: boolean;
  inputType: 'voice' | 'text';
  audioPath?: string | null;
  durationMs?: number;
  provider: string; // e.g. 'groq_whisper' | 'keyboard'
  timestamp: string;
  originalAudioAvailable: boolean;
  transcriptionLength?: number;
  status: 'success' | 'edited' | 'fallback' | 'not_applicable';
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
  provider: 'openai' | 'elevenlabs' | 'openrouter' | 'web_speech';
  modelId: string;
  voiceId: string;
  sampleRate: number;
}

import { resolveTtsModel } from './models.js';

export interface VoiceOutputRequest {
  text: string;
  voiceId?: string;
  model?: string;
  speed?: number;
}

export interface VoiceOutputResult {
  audioBase64?: string;
  contentType: string;
  characterCount: number;
  byteCount?: number;
  provider: string;
  model: string;
  voiceId: string;
  latencyMs: number;
  httpStatus?: number;
  requestId?: string | null;
  estimatedCostUsd?: number;
  success: boolean;
  error?: string;
  useClientFallback?: boolean;
}

export interface VoiceOutputTelemetry {
  playbackRequested: boolean;
  ttsProvider: string;
  ttsModel: string;
  voiceId: string;
  characterCount: number;
  byteCount?: number;
  synthesisLatencyMs: number;
  httpStatus?: number;
  requestId?: string | null;
  estimatedCostUsd?: number;
  status: 'idle' | 'requested' | 'completed' | 'fallback' | 'error';
  success: boolean;
  error?: string | null;
  errorClass?: string | null;
  fallbackAttempted?: boolean;
  fallbackResult?: string | null;
  cached: boolean;
}

export const DEFAULT_LUNA_VOICE_POLICY: LunaVoiceExpressionPolicy = {
  register: 'poet_astronomer',
  brevity: 'concise',
  cadence: 'grounded_rhythmic',
  rateModifier: 0.95,
  returnToLifeGuidance: true,
  silenceRespect: true,
};

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/>\s+/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Luna Voice Input Provenance Helper
 */
export function formatVoiceInputProvenance(raw: any, messageLength?: number): VoiceInputProvenance {
  if (!raw || !raw.inputType || raw.inputType === 'text') {
    return {
      participated: false,
      inputType: 'text',
      audioPath: null,
      provider: 'keyboard',
      timestamp: new Date().toISOString(),
      originalAudioAvailable: false,
      status: 'not_applicable'
    };
  }

  return {
    participated: true,
    inputType: 'voice',
    audioPath: raw.audioPath || null,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    provider: raw.provider || 'groq_whisper',
    timestamp: raw.timestamp || new Date().toISOString(),
    originalAudioAvailable: !!raw.audioPath,
    transcriptionLength: typeof messageLength === 'number' ? messageLength : undefined,
    status: raw.status || 'success'
  };
}

/**
 * Luna Voice Output V0: Synthesize speech for an assistant message response.
 * Follows the principle: "Speak the response Luna actually produced without rewriting."
 */
export async function synthesizeLunaVoice(req: VoiceOutputRequest): Promise<VoiceOutputResult> {
  const startTime = Date.now();
  const rawText = req.text?.trim() || '';
  const text = cleanTextForSpeech(rawText);
  const characterCount = text.length;

  if (!text) {
    return {
      contentType: 'audio/mpeg',
      characterCount: 0,
      provider: 'none',
      model: 'none',
      voiceId: 'none',
      latencyMs: 0,
      success: false,
      error: 'Text is required for speech synthesis'
    };
  }

  const voice = req.voiceId || 'nova'; // warm, grounded tone
  const speed = req.speed || DEFAULT_LUNA_VOICE_POLICY.rateModifier;

  // 1. Try OpenRouter Dedicated Speech API (Primary production TTS engine)
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (openRouterKey) {
    try {
      const ttsModelConfig = resolveTtsModel(req.model || 'openai/tts-1');
      const modelId = ttsModelConfig.modelId;

      console.log(`[Luna Voice Out] Requesting OpenRouter TTS: model=${modelId}, voice=${voice}, chars=${characterCount}`);

      const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://lunaloops.app',
          'X-Title': 'Luna Loops',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          input: text,
          voice,
          speed
        })
      });

      const latencyMs = Date.now() - startTime;
      const requestId = response.headers.get('x-openrouter-request-id') || response.headers.get('x-request-id') || null;
      const estimatedCostUsd = Number(((characterCount * ttsModelConfig.costPer1MChars) / 1000000).toFixed(6));

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const audioBase64 = buffer.toString('base64');
        const byteCount = buffer.length;

        console.log(`[Luna Voice Out] OpenRouter TTS successful: ${byteCount} bytes in ${latencyMs}ms (req: ${requestId})`);

        return {
          audioBase64,
          contentType: 'audio/mpeg',
          byteCount,
          characterCount,
          provider: 'openrouter',
          model: modelId,
          voiceId: voice,
          latencyMs,
          httpStatus: response.status,
          requestId,
          estimatedCostUsd,
          success: true
        };
      } else {
        const errText = await response.text();
        console.warn(`[Luna Voice TTS] OpenRouter error (${response.status}):`, errText);
      }
    } catch (err: any) {
      console.warn('[Luna Voice TTS] OpenRouter TTS failed, checking fallbacks:', err.message);
    }
  }

  // 2. Direct OpenAI TTS Provider fallback if OPENAI_API_KEY configured
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (openAiKey) {
    try {
      const model = req.model || 'tts-1';
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed
        })
      });

      const latencyMs = Date.now() - startTime;
      const estimatedCostUsd = Number(((characterCount * 15.0) / 1000000).toFixed(6));

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const audioBase64 = buffer.toString('base64');
        const byteCount = buffer.length;

        return {
          audioBase64,
          contentType: 'audio/mpeg',
          byteCount,
          characterCount,
          provider: 'openai',
          model,
          voiceId: voice,
          latencyMs,
          httpStatus: response.status,
          estimatedCostUsd,
          success: true
        };
      } else {
        const errText = await response.text();
        console.warn(`[Luna Voice TTS] OpenAI direct error (${response.status}):`, errText);
      }
    } catch (err: any) {
      console.warn('[Luna Voice TTS] OpenAI direct TTS failed, falling back:', err.message);
    }
  }

  // 3. Client-side Web Speech fallback
  const latencyMs = Date.now() - startTime;
  return {
    contentType: 'audio/web-speech',
    characterCount,
    provider: 'web_speech',
    model: 'browser-native',
    voiceId: 'default',
    latencyMs,
    httpStatus: 200,
    estimatedCostUsd: 0,
    success: true,
    useClientFallback: true
  };
}
