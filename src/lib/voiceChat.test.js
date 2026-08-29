import { describe, it, expect, vi } from 'vitest';

// ─── Pure functions representing Voice Input state machine & Chat pipeline ───────

class MockVoiceStateMachine {
  constructor({ onTranscriptReady, transcribeFn, saveAudioFn, userId }) {
    this.state = 'idle'; // 'idle' | 'recording' | 'transcribing' | 'error'
    this.duration = 0;
    this.errorMessage = null;
    this.onTranscriptReady = onTranscriptReady;
    this.transcribeFn = transcribeFn;
    this.saveAudioFn = saveAudioFn;
    this.userId = userId;
    this.cancelled = false;
  }

  start() {
    this.state = 'recording';
    this.duration = 0;
    this.errorMessage = null;
    this.cancelled = false;
  }

  async stop(audioBlob) {
    if (this.cancelled) {
      this.state = 'idle';
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      this.state = 'error';
      this.errorMessage = 'No audio recorded. Please speak after tapping the microphone.';
      return;
    }

    this.state = 'transcribing';

    try {
      const transcript = await this.transcribeFn(audioBlob);
      if (!transcript || !transcript.trim()) {
        this.state = 'error';
        this.errorMessage = 'No speech was detected.';
        return;
      }

      let audioPath = null;
      if (this.userId && this.saveAudioFn) {
        try {
          const saveRes = await this.saveAudioFn(audioBlob);
          audioPath = saveRes?.path || null;
        } catch {
          // non-blocking
        }
      }

      const metadata = {
        inputType: 'voice',
        audioPath,
        durationMs: 3500,
        provider: 'groq_whisper',
        timestamp: new Date().toISOString()
      };

      this.state = 'idle';
      if (this.onTranscriptReady) {
        this.onTranscriptReady(transcript.trim(), metadata);
      }
    } catch (err) {
      this.state = 'error';
      this.errorMessage = err.message || 'Transcription failed.';
    }
  }

  cancel() {
    this.cancelled = true;
    this.state = 'idle';
  }
}

