// Luna Loops - Echoes Tab
// Journal entries tied to lunar phases with voice input

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MiniMoon } from '../components/MoonFace.jsx';
import { getEchoes, saveEcho as saveEchoToDb, deleteEcho as deleteEchoFromDb, updateEchoText, updateEchoAudioPath, generateId } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getLunarMonthInfo } from '../data/lunarMonths.js';
import { getPhaseContent } from '../data/phaseContent.js';
import { transcribeAudio, isModelLoaded, preloadModel } from '../lib/whisper.js';
import { saveAudio, getAudioUrl, getAudio, deleteAudio } from '../lib/audioStorage.js';
import { useEncryption } from '../lib/EncryptionContext.jsx';

// Phase-specific voice prompts
const VOICE_PROMPTS = {
  'new': 'Speak your intention...',
  'waxing-crescent': 'What wants to move?',
  'first-quarter': 'What decision is forming?',
  'waxing-gibbous': 'What do you notice?',
  'full': 'What is being revealed?',
  'waning-gibbous': 'What wants to be shared?',
  'last-quarter': 'What are you releasing?',
  'waning-crescent': 'What needs to rest?',
};

// Phase type lookup - Threshold (pivotal) vs Flow (sustained)
const PHASE_TYPES = {
  'new': 'threshold',
  'waxing-crescent': 'flow',
  'first-quarter': 'threshold',
  'waxing-gibbous': 'flow',
  'full': 'threshold',
  'waning-gibbous': 'flow',
  'last-quarter': 'threshold',
  'waning-crescent': 'flow',
};

// Get phase type from phase key (for echoes that don't have it stored)
function getPhaseType(phaseKey) {
  return PHASE_TYPES[phaseKey] || 'flow';
}

// Time-of-day emoji from ISO timestamp
function timeOfDayEmoji(isoString) {
  const hour = new Date(isoString).getHours();
  if (hour >= 5 && hour < 8) return '🌅';
  if (hour >= 8 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 17) return '🌤️';
  if (hour >= 17 && hour < 20) return '🌆';
  if (hour >= 20) return '🌃';
  return '🌙'; // midnight–5am
}

// Get local YYYY-MM-DD for any ISO timestamp
function localDateStr(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

// Short bell chime between queue tracks
function playChime() {
  return new Promise(resolve => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 1047; // C6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
      osc.onended = () => { ctx.close(); resolve(); };
    } catch { resolve(); }
  });
}

const PHASE_ORDER = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
];

