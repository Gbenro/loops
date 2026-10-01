import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from './supabase';

export const DEFAULT_API_BASE_URL = 'https://loops-production-e1d5.up.railway.app';
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? window.location.origin : DEFAULT_API_BASE_URL);
export const DEFAULT_VOICE_ID = 'eleven-nicole';
export const DEFAULT_VOICE_MODEL = 'eleven_flash_v2_5';

let sharedAudioCtx = null;

export function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {
    console.warn('[Luna Voice AudioContext unlock]:', e);
  }
}

/**
 * Converts Base64 string to Blob URL
 */
export function base64ToBlobUrl(base64Data, contentType = 'audio/wav') {
  const binaryStr = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes.buffer], { type: contentType });
  return URL.createObjectURL(blob);
}

/**
 * Converts Base64 string to ArrayBuffer for Web Audio API
 */
export function base64ToArrayBuffer(base64Data) {
  const binaryStr = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Splits long text into natural sentence/clause chunks for speech synthesis.
 * Prevents Web Speech API truncation and audio API timeouts on long messages.
 */
export function segmentTextClient(text, maxChunkLen = 300) {
  if (!text) return [];
  const strText = typeof text === 'string' ? text : String(text || '');
  const clean = strText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();

  if (!clean) return [];
  if (clean.length <= maxChunkLen) return [clean];

  const protectedText = clean
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|vs|etc|i\.e|e\.g)\./gi, '$1__DOT__')
    .replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');

  const rawSentences = protectedText.split(/(?<=[.!?…;:])\s+(?=[A-Z0-9"'“‘—])/g);
  const sentences = rawSentences.map(s => s.replace(/__DOT__/g, '.').trim()).filter(Boolean);

  const chunks = [];
  let curr = '';
  for (const s of sentences) {
    if (!curr) {
      curr = s;
    } else if ((curr + ' ' + s).length <= maxChunkLen) {
      curr += ' ' + s;
    } else {
      chunks.push(curr);
      curr = s;
    }
  }
  if (curr) chunks.push(curr);
  return chunks.length > 0 ? chunks : [clean];
}

export function useLunaVoicePlayback() {
  const [playbackStates, setPlaybackStates] = useState({});
  const [activeMessageId, setActiveMessageId] = useState(null);
  
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const activeBlobUrlRef = useRef(null);

  // Sequential chunk playback state tracking
  const chunkQueueRef = useRef({ messageId: null, text: '', chunks: [], currentIndex: 0, options: {} });
  const lastFailedChunkRef = useRef(new Map());

  // Clean up Blob URLs on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopPlayback = useCallback((targetId = null) => {
    const idToStop = targetId || activeMessageId;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    if (idToStop) {
      setPlaybackStates(prev => ({ ...prev, [idToStop]: 'idle' }));
    }
    if (!targetId || targetId === activeMessageId) {
      setActiveMessageId(null);
      chunkQueueRef.current = { messageId: null, text: '', chunks: [], currentIndex: 0, options: {} };
    }
  }, [activeMessageId]);

  const pausePlayback = useCallback((targetId = null) => {
    const idToPause = targetId || activeMessageId;
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      if (idToPause) {
        setPlaybackStates(prev => ({ ...prev, [idToPause]: 'paused' }));
      }
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      if (idToPause) {
        setPlaybackStates(prev => ({ ...prev, [idToPause]: 'paused' }));
      }
    }
  }, [activeMessageId]);

  const resumePlayback = useCallback((targetId = null) => {
    const idToResume = targetId || activeMessageId;
    if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
      unlockAudio();
      audioRef.current.play().then(() => {
        if (idToResume) {
          setPlaybackStates(prev => ({ ...prev, [idToResume]: 'playing' }));
        }
      }).catch(err => {
        console.warn('[Luna Voice Resume rejected]:', err);
        if (idToResume) {
          setPlaybackStates(prev => ({ ...prev, [idToResume]: 'error' }));
        }
      });
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      if (idToResume) {
        setPlaybackStates(prev => ({ ...prev, [idToResume]: 'playing' }));
      }
    }
  }, [activeMessageId]);

  /**
   * Browser Web SpeechSynthesis Sequential Chunk Playback (Fallback)
   */
  const playClientSpeechChunk = useCallback((messageId, chunks, index = 0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setActiveMessageId(null);
      return;
    }

    if (!chunks || index >= chunks.length) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      setActiveMessageId(null);
      chunkQueueRef.current = { messageId: null, text: '', chunks: [], currentIndex: 0, options: {} };
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const chunkText = chunks[index];
      if (!chunkText || !chunkText.trim()) {
        const nextIdx = index + 1;
        if (nextIdx < chunks.length) {
          playClientSpeechChunk(messageId, chunks, nextIdx);
        } else {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
          setActiveMessageId(null);
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      chunkQueueRef.current = { messageId, text: chunks.join(' '), chunks, currentIndex: index, options: {} };

      utterance.onstart = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
        setActiveMessageId(messageId);
      };

      utterance.onend = () => {
        const nextIdx = index + 1;
        if (nextIdx < chunks.length) {
          playClientSpeechChunk(messageId, chunks, nextIdx);
        } else {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
          setActiveMessageId(null);
          chunkQueueRef.current = { messageId: null, text: '', chunks: [], currentIndex: 0, options: {} };
        }
      };

      utterance.onerror = (e) => {
        console.warn(`[Luna Voice Client Speech Chunk ${index} error]:`, e);
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) {
          // Ignore benign cancellation events
          return;
        }
        lastFailedChunkRef.current.set(messageId, index);
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Luna Voice SpeechSynthesis Exception]:', err);
      lastFailedChunkRef.current.set(messageId, index);
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'error' }));
      setActiveMessageId(null);
    }
  }, []);

  const playAudioSourceChunk = useCallback((messageId, audioSrc, chunks, index, fallbackText) => {
    try {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }

      audio.src = audioSrc;

      audio.onplay = () => {
        setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
        setActiveMessageId(messageId);
      };

      audio.onended = () => {
        const nextIdx = index + 1;
        if (chunks && nextIdx < chunks.length) {
          playChunkIndex(messageId, chunks, nextIdx, fallbackText);
        } else {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
          setActiveMessageId(null);
          chunkQueueRef.current = { messageId: null, text: '', chunks: [], currentIndex: 0, options: {} };
        }
      };

      audio.onerror = (e) => {
        console.warn(`[Luna Voice Audio Chunk ${index} error, falling back to speech]:`, e);
        lastFailedChunkRef.current.set(messageId, index);
        playClientSpeechChunk(messageId, chunks, index);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn(`[Luna Voice Play Chunk ${index} rejected, falling back to speech]:`, err);
          lastFailedChunkRef.current.set(messageId, index);
          playClientSpeechChunk(messageId, chunks, index);
        });
      }
    } catch (err) {
      console.warn(`[Luna Voice Chunk ${index} Exception, falling back to speech]:`, err);
      lastFailedChunkRef.current.set(messageId, index);
      playClientSpeechChunk(messageId, chunks, index);
    }
  }, [playClientSpeechChunk]);

  const playBase64AudioChunk = useCallback((messageId, base64Data, contentType, chunks, index, fallbackText) => {
    try {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      const mime = contentType || 'audio/wav';
      const blobUrl = base64ToBlobUrl(base64Data, mime);
      activeBlobUrlRef.current = blobUrl;
      playAudioSourceChunk(messageId, blobUrl, chunks, index, fallbackText);
    } catch (err) {
      console.warn('[Luna Voice Blob creation failed, using data URI]:', err);
      const mime = contentType || 'audio/wav';
      const audioUrl = `data:${mime};base64,${base64Data}`;
      playAudioSourceChunk(messageId, audioUrl, chunks, index, fallbackText);
    }
  }, [playAudioSourceChunk]);

  const playChunkIndex = useCallback(async (messageId, chunks, index, fullText, options = {}) => {
    if (!chunks || index >= chunks.length) {
      setPlaybackStates(prev => ({ ...prev, [messageId]: 'idle' }));
      setActiveMessageId(null);
      return;
    }

    const chunkText = chunks[index];
    const savedVoice = typeof localStorage !== 'undefined' ? localStorage.getItem('luna_voice_key') : null;
    const savedModel = typeof localStorage !== 'undefined' ? localStorage.getItem('luna_voice_model_key') : null;
    const requestedVoice = options.voiceId || savedVoice || DEFAULT_VOICE_ID;
    const requestedModel = options.model || savedModel || DEFAULT_VOICE_MODEL;
    const cacheKey = `${messageId}:${index}:${requestedVoice}:${requestedModel}`;

    chunkQueueRef.current = { messageId, text: fullText, chunks, currentIndex: index, options };

    // 1. Check audio cache for this specific chunk
    if (audioCacheRef.current.has(cacheKey)) {
      const cached = audioCacheRef.current.get(cacheKey);
      const cachedBase64 = typeof cached === 'string' ? cached : cached.audioBase64;
      const cachedType = (typeof cached === 'object' && cached?.contentType) ? cached.contentType : 'audio/wav';
      playBase64AudioChunk(messageId, cachedBase64, cachedType, chunks, index, chunkText);
      return;
    }

    // 2. Fetch TTS audio for current chunk
    try {
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
          text: chunkText.trim(),
          messageId: `${messageId}_chunk_${index}`,
          voiceId: requestedVoice,
          provider: options.provider || (requestedVoice.startsWith('eleven-') ? 'elevenlabs' : undefined),
          model: requestedModel,
          segmentationMode: 'none'
        })
      });

      if (!response.ok) {
        throw new Error(`Synthesis API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.audioBase64) {
        const contentType = result.contentType || (result.provider === 'elevenlabs' ? 'audio/mpeg' : 'audio/wav');
        audioCacheRef.current.set(cacheKey, {
          audioBase64: result.audioBase64,
          contentType
        });
        playBase64AudioChunk(messageId, result.audioBase64, contentType, chunks, index, chunkText);
      } else if (result.useClientFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        playClientSpeechChunk(messageId, chunks, index);
      } else {
        throw new Error(result.error || 'Unable to generate audio chunk');
      }
    } catch (err) {
      console.warn(`[Luna Voice Chunk ${index}] Server TTS failed, using browser speech fallback:`, err);
      playClientSpeechChunk(messageId, chunks, index);
    }
  }, [playBase64AudioChunk, playClientSpeechChunk]);

  const playMessage = useCallback(async (messageId, text, options = {}) => {
    if (!text) return;
    const strText = typeof text === 'string' ? text : String(text || '');
    if (!strText.trim()) return;

    // Toggle pause/stop if clicking active playing message
    if (activeMessageId === messageId && playbackStates[messageId] === 'playing') {
      stopPlayback(messageId);
      return;
    }

    // Stop any other playing message
    stopPlayback();

    // Unlock audio context and prime HTMLAudioElement synchronously inside user click handler
    unlockAudio();
    if (typeof Audio !== 'undefined') {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      try {
        // Silent audio priming to preserve user gesture token for subsequent async play()
        audioRef.current.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        const primePromise = audioRef.current.play();
        if (primePromise !== undefined) {
          primePromise.then(() => {
            if (audioRef.current) audioRef.current.pause();
          }).catch(() => {});
        }
      } catch (_) {}
    }

    setActiveMessageId(messageId);
    setPlaybackStates(prev => ({ ...prev, [messageId]: 'loading' }));

    // Segment long text into sentence chunks
    const chunks = segmentTextClient(strText.trim(), 300);

    // Resume from last failed chunk index if retrying
    const startIdx = (playbackStates[messageId] === 'error' && lastFailedChunkRef.current.has(messageId))
      ? lastFailedChunkRef.current.get(messageId)
      : 0;

    lastFailedChunkRef.current.delete(messageId);
    playChunkIndex(messageId, chunks, startIdx, strText.trim(), options);
  }, [activeMessageId, playbackStates, stopPlayback, playChunkIndex]);

  const replayPlayback = useCallback((messageId, text, options = {}) => {
    lastFailedChunkRef.current.delete(messageId);
    if (audioRef.current && audioRef.current.src && !audioRef.current.src.startsWith('data:audio/wav;base64,UklGRiQ')) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlaybackStates(prev => ({ ...prev, [messageId]: 'playing' }));
          setActiveMessageId(messageId);
        }).catch(() => {
          playMessage(messageId, text, options);
        });
      }
    } else {
      playMessage(messageId, text, options);
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
