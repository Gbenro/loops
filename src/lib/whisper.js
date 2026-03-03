// Cosmic Loops - Browser-based Whisper Transcription
// Runs entirely on-device using Transformers.js - no data sent to servers

import { pipeline } from '@xenova/transformers';

let transcriber = null;
let isLoading = false;
let loadProgress = 0;
let loadCallbacks = [];

// Load the Whisper model (cached after first load)
export async function loadWhisperModel(onProgress) {
  if (transcriber) return transcriber;

  if (isLoading) {
    // Already loading - wait for it
    return new Promise((resolve) => {
      loadCallbacks.push(resolve);
    });
  }

  isLoading = true;
  console.log('[Whisper] Loading model...');

  try {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en', // Tiny English model ~40MB, good for mobile
      {
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            loadProgress = Math.round(progress.progress);
            if (onProgress) onProgress(loadProgress);
            console.log(`[Whisper] Loading: ${loadProgress}%`);
          }
        },
      }
    );

    console.log('[Whisper] Model loaded successfully');
    isLoading = false;

    // Resolve any waiting promises
    loadCallbacks.forEach(cb => cb(transcriber));
    loadCallbacks = [];

    return transcriber;
  } catch (error) {
    console.error('[Whisper] Failed to load model:', error);
    isLoading = false;
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
  // Ensure model is loaded
  if (!transcriber) {
    await loadWhisperModel(onProgress);
  }

  console.log('[Whisper] Transcribing audio...');

  // Convert blob to array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Decode audio to float32 samples
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get audio data as Float32Array
  const audioData = audioBuffer.getChannelData(0);

  // Transcribe
  const result = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    language: 'english',
    task: 'transcribe',
  });

  console.log('[Whisper] Transcription complete:', result.text);

  await audioContext.close();

  return result.text.trim();
}

// Preload model in background (optional, for better UX)
export function preloadModel() {
  if (!transcriber && !isLoading) {
    loadWhisperModel().catch(() => {
      // Silent fail on preload - will retry when needed
    });
  }
}
