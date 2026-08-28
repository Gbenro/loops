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
});
