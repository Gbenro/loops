import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://loops-production-e1d5.up.railway.app';

function cleanTextForSpeech(rawText) {
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
    .trim();
}

async function reportVoiceFeedback(messageId, event, details = {}) {
  if (!messageId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`${API_BASE_URL}/api/chat/telemetry/voice-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        messageId,
        event,
        ...details
      })
    });
  } catch {}
}

/**
 * Hook for Luna Voice Output V0: Playback assistant responses aloud.
 * Preserves the boundary: "Luna owns continuity. Providers supply vocal capacity."
 */
export function useLunaVoicePlayback() {
  const [playbackStates, setPlaybackStates] = useState({});
  const [activeMessageId, setActiveMessageId] = useState(null);
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeMessageId) {
      setPlaybackStates(prev => ({ ...prev, [activeMessageId]: 'idle' }));
      setActiveMessageId(null);
    }
  }, [activeMessageId]);

  const playBase64Audio = useCallback((messageId, base64Data, provider = 'openrouter', contentType = 'audio/wav') => {
    try {
      const audioUrl = `data:${contentType};base64,${base64Data}`;
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;

      let hasReportedStarted = false;
      let hasAdvancedAboveZero = false;

      const getAudioSnapshot = () => ({
        currentTime: audio.currentTime,
        duration: isNaN(audio.duration) ? null : audio.duration,
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume,
        readyState: audio.readyState,
        networkState: audio.networkState,
        hasAdvancedAboveZero
      });

      audio.onloadstart = () => {
        console.log('[Luna Voice Audio] loadstart:', getAudioSnapshot());
      };

      audio.onloadedmetadata = () => {
        console.log('[Luna Voice Audio] loadedmetadata: duration=', audio.duration, getAudioSnapshot());
      };

      audio.oncanplay = () => {
        console.log('[Luna Voice Audio] canplay:', getAudioSnapshot());
      };

      // Fired when playback actually begins audibly after buffering
      audio.onplaying = () => {
        console.log('[Luna Voice Audio] playing event fired:', getAudioSnapshot());
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
        if (!hasReportedStarted) {
          hasReportedStarted = true;
          reportVoiceFeedback(messageId, 'playback_started', {
            provider,
            contentType,
            ...getAudioSnapshot()
          });
        }
      };

      audio.ontimeupdate = () => {
        if (audio.currentTime > 0.05 && !hasAdvancedAboveZero) {
          hasAdvancedAboveZero = true;
          console.log('[Luna Voice Audio] timeupdate: currentTime advanced > 0:', audio.currentTime);
        }
      };

      audio.onended = () => {
        console.log('[Luna Voice Audio] playback ended cleanly:', getAudioSnapshot());
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        setActiveMessageId(null);
        audioRef.current = null;
        reportVoiceFeedback(messageId, 'playback_ended', {
          provider,
          contentType,
          ...getAudioSnapshot()
        });
      };

      audio.onerror = (e) => {
        const mediaErr = audio.error;
        const errCode = mediaErr ? mediaErr.code : 'UNKNOWN';
        const errMsg = mediaErr ? (mediaErr.message || `MediaError code ${errCode}`) : 'HTMLAudioElement error event';
        console.error('[Luna Voice Audio error]:', errCode, errMsg, e, getAudioSnapshot());

        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        reportVoiceFeedback(messageId, 'playback_failed', {
          provider,
          contentType,
          error: errMsg,
          errorClass: `MediaError_${errCode}`,
          ...getAudioSnapshot()
        });

        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
        audioRef.current = null;
      };

      audio.onstalled = () => {
        console.warn('[Luna Voice Audio] stalled event:', getAudioSnapshot());
      };

      audio.onwaiting = () => {
        console.warn('[Luna Voice Audio] waiting for data:', getAudioSnapshot());
      };

      audio.src = audioUrl;

      // Play audio
      audio.play().catch(err => {
        console.warn('[Luna Voice Play error]:', err);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        reportVoiceFeedback(messageId, 'playback_failed', {
          provider,
          contentType,
          error: err.message,
          errorClass: err.name,
          ...getAudioSnapshot()
        });
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      });
    } catch (err) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      reportVoiceFeedback(messageId, 'playback_failed', {
        provider,
        contentType,
        error: err.message,
        errorClass: err.name
      });
      setTimeout(() => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      }, 2500);
      setActiveMessageId(null);
    }
  }, []);

  const playClientSpeech = useCallback((messageId, text) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // contemplative, grounded pacing
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
        reportVoiceFeedback(messageId, 'playback_started', { provider: 'web_speech' });
      };

      utterance.onend = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        setActiveMessageId(null);
        reportVoiceFeedback(messageId, 'playback_ended', { provider: 'web_speech' });
      };

      utterance.onerror = (e) => {
        // If the playback was intentionally cancelled or interrupted by another message, return to idle
        if (e.error === 'interrupted' || e.error === 'canceled') {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
          setActiveMessageId(null);
          return;
        }

        console.warn('[Luna Voice Browser Speech error]:', e);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        reportVoiceFeedback(messageId, 'playback_failed', { provider: 'web_speech', error: e.error || 'SpeechSynthesis error', errorClass: 'SpeechSynthesisError' });
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      reportVoiceFeedback(messageId, 'playback_failed', { provider: 'web_speech', error: err.message, errorClass: err.name });
      setTimeout(() => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      }, 2500);
      setActiveMessageId(null);
    }
  }, []);

  const playMessage = useCallback(async (messageId, rawText) => {
    if (!rawText || !rawText.trim()) return;
    const text = cleanTextForSpeech(rawText);

    // If already playing this message, stop it (toggle behavior)
    if (activeMessageId === messageId && playbackStates[messageId] === 'playing') {
      stopPlayback();
      return;
    }

    // Stop any other active playback
    stopPlayback();

    // Synchronously prime the Web Speech engine on user click tick to preserve user activation
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }

    setActiveMessageId(messageId);
    setPlaybackStates(prev => ({ ...prev, [messageId]: 'loading' }));

    try {
      // 1. Check client memory cache first
      const cached = audioCacheRef.current.get(messageId);
      if (cached) {
        console.log('[Luna Voice Playback] Playing from client cache for message:', messageId);
        const { audioBase64, contentType } = typeof cached === 'string' ? { audioBase64: cached, contentType: 'audio/wav' } : cached;
        playBase64Audio(messageId, audioBase64, 'openrouter', contentType);
        return;
      }

      // 2. Request synthesized speech from backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_BASE_URL}/api/chat/synthesize-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          text: text.trim(),
          messageId
        })
      });

      if (!response.ok) {
        throw new Error(`Synthesis API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.audioBase64) {
        const contentType = result.contentType || 'audio/wav';
        audioCacheRef.current.set(messageId, { audioBase64: result.audioBase64, contentType });
        playBase64Audio(messageId, result.audioBase64, result.provider || 'openrouter', contentType);
      } else if (result.useClientFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        playClientSpeech(messageId, text);
      } else {
        throw new Error(result.error || 'Unable to generate audio');
      }
    } catch (err) {
      console.warn('[Luna Voice Playback] Server TTS failed, using browser speech fallback:', err);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        playClientSpeech(messageId, text);
      } else {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        reportVoiceFeedback(messageId, 'playback_failed', { provider: 'none', error: err.message, errorClass: err.name });
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      }
    }
  }, [activeMessageId, playbackStates, playBase64Audio, playClientSpeech, stopPlayback]);

  return {
    playbackStates,
    activeMessageId,
    playMessage,
    stopPlayback
  };
}
