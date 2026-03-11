import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, Search, X, Loader2, Check, XCircle, Music,
  Headphones, ArrowRight, RefreshCw, Star, Disc3, Hash, Zap
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Score Ring SVG ───
function ScoreRing({ score, size = 120, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const getColor = (s) => {
    if (s >= 75) return "#22c55e";
    if (s >= 50) return "#3b82f6";
    if (s >= 25) return "#f59e0b";
    return "#ef4444";
  };
  const color = getColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold text-white" data-testid="compatibility-score">{score}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">%</span>
      </div>
    </div>
  );
}

// ─── Music Compatibility Card ───
function MusicCompatibilityCard({ compatibility, friendName, friendId, onRefresh, refreshing, onStartRoom }) {
  if (!compatibility) {
    return (
      <div className="glass-card card-glow p-6" data-testid="compatibility-card-empty">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-notify-blue" />
          <h3 className="font-heading text-lg font-semibold text-white">Music Compatibility</h3>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
            <Music className="w-7 h-7 text-zinc-700" />
          </div>
          <p className="text-sm text-zinc-400">Pas encore calculée</p>
          <p className="text-xs text-zinc-600 mt-1 mb-4">Comparez vos goûts musicaux avec {friendName}</p>
          <button
            data-testid="calculate-compatibility-btn"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-notify-blue hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Calculer la compatibilité
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card card-glow overflow-hidden" data-testid="compatibility-card">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-notify-blue" />
          <h3 className="font-heading text-lg font-semibold text-white">Music Compatibility</h3>
        </div>
        <button
          data-testid="refresh-compatibility-btn"
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Recalculer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center pb-4">
        <ScoreRing score={compatibility.score} />
        <p className="text-sm text-zinc-400 mt-2">
          {compatibility.score >= 75 ? "Vous partagez les mêmes vibes !" :
           compatibility.score >= 50 ? "Bonne compatibilité musicale" :
           compatibility.score >= 25 ? "Quelques goûts en commun" :
           "Goûts musicaux différents"}
        </p>
      </div>

      {/* Score Breakdown */}
      <div className="px-6 pb-4 grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Star className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{compatibility.artists_score}%</p>
          <p className="text-[10px] text-zinc-500 uppercase">Artistes</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Disc3 className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{compatibility.tracks_score}%</p>
          <p className="text-[10px] text-zinc-500 uppercase">Tracks</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Hash className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{compatibility.genres_score}%</p>
          <p className="text-[10px] text-zinc-500 uppercase">Genres</p>
        </div>
      </div>

      {/* Common Artists */}
      {compatibility.common_artists && compatibility.common_artists.length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3" />
            Artistes en commun ({compatibility.common_artists.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {compatibility.common_artists.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]" data-testid={`common-artist-${a.id}`}>
                {a.image && <img src={a.image} alt="" className="w-5 h-5 rounded-full object-cover" />}
                <span className="text-xs text-zinc-300">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Tracks */}
      {compatibility.common_tracks && compatibility.common_tracks.length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Disc3 className="w-3 h-3" />
            Morceaux en commun ({compatibility.common_tracks.length})
          </p>
          <div className="space-y-1">
            {compatibility.common_tracks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors" data-testid={`common-track-${t.id}`}>
                {t.image && <img src={t.image} alt="" className="w-8 h-8 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{t.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{t.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Room Button */}
      <div className="p-4 border-t border-white/5">
        <button
          data-testid="start-room-together-btn"
          onClick={onStartRoom}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20"
        >
          <Headphones className="w-4 h-4" />
          Start Listening Room Together
        </button>
      </div>
    </div>
  );
}


// ─── Friend Profile Modal ───
function FriendProfileModal({ friendId, onClose, navigate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compatibility, setCompatibility] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/friends/profile/${friendId}`, { headers: getAuthHeaders() });
      setProfile(res.data.friend);
      setCompatibility(res.data.compatibility);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCalculateCompatibility = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post(`${API}/compatibility/calculate/${friendId}`, {}, { headers: getAuthHeaders() });
      setCompatibility(res.data);
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur lors du calcul de la compatibilité");
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartRoom = async () => {
    setCreatingRoom(true);
    try {
      const roomName = `${profile?.username || "Friend"} & moi`;
      const res = await axios.post(`${API}/rooms/create-with-friend`, {
        friend_id: friendId,
        name: roomName,
      }, { headers: getAuthHeaders() });
      onClose();
      navigate(`/room/${res.data.id}`);
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur lors de la création de la room");
    } finally {
      setCreatingRoom(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" data-testid="friend-profile-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 z-10" data-testid="close-friend-profile">
          <X className="w-5 h-5 text-zinc-400" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-notify-blue animate-spin" />
          </div>
        ) : profile ? (
          <>
            {/* Profile Header */}
            <div className="p-6 pb-4 text-center">
              <Avatar className="w-20 h-20 mx-auto border-2 border-white/10 rounded-2xl">
                <AvatarImage src={profile.avatar} alt={profile.username} className="rounded-2xl" />
                <AvatarFallback className="rounded-2xl bg-zinc-800 text-zinc-400 text-2xl font-heading">
                  {profile.username?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-heading text-xl font-bold text-white mt-3" data-testid="friend-profile-name">{profile.username}</h2>
              <div className="flex items-center justify-center gap-2 mt-1">
                <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span className="text-sm text-zinc-500">{profile.spotify_id}</span>
              </div>
              <div className="mt-2">
                <span className={profile.subscription === "premium" ? "badge-premium" : "badge-free"}>
                  {profile.subscription || "free"}
                </span>
              </div>
            </div>

            {/* Compatibility Card */}
            <div className="px-4 pb-4">
              <MusicCompatibilityCard
                compatibility={compatibility}
                friendName={profile.username}
                friendId={friendId}
                onRefresh={handleCalculateCompatibility}
                refreshing={refreshing}
                onStartRoom={handleStartRoom}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-sm text-zinc-400">Profil introuvable</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Main Friends Tab ───
export default function FriendsTab({ user }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState({ received: [], sent: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/friends/list`, { headers: getAuthHeaders() });
      setFriends(res.data.friends || []);
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/friends/pending`, { headers: getAuthHeaders() });
      setPending(res.data);
    } catch {
      setPending({ received: [], sent: [] });
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
    fetchPending();
  }, [fetchFriends, fetchPending]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/friends/search`, {
        params: { q: searchQuery.trim() },
        headers: getAuthHeaders(),
      });
      setSearchResults(res.data.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetId) => {
    setActionLoading(targetId);
    try {
      await axios.post(`${API}/friends/request`, { target_user_id: targetId }, { headers: getAuthHeaders() });
      setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, friendship_status: "pending", friendship_direction: "sent" } : u));
      fetchPending();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (userId) => {
    setActionLoading(userId);
    try {
      await axios.post(`${API}/friends/accept`, { target_user_id: userId }, { headers: getAuthHeaders() });
      fetchFriends();
      fetchPending();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId) => {
    setActionLoading(`reject-${userId}`);
    try {
      await axios.post(`${API}/friends/reject`, { target_user_id: userId }, { headers: getAuthHeaders() });
      fetchPending();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (userId) => {
    if (!window.confirm("Voulez-vous vraiment retirer cet ami ?")) return;
    setActionLoading(userId);
    try {
      await axios.post(`${API}/friends/remove`, { target_user_id: userId }, { headers: getAuthHeaders() });
      fetchFriends();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = (pending.received?.length || 0);

  return (
    <div className="max-w-3xl space-y-6" data-testid="friends-tab">
      {/* Header */}
      <div className="animate-fade-up">
        <h2 className="font-heading text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-notify-blue" />
          Friends
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Gérez vos amis et découvrez votre compatibilité musicale</p>
      </div>

      {/* Search */}
      <div className="glass-card p-4 animate-fade-up delay-100" data-testid="friends-search">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-notify-blue/50 transition-colors">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              data-testid="friends-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher un utilisateur..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="p-0.5">
                <X className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            )}
          </div>
          <button
            data-testid="friends-search-btn"
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-xl bg-notify-blue hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            Rechercher
          </button>
        </div>

        {/* Search Results */}
        {(searchResults.length > 0 || searching) && (
          <div className="mt-3 space-y-1" data-testid="search-results">
            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-notify-blue animate-spin" />
              </div>
            )}
            {!searching && searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors" data-testid={`search-user-${u.id}`}>
                <Avatar className="w-10 h-10 border border-white/10">
                  <AvatarImage src={u.avatar} alt={u.username} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">{u.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{u.username}</p>
                  <p className="text-xs text-zinc-500">{u.spotify_id}</p>
                </div>
                {u.friendship_status === "accepted" ? (
                  <span className="text-xs text-green-400 px-3 py-1 rounded-full bg-green-500/10">Ami</span>
                ) : u.friendship_status === "pending" && u.friendship_direction === "sent" ? (
                  <span className="text-xs text-amber-400 px-3 py-1 rounded-full bg-amber-500/10">En attente</span>
                ) : u.friendship_status === "pending" && u.friendship_direction === "received" ? (
                  <button
                    onClick={() => handleAccept(u.id)}
                    disabled={actionLoading === u.id}
                    className="flex items-center gap-1 text-xs text-green-400 px-3 py-1.5 rounded-full bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Accepter
                  </button>
                ) : (
                  <button
                    data-testid={`add-friend-${u.id}`}
                    onClick={() => handleSendRequest(u.id)}
                    disabled={actionLoading === u.id}
                    className="flex items-center gap-1 text-xs text-notify-blue px-3 py-1.5 rounded-full bg-notify-blue/10 hover:bg-notify-blue/20 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    Ajouter
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs: Friends / Pending */}
      <div className="flex items-center gap-2 animate-fade-up delay-200">
        <button
          data-testid="tab-friends"
          onClick={() => setActiveSection("friends")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeSection === "friends"
              ? "bg-notify-blue/20 text-notify-blue border border-notify-blue/30"
              : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10"
          }`}
        >
          Mes amis ({friends.length})
        </button>
        <button
          data-testid="tab-pending"
          onClick={() => setActiveSection("pending")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all relative ${
            activeSection === "pending"
              ? "bg-notify-blue/20 text-notify-blue border border-notify-blue/30"
              : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10"
          }`}
        >
          En attente
          {totalPending > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {totalPending}
            </span>
          )}
        </button>
      </div>

      {/* Friends List */}
      {activeSection === "friends" && (
        <div className="glass-card card-glow overflow-hidden animate-fade-up delay-300" data-testid="friends-list">
          <div className="p-4">
            {loadingFriends ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-zinc-700" />
                </div>
                <p className="text-sm text-zinc-400">Aucun ami pour le moment</p>
                <p className="text-xs text-zinc-600 mt-2">Recherchez des utilisateurs pour les ajouter</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all cursor-pointer group"
                    data-testid={`friend-${f.id}`}
                    onClick={() => setSelectedFriend(f.id)}
                  >
                    <Avatar className="w-11 h-11 border border-white/10">
                      <AvatarImage src={f.avatar} alt={f.username} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-400 text-sm">{f.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{f.username}</p>
                      <p className="text-xs text-zinc-500">{f.spotify_id}</p>
                    </div>
                    {f.compatibility_score !== null && f.compatibility_score !== undefined && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                        <Zap className="w-3 h-3 text-notify-blue" />
                        <span className="text-xs font-bold text-white">{f.compatibility_score}%</span>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-notify-blue transition-colors flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Requests */}
      {activeSection === "pending" && (
        <div className="space-y-4 animate-fade-up delay-300">
          {/* Received */}
          <div className="glass-card card-glow overflow-hidden" data-testid="pending-received">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Demandes reçues ({pending.received?.length || 0})</h3>
            </div>
            <div className="p-4">
              {loadingPending ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                </div>
              ) : (pending.received?.length || 0) === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">Aucune demande reçue</p>
              ) : (
                <div className="space-y-2">
                  {pending.received.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]" data-testid={`pending-user-${r.id}`}>
                      <Avatar className="w-10 h-10 border border-white/10">
                        <AvatarImage src={r.avatar} alt={r.username} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">{r.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{r.username}</p>
                        <p className="text-xs text-zinc-500">{r.spotify_id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          data-testid={`accept-${r.id}`}
                          onClick={() => handleAccept(r.id)}
                          disabled={actionLoading === r.id}
                          className="p-2 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          data-testid={`reject-${r.id}`}
                          onClick={() => handleReject(r.id)}
                          disabled={actionLoading === `reject-${r.id}`}
                          className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `reject-${r.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sent */}
          <div className="glass-card card-glow overflow-hidden" data-testid="pending-sent">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Demandes envoyées ({pending.sent?.length || 0})</h3>
            </div>
            <div className="p-4">
              {(pending.sent?.length || 0) === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">Aucune demande envoyée</p>
              ) : (
                <div className="space-y-2">
                  {pending.sent.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]" data-testid={`sent-user-${s.id}`}>
                      <Avatar className="w-10 h-10 border border-white/10">
                        <AvatarImage src={s.avatar} alt={s.username} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">{s.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.username}</p>
                        <p className="text-xs text-zinc-500">{s.spotify_id}</p>
                      </div>
                      <span className="text-xs text-amber-400 px-3 py-1 rounded-full bg-amber-500/10">En attente</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Friend Profile Modal */}
      {selectedFriend && (
        <FriendProfileModal
          friendId={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
