import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('notify_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const authAPI = {
  getLoginUrl: () => api.get('/auth/login'),
  handleCallback: (code) => api.get(`/auth/callback?code=${code}`),
  refreshToken: (userId) => api.post('/auth/refresh', { user_id: userId }),
};

export const userAPI = {
  getMe: () => api.get('/users/me'),
  checkPremium: () => api.get('/users/me/premium'),
  getTopArtists: () => api.get('/users/me/top-artists'),
  getTopTracks: () => api.get('/users/me/top-tracks'),
  getProfile: (userId) => api.get(`/users/${userId}/profile`),
  searchUsers: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
};

export const roomAPI = {
  create: (name) => api.post('/rooms', { name }),
  list: () => api.get('/rooms'),
  get: (roomId) => api.get(`/rooms/${roomId}`),
  join: (roomId) => api.post(`/rooms/${roomId}/join`),
  leave: (roomId) => api.post(`/rooms/${roomId}/leave`),
  delete: (roomId) => api.delete(`/rooms/${roomId}`),
  getByCode: (code) => api.get(`/rooms/join-by-code/${code}`),
};

export const playbackAPI = {
  search: (query) => api.get(`/playback/search?q=${encodeURIComponent(query)}`),
  play: (trackUri, positionMs = 0, deviceId = null) =>
    api.post('/playback/play', { track_uri: trackUri, position_ms: positionMs, device_id: deviceId }),
  pause: () => api.post('/playback/pause'),
  seek: (positionMs, deviceId = null) =>
    api.post('/playback/seek', { position_ms: positionMs, device_id: deviceId }),
  getState: () => api.get('/playback/state'),
};

export const friendAPI = {
  list: () => api.get('/friends'),
  pending: () => api.get('/friends/pending'),
  sendRequest: (targetUserId) => api.post('/friends/request', { target_user_id: targetUserId }),
  accept: (targetUserId) => api.post('/friends/accept', { target_user_id: targetUserId }),
  reject: (targetUserId) => api.post('/friends/reject', { target_user_id: targetUserId }),
  remove: (friendId) => api.delete(`/friends/${friendId}`),
  status: (userId) => api.get(`/friends/${userId}/status`),
};

export const playlistAPI = {
  list: () => api.get('/playlists'),
  get: (id) => api.get(`/playlists/${id}`),
  create: (name, description = '', isPublic = true) =>
    api.post('/playlists', { name, description, is_public: isPublic }),
  update: (id, data) => api.put(`/playlists/${id}`, data),
  delete: (id) => api.delete(`/playlists/${id}`),
  addTrack: (id, track) => api.post(`/playlists/${id}/tracks`, track),
  removeTrack: (playlistId, trackId) => api.delete(`/playlists/${playlistId}/tracks/${trackId}`),
  addMember: (id, userId, role = 'editor') =>
    api.post(`/playlists/${id}/members`, { user_id: userId, role }),
  syncToSpotify: (id) => api.post(`/playlists/${id}/sync-to-spotify`),
  importSpotifyList: () => api.get('/playlists/import-spotify'),
  importSpotifyPlaylist: (spotifyId) => api.post(`/playlists/import-spotify/${spotifyId}`),
};

export const activityAPI = {
  feed: () => api.get('/activity'),
  mine: () => api.get('/activity/me'),
};

export const getWebSocketUrl = (roomId) => {
  const token = localStorage.getItem('notify_token');
  const wsBase = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  return `${wsBase}/api/ws/jam/${roomId}?token=${token}`;
};

export default api;