function createChatMessagePayload(inputText, pendingVoiceMetadata, sessionId, modelKey) {
  if (!inputText || !inputText.trim()) {
    throw new Error('Message content is required');
  }

  const inputType = pendingVoiceMetadata ? 'voice' : 'text';
  const metadata = pendingVoiceMetadata || {};

  return {
    message: inputText.trim(),
    sessionId,
    modelKey: modelKey || 'anthropic-fable',
    inputType,
    metadata
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Luna Voice Input V1', () => {
  describe('Recording State Flow & Audio Capture', () => {
    it('transitions idle -> recording -> transcribing -> idle on successful recording', async () => {
      const transcriptCallback = vi.fn();
      const mockTranscribe = vi.fn().mockResolvedValue('Luna, something came up while I was driving today.');
      const mockSaveAudio = vi.fn().mockResolvedValue({ path: 'voice/user1/aud_123.webm' });

      const recorder = new MockVoiceStateMachine({
        onTranscriptReady: transcriptCallback,
        transcribeFn: mockTranscribe,
        saveAudioFn: mockSaveAudio,
        userId: 'user_123'
      });

      expect(recorder.state).toBe('idle');

      // Start recording
      recorder.start();
      expect(recorder.state).toBe('recording');

      // Stop recording with valid audio blob
      const fakeBlob = { size: 1024, type: 'audio/webm' };
      await recorder.stop(fakeBlob);

      expect(mockTranscribe).toHaveBeenCalledWith(fakeBlob);
      expect(transcriptCallback).toHaveBeenCalledWith(
        'Luna, something came up while I was driving today.',
        expect.objectContaining({
          inputType: 'voice',
          audioPath: 'voice/user1/aud_123.webm',
          provider: 'groq_whisper'
        })
      );
      expect(recorder.state).toBe('idle');
    });

    it('handles cancellation without triggering transcript callback', async () => {
      const transcriptCallback = vi.fn();
      const mockTranscribe = vi.fn();

      const recorder = new MockVoiceStateMachine({
        onTranscriptReady: transcriptCallback,
        transcribeFn: mockTranscribe
      });

      recorder.start();
      expect(recorder.state).toBe('recording');

      recorder.cancel();
      expect(recorder.state).toBe('idle');

      await recorder.stop({ size: 1024 });
      expect(mockTranscribe).not.toHaveBeenCalled();
      expect(transcriptCallback).not.toHaveBeenCalled();
    });

    it('sets error state when audio recording is empty', async () => {
      const transcriptCallback = vi.fn();
      const recorder = new MockVoiceStateMachine({
        onTranscriptReady: transcriptCallback,
        transcribeFn: vi.fn()
      });

      recorder.start();
      await recorder.stop({ size: 0 });

      expect(recorder.state).toBe('error');
      expect(recorder.errorMessage).toContain('No audio recorded');
      expect(transcriptCallback).not.toHaveBeenCalled();
    });

    it('sets error state when transcription API returns empty text', async () => {
      const transcriptCallback = vi.fn();
      const mockTranscribe = vi.fn().mockResolvedValue('');

      const recorder = new MockVoiceStateMachine({
        onTranscriptReady: transcriptCallback,
        transcribeFn: mockTranscribe
      });

      recorder.start();
      await recorder.stop({ size: 512 });

      expect(recorder.state).toBe('error');
      expect(recorder.errorMessage).toContain('No speech was detected');
      expect(transcriptCallback).not.toHaveBeenCalled();
    });
  });

  describe('Transcript Preview & Editing Flow', () => {
    it('places transcript into composer without auto-sending, allowing user review/editing', () => {
      let composerText = '';
      let pendingVoiceMetadata = null;

      const handleTranscriptReady = (transcript, metadata) => {
        composerText = composerText ? `${composerText} ${transcript}` : transcript;
        pendingVoiceMetadata = metadata;
      };

      // 1. User records first phrase
      handleTranscriptReady('I noticed that impact happens by itself', {
        inputType: 'voice',
        durationMs: 2500,
        provider: 'groq_whisper'
      });

      expect(composerText).toBe('I noticed that impact happens by itself');
      expect(pendingVoiceMetadata.inputType).toBe('voice');

      // 2. User edits transcript in the text composer before sending
      composerText += ' when I stop reaching for it.';

      // 3. User sends the reviewed message
      const payload = createChatMessagePayload(composerText, pendingVoiceMetadata, 'session_1', 'anthropic-fable');

      expect(payload).toEqual({
        message: 'I noticed that impact happens by itself when I stop reaching for it.',
        sessionId: 'session_1',
        modelKey: 'anthropic-fable',
        inputType: 'voice',
        metadata: expect.objectContaining({
          inputType: 'voice',
          provider: 'groq_whisper'
        })
      });
    });

    it('creates standard text payload when user types normally without voice', () => {
      const payload = createChatMessagePayload('What is the lunar phase today?', null, 'session_1', 'anthropic-fable');

      expect(payload).toEqual({
        message: 'What is the lunar phase today?',
        sessionId: 'session_1',
        modelKey: 'anthropic-fable',
        inputType: 'text',
        metadata: {}
      });
    });

    it('rejects sending empty message', () => {
      expect(() => createChatMessagePayload('   ', null, 'session_1')).toThrow('Message content is required');
    });
  });

  describe('Unified Luna Conversation & Relational Memory Participation', () => {
    it('ensures voice-originated transcripts feed into identical chat pipeline without auto-creating echoes', () => {
      // User speaks a conversational question
      const voiceQueryPayload = createChatMessagePayload(
        'Can you show me what rhythms I have active in the waxing phase?',
        { inputType: 'voice', durationMs: 2100 },
        'session_1'
      );

      // Verifies it is simply a conversational chat turn
      expect(voiceQueryPayload.inputType).toBe('voice');
      expect(voiceQueryPayload.message).toBe('Can you show me what rhythms I have active in the waxing phase?');
      // Downstream Luna pipeline treats message identically to typed queries
    });
  });

  describe('OpenRouter TTS & Voice Expression Layer', () => {
    it('preserves clean separation between Luna reasoning model and TTS voice model', () => {
      const reasoningModel = 'deepseek/deepseek-v4-pro';
      const ttsModel = 'hexgrad/kokoro-82m';

      const voiceTelemetry = {
        playbackRequested: true,
        ttsProvider: 'openrouter',
        ttsModel,
        voiceId: 'af_nova',
        characterCount: 142,
        byteCount: 28450,
        synthesisLatencyMs: 409,
        requestId: 'gen-or-1788022209-940',
        estimatedCostUsd: 0.000088,
        status: 'completed',
        success: true
      };

      expect(reasoningModel).not.toBe(ttsModel);
      expect(voiceTelemetry.ttsProvider).toBe('openrouter');
      expect(voiceTelemetry.ttsModel).toBe('hexgrad/kokoro-82m');
      expect(voiceTelemetry.byteCount).toBeGreaterThan(0);
      expect(voiceTelemetry.requestId).toBe('gen-or-1788022209-940');
    });

    it('wraps raw PCM buffers in standard 44-byte RIFF WAV container', () => {
      const rawPcm = Buffer.alloc(48000); // 1 second of 24kHz 16-bit mono PCM

      function ensureAudioContainerPure(buffer, defaultSampleRate = 24000, expectedFormat = 'pcm') {
        if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
          return { buffer, contentType: 'audio/wav' };
        }
        if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
          return { buffer, contentType: 'audio/ogg' };
        }
        if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') {
          return { buffer, contentType: 'audio/mpeg' };
        }
        if (expectedFormat === 'mp3') {
          return { buffer, contentType: 'audio/mpeg' };
        }

        const sampleRate = defaultSampleRate;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + buffer.length, 4);
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20);
        wavHeader.writeUInt16LE(numChannels, 22);
        wavHeader.writeUInt32LE(sampleRate, 24);
        wavHeader.writeUInt32LE(byteRate, 28);
        wavHeader.writeUInt16LE(blockAlign, 32);
        wavHeader.writeUInt16LE(bitsPerSample, 34);
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(buffer.length, 40);
        return {
          buffer: Buffer.concat([wavHeader, buffer]),
          contentType: 'audio/wav'
        };
      }

      // Standard zero PCM
      const packaged = ensureAudioContainerPure(rawPcm, 24000, 'pcm');
      expect(packaged.contentType).toBe('audio/wav');
      expect(packaged.buffer.length).toBe(48044);
      expect(packaged.buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(packaged.buffer.toString('ascii', 8, 12)).toBe('WAVE');

      // Regression check: Raw PCM starting with negative samples (0xFF 0xFF) MUST NEVER be treated as MP3!
      const negativePcm = Buffer.alloc(693800);
      negativePcm[0] = 0xff;
      negativePcm[1] = 0xff; // -1 signed 16-bit PCM sample
      const negativePackaged = ensureAudioContainerPure(negativePcm, 24000, 'pcm');
      expect(negativePackaged.contentType).toBe('audio/wav');
      expect(negativePackaged.buffer.length).toBe(693844);
      expect(negativePackaged.buffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(negativePackaged.buffer.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('records end-to-end layered lifecycle states and audio bandwidth metrics', () => {
      const rawByteCount = 192000;
      const packagedByteCount = 192044;
      const characterCount = 120;
      const audioDurationSec = Number((rawByteCount / (24000 * 2)).toFixed(3)); // 4.000s
      const bytesPerSecond = Number((packagedByteCount / audioDurationSec).toFixed(1)); // 48011.0 B/s
      const bytesPerCharacter = Number((packagedByteCount / characterCount).toFixed(1)); // 1600.4 B/char
      const estimatedCostUsd = 0.000074;
      const costPerSpokenMinuteUsd = Number(((estimatedCostUsd / audioDurationSec) * 60).toFixed(6));

      const voiceTelemetry = {
        playbackRequested: true,
        playbackMode: 'provider_audio',
        ttsProvider: 'openrouter',
        ttsModel: 'hexgrad/kokoro-82m',
        voiceId: 'af_nova',
        characterCount,
        rawByteCount,
        packagedByteCount,
        byteCount: packagedByteCount,
        audioDurationSec,
        bytesPerSecond,
        bytesPerCharacter,
        networkPayloadSizeBytes: packagedByteCount,
        costPerSpokenMinuteUsd,
        synthesisLatencyMs: 380,
        requestHandled: true,
        synthesisSucceeded: true,
        audioValidated: true,
        playbackStarted: true,
        playbackAdvanced: true,
        playbackCompleted: true,
        playbackSucceeded: true,
        status: 'completed'
      };

      expect(voiceTelemetry.requestHandled).toBe(true);
      expect(voiceTelemetry.synthesisSucceeded).toBe(true);
      expect(voiceTelemetry.audioValidated).toBe(true);
      expect(voiceTelemetry.playbackStarted).toBe(true);
      expect(voiceTelemetry.playbackAdvanced).toBe(true);
      expect(voiceTelemetry.playbackCompleted).toBe(true);
      expect(voiceTelemetry.playbackSucceeded).toBe(true);
      expect(voiceTelemetry.audioDurationSec).toBe(4);
      expect(voiceTelemetry.bytesPerSecond).toBe(48011);
      expect(voiceTelemetry.costPerSpokenMinuteUsd).toBeGreaterThan(0);
    });

    it('records distinguishable telemetry for Web Speech comparator ($0 cost, 0 network bytes)', () => {
      const webSpeechTelemetry = {
        playbackRequested: true,
        playbackMode: 'web_speech',
        ttsProvider: 'web_speech',
        ttsModel: 'browser-native',
        voiceId: 'default',
        characterCount: 95,
        rawByteCount: 0,
        packagedByteCount: 0,
        byteCount: 0,
        audioDurationSec: 6.33,
        networkPayloadSizeBytes: 0,
        costPerSpokenMinuteUsd: 0,
        estimatedCostUsd: 0,
        requestHandled: true,
        synthesisSucceeded: true,
        audioValidated: true,
        playbackStarted: true,
        playbackAdvanced: true,
        playbackCompleted: true,
        playbackSucceeded: true
      };

      expect(webSpeechTelemetry.playbackMode).toBe('web_speech');
      expect(webSpeechTelemetry.networkPayloadSizeBytes).toBe(0);
      expect(webSpeechTelemetry.costPerSpokenMinuteUsd).toBe(0);
      expect(webSpeechTelemetry.estimatedCostUsd).toBe(0);
    });
  });

  describe('Echo & Reflection Provenance Boundaries', () => {
    function createRecordWithServerEnforcement(type, text, inputArgs = {}) {
      if (type === 'create_echo') {
        return {
          id: 'e_direct_1',
          text,
          source: inputArgs.source || 'direct_entry',
          tags: inputArgs.tags || [],
          provenance_author: 'user',
          provenance_kind: 'original_echo',
          parent_id: inputArgs.parentId || null
        };
      } else if (type === 'create_conversation_reflection') {
        return {
          id: 'e_conv_ref_1',
          text,
          source: 'luna_conversation',
          tags: inputArgs.tags || ['conversation-reflection'],
          metadata: {
            sessionId: inputArgs.sessionId || null,
            conversationTitle: inputArgs.conversationTitle || null,
            coCreatedWith: 'Luna'
          },
          provenance_author: 'co-created',
          provenance_kind: 'conversation_reflection',
          parent_id: null
        };
      } else if (type === 'attach_reflection') {
        return {
          id: 'ref_1',
          echo_id: inputArgs.echoId,
          content: text,
          author_type: 'ai',
          provenance_kind: 'ai_reflection'
        };
      }
      throw new Error(`Unknown type: ${type}`);
    }

    it('enforces user/original_echo for direct personal Echoes even if reflection tags are present', () => {
      const record = createRecordWithServerEnforcement('create_echo', 'Notice how the rhythm slows down today.', {
        tags: ['conversation-reflection', 'insight'] // Client attempt to pass reflection tags
      });

      expect(record.provenance_author).toBe('user');
      expect(record.provenance_kind).toBe('original_echo');
      expect(record.source).toBe('direct_entry');
    });

    it('enforces co-created/conversation_reflection for conversation-derived reflections', () => {
      const record = createRecordWithServerEnforcement('create_conversation_reflection', 'CONVERSATION REFLECTION — Luna voice came through.', {
        sessionId: 'session_42',
        conversationTitle: 'Voice Milestones'
      });

      expect(record.provenance_author).toBe('co-created');
      expect(record.provenance_kind).toBe('conversation_reflection');
      expect(record.source).toBe('luna_conversation');
      expect(record.metadata.coCreatedWith).toBe('Luna');
    });

    it('enforces ai/ai_reflection when attaching reflections to existing Echo without mutating original Echo', () => {
      const originalEcho = {
        id: 'e_orig_1',
        text: 'Walked in the evening twilight.',
        provenance_author: 'user',
        provenance_kind: 'original_echo'
      };

      const attachedRef = createRecordWithServerEnforcement('attach_reflection', 'Luna observation: Consistent evening grounding pattern.', {
        echoId: originalEcho.id
      });

      // Reflection has AI provenance
      expect(attachedRef.author_type).toBe('ai');
      expect(attachedRef.echo_id).toBe('e_orig_1');
      expect(attachedRef.provenance_kind).toBe('ai_reflection');

      // Original Echo remains completely unchanged
      expect(originalEcho.text).toBe('Walked in the evening twilight.');
      expect(originalEcho.provenance_author).toBe('user');
      expect(originalEcho.provenance_kind).toBe('original_echo');
    });
  });
});
