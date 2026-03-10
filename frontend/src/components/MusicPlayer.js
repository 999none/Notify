import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, X, Volume2, VolumeX, SkipForward, SkipBack, Loader2, Music, ExternalLink } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── YouTube Player (Free users) ───
function YouTubePlayer({ track, onClose }) {
  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const searchYouTube = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API}/player/search-youtube`, {
          params: { track_name: track.name, artist_name: track.artist },
          headers: getAuthHeaders(),
        });
        if (res.data.found) {
          setVideoData(res.data);
        } else {
          setError(res.data.message || "Aucune version alternative disponible");
        }
      } catch {
        setError("Aucune version alternative disponible");
      } finally {
        setLoading(false);
      }
    };
    searchYouTube();
  }, [track]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="youtube-player-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Player Card */}
      <div className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
              {track.image ? (
                <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{track.name}</p>
              <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            data-testid="close-player-button"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-notify-blue animate-spin" />
              <p className="text-sm text-zinc-400">Recherche de la version alternative...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <Music className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400">{error}</p>
            </div>
          )}

          {videoData && !loading && (
            <div className="space-y-3">
              {/* YouTube Embed */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoData.video_id}?autoplay=1&rel=0&modestbranding=1`}
                  title={videoData.title}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  data-testid="youtube-iframe"
                />
              </div>

              {/* Video Info */}
              <div className="flex items-center justify-between px-1">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 truncate">{videoData.channel}</p>
                  <p className="text-[11px] text-zinc-600">{videoData.duration}</p>
                </div>
                <a
                  href={videoData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  YouTube
                </a>
              </div>

              <div className="flex items-center gap-2 px-1 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <p className="text-[11px] text-zinc-500">Version alternative via YouTube</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Spotify Web Playback SDK Player (Premium users) ───
function SpotifyPlayer({ track, spotifyToken, onClose }) {
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deviceId, setDeviceId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef(null);
  const progressInterval = useRef(null);

  useEffect(() => {
    if (!spotifyToken) {
      setError("Token Spotify manquant");
      setLoading(false);
      return;
    }

    // Load Spotify Web Playback SDK
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: "Notify Player",
        getOAuthToken: (cb) => cb(spotifyToken),
        volume: 0.5,
      });

      spotifyPlayer.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setLoading(false);
        // Play the track
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [`spotify:track:${track.id}`] }),
        }).then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setError("Impossible de lancer la lecture. Vérifiez votre abonnement Premium.");
        });
      });

      spotifyPlayer.addListener("not_ready", () => {
        setError("Lecteur Spotify non disponible");
        setLoading(false);
      });

      spotifyPlayer.addListener("player_state_changed", (state) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setProgress(state.position);
        setDuration(state.duration);
      });

      spotifyPlayer.addListener("initialization_error", ({ message }) => {
        setError("Erreur d'initialisation du lecteur");
        setLoading(false);
      });

      spotifyPlayer.addListener("authentication_error", ({ message }) => {
        setError("Erreur d'authentification Spotify");
        setLoading(false);
      });

      spotifyPlayer.addListener("account_error", ({ message }) => {
        setError("Compte Spotify Premium requis pour la lecture directe");
        setLoading(false);
      });

      spotifyPlayer.connect();
      playerRef.current = spotifyPlayer;
      setPlayer(spotifyPlayer);
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
      if (existingScript) existingScript.remove();
    };
  }, [spotifyToken, track.id]);

  // Progress tracking
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + 1000, duration));
      }, 1000);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, duration]);

  const togglePlay = () => {
    if (player) player.togglePlay();
  };

  const toggleMute = () => {
    if (player) {
      player.setVolume(isMuted ? 0.5 : 0);
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (ms) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" data-testid="spotify-player-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span className="text-xs font-medium text-green-400">Spotify Premium</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            data-testid="close-spotify-player-button"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Album Art + Info */}
        <div className="p-6 flex flex-col items-center">
          <div className="w-48 h-48 rounded-2xl overflow-hidden bg-zinc-800 shadow-lg mb-5">
            {track.image ? (
              <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-12 h-12 text-zinc-600" />
              </div>
            )}
          </div>
          <h4 className="font-heading text-lg font-bold text-white text-center truncate max-w-full">{track.name}</h4>
          <p className="text-sm text-zinc-400 mt-1">{track.artist}</p>
        </div>

        {/* Controls */}
        <div className="px-6 pb-6">
          {loading && (
            <div className="flex flex-col items-center py-4 gap-2">
              <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
              <p className="text-xs text-zinc-500">Connexion au lecteur Spotify...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-4">
              <p className="text-sm text-zinc-400">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-zinc-600 tabular-nums">{formatTime(progress)}</span>
                  <span className="text-[11px] text-zinc-600 tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-6">
                <button onClick={toggleMute} className="p-2 rounded-full hover:bg-white/5 transition-colors" data-testid="spotify-mute-button">
                  {isMuted ? <VolumeX className="w-5 h-5 text-zinc-400" /> : <Volume2 className="w-5 h-5 text-zinc-400" />}
                </button>
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors shadow-lg"
                  data-testid="spotify-play-pause-button"
                >
                  {isPlaying ? <Pause className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 text-black ml-0.5" />}
                </button>
                <div className="w-9" /> {/* Spacer */}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Play Button Component ───
export function PlayButton({ track, subscription, onPlay }) {
  const isPremium = subscription === "premium";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPlay(track);
      }}
      className={`flex-shrink-0 p-2 rounded-full transition-all hover:scale-110 ${
        isPremium
          ? "bg-green-500/10 hover:bg-green-500/20 text-green-400"
          : "bg-red-500/10 hover:bg-red-500/20 text-red-400"
      }`}
      title={isPremium ? "Lecture Spotify" : "Version alternative"}
      data-testid="play-track-button"
    >
      <Play className="w-4 h-4" />
    </button>
  );
}

// ─── Main Music Player Manager ───
export default function MusicPlayer({ track, subscription, spotifyToken, onClose }) {
  if (!track) return null;

  const isPremium = subscription === "premium";

  if (isPremium && spotifyToken) {
    return <SpotifyPlayer track={track} spotifyToken={spotifyToken} onClose={onClose} />;
  }

  return <YouTubePlayer track={track} onClose={onClose} />;
}
