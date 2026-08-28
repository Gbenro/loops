import { describe, it, expect, vi } from 'vitest';

// Simulating updateEchoText validation logic
async function updateEchoText(echo, newText, mockSupabase) {
  const isPersonal = (echo.provenanceAuthor || 'user') === 'user' && (echo.provenanceKind || 'original_echo') === 'original_echo';
  if (isPersonal) {
    throw new Error('Personal Echo text content is immutable and cannot be updated.');
  }
  
  const { error } = await mockSupabase.from('echoes').update({ text: newText }).eq('id', echo.id);
  if (error) {
    throw new Error(`Server update failed: ${error.message}`);
  }
  return { ...echo, text: newText };
}

// Simulating updateEchoTags validation logic (enrichments are allowed)
async function updateEchoTags(echo, tags, mockSupabase) {
  const { error } = await mockSupabase.from('echoes').update({ tags }).eq('id', echo.id);
  if (error) {
    throw new Error(`Server update failed: ${error.message}`);
  }
  return { ...echo, tags };
}

describe('Echo Immutability Rules', () => {
  it('prevents updating text of user personal Echoes', async () => {
    const personalEcho = {
      id: 'e1',
      text: 'Original Echo Text',
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo'
    };
    
    await expect(
      updateEchoText(personalEcho, 'New Text', {})
    ).rejects.toThrow('Personal Echo text content is immutable and cannot be updated.');
  });

  it('allows updating text of reflections or non-personal Echoes', async () => {
    const aiReflection = {
      id: 'e2',
      text: 'Original AI reflection text',
      provenanceAuthor: 'ai',
      provenanceKind: 'ai_reflection'
    };
    
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    
    const result = await updateEchoText(aiReflection, 'New Reflection Text', mockSupabase);
    expect(result.text).toBe('New Reflection Text');
    expect(mockSupabase.from).toHaveBeenCalledWith('echoes');
  });

  it('allows enriching personal Echoes with tags', async () => {
    const personalEcho = {
      id: 'e1',
      text: 'Original Echo Text',
      provenanceAuthor: 'user',
      provenanceKind: 'original_echo',
      tags: ['original']
    };
    
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    
    const result = await updateEchoTags(personalEcho, ['original', 'new-tag'], mockSupabase);
    expect(result.tags).toEqual(['original', 'new-tag']);
  });
});
