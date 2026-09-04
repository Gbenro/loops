import { describe, it, expect } from 'vitest';
import { segmentTextForSpeech, cleanTextForSpeech, ELEVENLABS_VOICE_MAP } from '../../mcp-server/src/voice.ts';
import { resolveTtsModel, TTS_MODEL_REGISTRY } from '../../mcp-server/src/models.ts';

describe('Sentence-Aware TTS Segmentation & ElevenLabs Playground', () => {
  it('cleans markdown without disrupting semantic sentence boundaries', () => {
    const raw = '**Luna** whispers *softly*: `code` [link](https://luna.app). Return to stillness.';
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).toBe('Luna whispers softly: link. Return to stillness.');
  });

  it('preserves complete sentences and prevents arbitrary mid-sentence splits', () => {
    const text = 'The waxing crescent rises over the eastern horizon. Its light reveals the path through the trees. Quiet focus returns to the room.';
    const segments = segmentTextForSpeech(text, { maxChunkLength: 80, mode: 'sentence' });

    expect(segments.length).toBe(2);
    expect(segments[0]).toBe('The waxing crescent rises over the eastern horizon.');
    expect(segments[1]).toBe('Its light reveals the path through the trees. Quiet focus returns to the room.');
    
    // Check that neither segment cuts words or clauses arbitrarily
    for (const segment of segments) {
      expect(segment.endsWith('.')).toBe(true);
    }
  });

  it('protects abbreviations and numbers from causing erroneous sentence splits', () => {
    const text = 'Dr. Smith observed the tide at 3.14 meters, i.e. high water mark. We rested afterward.';
    const segments = segmentTextForSpeech(text, { maxChunkLength: 400, mode: 'sentence' });

    expect(segments.length).toBe(1);
    expect(segments[0]).toContain('Dr. Smith observed');
    expect(segments[0]).toContain('3.14 meters');
    expect(segments[0]).toContain('i.e. high water mark.');
  });

  it('supports separable segmentation modes: paragraph vs sentence vs none', () => {
    const multiPara = 'First paragraph here.\n\nSecond paragraph continues here.';
    
    const paraSegments = segmentTextForSpeech(multiPara, { mode: 'paragraph' });
    expect(paraSegments.length).toBe(2);
    expect(paraSegments[0]).toBe('First paragraph here.');
    expect(paraSegments[1]).toBe('Second paragraph continues here.');

    const noneSegments = segmentTextForSpeech(multiPara, { mode: 'none' });
    expect(noneSegments.length).toBe(1);
  });

  it('correctly maps friendly ElevenLabs voice names to official voice IDs', () => {
    expect(ELEVENLABS_VOICE_MAP['eleven-rachel']).toBe('21m00Tcm4TlvDq8ikWAM');
    expect(ELEVENLABS_VOICE_MAP['eleven-bella']).toBe('EXAVITQu4vr4xnSDxMaL');
    expect(ELEVENLABS_VOICE_MAP['eleven-antoni']).toBe('ErXwobaYiN019PkySvjV');
    expect(ELEVENLABS_VOICE_MAP['eleven-nicole']).toBe('piTKgcLEGmPE4e6mEKli');
    expect(ELEVENLABS_VOICE_MAP['eleven-adam']).toBe('pNInz6obpgDQGcFmaJgB');
  });

  it('resolves ElevenLabs models in TTS_MODEL_REGISTRY and provides Luna default fallback', () => {
    const turboModel = resolveTtsModel('elevenlabs-turbo');
    expect(turboModel.provider).toBe('elevenlabs');
    expect(turboModel.modelId).toBe('eleven_turbo_v2_5');

    const multiModel = resolveTtsModel('elevenlabs-multilingual');
    expect(multiModel.provider).toBe('elevenlabs');
    expect(multiModel.modelId).toBe('eleven_multilingual_v2');

    // Unmatched model key gracefully falls back to Luna Kokoro baseline
    const fallback = resolveTtsModel('unknown-model-key');
    expect(fallback.key).toBe('openrouter-kokoro');
    expect(fallback.provider).toBe('openrouter');
    expect(fallback.defaultVoice).toBe('af_nova');
  });
});
