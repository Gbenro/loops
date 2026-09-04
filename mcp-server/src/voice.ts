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
  provider?: 'openai' | 'elevenlabs' | 'openrouter' | 'web_speech';
  speed?: number;
  segmentationMode?: 'sentence' | 'paragraph' | 'none';
}

export interface VoiceOutputResult {
  audioBase64?: string;
  contentType: string;
  characterCount: number;
  rawByteCount?: number;
  packagedByteCount?: number;
  byteCount?: number;
  audioDurationSec?: number;
  bytesPerSecond?: number;
  bytesPerCharacter?: number;
  networkPayloadSizeBytes?: number;
  costPerSpokenMinuteUsd?: number;
  provider: string;
  model: string;
  voiceId: string;
  playbackMode: 'provider_audio' | 'web_speech';
  latencyMs: number;
  httpStatus?: number;
  requestId?: string | null;
  estimatedCostUsd?: number;
  requestHandled: boolean;
  synthesisSucceeded: boolean;
  audioValidated: boolean;
  success: boolean;
  error?: string;
  useClientFallback?: boolean;
  fallbackUsed?: boolean;
  providerError?: string;
}

export interface VoiceOutputTelemetry {
  playbackRequested: boolean;
  playbackMode: 'provider_audio' | 'web_speech';
  ttsProvider: string;
  ttsModel: string;
  voiceId: string;
  characterCount: number;
  rawByteCount?: number;
  packagedByteCount?: number;
  byteCount?: number;
  audioDurationSec?: number;
  bytesPerSecond?: number;
  bytesPerCharacter?: number;
  networkPayloadSizeBytes?: number;
  costPerSpokenMinuteUsd?: number;
  synthesisLatencyMs: number;
  httpStatus?: number;
  requestId?: string | null;
  estimatedCostUsd?: number;
  requestHandled: boolean;
  synthesisSucceeded: boolean;
  audioValidated: boolean;
  status: 'idle' | 'requested' | 'succeeded' | 'fallback' | 'error';
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
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Maps friendly ElevenLabs voice names/aliases to official ElevenLabs voice IDs.
 */
export const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'eleven-rachel': '21m00Tcm4TlvDq8ikWAM',
  'bella': 'EXAVITQu4vr4xnSDxMaL',
  'eleven-bella': 'EXAVITQu4vr4xnSDxMaL',
  'antoni': 'ErXwobaYiN019PkySvjV',
  'eleven-antoni': 'ErXwobaYiN019PkySvjV',
  'nicole': 'piTKgcLEGmPE4e6mEKli',
  'eleven-nicole': 'piTKgcLEGmPE4e6mEKli',
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'eleven-adam': 'pNInz6obpgDQGcFmaJgB'
};

/**
 * Splits text into natural sentence and semantic clause segments.
 * Prevents mid-sentence pauses that break meaning.
 */
