import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { playlistAPI, playbackAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Plus, ListMusic, Music, Trash2, ExternalLink, Search, X, Upload, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Playlists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);

  useEffect(() => { fetchPlaylists(); }, []);

  const fetchPlaylists = async () => {
    try {
      const res = await playlistAPI.list();
      setPlaylists(res.data.playlists || []);
    } catch (err) {}
  };

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    try {
      const res = await playlistAPI.create(newName.trim(), newDesc.trim());
      toast.success('Playlist created!');
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      fetchPlaylists();
      setSelectedPlaylist(res.data);
    } catch (err) { toast.error('Failed to create'); }
  };

  const deletePlaylist = async (id) => {
    try {
      await playlistAPI.delete(id);
      toast.success('Playlist deleted');
      setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (err) { toast.error('Failed'); }
  };

  const searchTracks = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await playbackAPI.search(searchQuery);
      setSearchResults(res.data.tracks || []);
    } catch (err) { toast.error('Search failed'); }
  };

  const addTrack = async (track) => {
    if (!selectedPlaylist) return;
    try {
      await playlistAPI.addTrack(selectedPlaylist.id, {
        track_uri: track.uri,
        name: track.name,
        artist: track.artist,
        album_art: track.album_art,
        duration_ms: track.duration_ms
      });
      toast.success(`Added: ${track.name}`);
      const res = await playlistAPI.get(selectedPlaylist.id);
      setSelectedPlaylist(res.data);
      fetchPlaylists();
    } catch (err) { toast.error('Failed to add'); }
  };

  const removeTrack = async (trackId) => {
    if (!selectedPlaylist) return;
    try {
      await playlistAPI.removeTrack(selectedPlaylist.id, trackId);
      const res = await playlistAPI.get(selectedPlaylist.id);
      setSelectedPlaylist(res.data);
      fetchPlaylists();
    } catch (err) {}
  };

  const syncToSpotify = async () => {
    if (!selectedPlaylist) return;
    try {
      await playlistAPI.syncToSpotify(selectedPlaylist.id);
      toast.success('Synced to Spotify!');
    } catch (err) { toast.error('Sync failed'); }
  };

  const openImport = async () => {
    setImportOpen(true);
    try {
      const res = await playlistAPI.importSpotifyList();
      setSpotifyPlaylists(res.data.playlists || []);
    } catch (err) { toast.error('Failed to load Spotify playlists'); }
  };

  const importPlaylist = async (spotifyId) => {
    try {
      await playlistAPI.importSpotifyPlaylist(spotifyId);
      toast.success('Playlist imported!');
      setImportOpen(false);
      fetchPlaylists();
    } catch (err) { toast.error('Import failed'); }
  };

  const formatDuration = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-7xl" data-testid="playlists-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Syne' }}>Playlists</h1>
            <p className="text-[#94A3B8] mt-1">Collaborative playlists synced with Spotify</p>
          </div>
          <div className="flex gap-3">
            <button onClick={openImport} className="btn-ghost flex items-center gap-2 border border-white/10 rounded-full px-4 py-2 text-sm" data-testid="import-spotify-btn">
              <Upload className="w-4 h-4" /> Import from Spotify
            </button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button className="btn-notify flex items-center gap-2" data-testid="create-playlist-btn">
                  <Plus className="w-5 h-5" /> New Playlist
                </button>
              </DialogTrigger>
              <DialogContent className="glass-heavy border-white/10 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Syne' }}>Create Playlist</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  <Input placeholder="Playlist name..." value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="playlist-name-input" />
                  <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="playlist-desc-input" />
                  <button onClick={createPlaylist} disabled={!newName.trim()} className="btn-notify w-full disabled:opacity-50" data-testid="create-playlist-submit">Create</button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Import Modal */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="glass-heavy border-white/10 text-white sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Syne' }}>Import from Spotify</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {spotifyPlaylists.map(p => (
                <div key={p.spotify_id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" onClick={() => importPlaylist(p.spotify_id)} data-testid={`import-${p.spotify_id}`}>
                  {p.image ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl" /> : <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><ListMusic className="w-6 h-6 text-[#475569]" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-[#475569]">{p.track_count} tracks</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#475569]" />
                </div>
              ))}
              {spotifyPlaylists.length === 0 && <p className="text-center text-[#475569] py-8">Loading...</p>}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-6">
          {/* Playlist list */}
          <div className={`space-y-3 ${selectedPlaylist ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
            {playlists.length === 0 ? (
              <div className="glass-card p-16 text-center">
                <ListMusic className="w-16 h-16 text-[#475569] mb-6 mx-auto" strokeWidth={1} />
                <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Syne' }}>No playlists yet</h3>
                <p className="text-[#475569]">Create your first collaborative playlist!</p>
              </div>
            ) : playlists.map(pl => (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylist(pl)}
                className={`glass-card p-4 cursor-pointer transition-all ${selectedPlaylist?.id === pl.id ? 'border-[#4DA6FF]/40 bg-[#4DA6FF]/5' : 'glass-card-interactive'}`}
                data-testid={`playlist-item-${pl.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#4DA6FF]/10 flex items-center justify-center flex-shrink-0">
                    <ListMusic className="w-6 h-6 text-[#4DA6FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{pl.name}</p>
                    <p className="text-xs text-[#475569]">{pl.track_count || 0} tracks</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Playlist detail */}
          {selectedPlaylist && (
            <div className="flex-1 animate-slide-right" data-testid="playlist-detail">
              <div className="glass-card p-6 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'Syne' }}>{selectedPlaylist.name}</h2>
                    {selectedPlaylist.description && <p className="text-[#94A3B8] text-sm mt-1">{selectedPlaylist.description}</p>}
                    <p className="text-xs text-[#475569] mt-2">{selectedPlaylist.track_count || 0} tracks - by {selectedPlaylist.owner_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={syncToSpotify} className="btn-ghost text-sm border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2" data-testid="sync-spotify-btn">
                      <ExternalLink className="w-3.5 h-3.5" /> Sync to Spotify
                    </button>
                    <button onClick={() => deletePlaylist(selectedPlaylist.id)} className="p-2 rounded-xl hover:bg-red-400/10 text-[#475569] hover:text-red-400 transition-colors" data-testid="delete-playlist-btn">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Add tracks */}
                <button onClick={() => setShowTrackSearch(!showTrackSearch)} className="btn-ghost text-sm border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2 mb-4" data-testid="add-tracks-toggle">
                  {showTrackSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                  {showTrackSearch ? 'Close' : 'Add Tracks'}
                </button>

                {showTrackSearch && (
                  <div className="mb-4 p-4 bg-white/3 rounded-xl" data-testid="track-search-panel">
                    <div className="flex gap-2 mb-3">
                      <Input placeholder="Search tracks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchTracks()} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="track-search-input" />
                      <button onClick={searchTracks} className="btn-notify text-sm px-4">Search</button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.map(t => (
                        <div key={t.uri} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" onClick={() => addTrack(t)}>
                          {t.album_art && <img src={t.album_art} alt="" className="w-8 h-8 rounded-lg" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-xs text-[#475569] truncate">{t.artist}</p>
                          </div>
                          <Plus className="w-4 h-4 text-[#4DA6FF] flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tracks */}
              <div className="space-y-1">
                {(selectedPlaylist.tracks || []).map((track, i) => (
                  <div key={track.id} className="glass-card p-3 flex items-center gap-4 group" data-testid={`track-${track.id}`}>
                    <span className="text-xs text-[#475569] w-6 text-right">{i + 1}</span>
                    {track.album_art && <img src={track.album_art} alt="" className="w-10 h-10 rounded-lg" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <p className="text-xs text-[#475569] truncate">{track.artist} - added by {track.added_by_name}</p>
                    </div>
                    <span className="text-xs text-[#475569] mono">{formatDuration(track.duration_ms)}</span>
                    <button onClick={() => removeTrack(track.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-400/10 text-[#475569] hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(!selectedPlaylist.tracks || selectedPlaylist.tracks.length === 0) && (
                  <div className="text-center py-12 text-[#475569]">
                    <Music className="w-10 h-10 mx-auto mb-3" strokeWidth={1} />
                    <p>No tracks yet. Search and add some!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
