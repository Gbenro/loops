// Cosmic Loops - Browser-based Whisper Transcription
// Runs entirely on-device using Transformers.js - no data sent to servers

import { pipeline, env } from '@xenova/transformers';

// Configure for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let isLoading = false;
let loadProgress = 0;
let loadCallbacks = [];
let loadError = null;

// Load the Whisper model (cached after first load)
export async function loadWhisperModel(onProgress) {
  if (transcriber) {
    console.log('[Whisper] Model already loaded');
    return transcriber;
  }

  if (loadError) {
    console.log('[Whisper] Previous load failed, retrying...');
    loadError = null;
  }

  if (isLoading) {
    // Already loading - wait for it
    console.log('[Whisper] Already loading, waiting...');
    return new Promise((resolve, reject) => {
      loadCallbacks.push({ resolve, reject });
    });
  }

  isLoading = true;
  loadProgress = 0;
  console.log('[Whisper] Starting model download...');

  try {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en', // Tiny English model ~40MB
      {
        progress_callback: (progress) => {
          if (progress.status === 'progress' && progress.progress) {
            loadProgress = Math.round(progress.progress);
            if (onProgress) onProgress(loadProgress);
            console.log(`[Whisper] Download: ${loadProgress}%`);
          } else if (progress.status === 'done') {
            console.log(`[Whisper] Downloaded: ${progress.file}`);
          } else if (progress.status === 'loading') {
            console.log(`[Whisper] Loading: ${progress.file}`);
          }
        },
      }
    );

    console.log('[Whisper] Model loaded successfully!');
    isLoading = false;

    // Resolve any waiting promises
    loadCallbacks.forEach(cb => cb.resolve(transcriber));
    loadCallbacks = [];

    return transcriber;
  } catch (error) {
    console.error('[Whisper] Failed to load model:', error);
    loadError = error;
    isLoading = false;

    // Reject any waiting promises
    loadCallbacks.forEach(cb => cb.reject(error));
    loadCallbacks = [];

    throw error;
  }
}

// Check if model is loaded
export function isModelLoaded() {
  return transcriber !== null;
}

// Get loading progress
export function getLoadProgress() {
  return loadProgress;
}

// Transcribe audio blob
export async function transcribeAudio(audioBlob, onProgress) {
  console.log('[Whisper] Starting transcription, blob size:', audioBlob.size, 'type:', audioBlob.type);

  if (audioBlob.size === 0) {
    console.error('[Whisper] Empty audio blob');
    throw new Error('No audio recorded');
  }

  // Ensure model is loaded
  if (!transcriber) {
    console.log('[Whisper] Model not loaded, loading now...');
    await loadWhisperModel(onProgress);
  }

  console.log('[Whisper] Processing audio...');

  try {
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log('[Whisper] Array buffer size:', arrayBuffer.byteLength);

    // Decode audio to float32 samples at 16kHz (Whisper's expected sample rate)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass({ sampleRate: 16000 });

    let audioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[Whisper] Decoded audio:', audioBuffer.duration, 'seconds,', audioBuffer.numberOfChannels, 'channels');
    } catch (decodeError) {
      console.error('[Whisper] Failed to decode audio:', decodeError);
      await audioContext.close();
      throw new Error('Could not decode audio. Try speaking louder or longer.');
    }

    // Get audio data as Float32Array (mono)
    const audioData = audioBuffer.getChannelData(0);
    console.log('[Whisper] Audio samples:', audioData.length);

    // Check if audio is too short or silent
    const maxAmplitude = Math.max(...Array.from(audioData).map(Math.abs));
    console.log('[Whisper] Max amplitude:', maxAmplitude);

    if (maxAmplitude < 0.01) {
      console.warn('[Whisper] Audio seems very quiet');
    }

    // Transcribe
    console.log('[Whisper] Running transcription...');
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'english',
      task: 'transcribe',
    });

    console.log('[Whisper] Transcription complete:', result.text);

    await audioContext.close();

    return result.text.trim();
  } catch (error) {
    console.error('[Whisper] Transcription error:', error);
    throw error;
  }
}

// Preload model in background (optional, for better UX)
export function preloadModel() {
  if (!transcriber && !isLoading) {
    loadWhisperModel().catch(() => {
      // Silent fail on preload - will retry when needed
    });
  }
}
