// Luna Loops - Voice Recorder Hook (V1)
// Modular audio capture & Whisper speech-to-text integration

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from './whisper.js';
import { saveAudio } from './audioStorage.js';
import { generateId } from './storage.js';

export function useVoiceRecorder({ onTranscriptReady, userId }) {
  const [state, setState] = useState('idle'); // 'idle' | 'recording' | 'transcribing' | 'error'
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const startTimeRef = useRef(null);
  const isCancelledRef = useRef(false);

  // Clear timer and wake lock
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Stop media streams
  const stopTracks = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    isCancelledRef.current = false;
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Find supported mime type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopTracks();
        cleanupRecording();

        if (isCancelledRef.current) {
          setState('idle');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

        if (!audioBlob || audioBlob.size === 0) {
          setState('error');
          setErrorMessage('No audio recorded. Please speak after tapping the microphone.');
          return;
        }

        setState('transcribing');
        try {
          // 1. Transcribe audio via Whisper
          const transcript = await transcribeAudio(audioBlob);

          if (!transcript || !transcript.trim()) {
            setState('error');
            setErrorMessage('No speech was detected. Please try speaking closer to the microphone.');
            return;
          }

          // 2. Optionally save audio file if user is logged in (best-effort)
          let audioPath = null;
          if (userId) {
            try {
              const audioId = generateId('aud');
              const saveResult = await saveAudio(audioId, audioBlob, userId);
              if (saveResult && saveResult.path) {
                audioPath = saveResult.path;
              }
            } catch (err) {
              console.warn('[useVoiceRecorder] Audio persistence skipped:', err.message);
            }
          }

          const metadata = {
            inputType: 'voice',
            audioPath,
            durationMs,
            provider: 'groq_whisper',
            timestamp: new Date().toISOString()
          };

          setState('idle');
          if (onTranscriptReady) {
            onTranscriptReady(transcript.trim(), metadata);
          }
        } catch (err) {
          console.error('[useVoiceRecorder] Transcription error:', err);
          setState('error');
          setErrorMessage(err.message || 'Transcription failed. Please try again.');
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('[useVoiceRecorder] MediaRecorder error:', e);
        setState('error');
        setErrorMessage('Recording error occurred. Please try again.');
        cleanupRecording();
        stopTracks();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(500); // 500ms data chunks

      startTimeRef.current = Date.now();
      setRecordingDuration(0);
      setState('recording');

      // Start duration counter
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 500);

      // Keep mobile screen awake
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then((lock) => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[useVoiceRecorder] getUserMedia error:', err);
      setState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser or device settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone found on this device. Please connect a microphone and try again.');
      } else {
        setErrorMessage(`Could not start recording: ${err.message}`);
      }
    }
  }, [userId, onTranscriptReady, stopTracks, cleanupRecording]);

  // Stop recording normally (triggers onstop and transcription)
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('[useVoiceRecorder] Error stopping recorder:', err);
      }
    }
  }, [state]);

  // Cancel recording without transcribing
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('[useVoiceRecorder] Error canceling recorder:', err);
      }
    } else {
      stopTracks();
      cleanupRecording();
      setState('idle');
    }
  }, [state, stopTracks, cleanupRecording]);

  // Clear any existing error message
  const resetError = useCallback(() => {
    setErrorMessage(null);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
      stopTracks();
    };
  }, [cleanupRecording, stopTracks]);

  return {
    state,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    recordingDuration,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
    resetError
  };
}
