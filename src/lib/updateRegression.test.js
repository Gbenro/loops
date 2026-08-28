import { describe, it, expect, vi } from 'vitest';

// Simulate the database verify & update logic we implemented in the tools
async function updateRecord(supabase, table, id, updateData, userId) {
  const { data, error } = await supabase
    .from(table)
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`Update failed: Record with ID "${id}" not found or unauthorized.`);
  }
  return data[0];
}

describe('Echo/Loop Update Reliability Regression Test', () => {
  it('updates successfully and returns the modified record when it exists', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'e123', text: 'Updated content', user_id: 'u456' }],
        error: null
      })
    };

    const result = await updateRecord(mockSupabase, 'echoes', 'e123', { text: 'Updated content' }, 'u456');
    
    expect(mockSupabase.from).toHaveBeenCalledWith('echoes');
    expect(mockSupabase.update).toHaveBeenCalledWith({ text: 'Updated content' });
    expect(result.text).toBe('Updated content');
  });

  it('fails loudly and throws an error if the record does not exist or user is unauthorized', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [], // 0 rows modified
        error: null
      })
    };

    await expect(
      updateRecord(mockSupabase, 'echoes', 'invalid_id', { text: 'New content' }, 'u456')
    ).rejects.toThrow('Update failed: Record with ID "invalid_id" not found or unauthorized.');
  });
});
