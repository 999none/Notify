import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Star, Disc3, Music, Clock, Hash, Loader2,
  RefreshCw, BarChart3, Share2, Sparkles, ExternalLink, ChevronRight,
  TrendingUp, Award
} from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ─── Genre Bar ───
function GenreBar({ name, count, maxCount, index }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const colors = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-pink-400",
    "from-green-500 to-emerald-400",
    "from-amber-500 to-orange-400",
    "from-rose-500 to-red-400",
    "from-indigo-500 to-violet-400",
    "from-teal-500 to-cyan-400",
    "from-fuchsia-500 to-pink-400",
  ];
  const color = colors[index % colors.length];

  return (
    <div className="group" data-testid={`genre-bar-${index}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-300 font-medium capitalize">{name}</span>
        <span className="text-xs text-zinc-500">{count} artiste{count > 1 ? "s" : ""}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%`, animationDelay: `${index * 100}ms` }}
        />
      </div>
    </div>
  );
}

// ─── Listening Time Card ───
function ListeningTimeCard({ minutes }) {
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-200" data-testid="listening-time-card">
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-5 h-5 text-notify-blue" />
        <h3 className="font-heading text-lg font-semibold text-white">Listening Time</h3>
      </div>
      <div className="flex flex-col items-center py-6 text-center">
        <div className="relative">
          <div className="w-32 h-32 rounded-full border-4 border-notify-blue/20 flex items-center justify-center">
            <div className="text-center">
              <p className="font-heading text-4xl font-bold text-white">{hours}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">heures</p>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-notify-blue/20 rounded-full px-2.5 py-1">
            <span className="text-xs font-bold text-notify-blue">{remainingMins}m</span>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mt-4">Estimation mensuelle</p>
        <p className="text-xs text-zinc-600 mt-1">Basé sur votre activité récente</p>
      </div>
    </div>
  );
}

