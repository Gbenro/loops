import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: number;
  email: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authService = {
  async signup(email: string, password: string): Promise<User> {
    try {
      const response = await axios.post(`${API_URL}/signup`, { email, password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async login(credentials: LoginCredentials): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);

      const response = await axios.post(`${API_URL}/token`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      return access_token;
    } catch (error) {
      throw error;
    }
  },

  logout() {
    localStorage.removeItem('token');
  },

  getCurrentUser(): User | null {
    const token = localStorage.getItem('token');
    return token ? { id: 0, email: '' } : null; // In a real app, decode token
  }
};