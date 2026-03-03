import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI } from '../api';
import { Plus, Users, Radio, LogOut, Music, Crown, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, isPremium, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await roomAPI.list();
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
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
    toast.success('Room code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505]" data-testid="dashboard-page">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#00C2FF]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top bar */}
      <header className="glass-heavy sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00C2FF] flex items-center justify-center">
            <Radio className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Manrope' }}>Notify</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.avatar_url && (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-white/10" />
          )}
          <span className="text-sm text-[#A1A1AA] hidden sm:block">{user?.display_name}</span>
          {isPremium && (
            <span className="flex items-center gap-1 text-xs text-[#00C2FF] bg-[#00C2FF]/10 px-2 py-1 rounded-full">
              <Crown className="w-3 h-3" /> Premium
            </span>
          )}
          <button onClick={logout} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="logout-btn">
            <LogOut className="w-5 h-5 text-[#A1A1AA]" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Manrope' }}>
            Welcome back, <span className="text-[#00C2FF]">{user?.display_name?.split(' ')[0] || 'User'}</span>
          </h1>
          <p className="text-lg text-[#A1A1AA]">Ready to JAM?</p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 stagger-children">
          {/* Create Room card */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <div
                className="glass-card p-8 cursor-pointer glass-card-interactive col-span-1 md:col-span-1 lg:col-span-1 flex flex-col items-center justify-center text-center min-h-[200px] border-dashed border-[#00C2FF]/30 hover:border-[#00C2FF]/60"
                data-testid="create-room-card"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#00C2FF]/10 flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-[#00C2FF]" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Manrope' }}>Create a JAM</h3>
                <p className="text-sm text-[#52525B]">Start a new room</p>
              </div>
            </DialogTrigger>
            <DialogContent className="glass-heavy border-white/10 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'Manrope' }}>Create a JAM Room</DialogTitle>
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

          {/* Profile card */}
          <div className="glass-card p-6 col-span-1 md:col-span-2 lg:col-span-1" data-testid="profile-card">
            <div className="flex items-center gap-4 mb-4">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-2xl border border-white/10" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Music className="w-7 h-7 text-[#A1A1AA]" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg" style={{ fontFamily: 'Manrope' }}>{user?.display_name}</h3>
                <p className="text-sm text-[#A1A1AA]">{user?.email}</p>
              </div>
            </div>
            {!isPremium && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-400">
                Spotify Premium required to participate in JAM rooms
              </div>
            )}
          </div>

          {/* Stats card */}
          <div className="glass-card p-6 col-span-1 lg:col-span-2" data-testid="stats-card">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#52525B] mb-4">Active Rooms</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-[#00C2FF]" style={{ fontFamily: 'Manrope' }}>{rooms.length}</span>
              <span className="text-[#A1A1AA]">JAM{rooms.length !== 1 ? 's' : ''} live</span>
            </div>
          </div>

          {/* Room cards */}
          {rooms.map((room) => (
            <div key={room.id} className="glass-card p-6 glass-card-interactive col-span-1" data-testid={`room-card-${room.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg truncate" style={{ fontFamily: 'Manrope' }}>{room.name}</h3>
                  <p className="text-xs text-[#52525B] mt-1">by {room.host_name}</p>
                </div>
                <button
                  onClick={() => copyCode(room.code)}
                  className="flex items-center gap-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 hover:bg-white/10 transition-colors"
                  data-testid={`copy-code-${room.code}`}
                >
                  {copiedCode === room.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span className="mono text-[#00C2FF]">{room.code}</span>
                </button>
              </div>

              {room.current_track && (
                <div className="flex items-center gap-3 mb-4 bg-white/5 rounded-xl p-3">
                  {room.current_track.album_art && (
                    <img src={room.current_track.album_art} alt="" className="w-10 h-10 rounded-lg" />
                  )}
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{room.current_track.name}</p>
                    <p className="text-xs text-[#52525B] truncate">{room.current_track.artist}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#A1A1AA]">
                  <Users className="w-4 h-4" />
                  <span>{room.participant_count || 0}/{room.max_participants}</span>
                </div>
                <button
                  onClick={() => joinRoom(room.id)}
                  className="text-sm font-semibold text-[#00C2FF] hover:text-[#33CFFF] transition-colors"
                  data-testid={`join-room-${room.id}`}
                >
                  Join JAM
                </button>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {rooms.length === 0 && (
            <div className="glass-card p-8 col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center text-center" data-testid="empty-rooms">
              <Radio className="w-12 h-12 text-[#52525B] mb-4" strokeWidth={1} />
              <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Manrope' }}>No active JAMs</h3>
              <p className="text-sm text-[#52525B]">Be the first to create a room!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
