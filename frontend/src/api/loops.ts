import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Loop {
  id?: number;
  title: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const loopsService = {
  async getLoops(): Promise<Loop[]> {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API_URL}/loops`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createLoop(loop: Omit<Loop, 'id'>): Promise<Loop> {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(`${API_URL}/loops`, loop, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateLoop(id: number, loop: Partial<Loop>): Promise<Loop> {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.put(`${API_URL}/loops/${id}`, loop, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteLoop(id: number): Promise<void> {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_URL}/loops/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      throw error;
    }
  },

  // Migration strategy from localStorage
  async migrateLocalLoops() {
    const localLoops = JSON.parse(localStorage.getItem('loops') || '[]');
    
    for (const loop of localLoops) {
      try {
        await this.createLoop({
          title: loop.title,
          description: loop.description,
          status: loop.status
        });
      } catch (error) {
        console.error('Migration error for loop:', loop);
      }
    }

    // Clear local storage after migration
    localStorage.removeItem('loops');
  }
};