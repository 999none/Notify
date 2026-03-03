import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('notify_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('notify_token');
      localStorage.removeItem('notify_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  getLoginUrl: () => api.get('/auth/login'),
  handleCallback: (code) => api.get(`/auth/callback?code=${code}`),
  refreshToken: (userId) => api.post('/auth/refresh', { user_id: userId }),
};

// User API
export const userAPI = {
  getMe: () => api.get('/users/me'),
  checkPremium: () => api.get('/users/me/premium'),
};

// Room API
export const roomAPI = {
  create: (name) => api.post('/rooms', { name }),
  list: () => api.get('/rooms'),
  get: (roomId) => api.get(`/rooms/${roomId}`),
  join: (roomId) => api.post(`/rooms/${roomId}/join`),
  leave: (roomId) => api.post(`/rooms/${roomId}/leave`),
  delete: (roomId) => api.delete(`/rooms/${roomId}`),
};

// Playback API
export const playbackAPI = {
  search: (query) => api.get(`/playback/search?q=${encodeURIComponent(query)}`),
  play: (trackUri, positionMs = 0, deviceId = null) =>
    api.post('/playback/play', { track_uri: trackUri, position_ms: positionMs, device_id: deviceId }),
  pause: () => api.post('/playback/pause'),
  seek: (positionMs, deviceId = null) =>
    api.post('/playback/seek', { position_ms: positionMs, device_id: deviceId }),
  getState: () => api.get('/playback/state'),
};

// WebSocket URL builder
export const getWebSocketUrl = (roomId) => {
  const token = localStorage.getItem('notify_token');
  const wsBase = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  return `${wsBase}/api/ws/jam/${roomId}?token=${token}`;
};

export default api;
