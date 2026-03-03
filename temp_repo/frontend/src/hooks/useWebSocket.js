import { useState, useEffect, useCallback, useRef } from 'react';
import { getWebSocketUrl } from '../api';

export const useWebSocket = (roomId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 8;
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isUnmountedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomId || isUnmountedRef.current) return;

    const token = localStorage.getItem('notify_token');
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
    }
    cleanup();

    const url = getWebSocketUrl(roomId);
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error('[Notify WS] Failed to create WebSocket:', err);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) { ws.close(); return; }
      console.log('[Notify WS] Connected to room:', roomId);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'heartbeat' })); } catch (e) {}
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'sync':
            setLastSync(data);
            setLastEvent({ type: 'sync', data });
            break;
          case 'pause':
            setLastEvent({ type: 'pause', data });
            break;
          case 'resume':
            setLastEvent({ type: 'resume', data });
            break;
          case 'seek':
            setLastEvent({ type: 'seek', data });
            break;
          case 'participant_joined':
            setParticipants((prev) => [...prev.filter(p => p.id !== data.user.id), data.user]);
            setLastEvent({ type: 'participant_joined', data });
            break;
          case 'participant_left':
            setParticipants((prev) => prev.filter((p) => p.id !== data.user_id));
            setLastEvent({ type: 'participant_left', data });
            break;
          case 'participants_list':
            setParticipants(data.participants || []);
            break;
          case 'queue_updated':
            setLastEvent({ type: 'queue_updated', data });
            break;
          case 'chat_message':
            setMessages((prev) => [...prev, data]);
            break;
          case 'room_closed':
            setLastEvent({ type: 'room_closed', data });
            break;
          case 'heartbeat_ack':
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('[Notify WS] Parse error:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[Notify WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      cleanup();

      if (isUnmountedRef.current) return;

      // Do not reconnect on auth/room errors
      if (event.code === 4001 || event.code === 4004 || event.code === 1000) return;

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts.current), 30000);
        console.log(`[Notify WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current + 1})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };
  }, [roomId, cleanup]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();
    return () => {
      isUnmountedRef.current = true;
      cleanup();
      if (wsRef.current) {
        try { wsRef.current.close(1000, 'Component unmounted'); } catch (e) {}
      }
    };
  }, [connect, cleanup]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify(message)); } catch (e) {}
    }
  }, []);

  const sendPlay = useCallback((trackUri, name, artist, albumArt, durationMs, positionMs = 0) => {
    sendMessage({ type: 'play', track_uri: trackUri, name, artist, album_art: albumArt, duration_ms: durationMs, position_ms: positionMs });
  }, [sendMessage]);

  const sendPause = useCallback((positionMs = 0) => {
    sendMessage({ type: 'pause', position_ms: positionMs });
  }, [sendMessage]);

  const sendSeek = useCallback((positionMs) => {
    sendMessage({ type: 'seek', position_ms: positionMs });
  }, [sendMessage]);

  const sendChat = useCallback((message) => {
    sendMessage({ type: 'chat', message });
  }, [sendMessage]);

  const sendQueueAdd = useCallback((trackUri, name, artist, albumArt) => {
    sendMessage({ type: 'queue_add', track_uri: trackUri, name, artist, album_art: albumArt });
  }, [sendMessage]);

  return {
    isConnected,
    participants,
    messages,
    lastSync,
    lastEvent,
    sendMessage,
    sendPlay,
    sendPause,
    sendSeek,
    sendChat,
    sendQueueAdd,
  };
};
