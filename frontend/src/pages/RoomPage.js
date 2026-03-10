import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Music, Play, Pause, SkipForward, Users, ThumbsUp, Plus,
  Search, X, Loader2, Crown, Radio, Volume2, ExternalLink, Wifi
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { io } from "socket.io-client";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDuration(ms) {
  if (!ms) return "0:00";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ─── Search Modal ───
function SearchModal({ roomId, onClose, onAdded, socket }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/spotify/search`, {
        params: { q: query },
        headers: getAuthHeaders(),
      });
      setResults(res.data.tracks || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (track) => {
    setAdding(track.id);
    try {
      await axios.post(`${API}/rooms/queue/add`, {
        room_id: roomId,
        track_id: track.id,
        track_name: track.name,
        artist: track.artist,
        album: track.album || "",
        image: track.image,
        duration_ms: track.duration_ms,
        external_url: track.external_url,
      }, { headers: getAuthHeaders() });
      if (socket) {
        socket.emit("queue_add", { room_id: roomId });
      }
      onAdded();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Erreur";
      alert(msg);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="search-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
              <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <input
                ref={inputRef}
                data-testid="search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher un morceau..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>
            <button
              data-testid="search-submit-btn"
              onClick={handleSearch}
              className="px-4 py-2 rounded-xl bg-notify-blue text-white text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Rechercher
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" data-testid="close-search-btn">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {searching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-notify-blue animate-spin" />
            </div>
          )}
          {!searching && results.length === 0 && query && (
            <p className="text-center text-sm text-zinc-500 py-8">Aucun résultat trouvé</p>
          )}
          {!searching && results.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors"
              data-testid={`search-result-${track.id}`}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                {track.image ? (
                  <img src={track.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{track.name}</p>
                <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
              </div>
              <span className="text-xs text-zinc-600 tabular-nums flex-shrink-0">{formatDuration(track.duration_ms)}</span>
              <button
                data-testid={`add-track-${track.id}`}
                onClick={() => handleAdd(track)}
                disabled={adding === track.id}
                className="flex-shrink-0 p-2 rounded-full bg-notify-blue/10 hover:bg-notify-blue/20 text-notify-blue transition-colors disabled:opacity-50"
              >
                {adding === track.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Queue Item ───
function QueueItem({ item, isHost, userId, onVote, onPlay }) {
  const hasVoted = (item.voted_by || []).includes(userId);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all group" data-testid={`queue-item-${item.id}`}>
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
        {item.image ? (
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-zinc-600" />
          </div>
        )}
        {isHost && (
          <button
            data-testid={`play-queue-${item.id}`}
            onClick={() => onPlay(item)}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.track_name}</p>
        <p className="text-xs text-zinc-500 truncate">{item.artist}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">Ajouté par {item.added_by_name}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-zinc-600 tabular-nums">{formatDuration(item.duration_ms)}</span>
        <button
          data-testid={`vote-${item.id}`}
          onClick={() => onVote(item.id)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            hasVoted
              ? "bg-notify-blue/20 text-notify-blue border border-notify-blue/30"
              : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10"
          }`}
        >
          <ThumbsUp className="w-3 h-3" />
          {item.votes || 0}
        </button>
      </div>
    </div>
  );
}


