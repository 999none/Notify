import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for Spotify Web Playback SDK integration.
 * Requires Spotify Premium.
 * 
 * Usage:
 * const { player, deviceId, isReady, currentTrack, isPlaying, play, pause, seek, setVolume } = useSpotifyPlayer(accessToken);
 */
export const useSpotifyPlayer = (spotifyAccessToken) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.5);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!spotifyAccessToken) return;

    // Load Spotify SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Notify JAM Player',
        getOAuthToken: (cb) => cb(spotifyAccessToken),
        volume: 0.5,
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('[Notify] Spotify Player ready, device:', device_id);
        setDeviceId(device_id);
        setIsReady(true);
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('[Notify] Spotify Player not ready:', device_id);
        setIsReady(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
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
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('[Notify] SDK auth error:', message);
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('[Notify] SDK account error (Premium required):', message);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
      playerRef.current = spotifyPlayer;
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [spotifyAccessToken]);

  const play = useCallback(async (uri, positionMs = 0) => {
    if (!deviceId || !spotifyAccessToken) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${spotifyAccessToken}`,
        },
        body: JSON.stringify({
          uris: [uri],
          position_ms: positionMs,
        }),
      });
    } catch (err) {
      console.error('[Notify] Play error:', err);
    }
  }, [deviceId, spotifyAccessToken]);

  const pause = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.pause();
    }
  }, []);

  const resume = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.resume();
    }
  }, []);

  const seek = useCallback(async (positionMs) => {
    if (playerRef.current) {
      await playerRef.current.seek(positionMs);
    }
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
    play,
    pause,
    resume,
    seek,
    setVolume,
  };
};
