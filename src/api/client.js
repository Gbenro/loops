// Production API URL - hardcoded for Railway deployment
const API_URL = import.meta.env.VITE_API_URL || 'https://loops-production-ed41.up.railway.app';

// Debug logging
console.log('[API Client] VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('[API Client] Using API_URL:', API_URL);

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
    console.log('[API Client] Initialized with baseUrl:', this.baseUrl);
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
    console.log('[API Client] Signup attempt to:', `${this.baseUrl}/signup`);
    try {
      const result = await this.request('/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      console.log('[API Client] Signup success:', result);
      return result;
    } catch (error) {
      console.error('[API Client] Signup error:', error);
      throw error;
    }
  }

  async login(email, password) {
    console.log('[API Client] Login attempt to:', `${this.baseUrl}/token`);
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[API Client] Login failed:', error);
        throw new Error(error.detail || 'Invalid credentials');
      }

      const data = await response.json();
      console.log('[API Client] Login success');
      this.setToken(data.access_token);
      return data;
    } catch (error) {
      console.error('[API Client] Login error:', error);
      throw error;
    }
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
    console.log('[API Client] Sync attempt to:', `${this.baseUrl}/sync`);
    console.log('[API Client] Syncing loops count:', loops?.length);

    // Ensure loops have required fields and proper format
    const sanitizedLoops = (loops || []).map(loop => ({
      id: loop.id,
      tier: loop.tier,
      type: loop.type,
      recurrence: loop.recurrence || null,
      status: loop.status || 'active',
      title: loop.title,
      color: loop.color,
      period: loop.period,
      linkedTo: loop.linkedTo || null,
      rolledFrom: loop.rolledFrom || null,
      subtasks: (loop.subtasks || []).map(s => ({
        id: s.id,
        text: s.text,
        done: s.done || false
      }))
    }));

    const body = {
      loops: sanitizedLoops,
      lastSyncTimestamp: lastSyncTimestamp ? lastSyncTimestamp.toISOString() : null
    };

    console.log('[API Client] Request body:', JSON.stringify(body, null, 2));

    try {
      const result = await this.request('/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      console.log('[API Client] Sync success');
      return result;
    } catch (error) {
      console.error('[API Client] Sync error:', error);
      throw error;
    }
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
