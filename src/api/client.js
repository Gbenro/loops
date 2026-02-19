const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return localStorage.getItem('loops_auth_token');
  }

  setToken(token) {
    localStorage.setItem('loops_auth_token', token);
  }

  clearToken() {
    localStorage.removeItem('loops_auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Request failed');
    }

    if (response.status === 204) return null;
    return response.json();
  }

  // Auth methods
  async signup(email, password) {
    return this.request('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email, password) {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Invalid credentials');
    }

    const data = await response.json();
    this.setToken(data.access_token);
    return data;
  }

  logout() {
    this.clearToken();
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  // Loops methods
  async getLoops() {
    return this.request('/loops');
  }

  async syncLoops(loops, lastSyncTimestamp = null) {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify({ loops, lastSyncTimestamp }),
    });
  }

  async createLoop(loop) {
    return this.request('/loops', {
      method: 'POST',
      body: JSON.stringify(loop),
    });
  }

  async updateLoop(clientId, updates) {
    return this.request(`/loops/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteLoop(clientId) {
    return this.request(`/loops/${clientId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
