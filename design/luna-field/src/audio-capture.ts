/** Speech capture preferences are ideals: older phones may use their supported settings. */
export const VOICE_BIT_RATE = 192_000;
export function voiceCaptureConstraints(): MediaStreamConstraints {
  return { audio: {
    channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 },
    echoCancellation: { ideal: true }, noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true }
  } };
}

/** Retry only unsupported encoder options, never microphone permissions. */
export function createVoiceRecorder(stream: MediaStream, Recorder: typeof MediaRecorder = MediaRecorder): MediaRecorder {
  const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm']
    .find(type => Recorder.isTypeSupported(type));
  const candidates: MediaRecorderOptions[] = [
    { ...(mimeType ? {mimeType} : {}), audioBitsPerSecond: VOICE_BIT_RATE },
    ...(mimeType ? [{mimeType}] : []), {}
  ];
  for (let i=0;i<candidates.length;i++){
    try { return new Recorder(stream,candidates[i]); }
    catch(error){
      const name=(error as Error).name;
      if(i===candidates.length-1 || !['NotSupportedError','TypeError'].includes(name))throw error;
    }
  }
  throw new Error('Voice recording is unavailable.');
}