// ─── Now Playing Bar ───
function NowPlayingBar({ track, isPlaying, isHost, youtubeVideoId, subscription, onPlayPause, onNext, onYouTube }) {
  if (!track) {
    return (
      <div className="glass-card p-6 flex flex-col items-center text-center" data-testid="no-track-playing">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
          <Music className="w-7 h-7 text-zinc-700" />
        </div>
        <p className="text-sm text-zinc-400">Aucun morceau en lecture</p>
        <p className="text-xs text-zinc-600 mt-1">L'hôte doit lancer un morceau depuis la queue</p>
      </div>
    );
  }

  const trackName = track.track_name || track.name || "Unknown";
  const artistName = track.artist || "Unknown";
  const trackImage = track.image;
  const isFree = subscription !== "premium";

  return (
    <div className="glass-card overflow-hidden" data-testid="now-playing-bar">
      <div className="flex items-center gap-4 p-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 shadow-lg">
          {trackImage ? (
            <img src={trackImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-6 h-6 text-zinc-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-base font-semibold text-white truncate" data-testid="now-playing-track-name">{trackName}</p>
          <p className="text-sm text-zinc-400 truncate">{artistName}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-[11px] text-zinc-500">{isPlaying ? "En lecture" : "En pause"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isHost && (
            <>
              <button
                data-testid="play-pause-btn"
                onClick={onPlayPause}
                className="w-12 h-12 rounded-full bg-notify-blue hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg"
              >
                {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </button>
              <button
                data-testid="next-track-btn"
                onClick={onNext}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-5 h-5 text-zinc-300" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Free user YouTube button */}
      {isFree && youtubeVideoId && (
        <button
          data-testid="listen-youtube-btn"
          onClick={onYouTube}
          className="w-full px-4 py-3 border-t border-white/5 flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Écouter la version alternative (YouTube)
        </button>
      )}
    </div>
  );
}


// ─── YouTube Embed Modal ───
function YouTubeModal({ videoId, trackName, onClose }) {
  if (!videoId) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" data-testid="youtube-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-zinc-300">Version alternative - YouTube</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" data-testid="close-youtube-modal">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={trackName}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            data-testid="youtube-embed"
          />
        </div>
      </div>
    </div>
  );
}


// ─── Participants Panel ───
function ParticipantsPanel({ participants, hostId }) {
  return (
    <div className="glass-card p-4" data-testid="participants-panel">
      <h3 className="font-heading text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-notify-blue" />
        Participants ({participants.length})
      </h3>
      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg" data-testid={`participant-${p.user_id}`}>
            <div className="relative">
              <Avatar className="w-8 h-8 border border-white/10">
                <AvatarImage src={p.avatar} alt={p.username} />
                <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                  {p.username?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${p.online ? "bg-green-400" : "bg-zinc-600"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-white truncate">{p.username}</p>
                {p.user_id === hostId && (
                  <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{p.subscription || "free"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Main Room Page ───
export default function RoomPage({ user }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [queue, setQueue] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isHost = room?.host_id === user?.id;
  const subscription = user?.subscription || "free";

  // Connect Socket.IO
  useEffect(() => {
    const token = localStorage.getItem("notify_token");
    if (!token || !roomId) return;

    const socket = io(BACKEND_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join_room", { token, room_id: roomId });
    });

    socket.on("room_state", (data) => {
      setRoom(data.room);
      setQueue(data.queue || []);
      setParticipants(data.participants || []);
      setCurrentTrack(data.room?.current_track || null);
      setIsPlaying(data.room?.is_playing || false);
      setLoading(false);
    });

    socket.on("queue_update", (data) => {
      setQueue(data.queue || []);
    });

    socket.on("participants_update", (data) => {
      setParticipants(data.participants || []);
    });

    socket.on("playback_sync", (data) => {
      if (data.action === "play") {
        setCurrentTrack(data.track);
        setIsPlaying(true);
        setYoutubeVideoId(data.youtube_video_id || null);
      } else if (data.action === "pause") {
        setIsPlaying(false);
      } else if (data.action === "resume") {
        setIsPlaying(true);
      } else if (data.action === "stop") {
        setCurrentTrack(null);
        setIsPlaying(false);
        setYoutubeVideoId(null);
      }
    });

    socket.on("error", (data) => {
      console.error("Socket error:", data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.emit("leave_room", { room_id: roomId });
      socket.disconnect();
    };
  }, [roomId]);

  // Fallback: fetch room via REST if socket fails
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await axios.get(`${API}/rooms/${roomId}`, { headers: getAuthHeaders() });
        setRoom(res.data);
        setQueue(res.data.queue || []);
        setParticipants(res.data.participants || []);
        setCurrentTrack(res.data.current_track || null);
        setIsPlaying(res.data.is_playing || false);
      } catch {
        setError("Room introuvable");
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  const handleVote = async (queueItemId) => {
    try {
      await axios.post(`${API}/rooms/queue/vote`, {
        room_id: roomId,
        queue_item_id: queueItemId,
      }, { headers: getAuthHeaders() });
      if (socketRef.current) {
        socketRef.current.emit("queue_vote", { room_id: roomId });
      }
    } catch {
      // ignore
    }
  };

  const handlePlayFromQueue = (item) => {
    if (!isHost || !socketRef.current) return;
    const trackData = {
      track_id: item.track_id,
      track_name: item.track_name,
      artist: item.artist,
      album: item.album || "",
      image: item.image,
      duration_ms: item.duration_ms,
      external_url: item.external_url,
    };
    socketRef.current.emit("play_track", { room_id: roomId, track: trackData });
  };

  const handlePlayPause = () => {
    if (!isHost || !socketRef.current) return;
    if (isPlaying) {
      socketRef.current.emit("pause_track", { room_id: roomId, position_ms: 0 });
    } else {
      socketRef.current.emit("resume_track", { room_id: roomId, position_ms: 0 });
    }
  };

  const handleNext = () => {
    if (!isHost || !socketRef.current) return;
    socketRef.current.emit("next_track", { room_id: roomId });
  };

  const handleLeave = async () => {
    try {
      await axios.post(`${API}/rooms/leave`, { room_id: roomId }, { headers: getAuthHeaders() });
    } catch {
      // ignore
    }
    navigate("/dashboard");
  };

  const handleTrackAdded = () => {
    // Queue updated via socket
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-notify-blue animate-spin" />
          <p className="text-sm text-zinc-400">Chargement de la room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Radio className="w-12 h-12 text-zinc-700" />
          <p className="text-lg text-zinc-400">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-notify-blue hover:underline"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black" data-testid="room-page">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 glass-sidebar border-b border-white/5">
        <div className="flex items-center justify-between px-4 md:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              data-testid="back-to-dashboard"
              onClick={handleLeave}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-notify-blue" />
                <h1 className="font-heading text-lg font-bold text-white" data-testid="room-name">{room?.name}</h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-xs text-zinc-500">{participants.length} connecté{participants.length > 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="add-track-btn"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-notify-blue hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ajouter</span>
            </button>
            <button
              data-testid="leave-room-btn"
              onClick={handleLeave}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-sm font-medium transition-colors border border-white/5"
            >
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Now Playing */}
            <NowPlayingBar
              track={currentTrack}
              isPlaying={isPlaying}
              isHost={isHost}
              youtubeVideoId={youtubeVideoId}
              subscription={subscription}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onYouTube={() => setShowYouTube(true)}
            />

            {/* Queue */}
            <div className="glass-card overflow-hidden" data-testid="queue-section">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-heading text-base font-semibold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-notify-blue" />
                  File d'attente ({queue.length})
                </h3>
                <button
                  data-testid="add-track-queue-btn"
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-1.5 text-xs text-notify-blue hover:text-blue-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>
              <div className="p-4 space-y-2">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
                      <Music className="w-6 h-6 text-zinc-700" />
                    </div>
                    <p className="text-sm text-zinc-400">La queue est vide</p>
                    <p className="text-xs text-zinc-600 mt-1">Ajoutez des morceaux pour commencer</p>
                  </div>
                ) : (
                  queue.map((item) => (
                    <QueueItem
                      key={item.id}
                      item={item}
                      isHost={isHost}
                      userId={user?.id}
                      onVote={handleVote}
                      onPlay={handlePlayFromQueue}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Participants */}
          <div className="lg:col-span-4 space-y-6">
            <ParticipantsPanel participants={participants} hostId={room?.host_id} />

            {/* Room Info */}
            <div className="glass-card p-4" data-testid="room-info">
              <h3 className="font-heading text-sm font-semibold text-white mb-3">Info</h3>
              <div className="space-y-2 text-xs text-zinc-500">
                <div className="flex justify-between">
                  <span>Room ID</span>
                  <span className="text-zinc-300 font-mono" data-testid="room-id-display">{room?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hôte</span>
                  <span className="text-zinc-300">{room?.host_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Votre rôle</span>
                  <span className={isHost ? "text-amber-400" : "text-zinc-300"}>
                    {isHost ? "Hôte" : "Participant"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Abonnement</span>
                  <span className={subscription === "premium" ? "text-amber-400" : "text-zinc-400"}>
                    {subscription}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Search Modal */}
      {showSearch && (
        <SearchModal
          roomId={roomId}
          onClose={() => setShowSearch(false)}
          onAdded={handleTrackAdded}
          socket={socketRef.current}
        />
      )}

      {/* YouTube Modal */}
      {showYouTube && youtubeVideoId && (
        <YouTubeModal
          videoId={youtubeVideoId}
          trackName={currentTrack?.track_name || currentTrack?.name || ""}
          onClose={() => setShowYouTube(false)}
        />
      )}
    </div>
  );
}
