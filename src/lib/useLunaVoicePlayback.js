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

    setActiveMessageId(messageId);
    setPlaybackStates(prev => ({ ...prev, [messageId]: 'loading' }));

    try {
      // 1. Check client audio cache
      if (audioCacheRef.current.has(messageId)) {
        const cachedBase64 = audioCacheRef.current.get(messageId);
        playBase64Audio(messageId, cachedBase64);
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
        audioCacheRef.current.set(messageId, result.audioBase64);
        playBase64Audio(messageId, result.audioBase64);
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
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      }
    }
  }, [activeMessageId, playbackStates, stopPlayback]);

  const playBase64Audio = (messageId, base64Data) => {
    try {
      const audioUrl = `data:audio/mpeg;base64,${base64Data}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
      };

      audio.onended = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        setActiveMessageId(null);
        audioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error('[Luna Voice Audio error]:', e);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
        audioRef.current = null;
      };

      audio.play().catch(err => {
        console.warn('[Luna Voice Play error]:', err);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      });
    } catch (err) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setTimeout(() => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      }, 2500);
      setActiveMessageId(null);
    }
  };

  const playClientSpeech = (messageId, text) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // contemplative, grounded pacing
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
      };

      utterance.onend = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        setActiveMessageId(null);
      };

      utterance.onerror = (e) => {
        console.warn('[Luna Voice Browser Speech error]:', e);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setTimeout(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        }, 2500);
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setTimeout(() => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      }, 2500);
      setActiveMessageId(null);
    }
  };

  return {
    playbackStates,
    activeMessageId,
    playMessage,
    stopPlayback
  };
}
