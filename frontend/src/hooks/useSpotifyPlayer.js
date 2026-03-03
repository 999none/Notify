import { useState, useEffect, useCallback, useRef } from 'react';
import { userAPI } from '../api';

/**
 * Hook for Spotify Web Playback SDK integration.
 * Requires Spotify Premium.
 * Fetches the Spotify access token from the backend.
 */
export const useSpotifyPlayer = () => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.5);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [sdkError, setSdkError] = useState(null);
  const playerRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  // Fetch Spotify token from backend
  const fetchToken = useCallback(async () => {
    try {
      const res = await userAPI.getSpotifyToken();
      setSpotifyToken(res.data.access_token);
      return res.data.access_token;
    } catch (err) {
      console.error('[Notify] Failed to fetch Spotify token:', err);
      setSdkError('Failed to get Spotify token');
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const token = await fetchToken();
      if (!token || !mounted) return;

      // Load Spotify SDK script only once
      if (!scriptLoadedRef.current && !document.getElementById('spotify-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
        scriptLoadedRef.current = true;
      }

      const initPlayer = (accessToken) => {
        if (!mounted) return;
        
        const spotifyPlayer = new window.Spotify.Player({
          name: 'Notify JAM Player',
          getOAuthToken: async (cb) => {
            // Always try to get a fresh token
            try {
              const freshRes = await userAPI.getSpotifyToken();
              cb(freshRes.data.access_token);
            } catch (e) {
              cb(accessToken);
            }
          },
          volume: 0.5,
        });

        spotifyPlayer.addListener('ready', ({ device_id }) => {
          if (!mounted) return;
          console.log('[Notify] Spotify Player ready, device:', device_id);
          setDeviceId(device_id);
          setIsReady(true);
          setSdkError(null);
        });

        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
          if (!mounted) return;
          console.log('[Notify] Spotify Player not ready:', device_id);
          setIsReady(false);
        });

        spotifyPlayer.addListener('player_state_changed', (state) => {
          if (!state || !mounted) return;
          const track = state.track_window?.current_track;
          if (track) {
            setCurrentTrack({
              uri: track.uri,
              name: track.name,
              artist: track.artists.map((a) => a.name).join(', '),
              albumArt: track.album.images[0]?.url,
              durationMs: track.duration_ms,
            });
            setDuration(track.duration_ms);
          }
          setIsPlaying(!state.paused);
          setPosition(state.position);
        });

        spotifyPlayer.addListener('initialization_error', ({ message }) => {
          console.error('[Notify] SDK init error:', message);
          if (mounted) setSdkError(message);
        });

        spotifyPlayer.addListener('authentication_error', ({ message }) => {
          console.error('[Notify] SDK auth error:', message);
          if (mounted) setSdkError('Spotify authentication failed. Try re-logging.');
        });

        spotifyPlayer.addListener('account_error', ({ message }) => {
          console.error('[Notify] SDK account error (Premium required):', message);
          if (mounted) setSdkError('Spotify Premium required for playback.');
        });

        spotifyPlayer.connect();
        setPlayer(spotifyPlayer);
        playerRef.current = spotifyPlayer;
      };

      if (window.Spotify) {
        initPlayer(token);
      } else {
        window.onSpotifyWebPlaybackSDKReady = () => {
          if (mounted) initPlayer(token);
        };
      }
    };

    init();

    return () => {
      mounted = false;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [fetchToken]);

  const play = useCallback(async (uri, positionMs = 0) => {
    if (!deviceId) return;
    try {
      const tokenRes = await userAPI.getSpotifyToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRes.data.access_token}`,
        },
        body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
      });
    } catch (err) {
      console.error('[Notify] Play error:', err);
    }
  }, [deviceId]);

  const pause = useCallback(async () => {
    if (playerRef.current) await playerRef.current.pause();
  }, []);

  const resume = useCallback(async () => {
    if (playerRef.current) await playerRef.current.resume();
  }, []);

  const seek = useCallback(async (positionMs) => {
    if (playerRef.current) await playerRef.current.seek(positionMs);
  }, []);

  const setVolume = useCallback(async (vol) => {
    if (playerRef.current) {
      await playerRef.current.setVolume(vol);
      setVolumeState(vol);
    }
  }, []);

  return {
    player,
    deviceId,
    isReady,
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    sdkError,
    play,
    pause,
    resume,
    seek,
    setVolume,
    fetchToken,
  };
};
