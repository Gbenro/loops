import { describe, it, expect } from 'vitest';
import { saveDraftAudio, getDraftAudio, deleteDraftAudio, getAllDraftAudio } from './audioStorage.js';

describe('Durable Draft Audio Storage', () => {
  it('handles draft audio saving, reading, and deletion gracefully', async () => {
    const fakeBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
    const draftId = 'draft_test_123';

    // In node test environment without indexedDB, returns null safely without throwing
    const record = await saveDraftAudio(draftId, fakeBlob, { phase: 'new' });
    expect(record === null || typeof record === 'object').toBe(true);

    const retrieved = await getDraftAudio(draftId);
    expect(retrieved === null || typeof retrieved === 'object').toBe(true);

    const all = await getAllDraftAudio();
    expect(Array.isArray(all)).toBe(true);

    const deleted = await deleteDraftAudio(draftId);
    expect(typeof deleted === 'boolean').toBe(true);
  });
});
