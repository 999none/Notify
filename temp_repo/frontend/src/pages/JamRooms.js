import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Plus, Users, Radio, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function JamRooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await roomAPI.list();
      setRooms(res.data);
    } catch (err) {}
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
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-6xl" data-testid="jam-rooms-page">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Syne' }}>JAM Rooms</h1>
            <p className="text-[#94A3B8] mt-1">Create or join a synchronized listening room</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="btn-notify flex items-center gap-2" data-testid="create-room-btn">
                <Plus className="w-5 h-5" /> New Room
              </button>
            </DialogTrigger>
            <DialogContent className="glass-heavy border-white/10 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle style={{ fontFamily: 'Syne' }}>Create JAM Room</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <Input placeholder="Room name..." value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createRoom()} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="room-name-input" />
                <button onClick={createRoom} disabled={isCreating || !newRoomName.trim()} className="btn-notify w-full disabled:opacity-50" data-testid="create-room-submit-btn">
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {rooms.length === 0 ? (
          <div className="glass-card p-16 text-center" data-testid="empty-rooms">
            <Radio className="w-16 h-16 text-[#475569] mb-6 mx-auto" strokeWidth={1} />
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Syne' }}>No active JAMs</h3>
            <p className="text-[#475569]">Create the first room and invite your friends!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="glass-card p-6 glass-card-interactive" data-testid={`room-card-${room.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg truncate" style={{ fontFamily: 'Syne' }}>{room.name}</h3>
                    <p className="text-xs text-[#475569] mt-1">by {room.host_name}</p>
                  </div>
                  <button onClick={() => copyCode(room.code)} className="flex items-center gap-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 hover:bg-white/10 transition-colors flex-shrink-0">
                    {copiedCode === room.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span className="mono text-[#4DA6FF]">{room.code}</span>
                  </button>
                </div>
                {room.current_track && (
                  <div className="flex items-center gap-3 mb-4 bg-white/5 rounded-xl p-3">
                    {room.current_track.album_art && <img src={room.current_track.album_art} alt="" className="w-10 h-10 rounded-lg" />}
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
                  <button onClick={() => joinRoom(room.id)} className="btn-notify text-sm px-4 py-2" data-testid={`join-room-${room.id}`}>Join</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
