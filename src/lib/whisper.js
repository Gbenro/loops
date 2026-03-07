// Luna Loops - Audio Transcription via Groq Whisper
// Fast, accurate speech-to-text via Supabase Edge Function

const TRANSCRIBE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/transcribe-audio';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

// Transcribe audio blob via Groq Whisper API
export async function transcribeAudio(audioBlob, onProgress) {
  console.log('[Whisper] Starting transcription, blob size:', audioBlob.size, 'type:', audioBlob.type);

  if (audioBlob.size === 0) {
    console.error('[Whisper] Empty audio blob');
    throw new Error('No audio recorded');
  }

  if (onProgress) onProgress(50);

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    console.log('[Whisper] Sending to edge function...');

    // JWT verification must be disabled on this function in Supabase dashboard.
    // apikey header is sufficient for gateway access + our own rate limiting handles abuse.
    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
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