// ─── Recap Card ───
function RecapCard({ recap, onClick }) {
  const months = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <div
      className="glass-card card-glow p-5 cursor-pointer hover:border-notify-blue/30 transition-all group"
      onClick={onClick}
      data-testid={`recap-card-${recap.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-heading text-base font-semibold text-white">
            {months[recap.month] || ""} {recap.year}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Notify Recap</p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-notify-blue transition-colors" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        {recap.top_artist?.image && (
          <img src={recap.top_artist.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500">Top Artist</p>
          <p className="text-sm text-white font-medium truncate">{recap.top_artist?.name || "?"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400">
          {recap.listening_personality?.name || "Listener"}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400 capitalize">
          {recap.favorite_genre || "?"}
        </span>
      </div>
    </div>
  );
}

// ─── Recap Detail Modal ───
function RecapDetailModal({ recap, onClose, onShare }) {
  const recapRef = useRef(null);

  if (!recap) return null;

  const months = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="recap-detail-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 z-20"
          data-testid="close-recap-modal"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Shareable Card */}
        <div ref={recapRef} className="recap-shareable" data-testid="recap-shareable-content">
          {/* Header gradient */}
          <div className="relative overflow-hidden rounded-t-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800" />
            <div className="relative p-6 pb-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Music className="w-5 h-5 text-white/80" />
                <span className="font-heading text-sm font-bold text-white/80 uppercase tracking-wider">Notify Recap</span>
              </div>
              <h2 className="font-heading text-2xl font-bold text-white">
                {months[recap.month] || ""} {recap.year}
              </h2>
              {recap.username && (
                <p className="text-sm text-white/60 mt-1">@{recap.username}</p>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Top Artist */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]" data-testid="recap-top-artist">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                {recap.top_artist?.image ? (
                  <img src={recap.top_artist.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-3 h-3" /> Top Artist
                </p>
                <p className="font-heading text-lg font-bold text-white mt-0.5">{recap.top_artist?.name || "?"}</p>
              </div>
            </div>

            {/* Top Track */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]" data-testid="recap-top-track">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                {recap.top_track?.image ? (
                  <img src={recap.top_track.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc3 className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Top Track
                </p>
                <p className="font-heading text-base font-bold text-white mt-0.5 truncate">{recap.top_track?.name || "?"}</p>
                <p className="text-xs text-zinc-400 truncate">{recap.top_track?.artist || ""}</p>
              </div>
            </div>

            {/* Favorite Genre */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center" data-testid="recap-fav-genre">
              <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center justify-center gap-1">
                <Hash className="w-3 h-3" /> Genre Favori
              </p>
              <p className="font-heading text-xl font-bold text-white mt-1 capitalize">{recap.favorite_genre || "?"}</p>
              {recap.top_genres && recap.top_genres.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                  {recap.top_genres.slice(1, 5).map((g) => (
                    <span key={g} className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-zinc-400 capitalize">{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Listening Personality */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-center" data-testid="recap-personality">
              <Sparkles className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Listening Personality</p>
              <p className="font-heading text-xl font-bold text-white mt-1">{recap.listening_personality?.name || "Listener"}</p>
              <p className="text-sm text-zinc-400 mt-1">{recap.listening_personality?.desc || ""}</p>
            </div>
          </div>
        </div>

        {/* Share Button */}
        <div className="p-4 border-t border-white/5">
          <button
            data-testid="share-recap-btn"
            onClick={() => onShare(recapRef)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20"
          >
            <Share2 className="w-4 h-4" />
            Share Recap
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Main Stats Page ───
export default function StatsPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingRecap, setGeneratingRecap] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [sharing, setSharing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, recapsRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/recaps`, { headers }),
      ]);
      setStats(statsRes.data);
      setRecaps(recapsRes.data.recaps || []);
    } catch (err) {
      console.error("Stats fetch error:", err);
      // Try saved stats
      try {
        const headers = getAuthHeaders();
        const saved = await axios.get(`${API}/stats/saved`, { headers });
        if (saved.data && saved.data.user_id) {
          setStats(saved.data);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API}/stats`, { headers: getAuthHeaders() });
      setStats(res.data);
    } catch (err) {
      alert("Erreur lors du rafraîchissement des stats");
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateRecap = async () => {
    setGeneratingRecap(true);
    try {
      const res = await axios.post(`${API}/recap/generate`, {}, { headers: getAuthHeaders() });
      setRecaps((prev) => [res.data, ...prev]);
      setSelectedRecap(res.data);
    } catch (err) {
      alert("Erreur lors de la génération du recap");
    } finally {
      setGeneratingRecap(false);
    }
  };

  const handleShareRecap = async (recapRef) => {
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const element = recapRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        backgroundColor: "#09090b",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `notify-recap-${selectedRecap?.year || ""}-${selectedRecap?.month || ""}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("Share error:", err);
      alert("Erreur lors du partage");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center" data-testid="stats-loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-notify-blue animate-spin" />
          <p className="text-sm text-zinc-400">Chargement de vos stats...</p>
        </div>
      </div>
    );
  }

  const maxGenreCount = stats?.favorite_genres?.[0]?.count || 1;

  return (
    <div className="min-h-screen bg-black" data-testid="stats-page">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-sidebar border-b border-white/5">
        <div className="flex items-center justify-between px-4 md:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              data-testid="stats-back-btn"
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="font-heading text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-notify-blue" />
                Notify Stats & Recap
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">Vos statistiques musicales</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="refresh-stats-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-medium transition-colors disabled:opacity-50 border border-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              data-testid="generate-recap-btn"
              onClick={handleGenerateRecap}
              disabled={generatingRecap}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
            >
              {generatingRecap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Générer Recap
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {!stats || !stats.top_artists ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-lg text-zinc-400">Pas encore de statistiques</p>
            <p className="text-sm text-zinc-600 mt-2">Connectez-vous avec Spotify et écoutez de la musique</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
              {/* Top Artists */}
              <div className="glass-card card-glow overflow-hidden animate-fade-up" data-testid="stats-top-artists">
                <div className="p-6 pb-4">
                  <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
                    <Star className="w-5 h-5 text-notify-blue" />
                    Top Artists
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Vos artistes les plus écoutés</p>
                </div>
                <div className="px-4 pb-4 space-y-1">
                  {(stats.top_artists || []).map((artist, index) => (
                    <a
                      key={artist.id}
                      href={artist.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                      data-testid={`stats-artist-${index}`}
                    >
                      <span className="text-xs font-bold text-zinc-600 w-6 text-right">{index + 1}</span>
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
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
                          {artist.genres?.length > 0 ? artist.genres.join(", ") : "No genres"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                            style={{ width: `${artist.popularity}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-600 w-8 text-right">{artist.popularity}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Top Tracks */}
              <div className="glass-card card-glow overflow-hidden animate-fade-up delay-100" data-testid="stats-top-tracks">
                <div className="p-6 pb-4">
                  <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
                    <Disc3 className="w-5 h-5 text-notify-blue" />
                    Top Tracks
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Vos morceaux les plus joués</p>
                </div>
                <div className="px-4 pb-4 space-y-1">
                  {(stats.top_tracks || []).map((track, index) => (
                    <a
                      key={track.id}
                      href={track.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
                      data-testid={`stats-track-${index}`}
                    >
                      <span className="text-xs font-bold text-zinc-600 w-6 text-right">{index + 1}</span>
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
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
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Listening Time */}
              <ListeningTimeCard minutes={stats.listening_time_estimate || 0} />

              {/* Favorite Genres */}
              <div className="glass-card card-glow p-6 animate-fade-up delay-300" data-testid="stats-genres">
                <div className="flex items-center gap-2 mb-5">
                  <Hash className="w-5 h-5 text-notify-blue" />
                  <h3 className="font-heading text-lg font-semibold text-white">Genres Favoris</h3>
                </div>
                <div className="space-y-4">
                  {(stats.favorite_genres || []).slice(0, 8).map((genre, index) => (
                    <GenreBar
                      key={genre.name}
                      name={genre.name}
                      count={genre.count}
                      maxCount={maxGenreCount}
                      index={index}
                    />
                  ))}
                  {(!stats.favorite_genres || stats.favorite_genres.length === 0) && (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Hash className="w-6 h-6 text-zinc-700 mb-2" />
                      <p className="text-sm text-zinc-400">Aucun genre détecté</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recaps */}
              <div className="glass-card card-glow p-6 animate-fade-up delay-400" data-testid="stats-recaps-section">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-notify-blue" />
                    <h3 className="font-heading text-lg font-semibold text-white">Mes Recaps</h3>
                  </div>
                  <button
                    data-testid="generate-recap-sidebar-btn"
                    onClick={handleGenerateRecap}
                    disabled={generatingRecap}
                    className="text-xs text-notify-blue hover:text-blue-400 transition-colors disabled:opacity-50"
                  >
                    {generatingRecap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+ Nouveau"}
                  </button>
                </div>
                {recaps.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Sparkles className="w-6 h-6 text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-400">Aucun recap</p>
                    <p className="text-xs text-zinc-600 mt-1">Générez votre premier recap !</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recaps.map((recap) => (
                      <RecapCard key={recap.id} recap={recap} onClick={() => setSelectedRecap(recap)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Recap Detail Modal */}
      {selectedRecap && (
        <RecapDetailModal
          recap={selectedRecap}
          onClose={() => setSelectedRecap(null)}
          onShare={handleShareRecap}
        />
      )}
    </div>
  );
}
