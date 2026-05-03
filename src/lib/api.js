const TOKEN_KEY = 'secure_channel_auth_token';

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/auth/${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

export const authApi = {
  async register(payload) {
    return request('register', {
      method: 'POST',
      body: payload
    });
  },

  async login(payload) {
    const data = await request('login', {
      method: 'POST',
      body: payload
    });

    if (data.token) {
      sessionStorage.setItem(TOKEN_KEY, data.token);
    }

    return data;
  },

  async me() {
    return request('me');
  },

  async forgot(email) {
    return request('forgot', {
      method: 'POST',
      body: { email }
    });
  }
};