export function Echoes({ userId, phrases, phrasesLoading, hemisphere = 'north' }) {
  const { encryptField, decryptField, sessionKey } = useEncryption();
  const [echoes, setEchoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [source, setSource] = useState('text'); // 'text' | 'voice'

  // Filter state
  const [filterMode, setFilterMode] = useState('day'); // 'day' | 'phase' | 'cycle'
  const [filterNavIndex, setFilterNavIndex] = useState(0); // 0 = most recent

  // Voice state (Whisper-based)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const pendingAudioBlobRef = useRef(null);  // Store audio blob until echo is saved
  const [playingId, setPlayingId] = useState(null);
  const audioPlayerRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Queue player
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queuePlaying, setQueuePlaying] = useState(false);
  const [queueReversed, setQueueReversed] = useState(false);
  const [audioDuration, setAudioDuration] = useState(null);
  const queueRef = useRef([]);
  const playQueueTrackRef = useRef(null);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);

  // Derive sorted unique values for navigation
  const uniqueDays = useMemo(() =>
    [...new Set(echoes.map(e => e.createdAt ? localDateStr(e.createdAt) : null).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
  [echoes]);

  const uniquePhases = useMemo(() =>
    PHASE_ORDER.filter(p => echoes.some(e => e.phase === p)),
  [echoes]);

  const uniqueCycles = useMemo(() =>
    [...new Set(echoes.map(e => e.lunarMonth).filter(v => v != null))].sort((a, b) => b - a),
  [echoes]);

  const switchFilterMode = (mode) => {
    setFilterMode(mode);
    if (mode === 'phase') {
      const idx = uniquePhases.indexOf(lunarData.phase.key);
      setFilterNavIndex(idx >= 0 ? idx : 0);
    } else {
      setFilterNavIndex(0); // day → today (index 0); cycle → current cycle (index 0)
    }
  };

  // Nav list and bounds
  // Phase navigates in natural cycle order (‹ = earlier, › = later)
  // Day/cycle navigate newest-first (‹ = older, › = newer)
  const navList = filterMode === 'day' ? uniqueDays : filterMode === 'phase' ? uniquePhases : uniqueCycles;
  const isPhaseMode = filterMode === 'phase';
  const canNavPrev = isPhaseMode ? filterNavIndex > 0 : filterNavIndex < navList.length - 1;
  const canNavNext = isPhaseMode ? filterNavIndex < navList.length - 1 : filterNavIndex > 0;
  const onNavPrev = () => setFilterNavIndex(i => isPhaseMode ? i - 1 : i + 1);
  const onNavNext = () => setFilterNavIndex(i => isPhaseMode ? i + 1 : i - 1);

  // Current nav label
  const todayStr = localDateStr(new Date().toISOString());
  const navLabel = (() => {
    if (filterMode === 'day') return formatDayLabel(uniqueDays[filterNavIndex] || todayStr);
    if (filterMode === 'phase') {
      const p = uniquePhases[filterNavIndex];
      return p ? `${getPhaseEmoji(p)} ${p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` : '';
    }
    const c = uniqueCycles[filterNavIndex];
    return c != null ? getLunarMonthInfo(c, hemisphere).name : '';
  })();

  const isCurrentNav = filterMode === 'day'
    ? uniqueDays[filterNavIndex] === todayStr
    : filterMode === 'phase'
      ? uniquePhases[filterNavIndex] === lunarData.phase.key
      : uniqueCycles[filterNavIndex] === lunarData.lunarMonth;

  // Filtered echoes
  const filteredEchoes = useMemo(() => {
    if (navList.length === 0) return echoes;
    const target = navList[filterNavIndex];
    return echoes.filter(e => {
      if (filterMode === 'day') return e.createdAt ? localDateStr(e.createdAt) === target : false;
      if (filterMode === 'phase') return e.phase === target;
      return e.lunarMonth === target;
    });
  }, [echoes, filterMode, filterNavIndex, navList]);

  // Echoes that have audio — the queue for the player
  const audioQueue = useMemo(() => {
    const q = filteredEchoes.filter(e => !!e.audio_path);
    return queueReversed ? [...q].reverse() : q;
  }, [filteredEchoes, queueReversed]);

  // Keep queueRef in sync so onended closures always see the latest queue
  useEffect(() => {
    queueRef.current = audioQueue;
    if (queueIndex >= audioQueue.length) setQueueIndex(0);
  }, [audioQueue]); // eslint-disable-line

  // Stop queue and reset when filter changes
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setPlayingId(null);
    setQueuePlaying(false);
    setQueueIndex(0);
  }, [filterMode, filterNavIndex]);

  // Preload Whisper model in background
  useEffect(() => {
    preloadModel();
  }, []);

  // Tutorial action listener
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.action === 'open-echo-write') {
        setIsWriting(true);
        setSource('text');
      }
    };
    window.addEventListener('luna-tutorial-action', handler);
    return () => window.removeEventListener('luna-tutorial-action', handler);
  }, []);


  // Use generated prompts or fallbacks
  const voicePrompt = phrasesLoading
    ? (VOICE_PROMPTS[lunarData.phase.key] || 'Speak your reflection...')
    : (phrases.echoesVoicePrompt || VOICE_PROMPTS[lunarData.phase.key] || 'Speak your reflection...');

  const writePrompt = phrasesLoading
    ? "What is alive in you right now? What arrived today? What are you noticing..."
    : (phrases.echoesWritePrompt || "What is alive in you right now?");

  // Start recording
  const startRecording = useCallback(async () => {
    if (!userId) {
      alert('Sign in to record voice echoes — audio is saved securely to your account.');
      return;
    }
    try {
      console.log('[Voice] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      console.log('[Voice] Microphone access granted');

      // Find supported mime type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        // Fallback - let browser choose
        mimeType = '';
      }
      console.log('[Voice] Using mime type:', mimeType || 'browser default');

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('[Voice] Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Voice] Recording stopped, chunks:', audioChunksRef.current.length);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        console.log('[Voice] Audio blob created:', audioBlob.size, 'bytes');

        if (audioBlob.size > 0) {
          // Save blob for later storage
          pendingAudioBlobRef.current = audioBlob;

          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(audioBlob, setModelProgress);
            if (text) {
              setCurrentText(prev => prev + (prev ? ' ' : '') + text);
            } else {
              console.warn('[Voice] Empty transcription result');
            }
          } catch (error) {
            console.error('[Voice] Transcription failed:', error);
            alert('Transcription failed: ' + error.message);
          }
          setIsTranscribing(false);
        } else {
          console.error('[Voice] Empty audio blob');
          alert('No audio was recorded. Please try again.');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[Voice] MediaRecorder error:', event.error);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(500); // Collect data every 500ms
      console.log('[Voice] Recording started');

      setIsRecording(true);
      setSource('voice');
      setIsWriting(true);
      setRecordingTime(0);

      // Keep screen on while recording
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
          wakeLockRef.current = lock;
        }).catch(() => {}); // silently ignore if denied
      }

    } catch (error) {
      console.error('[Voice] Could not start recording:', error);
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Could not access microphone: ' + error.message);
      }
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Release screen wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }

    }
  }, [isRecording]);

  // Recording timer — driven by isRecording state, no manual interval needed
  useEffect(() => {
    if (!isRecording) return;
    setRecordingTime(0);
    const interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // Fetch echoes on mount; decrypt encrypted texts if key is available
  useEffect(() => {
    setLoading(true);
    getEchoes(userId).then(async data => {
      const updated = await Promise.all(data.map(async echo => {
        const text = (echo.isEncrypted && sessionKey)
          ? await decryptField(echo.text)
          : echo.text;
        return { ...echo, text };
      }));
      setEchoes(updated);
      setLoading(false);
    });
  }, [userId, sessionKey, decryptField]);

  const saveEcho = async () => {
    if (!currentText.trim()) return;

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    const echoId = generateId('e');
    const hasVoice = source === 'voice' && pendingAudioBlobRef.current;

    const isEncrypted = !!sessionKey;
    const plainText = currentText.trim();
    const storedText = isEncrypted ? await encryptField(plainText) : plainText;

    const newEcho = {
      id: echoId,
      text: plainText, // plaintext in state
      source,
      audio_path: null,
      isEncrypted,
      createdAt: new Date().toISOString(),
      phase: lunarData.phase.key,
      phaseName: lunarData.phase.name,
      phaseType: lunarData.phase.phaseType, // 'threshold' | 'flow'
      lunarMonth: lunarData.lunarMonth,
      dayOfCycle: lunarData.dayOfCycle,
      zodiac: lunarData.zodiac.sign,
      illumination: lunarData.illumination,
    };

    setEchoes(prev => [newEcho, ...prev]);
    setCurrentText('');
    setIsWriting(false);
    setSource('text');
    setRecordingTime(0);

    // Save echo record first, then upload audio
    const audioBlob = pendingAudioBlobRef.current;
    pendingAudioBlobRef.current = null;

    await saveEchoToDb({ ...newEcho, text: storedText }, userId);

    // Upload audio to cloud storage (requires login — already blocked in startRecording)
    if (hasVoice && audioBlob && userId) {
      const audioPath = await saveAudio(echoId, audioBlob, userId);
      if (audioPath) {
        setEchoes(prev => prev.map(e => e.id === echoId ? { ...e, audio_path: audioPath } : e));
        await updateEchoAudioPath(echoId, audioPath, userId);
      }
    }
  };

  const deleteEcho = async (id) => {
    if (!window.confirm('Delete this echo? This cannot be undone.')) return;
    const echo = echoes.find(e => e.id === id);
    if (echo?.audio_path) await deleteAudio(echo.audio_path);
    setEchoes(prev => prev.filter(e => e.id !== id));
    setExpandedId(null);
    await deleteEchoFromDb(id, userId);
  };

  const handleUpdateEchoText = async (id, newText) => {
    setEchoes(prev => prev.map(e => e.id === id ? { ...e, text: newText } : e));
    await updateEchoText(id, newText, userId);
  };

  const cancelWriting = () => {
    if (isRecording) {
      stopRecording();
    }
    setIsWriting(false);
    setCurrentText('');
    setSource('text');
    setRecordingTime(0);
    pendingAudioBlobRef.current = null;
  };

  // Queue track player — uses ref pattern so onended always calls the latest version
  playQueueTrackRef.current = async (index) => {
    const queue = queueRef.current;
    if (index < 0 || index >= queue.length) {
      setQueuePlaying(false);
      setPlayingId(null);
      setQueueIndex(0);
      audioPlayerRef.current = null;
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    const echo = queue[index];
    setQueueIndex(index);
    const audioUrl = await getAudioUrl(echo.audio_path);
    if (!audioUrl) {
      playQueueTrackRef.current(index + 1);
      return;
    }
    const audio = new Audio(audioUrl);
    setAudioDuration(null);
    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration)) setAudioDuration(audio.duration);
    };
    audio.onended = () => {
      audioPlayerRef.current = null;
      const hasNext = index + 1 < queueRef.current.length;
      if (hasNext) {
        playChime().then(() => playQueueTrackRef.current(index + 1));
      } else {
        playQueueTrackRef.current(index + 1);
      }
    };
    audio.onerror = () => {
      audioPlayerRef.current = null;
      playQueueTrackRef.current(index + 1);
    };
    audioPlayerRef.current = audio;
    setPlayingId(echo.id);
    setQueuePlaying(true);
    audio.play();
  };

  const stopQueue = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setQueuePlaying(false);
    setPlayingId(null);
    setQueueIndex(0);
  };

  // Play/stop audio for an echo (single card — stops queue if active)
  const playAudio = async (echoId, audioPath) => {
    // Stop queue mode if running
    if (queuePlaying) {
      setQueuePlaying(false);
    }

    // If already playing this echo, stop it
    if (playingId === echoId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    const audioUrl = await getAudioUrl(audioPath);
    if (!audioUrl) {
      setPlayingId('unavailable-' + echoId);
      setTimeout(() => setPlayingId(null), 2000);
      return;
    }

    const audio = new Audio(audioUrl);
    setAudioDuration(null);
    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration)) setAudioDuration(audio.duration);
    };
    audio.onended = () => {
      setPlayingId(null);
      audioPlayerRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioPlayerRef.current = null;
    };
    audioPlayerRef.current = audio;
    setPlayingId(echoId);
    audio.play();
  };

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040810',
        color: 'rgba(245, 230, 200, 0.4)',
        fontSize: 18,
      }}>
        〜
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#040810',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26,
          color: '#f5e6c8',
          marginBottom: 8,
        }}>
          Echoes
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          color: 'rgba(245, 230, 200, 0.4)',
        }}>
          {getPhaseEmoji(lunarData.phase.key)} {lunarData.phase.name.toUpperCase()} · DAY {lunarData.dayOfCycle}
        </div>
      </div>

      {/* Filter Navigator */}
      <div style={{ padding: '0 20px 14px' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, justifyContent: 'center' }}>
          {['day', 'phase', 'cycle'].map(mode => (
            <button
              key={mode}
              onClick={() => switchFilterMode(mode)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: filterMode === mode ? 'rgba(245, 230, 200, 0.1)' : 'transparent',
                color: filterMode === mode ? 'rgba(245, 230, 200, 0.6)' : 'rgba(245, 230, 200, 0.25)',
                fontSize: 9,
                fontFamily: 'monospace',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Arrow navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}>
          <button
            onClick={onNavPrev}
            disabled={!canNavPrev}
            style={{
              background: 'none',
              border: 'none',
              color: canNavPrev ? 'rgba(245, 230, 200, 0.5)' : 'rgba(245, 230, 200, 0.15)',
              fontSize: 16,
              cursor: canNavPrev ? 'pointer' : 'default',
              padding: '4px 8px',
            }}
          >
            ‹
          </button>
          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{
              fontSize: 13,
              color: isCurrentNav ? 'rgba(167, 139, 250, 0.8)' : 'rgba(245, 230, 200, 0.7)',
              fontFamily: "'Cormorant Garamond', serif",
            }}>
              {navLabel}
            </div>
            {isCurrentNav && (
              <div style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: 'rgba(167, 139, 250, 0.5)',
                letterSpacing: '0.1em',
                marginTop: 2,
              }}>
                CURRENT
              </div>
            )}
          </div>
          <button
            onClick={onNavNext}
            disabled={!canNavNext}
            style={{
              background: 'none',
              border: 'none',
              color: canNavNext ? 'rgba(245, 230, 200, 0.5)' : 'rgba(245, 230, 200, 0.15)',
              fontSize: 16,
              cursor: canNavNext ? 'pointer' : 'default',
              padding: '4px 8px',
            }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Write Area */}
      <div data-tutorial="echoes-write-area" style={{ padding: '0 20px 20px' }}>
        {isWriting ? (
          <div style={{
            background: 'rgba(245, 230, 200, 0.03)',
            border: `1px solid ${isRecording ? 'rgba(252, 129, 129, 0.3)' : isTranscribing ? 'rgba(167, 139, 250, 0.3)' : 'rgba(245, 230, 200, 0.1)'}`,
            borderRadius: 12,
            padding: 16,
            transition: 'border-color 0.3s',
          }}>
            {/* Recording indicator */}
            {isRecording && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: '#FC8181',
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#FC8181',
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
                <span style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                }}>
                  RECORDING {formatTime(recordingTime)} · TAP TO STOP
                </span>
              </div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: '#A78BFA',
              }}>
                <div style={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  height: 16,
                }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 2,
                        height: 8,
                        background: '#A78BFA',
                        borderRadius: 1,
                        animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                }}>
                  {!isModelLoaded() ? `LOADING WHISPER ${modelProgress}%` : 'TRANSCRIBING...'}
                </span>
              </div>
            )}

            {/* Voice prompt when recording with no text */}
            {isRecording && !currentText && (
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                fontStyle: 'italic',
                color: 'rgba(252, 129, 129, 0.5)',
                marginBottom: 12,
              }}>
                {voicePrompt}
              </div>
            )}

            <textarea
              autoFocus={!isRecording}
              value={currentText}
              onChange={e => {
                setCurrentText(e.target.value);
                // Only reset to text source if there's no pending voice audio
                if (!pendingAudioBlobRef.current) setSource('text');
              }}
              readOnly={isRecording || isTranscribing}
              placeholder={isRecording ? '' : writePrompt}
              style={{
                width: '100%',
                minHeight: 100,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f5e6c8',
                fontSize: 15,
                fontFamily: "'Cormorant Garamond', serif",
                lineHeight: 1.7,
                resize: 'none',
              }}
            />

            {/* Cosmic stamp with phase type */}
            <div data-tutorial="echo-stamp" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'rgba(245, 230, 200, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>{getPhaseEmoji(lunarData.phase.key)} {lunarData.phase.name}</span>
                <span style={{
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: lunarData.phase.isThreshold
                    ? 'rgba(245, 230, 200, 0.08)'
                    : 'rgba(201, 168, 76, 0.1)',
                  color: lunarData.phase.isThreshold
                    ? 'rgba(245, 230, 200, 0.5)'
                    : 'rgba(201, 168, 76, 0.7)',
                  fontSize: 7,
                  letterSpacing: '0.05em',
                }}>
                  {lunarData.phase.isThreshold ? 'THRESHOLD' : 'FLOW'}
                </span>
                <span>· {lunarData.zodiac.sign} · Day {lunarData.dayOfCycle}</span>
              </div>

              {/* Voice orb */}
              <button
                data-tutorial="echoes-voice-orb"
                onClick={toggleRecording}
                disabled={isTranscribing}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording
                    ? 'rgba(252, 129, 129, 0.2)'
                    : isTranscribing
                      ? 'rgba(167, 139, 250, 0.2)'
                      : 'rgba(245, 230, 200, 0.08)',
                  color: isRecording
                    ? '#FC8181'
                    : isTranscribing
                      ? '#A78BFA'
                      : 'rgba(245, 230, 200, 0.5)',
                  cursor: isTranscribing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  position: 'relative',
                  animation: isRecording ? 'voiceOrb 2s ease-in-out infinite' : isTranscribing ? 'none' : 'voiceIdle 3s ease-in-out infinite',
                  boxShadow: isRecording
                    ? '0 0 20px rgba(252, 129, 129, 0.3)'
                    : 'none',
                  transition: 'all 0.3s',
                }}
              >
                {isRecording ? '■' : isTranscribing ? '...' : '◎'}
                {/* Ripple effect when recording */}
                {isRecording && (
                  <div style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    border: '2px solid rgba(252, 129, 129, 0.3)',
                    animation: 'ripple 1.5s ease-out infinite',
                  }} />
                )}
              </button>
            </div>

            {/* Audio ready indicator */}
            {source === 'voice' && pendingAudioBlobRef.current && !isRecording && !isTranscribing && (
              <div style={{
                fontSize: 9,
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                color: 'rgba(167, 139, 250, 0.6)',
                marginBottom: 12,
              }}>
                ◉ VOICE RECORDING READY · WILL SAVE TO CLOUD
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={cancelWriting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(245, 230, 200, 0.15)',
                  color: 'rgba(245, 230, 200, 0.5)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEcho}
                disabled={!currentText.trim() || isRecording || isTranscribing}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  background: (currentText.trim() && !isRecording && !isTranscribing)
                    ? 'rgba(245, 230, 200, 0.1)'
                    : 'rgba(245, 230, 200, 0.03)',
                  border: '1px solid rgba(245, 230, 200, 0.2)',
                  color: (currentText.trim() && !isRecording && !isTranscribing)
                    ? '#f5e6c8'
                    : 'rgba(245, 230, 200, 0.3)',
                  fontSize: 12,
                  cursor: (currentText.trim() && !isRecording && !isTranscribing) ? 'pointer' : 'default',
                }}
              >
                {isRecording ? 'STOP FIRST' : isTranscribing ? 'WAIT...' : 'ECHO ↩'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsWriting(true);
              setSource('text');
            }}
            style={{
              width: '100%',
              padding: '20px',
              borderRadius: 12,
              background: 'rgba(245, 230, 200, 0.03)',
              border: '1px dashed rgba(245, 230, 200, 0.15)',
              color: 'rgba(245, 230, 200, 0.4)',
              fontSize: 14,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            "{phaseContent.asks}"
          </button>
        )}
      </div>

      {/* Echoes List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `0 20px ${audioQueue.length > 0 ? '100px' : '40px'}`,
      }}>
        {echoes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(245, 230, 200, 0.3)',
            fontSize: 14,
            fontStyle: 'italic',
          }}>
            No echoes yet. What is alive in you?
          </div>
        ) : filteredEchoes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(245, 230, 200, 0.3)',
            fontSize: 13,
            fontStyle: 'italic',
          }}>
            No echoes in this {filterMode}.
          </div>
        ) : (
          filteredEchoes.map(echo => (
            <EchoCard
              key={echo.id}
              echo={echo}
              isExpanded={expandedId === echo.id}
              onToggle={() => setExpandedId(expandedId === echo.id ? null : echo.id)}
              onDelete={() => deleteEcho(echo.id)}
              onPlayAudio={(id) => playAudio(id, echo.audio_path)}
              onUpdateText={handleUpdateEchoText}
              isPlaying={playingId === echo.id}
              playingDuration={playingId === echo.id ? audioDuration : null}
              isUnavailable={playingId === 'unavailable-' + echo.id}
              onDownloadAudio={async () => {
                const blob = await getAudio(echo.audio_path);
                if (!blob) return;
                const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const date = echo.createdAt ? new Date(echo.createdAt).toISOString().slice(0, 10) : 'unknown';
                const phase = (echo.phase || 'moon').replace(/\s+/g, '-');
                const zodiac = (echo.zodiac || '').toLowerCase();
                const day = echo.dayOfCycle ? `day${echo.dayOfCycle}` : '';
                const parts = ['echo', phase, zodiac, day, date].filter(Boolean);
                a.download = `${parts.join('_')}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          ))
        )}
      </div>

      {/* Queue Player Bar */}
      {audioQueue.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(10, 8, 20, 0.97)',
          borderTop: '1px solid rgba(245, 230, 200, 0.08)',
          backdropFilter: 'blur(12px)',
          zIndex: 20,
          transition: 'all 0.25s ease',
        }}>
          {queueExpanded ? (
            /* Expanded */
            <div style={{ padding: '16px 20px 20px' }}>
              {/* Collapse handle */}
              <div
                onClick={() => setQueueExpanded(false)}
                style={{
                  display: 'flex', justifyContent: 'center',
                  marginBottom: 12, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 32, height: 3, borderRadius: 2,
                  background: 'rgba(245, 230, 200, 0.2)',
                }} />
              </div>

              {/* Track info */}
              <div style={{
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'rgba(245, 230, 200, 0.35)',
                marginBottom: 6,
              }}>
                {queuePlaying || queueIndex > 0
                  ? `VOICE ${queueIndex + 1} OF ${audioQueue.length}`
                  : `${audioQueue.length} VOICE ${audioQueue.length === 1 ? 'ECHO' : 'ECHOES'}`}
              </div>

              {(queuePlaying || queueIndex > 0) && audioQueue[queueIndex] && (
                <div style={{
                  textAlign: 'center',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: 'rgba(245, 230, 200, 0.5)',
                  marginBottom: 16,
                  padding: '0 20px',
                  lineHeight: 1.5,
                  maxHeight: 40,
                  overflow: 'hidden',
                }}>
                  {audioQueue[queueIndex].text?.slice(0, 80)}{audioQueue[queueIndex].text?.length > 80 ? '…' : ''}
                </div>
              )}

              {/* Controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
              }}>
                <button
                  onClick={() => playQueueTrackRef.current(queueIndex - 1)}
                  disabled={queueIndex === 0}
                  style={{
                    background: 'none', border: 'none',
                    color: queueIndex > 0 ? 'rgba(245, 230, 200, 0.6)' : 'rgba(245, 230, 200, 0.2)',
                    fontSize: 20, cursor: queueIndex > 0 ? 'pointer' : 'default',
                    padding: '4px 8px',
                  }}
                >
                  ◁
                </button>

                <button
                  onClick={() => {
                    if (queuePlaying) {
                      audioPlayerRef.current?.pause();
                      setQueuePlaying(false);
                    } else if (audioPlayerRef.current) {
                      audioPlayerRef.current.play();
                      setQueuePlaying(true);
                    } else {
                      playQueueTrackRef.current(queueIndex);
                    }
                  }}
                  style={{
                    width: 48, height: 48,
                    borderRadius: '50%',
                    border: '1px solid rgba(245, 230, 200, 0.2)',
                    background: 'rgba(245, 230, 200, 0.08)',
                    color: '#f5e6c8',
                    fontSize: 18,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {queuePlaying ? '⏸' : '▶'}
                </button>

                <button
                  onClick={() => playQueueTrackRef.current(queueIndex + 1)}
                  disabled={queueIndex >= audioQueue.length - 1}
                  style={{
                    background: 'none', border: 'none',
                    color: queueIndex < audioQueue.length - 1 ? 'rgba(245, 230, 200, 0.6)' : 'rgba(245, 230, 200, 0.2)',
                    fontSize: 20,
                    cursor: queueIndex < audioQueue.length - 1 ? 'pointer' : 'default',
                    padding: '4px 8px',
                  }}
                >
                  ▷
                </button>
              </div>

              {/* Duration + Reverse */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                  color: 'rgba(245, 230, 200, 0.3)',
                }}>
                  {audioDuration != null ? formatTime(Math.round(audioDuration)) : ''}
                </div>
                <button
                  onClick={() => {
                    setQueueReversed(r => !r);
                    setQueueIndex(0);
                    if (queuePlaying) stopQueue();
                  }}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 9, fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    color: queueReversed ? 'rgba(167, 139, 250, 0.7)' : 'rgba(245, 230, 200, 0.3)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  ⇅ {queueReversed ? 'OLDEST FIRST' : 'NEWEST FIRST'}
                </button>
              </div>
            </div>
          ) : (
            /* Minimized */
            <div
              style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                gap: 12, cursor: 'pointer',
              }}
            >
              {/* Play/stop button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (queuePlaying) {
                    audioPlayerRef.current?.pause();
                    setQueuePlaying(false);
                  } else if (audioPlayerRef.current) {
                    audioPlayerRef.current.play();
                    setQueuePlaying(true);
                  } else {
                    playQueueTrackRef.current(queueIndex);
                  }
                }}
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(245, 230, 200, 0.15)',
                  background: queuePlaying ? 'rgba(167, 139, 250, 0.15)' : 'rgba(245, 230, 200, 0.06)',
                  color: queuePlaying ? '#A78BFA' : 'rgba(245, 230, 200, 0.6)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {queuePlaying ? '⏸' : '▶'}
              </button>

              {/* Label */}
              <div
                onClick={() => setQueueExpanded(true)}
                style={{ flex: 1, overflow: 'hidden' }}
              >
                {queuePlaying && audioQueue[queueIndex] ? (
                  <>
                    <div style={{
                      fontSize: 9, fontFamily: 'monospace',
                      letterSpacing: '0.1em',
                      color: 'rgba(167, 139, 250, 0.7)',
                      marginBottom: 2,
                    }}>
                      PLAYING {queueIndex + 1} / {audioQueue.length}{audioDuration != null ? ` · ${formatTime(Math.round(audioDuration))}` : ''}
                    </div>
                    <div style={{
                      fontSize: 12,
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: 'italic',
                      color: 'rgba(245, 230, 200, 0.55)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {audioQueue[queueIndex].text?.slice(0, 60)}{audioQueue[queueIndex].text?.length > 60 ? '…' : ''}
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontSize: 11, fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    color: 'rgba(245, 230, 200, 0.35)',
                  }}>
                    {audioQueue.length} VOICE {audioQueue.length === 1 ? 'ECHO' : 'ECHOES'} · PLAY ALL
                  </div>
                )}
              </div>

              {/* Expand arrow */}
              <button
                onClick={() => setQueueExpanded(true)}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(245, 230, 200, 0.25)',
                  fontSize: 14, cursor: 'pointer',
                  padding: '4px',
                  flexShrink: 0,
                }}
              >
                ↑
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voice animations */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(2.2); }
        }
        @keyframes voiceOrb {
          0%, 100% { box-shadow: 0 0 15px rgba(252, 129, 129, 0.3); }
          50% { box-shadow: 0 0 25px rgba(252, 129, 129, 0.5); }
        }
        @keyframes voiceIdle {
          0%, 100% { opacity: 0.5; box-shadow: 0 0 0px rgba(245, 230, 200, 0); }
          50% { opacity: 0.85; box-shadow: 0 0 10px rgba(245, 230, 200, 0.12); }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}


