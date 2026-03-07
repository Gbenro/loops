// Cosmic Loops - Audio Transcription via Groq Whisper
// Fast, accurate speech-to-text via Supabase Edge Function

import { supabase } from './supabase.js';

// Transcribe audio blob via Groq Whisper API
export async function transcribeAudio(audioBlob, onProgress) {
  console.log('[Whisper] Starting transcription, blob size:', audioBlob.size, 'type:', audioBlob.type);

  if (audioBlob.size === 0) {
    console.error('[Whisper] Empty audio blob');
    throw new Error('No audio recorded');
  }

  if (onProgress) onProgress(50); // Show some progress

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    console.log('[Whisper] Sending to edge function...');

    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: formData,
    });

    if (error) {
      console.error('[Whisper] Edge function error:', error);
      throw new Error(error.message || 'Transcription failed');
    }

    console.log('[Whisper] Transcription complete:', data?.text);

    if (onProgress) onProgress(100);

    return data?.text?.trim() || '';
  } catch (error) {
    console.error('[Whisper] Transcription error:', error);
    throw error;
  }
}

// These are no longer needed but kept for compatibility
export function isModelLoaded() {
  return true; // API is always "loaded"
}

export function preloadModel() {
  // No-op for API-based transcription
}
