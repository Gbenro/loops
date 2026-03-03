// Cosmic Loops - Audio Transcription via Groq Whisper
// Fast, accurate speech-to-text via Supabase Edge Function

const TRANSCRIBE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/transcribe-audio';

// Transcribe audio blob via Groq Whisper API
export async function transcribeAudio(audioBlob, onProgress) {
  console.log('[Whisper] Starting transcription, blob size:', audioBlob.size, 'type:', audioBlob.type);

  if (audioBlob.size === 0) {
    console.error('[Whisper] Empty audio blob');
    throw new Error('No audio recorded');
  }

  if (onProgress) onProgress(50); // Show some progress

  try {
    // Create form data with audio file
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    console.log('[Whisper] Sending to Groq API...');

    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Whisper] API error:', response.status, errorData);
      throw new Error(errorData.error || `Transcription failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Whisper] Transcription complete:', result.text);

    if (onProgress) onProgress(100);

    return result.text?.trim() || '';
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
