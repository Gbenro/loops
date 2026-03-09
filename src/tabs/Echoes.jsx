// Luna Loops - Echoes Tab
// Journal entries tied to lunar phases with voice input

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MiniMoon } from '../components/MoonFace.jsx';
import { getEchoes, saveEcho as saveEchoToDb, deleteEcho as deleteEchoFromDb, generateId } from '../lib/storage.js';
import { getLunarData, getPhaseEmoji } from '../lib/lunar.js';
import { getPhaseContent } from '../data/phaseContent.js';
import { transcribeAudio, isModelLoaded, preloadModel } from '../lib/whisper.js';
import { saveAudio, getAudio, deleteAudio, hasAudio } from '../lib/audioStorage.js';
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

function formatDayLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

const PHASE_ORDER = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
];

export function Echoes({ userId, phrases, phrasesLoading }) {
  const { encryptField, decryptField, sessionKey } = useEncryption();
  const [echoes, setEchoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWriting, setIsWriting] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [source, setSource] = useState('text'); // 'text' | 'voice'

  // Filter state
  const [filterDay, setFilterDay] = useState('all');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterCycle, setFilterCycle] = useState('all');
  const [openFilter, setOpenFilter] = useState(null); // 'day' | 'phase' | 'cycle' | null

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
  const [keepAudio, setKeepAudio] = useState(true);  // Option to save audio locally
  const wakeLockRef = useRef(null);

  const lunarData = useMemo(() => getLunarData(), []);
  const phaseContent = getPhaseContent(lunarData.phase.key);

  // Derive unique filter options from echoes
  const filterOptions = useMemo(() => {
    const days = [...new Set(echoes.map(e => e.createdAt?.slice(0, 10)).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));
    const phases = PHASE_ORDER.filter(p => echoes.some(e => e.phase === p));
    const cycles = [...new Set(echoes.map(e => e.lunarMonth).filter(Boolean))]
      .sort((a, b) => b - a);
    return { days, phases, cycles };
  }, [echoes]);

  // Filtered echoes
  const filteredEchoes = useMemo(() => {
    return echoes.filter(e => {
      if (filterDay !== 'all' && e.createdAt?.slice(0, 10) !== filterDay) return false;
      if (filterPhase !== 'all' && e.phase !== filterPhase) return false;
      if (filterCycle !== 'all' && String(e.lunarMonth) !== filterCycle) return false;
      return true;
    });
  }, [echoes, filterDay, filterPhase, filterCycle]);

  const hasActiveFilter = filterDay !== 'all' || filterPhase !== 'all' || filterCycle !== 'all';

  // Preload Whisper model in background
  useEffect(() => {
    preloadModel();
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e) => {
      if (!e.target.closest('[data-filter-bar]')) setOpenFilter(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilter]);

  // Use generated prompts or fallbacks
  const voicePrompt = phrasesLoading
    ? (VOICE_PROMPTS[lunarData.phase.key] || 'Speak your reflection...')
    : (phrases.echoesVoicePrompt || VOICE_PROMPTS[lunarData.phase.key] || 'Speak your reflection...');

  const writePrompt = phrasesLoading
    ? "What is alive in you right now? What arrived today? What are you noticing..."
    : (phrases.echoesWritePrompt || "What is alive in you right now?");

  // Start recording
  const startRecording = useCallback(async () => {
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

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

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

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Fetch echoes on mount; decrypt encrypted texts if key is available
  useEffect(() => {
    setLoading(true);
    getEchoes(userId).then(async data => {
      const updated = await Promise.all(data.map(async echo => {
        const audioExists = await hasAudio(echo.id);
        const text = (echo.isEncrypted && sessionKey)
          ? await decryptField(echo.text)
          : echo.text;
        return { ...echo, text, hasAudio: audioExists };
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
    const willSaveAudio = hasVoice && keepAudio;

    const isEncrypted = !!sessionKey;
    const plainText = currentText.trim();
    const storedText = isEncrypted ? await encryptField(plainText) : plainText;

    const newEcho = {
      id: echoId,
      text: plainText, // plaintext in state
      source,
      hasAudio: willSaveAudio,
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
    setKeepAudio(true);  // Reset for next time

    // Save audio to IndexedDB if user chose to keep it
    if (willSaveAudio) {
      await saveAudio(echoId, pendingAudioBlobRef.current);
    }
    pendingAudioBlobRef.current = null;

    await saveEchoToDb({ ...newEcho, text: storedText }, userId);
  };

  const deleteEcho = async (id) => {
    // Also delete stored audio
    await deleteAudio(id);
    setEchoes(prev => prev.filter(e => e.id !== id));
    setExpandedId(null);
    await deleteEchoFromDb(id, userId);
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

  // Play/stop audio for an echo
  const playAudio = async (echoId) => {
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

    // Load and play the audio
    const audioBlob = await getAudio(echoId);
    if (!audioBlob) {
      setPlayingId('unavailable-' + echoId);
      setTimeout(() => setPlayingId(null), 2000);
      return;
    }
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingId(null);
        audioPlayerRef.current = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingId(null);
        audioPlayerRef.current = null;
      };

      audioPlayerRef.current = audio;
      setPlayingId(echoId);
      audio.play();
    }
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

      {/* Filter Bar */}
      <div data-filter-bar style={{ padding: '0 20px 14px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { key: 'phase', label: filterPhase !== 'all' ? (echoes.find(e => e.phase === filterPhase)?.phaseName || filterPhase) : 'Phase', value: filterPhase },
            { key: 'day', label: filterDay !== 'all' ? formatDayLabel(filterDay) : 'Day', value: filterDay },
            { key: 'cycle', label: filterCycle !== 'all' ? `Cycle ${filterCycle}` : 'Cycle', value: filterCycle },
          ].map(({ key, label, value }) => (
            <button
              key={key}
              onClick={() => setOpenFilter(openFilter === key ? null : key)}
              style={{
                padding: '5px 10px',
                borderRadius: 20,
                border: `1px solid ${value !== 'all' ? 'rgba(167, 139, 250, 0.5)' : 'rgba(245, 230, 200, 0.12)'}`,
                background: value !== 'all' ? 'rgba(167, 139, 250, 0.12)' : 'rgba(245, 230, 200, 0.03)',
                color: value !== 'all' ? 'rgba(167, 139, 250, 0.9)' : 'rgba(245, 230, 200, 0.45)',
                fontSize: 10,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label.toUpperCase()}{value !== 'all' ? ' ×' : ''}
            </button>
          ))}
          {hasActiveFilter && (
            <button
              onClick={() => { setFilterDay('all'); setFilterPhase('all'); setFilterCycle('all'); setOpenFilter(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(245, 230, 200, 0.3)',
                fontSize: 10,
                fontFamily: 'monospace',
                cursor: 'pointer',
                padding: '5px 6px',
              }}
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Dropdown */}
        {openFilter && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 20,
            zIndex: 50,
            background: '#0d1420',
            border: '1px solid rgba(245, 230, 200, 0.12)',
            borderRadius: 10,
            padding: '6px 0',
            minWidth: 160,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {openFilter === 'phase' && (
              <>
                <DropdownItem label="All phases" active={filterPhase === 'all'} onClick={() => { setFilterPhase('all'); setOpenFilter(null); }} />
                {filterOptions.phases.map(p => (
                  <DropdownItem
                    key={p}
                    label={`${getPhaseEmoji(p)} ${p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
                    active={filterPhase === p}
                    onClick={() => { setFilterPhase(p); setOpenFilter(null); }}
                  />
                ))}
              </>
            )}
            {openFilter === 'day' && (
              <>
                <DropdownItem label="All days" active={filterDay === 'all'} onClick={() => { setFilterDay('all'); setOpenFilter(null); }} />
                {filterOptions.days.map(d => (
                  <DropdownItem
                    key={d}
                    label={formatDayLabel(d)}
                    active={filterDay === d}
                    onClick={() => { setFilterDay(d); setOpenFilter(null); }}
                  />
                ))}
              </>
            )}
            {openFilter === 'cycle' && (
              <>
                <DropdownItem label="All cycles" active={filterCycle === 'all'} onClick={() => { setFilterCycle('all'); setOpenFilter(null); }} />
                {filterOptions.cycles.map(c => (
                  <DropdownItem
                    key={c}
                    label={`Cycle ${c}`}
                    active={filterCycle === String(c)}
                    onClick={() => { setFilterCycle(String(c)); setOpenFilter(null); }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Write Area */}
      <div style={{ padding: '0 20px 20px' }}>
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
                setSource('text');
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
            <div style={{
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
                  animation: isRecording ? 'voiceOrb 2s ease-in-out infinite' : 'none',
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

            {/* Keep audio option - shown after voice recording */}
            {source === 'voice' && pendingAudioBlobRef.current && !isRecording && !isTranscribing && (
              <div
                onClick={() => setKeepAudio(!keepAudio)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  marginBottom: 12,
                  borderRadius: 8,
                  background: 'rgba(167, 139, 250, 0.05)',
                  border: '1px solid rgba(167, 139, 250, 0.15)',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${keepAudio ? 'rgba(167, 139, 250, 0.7)' : 'rgba(245, 230, 200, 0.3)'}`,
                  background: keepAudio ? 'rgba(167, 139, 250, 0.3)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#f5e6c8',
                }}>
                  {keepAudio && '✓'}
                </div>
                <span style={{
                  fontSize: 11,
                  color: 'rgba(245, 230, 200, 0.7)',
                }}>
                  Save to device
                </span>
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
        padding: '0 20px 40px',
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
            No echoes match this filter.
          </div>
        ) : (
          filteredEchoes.map(echo => (
            <EchoCard
              key={echo.id}
              echo={echo}
              isExpanded={expandedId === echo.id}
              onToggle={() => setExpandedId(expandedId === echo.id ? null : echo.id)}
              onDelete={() => deleteEcho(echo.id)}
              onPlayAudio={playAudio}
              isPlaying={playingId === echo.id}
              isUnavailable={playingId === 'unavailable-' + echo.id}
              onDownloadAudio={async (echoId) => {
                const blob = await getAudio(echoId);
                if (!blob) return;
                const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `echo-${echoId}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          ))
        )}
      </div>

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

function DropdownItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 14px',
        background: active ? 'rgba(167, 139, 250, 0.12)' : 'none',
        border: 'none',
        color: active ? 'rgba(167, 139, 250, 0.9)' : 'rgba(245, 230, 200, 0.6)',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'monospace',
        letterSpacing: '0.03em',
      }}
    >
      {label}
    </button>
  );
}

function EchoCard({ echo, isExpanded, onToggle, onDelete, onPlayAudio, isPlaying, isUnavailable, onDownloadAudio }) {
  const [copied, setCopied] = useState(false);

  const phaseNum = (echo.phase || 'new').includes('waxing')
    ? echo.illumination / 100 * 0.5
    : echo.phase === 'full'
      ? 0.5
      : 0.5 + (100 - echo.illumination) / 100 * 0.5;

  // Derive phase type from stored value or phase key
  const phaseType = echo.phaseType || getPhaseType(echo.phase);
  const isThreshold = phaseType === 'threshold';
  const canPlay = echo.source === 'voice';

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
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 15,
        lineHeight: 1.76,
        color: 'rgba(245, 230, 200, 0.85)',
      }}>
        {echo.text}
      </div>

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
                    {isUnavailable ? '✕ NOT FOUND' : isPlaying ? '■ STOP' : '▶ PLAY'}
                  </button>
                  <button
                    onClick={() => onDownloadAudio(echo.id)}
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
