import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Radio,
  Bell,
  Settings,
  LogOut,
  Music,
  Disc3,
  Headphones,
  UserPlus,
  Clock,
  ListMusic,
  Star,
  ExternalLink,
  Download,
  Plus,
  Loader2,
  Crown,
  ArrowRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import axios from "axios";
import MusicPlayer, { PlayButton } from "@/components/MusicPlayer";
import NotificationFeed, { NotificationBadge, useNotificationSocket } from "@/components/NotificationFeed";
import FriendsTab from "@/components/FriendsTab";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VINYL_IMG = "https://images.unsplash.com/photo-1621940760699-8fe82b462dfa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwzfHx2aW55bCUyMHJlY29yZCUyMGFic3RyYWN0JTIwY3Jvd2QlMjBhZXN0aGV0aWMlMjBkYXJrJTIwYmx1ZXxlbnwwfHx8fDE3NzMxNzI4MzR8MA&ixlib=rb-4.1.0&q=85";
const HEADPHONES_IMG = "https://images.unsplash.com/photo-1697040975575-0baa5b9c7803?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwyfHxwZXJzb24lMjBsaXN0ZW5pbmclMjB0byUyMG11c2ljJTIwaGVhZHBob25lcyUyMGRhcmslMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzczMTcyODM1fDA&ixlib=rb-4.1.0&q=85";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "friends", label: "Friends", icon: Users },
  { id: "rooms", label: "Listening Rooms", icon: Radio },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPlayedAt(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─── Sidebar ───
function Sidebar({ activeTab, setActiveTab, user, onLogout, unreadCount }) {
  return (
    <aside className="sidebar-desktop glass-sidebar fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50" data-testid="sidebar">
      <div className="flex items-center gap-2.5 px-6 py-7">
        <div className="w-9 h-9 rounded-xl bg-notify-blue flex items-center justify-center">
          <Music className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading text-xl font-bold text-white tracking-tight">
          Notify
        </span>
      </div>
      <Separator className="bg-white/5 mx-4" />
      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`nav-item w-full relative ${activeTab === item.id ? "active" : ""}`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.id === "notifications" && <NotificationBadge count={unreadCount} />}
            </div>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-4 pb-6">
        <Separator className="bg-white/5 mb-4" />
        <div className="flex items-center gap-3 px-2 mb-3">
          <Avatar className="w-9 h-9 border border-white/10">
            <AvatarImage src={user?.avatar} alt={user?.username} />
            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs font-heading">
              {user?.username?.charAt(0)?.toUpperCase() || "N"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={onLogout}
          className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Nav ───
function MobileNav({ activeTab, setActiveTab, unreadCount }) {
  return (
    <div className="mobile-nav fixed bottom-0 left-0 right-0 z-50 glass-sidebar border-t border-white/5 px-2 py-2" data-testid="mobile-nav">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button
            key={item.id}
            data-testid={`mobile-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors relative ${
              activeTab === item.id ? "text-blue-400" : "text-zinc-500"
            }`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.id === "notifications" && <NotificationBadge count={unreadCount} />}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Profile Card (existing) ───
function ProfileCard({ user }) {
  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-100" data-testid="profile-card">
      <div className="flex items-start gap-5">
        <Avatar className="w-20 h-20 rounded-2xl border-2 border-white/10">
          <AvatarImage src={user?.avatar} alt={user?.username} className="rounded-2xl" />
          <AvatarFallback className="rounded-2xl bg-zinc-800 text-zinc-300 text-2xl font-heading">
            {user?.username?.charAt(0)?.toUpperCase() || "N"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-2xl font-bold text-white tracking-tight truncate" data-testid="profile-username">
            {user?.username}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span className="text-sm text-zinc-400" data-testid="profile-spotify-id">{user?.spotify_id}</span>
          </div>
          <div className="mt-3">
            <span
              className={user?.subscription === "premium" ? "badge-premium" : "badge-free"}
              data-testid="profile-subscription"
            >
              {user?.subscription || "free"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Friends</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Rooms</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Sessions</p>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ───
function SkeletonCard({ rows = 3 }) {
  return (
    <div className="glass-card p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl skeleton-shimmer flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded skeleton-shimmer" />
            <div className="h-2 w-20 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Top Artists Section ───
function TopArtistsCard({ artists, loading }) {
  if (loading) return <SkeletonCard rows={5} />;

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-200" data-testid="top-artists-card">
      <div className="p-6 pb-4">
        <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-notify-blue" />
          Top Artists
        </h3>
        <p className="text-xs text-zinc-500 mt-1">Your most listened artists</p>
      </div>
      <div className="px-4 pb-4 space-y-1">
        {artists.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">No top artists yet.</p>
            <p className="text-xs text-zinc-600 mt-1">Listen to more music on Spotify</p>
          </div>
        ) : (
          artists.map((artist, index) => (
            <a
              key={artist.id}
              href={artist.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              data-testid={`top-artist-${index}`}
            >
              <span className="text-xs font-bold text-zinc-600 w-5 text-right">{index + 1}</span>
              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                {artist.image ? (
                  <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{artist.name}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {artist.genres.length > 0 ? artist.genres.join(", ") : "No genres"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                    style={{ width: `${artist.popularity}%` }}
                  />
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Top Tracks Section ───
function TopTracksCard({ tracks, loading, subscription, onPlayTrack }) {
  if (loading) return <SkeletonCard rows={5} />;

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-300" data-testid="top-tracks-card">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <Disc3 className="w-5 h-5 text-notify-blue" />
              Top Tracks
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Your most played songs</p>
          </div>
          {subscription !== "premium" && tracks.length > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              YouTube Alt.
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 space-y-1">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <Disc3 className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">No top tracks yet.</p>
            <p className="text-xs text-zinc-600 mt-1">Listen to more music on Spotify</p>
          </div>
        ) : (
          tracks.map((track, index) => (
            <div
              key={track.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              data-testid={`top-track-${index}`}
            >
              <span className="text-xs font-bold text-zinc-600 w-5 text-right">{index + 1}</span>
              <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                {track.image ? (
                  <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{track.name}</p>
                <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 tabular-nums">{formatDuration(track.duration_ms)}</span>
                <PlayButton track={track} subscription={subscription} onPlay={onPlayTrack} />
                <a href={track.external_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Recently Played Section ───
function RecentlyPlayedCard({ tracks, loading, subscription, onPlayTrack }) {
  if (loading) return <SkeletonCard rows={5} />;

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-400" data-testid="recently-played-card">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-notify-blue" />
              Recently Played
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Your listening history</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-1 max-h-[500px] overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">No recent plays.</p>
            <p className="text-xs text-zinc-600 mt-1">Start listening on Spotify</p>
          </div>
        ) : (
          tracks.map((track, index) => (
            <div
              key={`${track.id}-${index}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              data-testid={`recently-played-${index}`}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                {track.image ? (
                  <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
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
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-600 flex-shrink-0">{formatPlayedAt(track.played_at)}</span>
                <PlayButton track={track} subscription={subscription} onPlay={onPlayTrack} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Playlists Section ───
function PlaylistsCard({ playlists, loading }) {
  if (loading) return <SkeletonCard rows={4} />;

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-500" data-testid="playlists-card">
      <div className="p-6 pb-4">
        <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-notify-blue" />
          Your Playlists
        </h3>
        <p className="text-xs text-zinc-500 mt-1">Your Spotify playlists</p>
      </div>
      <div className="px-4 pb-4">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <ListMusic className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">No playlists found.</p>
            <p className="text-xs text-zinc-600 mt-1">Create playlists on Spotify</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((playlist, index) => (
              <a
                key={playlist.id}
                href={playlist.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all"
                data-testid={`playlist-${index}`}
              >
                <div className="aspect-square w-full overflow-hidden bg-zinc-800">
                  {playlist.image ? (
                    <img src={playlist.image} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white truncate">{playlist.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{playlist.tracks_total} tracks</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Friends Card (placeholder) ───
function FriendsCard() {
  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-600" data-testid="friends-card">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-notify-blue" />
          Friends
        </h3>
        <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1" data-testid="add-friends-button">
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-zinc-700" />
        </div>
        <p className="text-sm text-zinc-400">You don't have friends on Notify yet.</p>
        <p className="text-xs text-zinc-600 mt-2">Invite friends to share your music taste</p>
      </div>
    </div>
  );
}

// ─── Rooms Card (functional) ───
function RoomsCard({ navigate }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API}/rooms/list`, { headers: getAuthHeaders() });
      setRooms(res.data.rooms || []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API}/rooms/create`, { name: roomName.trim() }, { headers: getAuthHeaders() });
      navigate(`/room/${res.data.id}`);
    } catch {
      alert("Erreur lors de la création de la room");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (roomId) => {
    setJoining(roomId);
    try {
      await axios.post(`${API}/rooms/join`, { room_id: roomId }, { headers: getAuthHeaders() });
      navigate(`/room/${roomId}`);
    } catch {
      alert("Erreur lors de la connexion à la room");
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-700" data-testid="rooms-card">
      <div className="relative h-32 overflow-hidden">
        <img src={HEADPHONES_IMG} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent" />
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
          <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
            <Headphones className="w-5 h-5 text-notify-blue" />
            Listening Rooms
          </h3>
          <button
            data-testid="create-room-btn"
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-notify-blue/90 hover:bg-notify-blue text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            Créer
          </button>
        </div>
      </div>

      {/* Create Room Form */}
      {showCreate && (
        <div className="p-4 border-b border-white/5" data-testid="create-room-form">
          <div className="flex items-center gap-2">
            <input
              data-testid="room-name-input"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nom de la room..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-notify-blue/50"
            />
            <button
              data-testid="confirm-create-room-btn"
              onClick={handleCreate}
              disabled={creating || !roomName.trim()}
              className="px-4 py-2 rounded-xl bg-notify-blue hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <Radio className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">Aucune room active.</p>
            <p className="text-xs text-zinc-600 mt-2">Créez une room et écoutez ensemble</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all group cursor-pointer"
                data-testid={`room-${room.id}`}
                onClick={() => handleJoin(room.id)}
              >
                <div className="w-10 h-10 rounded-xl bg-notify-blue/10 flex items-center justify-center flex-shrink-0">
                  <Radio className="w-5 h-5 text-notify-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{room.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-zinc-500">{room.host_name}</span>
                    <span className="text-xs text-zinc-600">·</span>
                    <Users className="w-3 h-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500">{room.participant_count || 0}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {joining === room.id ? (
                    <Loader2 className="w-4 h-4 text-notify-blue animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-notify-blue transition-colors" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───
export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);

  // Player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [spotifyToken, setSpotifyToken] = useState(null);

  // Notification socket
  const { unreadCount, newNotification, decrementCount, resetCount } = useNotificationSocket(user?.id);

  const subscription = user?.subscription || "free";

  // Dispatch new_notification event for NotificationFeed component
  useEffect(() => {
    if (newNotification) {
      window.dispatchEvent(new CustomEvent("new_notification", { detail: newNotification }));
    }
  }, [newNotification]);

  // Listen for read events
  useEffect(() => {
    const handleRead = () => decrementCount();
    const handleAllRead = () => resetCount();
    window.addEventListener("notification_read", handleRead);
    window.addEventListener("notification_all_read", handleAllRead);
    return () => {
      window.removeEventListener("notification_read", handleRead);
      window.removeEventListener("notification_all_read", handleAllRead);
    };
  }, [decrementCount, resetCount]);

  const fetchSpotifyData = useCallback(async () => {
    const headers = getAuthHeaders();

    // Fetch all data in parallel
    const fetchArtists = axios.get(`${API}/spotify/top-artists`, { headers })
      .then(res => { setTopArtists(res.data.artists || []); })
      .catch(() => { setTopArtists([]); })
      .finally(() => setLoadingArtists(false));

    const fetchTracks = axios.get(`${API}/spotify/top-tracks`, { headers })
      .then(res => { setTopTracks(res.data.tracks || []); })
      .catch(() => { setTopTracks([]); })
      .finally(() => setLoadingTracks(false));

    const fetchRecent = axios.get(`${API}/spotify/recently-played`, { headers })
      .then(res => { setRecentlyPlayed(res.data.tracks || []); })
      .catch(() => { setRecentlyPlayed([]); })
      .finally(() => setLoadingRecent(false));

    const fetchPlaylists = axios.get(`${API}/spotify/playlists`, { headers })
      .then(res => { setPlaylists(res.data.playlists || []); })
      .catch(() => { setPlaylists([]); })
      .finally(() => setLoadingPlaylists(false));

    // Also fetch Spotify access token for Premium playback
    if (subscription === "premium") {
      axios.get(`${API}/player/spotify-token`, { headers })
        .then(res => { setSpotifyToken(res.data.access_token); })
        .catch(() => {});
    }

    await Promise.allSettled([fetchArtists, fetchTracks, fetchRecent, fetchPlaylists]);
  }, [subscription]);

  useEffect(() => {
    fetchSpotifyData();
  }, [fetchSpotifyData]);

  const handlePlayTrack = (track) => {
    setCurrentTrack(track);
  };

  const handleClosePlayer = () => {
    setCurrentTrack(null);
  };

  return (
    <div className="min-h-screen bg-black" data-testid="dashboard-page">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={onLogout}
        unreadCount={unreadCount}
      />
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} unreadCount={unreadCount} />

      <main className="md:ml-[260px] min-h-screen p-6 md:p-8 lg:p-10 pb-24 md:pb-10">
        {/* Header */}
        <div className="mb-10 animate-fade-up flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-white tracking-tight">
              Welcome back{user?.username ? `, ${user.username}` : ""}
            </h1>
            <p className="text-zinc-500 mt-2 text-base">
              Here's what's happening in your music world
            </p>
          </div>
          <a
            href={`${API}/download/project-zip`}
            className="hidden md:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
            data-testid="download-zip-button"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </a>
        </div>

        {/* Show content based on active tab */}
        {activeTab === "notifications" ? (
          <div className="max-w-3xl">
            <NotificationFeed userId={user?.id} />
          </div>
        ) : activeTab === "friends" ? (
          <FriendsTab user={user} />
        ) : activeTab === "rooms" ? (
          <div className="max-w-3xl">
            <RoomsCard navigate={navigate} />
          </div>
        ) : (
          /* Dashboard Bento Grid */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Profile Card */}
            <div className="md:col-span-5 lg:col-span-4">
              <ProfileCard user={user} />
            </div>

            {/* Top Artists */}
            <div className="md:col-span-7 lg:col-span-8">
              <TopArtistsCard artists={topArtists} loading={loadingArtists} />
            </div>

            {/* Top Tracks */}
            <div className="md:col-span-7 lg:col-span-8">
              <TopTracksCard tracks={topTracks} loading={loadingTracks} subscription={subscription} onPlayTrack={handlePlayTrack} />
            </div>

            {/* Recently Played */}
            <div className="md:col-span-5 lg:col-span-4">
              <RecentlyPlayedCard tracks={recentlyPlayed} loading={loadingRecent} subscription={subscription} onPlayTrack={handlePlayTrack} />
            </div>

            {/* Playlists */}
            <div className="col-span-full">
              <PlaylistsCard playlists={playlists} loading={loadingPlaylists} />
            </div>

            {/* Rooms */}
            <div className="col-span-full">
              <RoomsCard navigate={navigate} />
            </div>

            {/* Activity Feed */}
            <div className="col-span-full">
              <NotificationFeed userId={user?.id} />
            </div>
          </div>
        )}
      </main>

      {/* Music Player Modal */}
      {currentTrack && (
        <MusicPlayer
          track={currentTrack}
          subscription={subscription}
          spotifyToken={spotifyToken}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
}
