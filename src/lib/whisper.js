// Luna Loops - Audio Transcription
// Dual-path speech-to-text: Primary unified backend with resilient Supabase Edge Function fallback

const TRANSCRIBE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/transcribe-audio';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

/**
 * Maps MIME types to audio container file extensions.
 * Prioritizes container formats over codec strings (e.g. 'audio/webm;codecs=opus' -> 'webm').
 */
export function getExtensionFromMime(mimeType) {
  if (!mimeType) return 'webm';
  const lower = mimeType.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'mp4';
  if (lower.includes('ogg') || lower.includes('opus')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('flac')) return 'flac';
  return 'webm';
}

/**
 * Transcribe audio blob via unified backend with fallback to Supabase Edge Function.
 * Validates audio container size and prevents deterministic 400 retry loops.
 */
export async function transcribeAudio(audioBlob, onProgress) {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('No audio recorded. Please speak into the microphone and try again.');
  }

  if (audioBlob.size < 500) {
    throw new Error('Audio recording was too short or silent (less than 1 second). Please speak clearly and try again.');
  }

  if (onProgress) onProgress(30);

  const ext = getExtensionFromMime(audioBlob.type);
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://loops-production-e1d5.up.railway.app';
  const PRIMARY_URL = `${API_BASE}/api/voice/transcribe`;

  // 1. Primary path: Unified backend with server-side operational diagnostics
  try {
    let arrayBuffer;
    if (typeof audioBlob.arrayBuffer === 'function') {
      arrayBuffer = await audioBlob.arrayBuffer();
    } else if (typeof Response !== 'undefined') {
      arrayBuffer = await new Response(audioBlob).arrayBuffer();
    } else {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(audioBlob);
      });
    }
    const response = await fetch(PRIMARY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || `audio/${ext}`,
        'x-audio-filename': `recording.${ext}`
      },
      body: new Uint8Array(arrayBuffer)
    });

    if (response.ok) {
      const data = await response.json();
      if (onProgress) onProgress(100);
      return data.text?.trim() || '';
    }

    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Audio recording was too short or corrupted. Please record again.');
    }
  } catch (backendErr) {
    // If backend validated as 400 (too short / corrupt), throw directly to prevent sending doomed payload to gateway
    if (backendErr.message && (backendErr.message.includes('too short') || backendErr.message.includes('corrupt'))) {
      throw backendErr;
    }
    console.warn('[Whisper] Primary backend failed, falling back to Supabase Edge Function:', backendErr.message);
  }

  if (onProgress) onProgress(60);

  // 2. Fallback path: Supabase Edge Function via multipart form
  const formData = new FormData();
  formData.append('audio', audioBlob, `recording.${ext}`);

  const response = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const rawError = errorData.error || `Transcription failed: ${response.status}`;
    if (rawError.includes('400')) {
      throw new Error('Audio recording was too short or silent. Please speak clearly for at least one second and try again.');
    }
    throw new Error(rawError);
  }

  const result = await response.json();

  if (onProgress) onProgress(100);

  return result.text?.trim() || '';
}

// These are no longer needed but kept for compatibility
export function isModelLoaded() {
  return true; // API is always "loaded"
}

export function preloadModel() {
  // No-op for API-based transcription
}
