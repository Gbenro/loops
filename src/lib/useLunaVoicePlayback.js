import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export const DEFAULT_API_BASE_URL = 'https://loops-production-e1d5.up.railway.app';
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || DEFAULT_API_BASE_URL;

let sharedAudioCtx = null;

export function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch (_) {
      // ignore context creation error
    }
  }
  return sharedAudioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (_) {
    // ignore unlock error
  }
}

/**
 * Converts a base64 string to a Uint8Array / ArrayBuffer.
 */
export function base64ToArrayBuffer(base64Data) {
  if (typeof window === 'undefined' && typeof Buffer !== 'undefined') {
    return Buffer.from(base64Data, 'base64').buffer;
  }
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts a base64 string to a Blob URL.
 * Defaults to 'audio/wav' to match the OpenRouter / Kokoro TTS production format.
 */
export function base64ToBlobUrl(base64Data, mimeType = 'audio/wav') {
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

  const stopPlayback = useCallback((messageId) => {
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
    const targetId = messageId || activeMessageId;
    if (targetId) {
      setPlaybackStates(prev => ({ ...prev, [targetId]: 'idle' }));
    }
    setActiveMessageId(null);
  }, [activeMessageId]);

  const pausePlayback = useCallback((messageId) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const targetId = messageId || activeMessageId;
    if (targetId) {
      setPlaybackStates(prev => ({ ...prev, [targetId]: 'paused' }));
    }
  }, [activeMessageId]);

  const resumePlayback = useCallback((messageId) => {
    const targetId = messageId || activeMessageId;
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (targetId) {
            setPlaybackStates(prev => ({ ...prev, [targetId]: 'playing' }));
          }
        }).catch(err => {
          console.warn('[Luna Voice Resume rejected]:', err);
          if (targetId) {
            setPlaybackStates(prev => ({ ...prev, [targetId]: 'error' }));
          }
        });
      }
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

      utterance.onerror = (e) => {
        console.warn('[Luna Voice SpeechSynthesis onerror]:', e);
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

  const playBase64Audio = useCallback((messageId, base64Data, contentType = 'audio/wav', fallbackText) => {
    try {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      const mime = contentType || 'audio/wav';
      const blobUrl = base64ToBlobUrl(base64Data, mime);
      activeBlobUrlRef.current = blobUrl;
      playAudioSource(messageId, blobUrl, fallbackText);
    } catch (err) {
      console.warn('[Luna Voice Blob creation failed, falling back to data URI]:', err);
      const mime = contentType || 'audio/wav';
      const audioUrl = `data:${mime};base64,${base64Data}`;
      playAudioSource(messageId, audioUrl, fallbackText);
    }
  }, [playAudioSource]);

  const playMessage = useCallback(async (messageId, text) => {
    if (!text || !text.trim()) return;

    // If already playing this message, pause/stop toggle
    if (activeMessageId === messageId && playbackStates[messageId] === 'playing') {
      stopPlayback(messageId);
      return;
    }

    // Stop any other active playback
    stopPlayback();

    // Prime audio instance and AudioContext synchronously inside user gesture!
    unlockAudio();
    if (!audioRef.current && typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
      try { audioRef.current.load(); } catch (_) {}
    }

    setActiveMessageId(messageId);
    setPlaybackStates(prev => ({ ...prev, [messageId]: 'loading' }));

    try {
      // 1. Check client audio cache
      if (audioCacheRef.current.has(messageId)) {
        const cached = audioCacheRef.current.get(messageId);
        const cachedBase64 = typeof cached === 'string' ? cached : cached.audioBase64;
        const cachedType = (typeof cached === 'object' && cached?.contentType) ? cached.contentType : 'audio/wav';
        playBase64Audio(messageId, cachedBase64, cachedType, text);
        return;
      }

      // 2. Request synthesized speech from backend
      let token = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      } catch (_) {}

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
        audioCacheRef.current.set(messageId, {
          audioBase64: result.audioBase64,
          contentType
        });
        playBase64Audio(messageId, result.audioBase64, contentType, text);
      } else if (result.useClientFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        playClientSpeech(messageId, text);
      } else {
        throw new Error(result.error || 'Unable to generate audio');
      }
    } catch (err) {
      console.warn('[Luna Voice Playback] Server TTS failed, attempting browser speech fallback:', err);
      playClientSpeech(messageId, text);
    }
  }, [activeMessageId, playbackStates, stopPlayback, playBase64Audio, playClientSpeech]);

  const replayPlayback = useCallback((messageId, text) => {
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
          setActiveMessageId(messageId);
        }).catch(() => {
          playMessage(messageId, text);
        });
      }
    } else {
      playMessage(messageId, text);
    }
  }, [playMessage]);

  return {
    playbackStates,
    activeMessageId,
    playMessage,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    replayPlayback,
    audioCache: audioCacheRef.current
  };
}
