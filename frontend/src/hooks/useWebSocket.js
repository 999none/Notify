import { useState, useEffect, useCallback, useRef } from 'react';
import { getWebSocketUrl } from '../api';

/**
 * Hook for WebSocket JAM room connection.
 * Handles connect, disconnect, reconnect with exponential backoff.
 *
 * Usage:
 * const { isConnected, participants, messages, sendMessage } = useWebSocket(roomId);
 */
export const useWebSocket = (roomId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!roomId) return;

    const url = getWebSocketUrl(roomId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Notify WS] Connected to room:', roomId);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 5000);
      ws._heartbeatInterval = heartbeatInterval;
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
            console.log('[Notify WS] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[Notify WS] Parse error:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[Notify WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      if (ws._heartbeatInterval) clearInterval(ws._heartbeatInterval);

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts && event.code !== 4001 && event.code !== 4004) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[Notify WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Notify WS] Error:', error);
    };
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        if (wsRef.current._heartbeatInterval) clearInterval(wsRef.current._heartbeatInterval);
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendPlay = useCallback((trackUri, name, artist, albumArt, durationMs, positionMs = 0) => {
    sendMessage({
      type: 'play',
      track_uri: trackUri,
      name,
      artist,
      album_art: albumArt,
      duration_ms: durationMs,
      position_ms: positionMs,
    });
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