const TEXT_LIMIT = 180;

function EchoCard({ echo, isExpanded, onToggle, onDelete, onPlayAudio, onUpdateText, isPlaying, playingDuration, isUnavailable, onDownloadAudio }) {
  const [copied, setCopied] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(echo.text || '');
  const isLong = echo.text && echo.text.length > TEXT_LIMIT;
  const displayText = isLong && !textExpanded ? echo.text.slice(0, TEXT_LIMIT).trimEnd() + '…' : echo.text;

  const phaseNum = (echo.phase || 'new').includes('waxing')
    ? echo.illumination / 100 * 0.5
    : echo.phase === 'full'
      ? 0.5
      : 0.5 + (100 - echo.illumination) / 100 * 0.5;

  // Derive phase type from stored value or phase key
  const phaseType = echo.phaseType || getPhaseType(echo.phase);
  const isThreshold = phaseType === 'threshold';
  const canPlay = !!echo.audio_path;

  const copyText = () => {
    navigator.clipboard.writeText(echo.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      background: 'rgba(245, 230, 200, 0.025)',
      border: '1px solid rgba(245, 230, 200, 0.06)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
      }}>
        <MiniMoon size={20} phase={phaseNum} />
        <div style={{
          flex: 1,
          fontSize: 9,
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          color: 'rgba(245, 230, 200, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{echo.createdAt ? timeOfDayEmoji(echo.createdAt) : ''}</span>
          <span>{(echo.phaseName || 'MOON').toUpperCase()} · {isThreshold ? 'THR' : 'FLW'} · {echo.zodiac || ''} · DAY {echo.dayOfCycle || '?'}</span>
          {echo.source === 'voice' && (
            <span style={{
              padding: '1px 4px',
              borderRadius: 3,
              background: 'rgba(167, 139, 250, 0.15)',
              color: 'rgba(167, 139, 250, 0.7)',
              fontSize: 7,
              letterSpacing: '0.05em',
            }}>
              VOICE
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245, 230, 200, 0.3)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 8px',
          }}
        >
          ···
        </button>
      </div>

      {/* Text */}
      {isEditing ? (
        <div>
          <textarea
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: '100%',
              minHeight: 80,
              background: 'rgba(245, 230, 200, 0.04)',
              border: '1px solid rgba(245, 230, 200, 0.15)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#f5e6c8',
              fontSize: 15,
              fontFamily: "'Cormorant Garamond', serif",
              lineHeight: 1.76,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                onUpdateText(echo.id, editText.trim());
                setIsEditing(false);
              }}
              style={{
                background: 'none', border: '1px solid rgba(245, 230, 200, 0.2)',
                borderRadius: 6, color: 'rgba(245, 230, 200, 0.7)',
                fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em',
                cursor: 'pointer', padding: '4px 10px',
              }}
            >
              SAVE
            </button>
            <button
              onClick={() => { setEditText(echo.text || ''); setIsEditing(false); }}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(245, 230, 200, 0.3)',
                fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em',
                cursor: 'pointer', padding: '4px 8px',
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 15,
          lineHeight: 1.76,
          color: 'rgba(245, 230, 200, 0.85)',
        }}>
          {displayText}
          {isLong && (
            <span
              onClick={() => setTextExpanded(e => !e)}
              style={{
                marginLeft: 6,
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                color: 'rgba(245,230,200,0.35)',
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {textExpanded ? 'read less' : 'read more'}
            </span>
          )}
        </div>
      )}

      {/* Expanded info */}
      {isExpanded && (
        <div style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid rgba(245, 230, 200, 0.06)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'rgba(245, 230, 200, 0.3)',
            }}>
              {new Date(echo.createdAt).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {' · '}
              {echo.zodiac}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canPlay && (
                <>
                  <button
                    onClick={() => onPlayAudio(echo.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isUnavailable ? 'rgba(252, 129, 129, 0.7)' : isPlaying ? 'rgba(167, 139, 250, 0.9)' : 'rgba(167, 139, 250, 0.6)',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    {isUnavailable ? '✕ NOT FOUND' : isPlaying ? `■ ${playingDuration != null ? Math.round(playingDuration) + 's' : 'STOP'}` : '▶ PLAY'}
                  </button>
                  <button
                    onClick={() => onDownloadAudio()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(167, 139, 250, 0.6)',
                      fontSize: 14,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      lineHeight: 1,
                    }}
                  >
                    ↓
                  </button>
                </>
              )}
              <button
                onClick={() => { setEditText(echo.text || ''); setIsEditing(true); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(245, 230, 200, 0.4)',
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ✎
              </button>
              <button
                onClick={copyText}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copied ? 'rgba(134, 239, 172, 0.8)' : 'rgba(245, 230, 200, 0.4)',
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
              >
                {copied ? '✓' : '⎘'}
              </button>
              <button
                onClick={onDelete}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(252, 129, 129, 0.6)',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
