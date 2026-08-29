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

export function ensureAudioContainer(buffer: Buffer, defaultSampleRate = 24000): { buffer: Buffer; contentType: string } {
  // 1. Check for standard WAV RIFF header ('RIFF....WAVE')
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return { buffer, contentType: 'audio/wav' };
  }
  // 2. Check for standard MP3 ID3 header or sync frame (0xFFFB, 0xFFF3, 0xFFF2)
  if (
    buffer.length >= 3 &&
    (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
  ) {
    return { buffer, contentType: 'audio/mpeg' };
  }
  // 3. Check for Ogg container
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return { buffer, contentType: 'audio/ogg' };
  }

  // 4. Raw PCM (24000 Hz, 16-bit Mono) -> wrap in 44-byte standard RIFF WAV header
  const sampleRate = defaultSampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + buffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(buffer.length, 40);

  return {
    buffer: Buffer.concat([wavHeader, buffer]),
    contentType: 'audio/wav'
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

  const ttsModelConfig = resolveTtsModel(req.model);
  const modelId = ttsModelConfig.modelId;
  const voice = req.voiceId || ttsModelConfig.defaultVoice;
  const speed = req.speed || DEFAULT_LUNA_VOICE_POLICY.rateModifier;

  console.log(`[Luna Voice Out] Selected TTS Provider: ${ttsModelConfig.provider}, model: ${modelId}, voice: ${voice}`);

  let lastError: string | null = null;

  // 1. Try OpenRouter Dedicated Speech API (Primary production TTS engine)
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (openRouterKey && (ttsModelConfig.provider === 'openrouter' || !process.env.OPENAI_API_KEY)) {
    try {
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
        const rawArrayBuffer = await response.arrayBuffer();
        const rawBuffer = Buffer.from(rawArrayBuffer);
        const { buffer: packagedBuffer, contentType } = ensureAudioContainer(rawBuffer, 24000);
        const audioBase64 = packagedBuffer.toString('base64');
        const byteCount = packagedBuffer.length;

        // Require byteCount > 0 before reporting synthesis success
        if (byteCount > 0) {
          console.log(`[Luna Voice Out] OpenRouter TTS successful: ${byteCount} bytes (${contentType}) in ${latencyMs}ms (req: ${requestId})`);

          return {
            audioBase64,
            contentType,
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
          lastError = 'OpenRouter returned empty audio buffer (0 bytes)';
          console.warn('[Luna Voice TTS] OpenRouter empty audio buffer returned');
        }
      } else {
        const errText = await response.text();
        lastError = `OpenRouter TTS (${response.status}): ${errText}`;
        console.warn(`[Luna Voice TTS] OpenRouter error (${response.status}):`, errText);
      }
    } catch (err: any) {
      lastError = `OpenRouter exception: ${err.message}`;
      console.warn('[Luna Voice TTS] OpenRouter TTS failed:', err.message);
    }
  }

  // 2. Direct OpenAI TTS Provider fallback ONLY if explicitly configured as provider
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (openAiKey && ttsModelConfig.provider === 'openai') {
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

        if (byteCount > 0) {
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
        }
      } else {
        const errText = await response.text();
        lastError = `OpenAI Direct TTS (${response.status}): ${errText}`;
        console.warn(`[Luna Voice TTS] OpenAI direct error (${response.status}):`, errText);
      }
    } catch (err: any) {
      lastError = `OpenAI Direct exception: ${err.message}`;
      console.warn('[Luna Voice TTS] OpenAI direct TTS failed:', err.message);
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
    error: lastError || undefined,
    success: true,
    useClientFallback: true
  };
}
