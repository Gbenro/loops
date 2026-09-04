import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Converts a base64 string to a Blob URL.
 * Blob URLs load and decode significantly faster and more reliably than data URIs.
 */
export function base64ToBlobUrl(base64Data, mimeType = 'audio/mpeg') {
  if (typeof window === 'undefined') return '';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Hook for Luna Voice Output: Playback assistant responses aloud.
 * Preserves the boundary: "Luna owns continuity. Providers supply vocal capacity."
 */
export function useLunaVoicePlayback() {
  const [playbackStates, setPlaybackStates] = useState({});
  const [activeMessageId, setActiveMessageId] = useState(null);
  const audioRef = useRef(null);
  const activeBlobUrlRef = useRef(null);
  const audioCacheRef = useRef(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
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
    }
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeMessageId) {
      setPlaybackStates(prev => ({ ...prev, [activeMessageId]: 'idle' }));
      setActiveMessageId(null);
    }
  }, [activeMessageId]);

  const playClientSpeech = useCallback((messageId, text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setActiveMessageId(null);
      return;
    }

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

      utterance.onerror = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Luna Voice SpeechSynthesis Error]:', err);
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setActiveMessageId(null);
    }
  }, []);

  const playAudioSource = useCallback((messageId, audioSrc, fallbackText) => {
    try {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }

      audio.src = audioSrc;

      audio.onplay = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
      };

      audio.onended = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
        setActiveMessageId(null);
      };

      audio.onerror = (e) => {
        console.warn('[Luna Voice Audio element error, falling back to speech]:', e);
        if (fallbackText) {
          playClientSpeech(messageId, fallbackText);
        } else {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
          setActiveMessageId(null);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[Luna Voice Play rejected, falling back to speech]:', err);
          if (fallbackText) {
            playClientSpeech(messageId, fallbackText);
          } else {
            setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
            setActiveMessageId(null);
          }
        });
      }
    } catch (err) {
      console.warn('[Luna Voice Exception, falling back to speech]:', err);
      if (fallbackText) {
        playClientSpeech(messageId, fallbackText);
      } else {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setActiveMessageId(null);
      }
    }
  }, [playClientSpeech]);

  const playBase64Audio = useCallback((messageId, base64Data, fallbackText) => {
    try {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      const blobUrl = base64ToBlobUrl(base64Data);
      activeBlobUrlRef.current = blobUrl;
      playAudioSource(messageId, blobUrl, fallbackText);
    } catch {
      // If Blob creation fails, fallback to data URI
      const audioUrl = `data:audio/mpeg;base64,${base64Data}`;
      playAudioSource(messageId, audioUrl, fallbackText);
    }
  }, [playAudioSource]);

  const playMessage = useCallback(async (messageId, text) => {
    if (!text || !text.trim()) return;

    // If already playing this message, stop it (toggle behavior)
    if (activeMessageId === messageId && playbackStates[messageId] === 'playing') {
      stopPlayback();
      return;
    }

    // Stop any other active playback
    stopPlayback();

    // Prime audio instance synchronously on the user gesture click!
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
      try { audioRef.current.load(); } catch {}
    }

    setActiveMessageId(messageId);
    setPlaybackStates(prev => ({ ...prev, [messageId]: 'loading' }));

    try {
      // 1. Check client audio cache
      if (audioCacheRef.current.has(messageId)) {
        const cachedBase64 = audioCacheRef.current.get(messageId);
        playBase64Audio(messageId, cachedBase64, text);
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
        playBase64Audio(messageId, result.audioBase64, text);
      } else if (result.useClientFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        playClientSpeech(messageId, text);
      } else {
        throw new Error(result.error || 'Unable to generate audio');
      }
    } catch (err) {
      console.warn('[Luna Voice Playback] Server TTS failed, using browser speech fallback:', err);
      playClientSpeech(messageId, text);
    }
  }, [activeMessageId, playbackStates, stopPlayback, playBase64Audio, playClientSpeech]);

  return {
    playbackStates,
    activeMessageId,
    playMessage,
    stopPlayback,
    audioCache: audioCacheRef.current
  };
}
