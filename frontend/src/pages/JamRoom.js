import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { roomAPI, playbackAPI } from '../api';
import {
  ArrowLeft, Play, Pause, SkipForward, Search, Send, Users,
  Volume2, VolumeX, Copy, Check, Crown, Radio, X
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';

export default function JamRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isPremium } = useAuth();

  const {
    isConnected, participants, messages, lastSync, lastEvent,
    sendPlay, sendPause, sendSeek, sendChat, sendQueueAdd
  } = useWebSocket(roomId);

  const [room, setRoom] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch room details
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await roomAPI.get(roomId);
        setRoom(res.data);
        if (res.data.current_track) {
          setCurrentTrack(res.data.current_track);
          setIsPlaying(res.data.current_track.is_playing);
        }
      } catch (err) {
        toast.error('Room not found');
        navigate('/dashboard');
      }
    };
    fetchRoom();
  }, [roomId, navigate]);

  // Handle WebSocket events
  useEffect(() => {
    if (!lastEvent) return;
    const { type, data } = lastEvent;

    if (type === 'sync') {
      setCurrentTrack({
        uri: data.uri,
        name: data.name,
        artist: data.artist,
        album_art: data.album_art,
        duration_ms: data.duration_ms,
        position_ms: data.position_ms,
        is_playing: data.is_playing,
      });
      setIsPlaying(data.is_playing !== false);
      // TODO: Here the Spotify SDK would play/seek to sync
    } else if (type === 'pause') {
      setIsPlaying(false);
    } else if (type === 'resume') {
      setIsPlaying(true);
    } else if (type === 'room_closed') {
      toast.info('Room has been closed');
      navigate('/dashboard');
    }
  }, [lastEvent, navigate]);

  // Search tracks
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await playbackAPI.search(searchQuery);
      setSearchResults(res.data.tracks || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Play a track
  const handlePlayTrack = (track) => {
    sendPlay(track.uri, track.name, track.artist, track.album_art, track.duration_ms, 0);
    setCurrentTrack({
      uri: track.uri,
      name: track.name,
      artist: track.artist,
      album_art: track.album_art,
      duration_ms: track.duration_ms,
      position_ms: 0,
      is_playing: true,
    });
    setIsPlaying(true);
    setShowSearch(false);
    toast.success(`Now playing: ${track.name}`);
  };

  // Toggle pause/play
  const togglePlayPause = () => {
    if (isPlaying) {
      sendPause(0);
      setIsPlaying(false);
    } else {
      sendPlay(
        currentTrack?.uri,
        currentTrack?.name,
        currentTrack?.artist,
        currentTrack?.album_art,
        currentTrack?.duration_ms,
        currentTrack?.position_ms || 0
      );
      setIsPlaying(true);
    }
  };

  // Send chat
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  // Leave room
  const handleLeave = async () => {
    try {
      await roomAPI.leave(roomId);
    } catch (err) {
      // ignore
    }
    navigate('/dashboard');
  };

  // Copy room code
  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      toast.success('Room code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-[#A1A1AA]">Loading room...</div>
      </div>
    );
  }

  const isHost = room.host_id === user?.id;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col" data-testid="jam-room-page">
      {/* Album art background blur */}
      {currentTrack?.album_art && (
        <div className="fixed inset-0 z-0">
          <img src={currentTrack.album_art} alt="" className="w-full h-full object-cover opacity-10 blur-3xl scale-110" />
          <div className="absolute inset-0 bg-[#050505]/80" />
        </div>
      )}

      {/* Top bar */}
      <header className="glass-heavy sticky top-0 z-50 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleLeave} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="leave-room-btn">
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div>
            <h2 className="font-semibold text-lg truncate max-w-[200px]" style={{ fontFamily: 'Manrope' }}>{room.name}</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-[#52525B]">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-full px-4 py-2 hover:bg-white/10 transition-colors"
            data-testid="copy-room-code-btn"
          >
            {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            <span className="mono text-[#00C2FF] font-semibold">{room.code}</span>
          </button>
          <div className="flex items-center gap-1 text-sm text-[#A1A1AA]">
            <Users className="w-4 h-4" />
            <span>{participants.length || room.participant_count || 0}</span>
          </div>
        </div>
      </header>

      {/* Main content - split layout */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 overflow-hidden">
        {/* Center: Now Playing */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          {currentTrack ? (
            <div className="text-center animate-fade-in-up" data-testid="now-playing">
              {currentTrack.album_art && (
                <div className="relative mb-8 mx-auto w-64 h-64 md:w-80 md:h-80">
                  <img
                    src={currentTrack.album_art}
                    alt={currentTrack.name}
                    className={`w-full h-full rounded-3xl shadow-2xl ${isPlaying ? 'animate-pulse-glow' : ''}`}
                    style={{ boxShadow: isPlaying ? '0 0 60px rgba(0, 194, 255, 0.2)' : '0 20px 40px rgba(0,0,0,0.5)' }}
                  />
                </div>
              )}
              <h2 className="text-2xl md:text-3xl font-bold mb-2 truncate max-w-md" style={{ fontFamily: 'Manrope' }}>
                {currentTrack.name}
              </h2>
              <p className="text-lg text-[#A1A1AA] mb-8">{currentTrack.artist}</p>

              {/* Player controls */}
              <div className="flex items-center justify-center gap-6" data-testid="player-controls">
                <button
                  onClick={togglePlayPause}
                  className="w-16 h-16 rounded-full bg-[#00C2FF] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-[0_0_30px_rgba(0,194,255,0.4)]"
                  data-testid="play-pause-btn"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-black" fill="black" />
                  ) : (
                    <Play className="w-7 h-7 text-black ml-1" fill="black" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center" data-testid="no-track-playing">
              <Radio className="w-16 h-16 text-[#52525B] mb-6 mx-auto" strokeWidth={1} />
              <h2 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'Manrope' }}>No track playing</h2>
              <p className="text-[#52525B] mb-6">Search for a track to start the JAM</p>
              <button
                onClick={() => setShowSearch(true)}
                className="btn-notify"
                data-testid="open-search-btn"
              >
                Search Tracks
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar: Participants + Chat */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="glass-card p-3 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
            data-testid="toggle-search-btn"
          >
            <Search className="w-4 h-4 text-[#00C2FF]" />
            <span className="text-sm font-medium">Search Tracks</span>
          </button>

          {/* Search panel */}
          {showSearch && (
            <div className="glass-card p-4 animate-fade-in" data-testid="search-panel">
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Search Spotify..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl flex-1"
                  data-testid="track-search-input"
                />
                <button onClick={() => setShowSearch(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="max-h-60">
                {searchResults.map((track) => (
                  <div
                    key={track.uri}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => handlePlayTrack(track)}
                    data-testid={`search-result-${track.uri}`}
                  >
                    {track.album_art && (
                      <img src={track.album_art} alt="" className="w-10 h-10 rounded-lg" />
                    )}
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <p className="text-xs text-[#52525B] truncate">{track.artist}</p>
                    </div>
                    <Play className="w-4 h-4 text-[#00C2FF] flex-shrink-0" />
                  </div>
                ))}
                {isSearching && <p className="text-center text-sm text-[#52525B] py-4">Searching...</p>}
              </ScrollArea>
            </div>
          )}

          {/* Participants */}
          <div className="glass-card p-4" data-testid="participants-panel">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#52525B] mb-3">
              Participants ({participants.length})
            </h3>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3" data-testid={`participant-${p.id}`}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                      {(p.display_name || '?')[0]}
                    </div>
                  )}
                  <span className="text-sm truncate">{p.display_name}</span>
                  {room.host_id === p.id && <Crown className="w-3 h-3 text-[#00C2FF] flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="glass-card p-4 flex-1 flex flex-col min-h-[200px]" data-testid="chat-panel">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#52525B] mb-3">Chat</h3>
            <ScrollArea className="flex-1 mb-3 max-h-48">
              <div className="space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className="text-sm" data-testid={`chat-message-${i}`}>
                    <span className="font-semibold text-[#00C2FF]">{msg.user?.display_name}: </span>
                    <span className="text-[#A1A1AA]">{msg.message}</span>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-xs text-[#52525B] text-center py-4">No messages yet</p>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl flex-1 text-sm"
                data-testid="chat-input"
              />
              <button
                onClick={handleSendChat}
                className="p-2 rounded-xl bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 transition-colors"
                data-testid="send-chat-btn"
              >
                <Send className="w-4 h-4 text-[#00C2FF]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium gate */}
      {!isPremium && (
        <div className="fixed bottom-0 left-0 right-0 z-50 glass-heavy px-6 py-4 text-center" data-testid="premium-gate">
          <p className="text-yellow-400 text-sm font-medium">
            Spotify Premium required to participate in JAM playback
          </p>
        </div>
      )}
    </div>
  );
}