export function segmentTextForSpeech(
  rawText: string,
  options?: { maxChunkLength?: number; mode?: 'sentence' | 'paragraph' | 'none' }
): string[] {
  const mode = options?.mode || 'sentence';
  const maxLen = options?.maxChunkLength || 400;
  const clean = cleanTextForSpeech(rawText);
  if (!clean) return [];

  if (mode === 'none') {
    return [clean.replace(/\s+/g, ' ')];
  }

  if (mode === 'paragraph') {
    return clean.split(/\n\s*\n+/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  const singleLine = clean.replace(/\s+/g, ' ');
  if (singleLine.length <= maxLen) {
    return [singleLine];
  }

  // Protect abbreviations: replace periods in common abbreviations temporarily
  const protectedText = singleLine
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|vs|etc|i\.e|e\.g)\./gi, '$1__DOT__')
    .replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');

  const sentenceBoundaryRegex = /(?<=[.!?…;:])\s+(?=[A-Z0-9"'“‘—])/g;
  const rawSentences = protectedText.split(sentenceBoundaryRegex);
  const sentences = rawSentences
    .map(s => s.replace(/__DOT__/g, '.').trim())
    .filter(Boolean);

  if (sentences.length === 0) return [singleLine];

  const chunks: string[] = [];
  let currentChunk = '';

  for (const s of sentences) {
    if (!currentChunk) {
      currentChunk = s;
    } else if ((currentChunk + ' ' + s).length <= maxLen) {
      currentChunk += ' ' + s;
    } else {
      chunks.push(currentChunk);
      currentChunk = s;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
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

export function ensureAudioContainer(
  buffer: Buffer,
  defaultSampleRate = 24000,
  expectedFormat: 'pcm' | 'mp3' | 'wav' | 'auto' = 'pcm'
): { buffer: Buffer; contentType: string } {
  // 1. Check for standard WAV RIFF header ('RIFF....WAVE')
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return { buffer, contentType: 'audio/wav' };
  }
  // 2. Check for standard Ogg container ('OggS')
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return { buffer, contentType: 'audio/ogg' };
  }
  // 3. Check for genuine MP3 container with ID3 header
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') {
    return { buffer, contentType: 'audio/mpeg' };
  }
  // 4. If explicitly specified as MP3 (e.g. OpenAI TTS fallback)
  if (expectedFormat === 'mp3') {
    return { buffer, contentType: 'audio/mpeg' };
  }

  // 5. Default & Kokoro path: ALWAYS wrap raw PCM in standard 44-byte RIFF WAV header!
  // Kokoro hexgrad/kokoro-82m on OpenRouter returns raw 24kHz 16-bit Mono PCM.
  // Never allow raw PCM (even with negative 0xFF 0xFF samples) to be treated as MP3.
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
      contentType: 'audio/wav',
      characterCount: 0,
      provider: 'none',
      model: 'none',
      voiceId: 'none',
      playbackMode: 'provider_audio',
      latencyMs: 0,
      requestHandled: true,
      synthesisSucceeded: false,
      audioValidated: false,
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
  let elevenLabsError: string | null = null;

  // 1. Try ElevenLabs TTS Provider if requested or configured
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || process.env.XI_API_KEY;
  const isElevenRequested =
    ttsModelConfig.provider === 'elevenlabs' ||
    req.provider === 'elevenlabs' ||
    (req.voiceId && (req.voiceId.startsWith('eleven-') || Boolean(ELEVENLABS_VOICE_MAP[req.voiceId])));

  if (isElevenRequested) {
    if (elevenLabsKey) {
      const elevenVoiceId =
        (req.voiceId && ELEVENLABS_VOICE_MAP[req.voiceId]) ||
        req.voiceId ||
        ttsModelConfig.defaultVoice ||
        '21m00Tcm4TlvDq8ikWAM';

      // Support multi-model resilience: try specified or flash/multilingual
      const candidateModels = (req.model && req.model.startsWith('eleven_'))
        ? [req.model, 'eleven_multilingual_v2', 'eleven_flash_v2_5']
        : ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];

      for (const elevenModelId of candidateModels) {
        try {
          console.log(`[Luna Voice Out] Requesting ElevenLabs TTS: voice=${elevenVoiceId}, model=${elevenModelId}, chars=${characterCount}`);

          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
              'xi-api-key': elevenLabsKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text,
              model_id: elevenModelId,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true
              }
            })
          });

          const latencyMs = Date.now() - startTime;
          const estimatedCostUsd = Number(((characterCount * 30.0) / 1000000).toFixed(6));

          if (response.ok) {
            const rawArrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(rawArrayBuffer);
            const byteCount = buffer.length;
            const audioBase64 = buffer.toString('base64');

            if (byteCount > 0) {
              console.log(`[Luna Voice Out] ElevenLabs TTS successful: ${byteCount} bytes (audio/mpeg) in ${latencyMs}ms`);
              return {
                audioBase64,
                contentType: 'audio/mpeg',
                characterCount,
                rawByteCount: byteCount,
                packagedByteCount: byteCount,
                byteCount,
                audioDurationSec: Number((characterCount / 15).toFixed(2)),
                bytesPerSecond: 16000,
                bytesPerCharacter: Number((byteCount / characterCount).toFixed(1)),
                networkPayloadSizeBytes: byteCount,
                costPerSpokenMinuteUsd: 0.03,
                provider: 'elevenlabs',
                model: elevenModelId,
                voiceId: elevenVoiceId,
                playbackMode: 'provider_audio',
                latencyMs,
                httpStatus: response.status,
                estimatedCostUsd,
                requestHandled: true,
                synthesisSucceeded: true,
                audioValidated: true,
                success: true
              };
            }
          } else {
            const errText = await response.text();
            elevenLabsError = `ElevenLabs TTS (${response.status}, model=${elevenModelId}): ${errText}`;
            lastError = elevenLabsError;
            console.warn(`[Luna Voice TTS] ElevenLabs error: ${elevenLabsError}.`);
            if (response.status === 401 || response.status === 402 || response.status === 403) {
              break;
            }
          }
        } catch (err: any) {
          elevenLabsError = `ElevenLabs exception: ${err.message}`;
          lastError = elevenLabsError;
          console.warn(`[Luna Voice TTS] ElevenLabs exception: ${err.message}.`);
          break;
        }
      }
    } else {
      elevenLabsError = 'ElevenLabs requested but ELEVENLABS_API_KEY is not configured in environment.';
      lastError = elevenLabsError;
      console.log(`[Luna Voice TTS] ${elevenLabsError} Gracefully falling back to Luna default (Kokoro).`);
    }
  }

  // 2. Try OpenRouter Dedicated Speech API (Primary production TTS engine)
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_KEY;
  if (openRouterKey && (ttsModelConfig.provider === 'openrouter' || !process.env.OPENAI_API_KEY || isElevenRequested)) {
    try {
      const openRouterModel = (ttsModelConfig.provider === 'openrouter') ? modelId : 'hexgrad/kokoro-82m';
      const kokoroVoices = ['af_nova', 'af_bella', 'af_sarah', 'af_sky', 'af_river', 'am_echo', 'am_puck', 'bm_fable'];
      const openRouterVoice = (voice && kokoroVoices.includes(voice)) ? voice : 'af_nova';

      console.log(`[Luna Voice Out] Requesting OpenRouter TTS: model=${openRouterModel}, voice=${openRouterVoice}, chars=${characterCount}`);

      const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://lunaloops.app',
          'X-Title': 'Luna Loops',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: openRouterModel,
          input: text,
          voice: openRouterVoice,
          speed
        })
      });

      const latencyMs = Date.now() - startTime;
      const requestId = response.headers.get('x-openrouter-request-id') || response.headers.get('x-request-id') || null;
      const estimatedCostUsd = Number(((characterCount * 0.62) / 1000000).toFixed(6));

      if (response.ok) {
        const rawArrayBuffer = await response.arrayBuffer();
        const rawBuffer = Buffer.from(rawArrayBuffer);
        const { buffer: packagedBuffer, contentType } = ensureAudioContainer(rawBuffer, 24000, 'pcm');
        const rawByteCount = rawBuffer.length;
        const packagedByteCount = packagedBuffer.length;
        const audioBase64 = packagedBuffer.toString('base64');
        const audioDurationSec = Number((rawByteCount / (24000 * 2)).toFixed(3)); // 24kHz 16-bit mono
        const bytesPerSecond = audioDurationSec > 0 ? Number((packagedByteCount / audioDurationSec).toFixed(1)) : packagedByteCount;
        const bytesPerCharacter = characterCount > 0 ? Number((packagedByteCount / characterCount).toFixed(1)) : packagedByteCount;
        const costPerSpokenMinuteUsd = audioDurationSec > 0 ? Number(((estimatedCostUsd / audioDurationSec) * 60).toFixed(6)) : 0;

        // Invariant assertion: OpenRouter/Kokoro raw PCM must always be packaged as WAV
        if (contentType !== 'audio/wav' || packagedByteCount !== rawByteCount + 44) {
          console.warn(`[Luna Voice Invariant Alert] Kokoro audio expected audio/wav (+44 bytes). Got: ${contentType}, raw=${rawByteCount}, packaged=${packagedByteCount}`);
        }

        // Require byteCount > 0 before reporting synthesis success
        if (packagedByteCount > 0) {
          console.log(`[Luna Voice Out] OpenRouter TTS successful: ${packagedByteCount} bytes (${contentType}, ~${audioDurationSec}s) in ${latencyMs}ms (req: ${requestId})`);

          return {
            audioBase64,
            contentType,
            characterCount,
            rawByteCount,
            packagedByteCount,
            byteCount: packagedByteCount,
            audioDurationSec,
            bytesPerSecond,
            bytesPerCharacter,
            networkPayloadSizeBytes: packagedByteCount,
            costPerSpokenMinuteUsd,
            provider: 'openrouter',
            model: openRouterModel,
            voiceId: openRouterVoice,
            playbackMode: 'provider_audio',
            latencyMs,
            httpStatus: response.status,
            requestId,
            estimatedCostUsd,
            requestHandled: true,
            synthesisSucceeded: true,
            audioValidated: true,
            success: true,
            fallbackUsed: isElevenRequested,
            providerError: isElevenRequested ? elevenLabsError || undefined : undefined
          };
        } else {
          const openRouterErr = 'OpenRouter returned empty audio buffer (0 bytes)';
          lastError = lastError ? `${lastError} | ${openRouterErr}` : openRouterErr;
          console.warn('[Luna Voice TTS] OpenRouter empty audio buffer returned');
        }
      } else {
        const errText = await response.text();
        const openRouterErr = `OpenRouter TTS (${response.status}): ${errText}`;
        lastError = lastError ? `${lastError} | ${openRouterErr}` : openRouterErr;
        console.warn(`[Luna Voice TTS] OpenRouter error (${response.status}):`, errText);
      }
    } catch (err: any) {
      const openRouterErr = `OpenRouter exception: ${err.message}`;
      lastError = lastError ? `${lastError} | ${openRouterErr}` : openRouterErr;
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
            characterCount,
            rawByteCount: byteCount,
            packagedByteCount: byteCount,
            byteCount,
            audioDurationSec: Number((characterCount / 15).toFixed(2)), // estimate ~15 chars/sec
            networkPayloadSizeBytes: byteCount,
            provider: 'openai',
            model,
            voiceId: voice,
            playbackMode: 'provider_audio',
            latencyMs,
            httpStatus: response.status,
            estimatedCostUsd,
            requestHandled: true,
            synthesisSucceeded: true,
            audioValidated: true,
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

  // 3. Client-side Web Speech fallback / Comparator
  const latencyMs = Date.now() - startTime;
  const isWebSpeechDirect = ttsModelConfig.provider === 'web_speech';
  return {
    contentType: 'audio/web-speech',
    characterCount,
    rawByteCount: 0,
    packagedByteCount: 0,
    byteCount: 0,
    audioDurationSec: Number((characterCount / 15).toFixed(2)),
    bytesPerSecond: 0,
    bytesPerCharacter: 0,
    networkPayloadSizeBytes: 0,
    costPerSpokenMinuteUsd: 0,
    provider: 'web_speech',
    model: 'browser-native',
    voiceId: 'default',
    playbackMode: 'web_speech',
    latencyMs,
    httpStatus: 200,
    estimatedCostUsd: 0,
    error: lastError || undefined,
    requestHandled: true,
    synthesisSucceeded: isWebSpeechDirect || !lastError,
    audioValidated: isWebSpeechDirect || !lastError,
    success: isWebSpeechDirect || !lastError,
    useClientFallback: true
  };
}
