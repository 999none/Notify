import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI, playlistAPI, friendAPI, activityAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Plus, Users, Radio, Music, Crown, Copy, Check, ListMusic, Activity, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => roomAPI.list().then(r => setRooms(r.data)).catch(() => {}), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [roomsRes, playlistsRes, friendsRes, activityRes] = await Promise.allSettled([
        roomAPI.list(),
        playlistAPI.list(),
        friendAPI.list(),
        activityAPI.feed()
      ]);
      if (roomsRes.status === 'fulfilled') setRooms(roomsRes.value.data);
      if (playlistsRes.status === 'fulfilled') setPlaylists(playlistsRes.value.data.playlists || []);
      if (friendsRes.status === 'fulfilled') setFriends(friendsRes.value.data.friends || []);
      if (activityRes.status === 'fulfilled') setActivities(activityRes.value.data.activities?.slice(0, 5) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    try {
      const res = await roomAPI.create(newRoomName.trim());
      toast.success('Room created!');
      setDialogOpen(false);
      setNewRoomName('');
      navigate(`/jam/${res.data.id}`);
    } catch (err) {
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const res = await roomAPI.getByCode(joinCode.trim());
      await roomAPI.join(res.data.id);
      navigate(`/jam/${res.data.id}`);
    } catch (err) {
      toast.error('Room not found');
    }
  };

  const joinRoom = async (roomId) => {
    try {
      await roomAPI.join(roomId);
      navigate(`/jam/${roomId}`);
    } catch (err) {
      toast.error('Failed to join room');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getActivityText = (act) => {
    const map = {
      'room_created': 'created a JAM room',
      'room_joined': 'joined a JAM room',
      'playlist_created': 'created a playlist',
      'track_added': 'added a track',
      'friend_request_sent': 'sent a friend request',
      'friend_request_accepted': 'accepted a friend request',
      'account_created': 'joined Notify',
    };
    return map[act.action] || act.action;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-7xl" data-testid="dashboard-page">
        {/* Ambient */}
        <div className="fixed top-0 right-0 w-[500px] h-[400px] bg-[#4DA6FF]/4 rounded-full blur-[140px] pointer-events-none" />

        {/* Welcome */}
        <div className="mb-10 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Syne' }}>
            Welcome, <span className="text-[#4DA6FF]">{user?.display_name?.split(' ')[0] || 'User'}</span>
          </h1>
          <p className="text-lg text-[#94A3B8]">Ready to JAM?</p>
        </div>

        {/* Top row: Create + Join */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 stagger-children">
          {/* Create Room */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <div
                className="glass-card p-8 cursor-pointer glass-card-interactive flex items-center gap-6 border-dashed border-[#4DA6FF]/30 hover:border-[#4DA6FF]/60"
                data-testid="create-room-card"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#4DA6FF]/10 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-7 h-7 text-[#4DA6FF]" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: 'Syne' }}>Create a JAM</h3>
                  <p className="text-sm text-[#475569]">Start a new synchronized room</p>
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="glass-heavy border-white/10 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Create a JAM Room</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <Input
                  placeholder="Room name..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                  data-testid="room-name-input"
                />
                <button
                  onClick={createRoom}
                  disabled={isCreating || !newRoomName.trim()}
                  className="btn-notify w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="create-room-submit-btn"
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Join by code */}
          <div className="glass-card p-8 flex items-center gap-6" data-testid="join-room-card">
            <div className="w-14 h-14 rounded-2xl bg-[#7CC3FF]/10 flex items-center justify-center flex-shrink-0">
              <Radio className="w-7 h-7 text-[#7CC3FF]" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'Syne' }}>Join by Code</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code..."
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl mono text-[#4DA6FF] uppercase tracking-wider"
                  data-testid="join-code-input"
                />
                <button onClick={joinByCode} className="btn-notify px-4" data-testid="join-code-btn">
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-children">
          {/* Active Rooms */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Syne' }}>Active JAM Rooms</h2>
              <button onClick={() => navigate('/jam-rooms')} className="text-sm text-[#4DA6FF] hover:text-[#7CC3FF] flex items-center gap-1" data-testid="view-all-rooms">
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {rooms.length === 0 ? (
              <div className="glass-card p-10 text-center" data-testid="empty-rooms">
                <Radio className="w-12 h-12 text-[#475569] mb-4 mx-auto" strokeWidth={1} />
                <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Syne' }}>No active JAMs</h3>
                <p className="text-sm text-[#475569]">Be the first to create a room!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.slice(0, 4).map((room) => (
                  <div key={room.id} className="glass-card p-5 glass-card-interactive" data-testid={`room-card-${room.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate" style={{ fontFamily: 'Syne' }}>{room.name}</h3>
                        <p className="text-xs text-[#475569] mt-1">by {room.host_name}</p>
                      </div>
                      <button
                        onClick={() => copyCode(room.code)}
                        className="flex items-center gap-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 hover:bg-white/10 transition-colors flex-shrink-0"
                        data-testid={`copy-code-${room.code}`}
                      >
                        {copiedCode === room.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        <span className="mono text-[#4DA6FF]">{room.code}</span>
                      </button>
                    </div>
                    {room.current_track && (
                      <div className="flex items-center gap-3 mb-3 bg-white/5 rounded-xl p-2">
                        {room.current_track.album_art && <img src={room.current_track.album_art} alt="" className="w-8 h-8 rounded-lg" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{room.current_track.name}</p>
                          <p className="text-xs text-[#475569] truncate">{room.current_track.artist}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                        <Users className="w-4 h-4" />
                        <span>{room.participant_count || 0}/{room.max_participants}</span>
                      </div>
                      <button onClick={() => joinRoom(room.id)} className="text-sm font-semibold text-[#4DA6FF] hover:text-[#7CC3FF] transition-colors" data-testid={`join-room-${room.id}`}>
                        Join
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right col: Stats + Activity */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="glass-card p-6" data-testid="stats-card">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#475569] mb-4">Overview</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-[#4DA6FF]" style={{ fontFamily: 'Syne' }}>{rooms.length}</p>
                  <p className="text-xs text-[#475569]">Rooms</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#7CC3FF]" style={{ fontFamily: 'Syne' }}>{playlists.length}</p>
                  <p className="text-xs text-[#475569]">Playlists</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#4DA6FF]" style={{ fontFamily: 'Syne' }}>{friends.length}</p>
                  <p className="text-xs text-[#475569]">Friends</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6" data-testid="activity-preview">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#475569]">Recent Activity</h3>
                <button onClick={() => navigate('/activity')} className="text-xs text-[#4DA6FF]">
                  View all
                </button>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-[#475569] text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((act, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {act.user_avatar ? (
                        <img src={act.user_avatar} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center text-xs font-bold text-[#4DA6FF]">
                          {(act.user_display_name || '?')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{act.user_display_name}</span>
                          <span className="text-[#94A3B8]"> {getActivityText(act)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Premium gate */}
            {!isPremium && (
              <div className="glass-card p-5 border-yellow-500/20" data-testid="premium-notice">
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                  <Crown className="w-4 h-4" />
                  <span>Spotify Premium required for JAM playback</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
