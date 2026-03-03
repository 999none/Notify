import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { friendAPI, userAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Search, UserPlus, UserCheck, UserX, Clock, X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => { fetchFriends(); fetchPending(); }, []);

  const fetchFriends = async () => {
    try {
      const res = await friendAPI.list();
      setFriends(res.data.friends || []);
    } catch (err) {}
  };

  const fetchPending = async () => {
    try {
      const res = await friendAPI.pending();
      setPendingRequests(res.data.requests || []);
    } catch (err) {}
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await userAPI.searchUsers(searchQuery);
      setSearchResults((res.data.users || []).filter(u => u.id !== user.id));
    } catch (err) {}
  };

  const sendRequest = async (targetId) => {
    try {
      await friendAPI.sendRequest(targetId);
      toast.success('Friend request sent!');
      setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, _requested: true } : u));
    } catch (err) {
      toast.error('Already sent or friends');
    }
  };

  const acceptRequest = async (fromId) => {
    try {
      await friendAPI.accept(fromId);
      toast.success('Friend accepted!');
      fetchFriends();
      fetchPending();
    } catch (err) { toast.error('Failed'); }
  };

  const rejectRequest = async (fromId) => {
    try {
      await friendAPI.reject(fromId);
      fetchPending();
    } catch (err) {}
  };

  const removeFriend = async (friendId) => {
    try {
      await friendAPI.remove(friendId);
      toast.success('Friend removed');
      fetchFriends();
    } catch (err) {}
  };

  const tabs = [
    { id: 'friends', label: `Friends (${friends.length})` },
    { id: 'pending', label: `Pending (${pendingRequests.length})` },
    { id: 'search', label: 'Find People' },
  ];

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-4xl" data-testid="friends-page">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne' }}>Friends</h1>
        <p className="text-[#94A3B8] mb-8">Connect with other Notify users</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`btn-ghost text-sm ${activeTab === t.id ? 'active' : ''}`} data-testid={`tab-${t.id}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Friends List */}
        {activeTab === 'friends' && (
          <div className="space-y-3" data-testid="friends-list">
            {friends.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-[#475569]">No friends yet. Search for people to add!</p>
              </div>
            ) : friends.map(f => (
              <div key={f.id} className="glass-card p-4 flex items-center justify-between" data-testid={`friend-${f.id}`}>
                <div className="flex items-center gap-4">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" className="w-11 h-11 rounded-full border border-white/10" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center text-lg font-bold text-[#4DA6FF]">
                      {(f.display_name || '?')[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{f.display_name}</p>
                    <p className="text-xs text-[#475569]">{f.product === 'premium' ? 'Premium' : 'Free'}</p>
                  </div>
                </div>
                <button onClick={() => removeFriend(f.id)} className="p-2 rounded-xl hover:bg-red-400/10 text-[#475569] hover:text-red-400 transition-colors" data-testid={`remove-friend-${f.id}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests */}
        {activeTab === 'pending' && (
          <div className="space-y-3" data-testid="pending-list">
            {pendingRequests.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-[#475569]">No pending requests</p>
              </div>
            ) : pendingRequests.map(req => (
              <div key={req.id} className="glass-card p-4 flex items-center justify-between" data-testid={`pending-${req.id}`}>
                <div className="flex items-center gap-4">
                  {req.requester?.avatar_url ? (
                    <img src={req.requester.avatar_url} alt="" className="w-11 h-11 rounded-full border border-white/10" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center text-lg font-bold text-[#4DA6FF]">
                      {(req.requester?.display_name || '?')[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{req.requester?.display_name}</p>
                    <p className="text-xs text-[#475569] flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptRequest(req.user_id)} className="btn-notify text-sm px-4 py-2" data-testid={`accept-${req.id}`}>Accept</button>
                  <button onClick={() => rejectRequest(req.user_id)} className="btn-ghost text-sm text-red-400" data-testid={`reject-${req.id}`}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {activeTab === 'search' && (
          <div data-testid="search-users">
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl pl-10"
                  data-testid="user-search-input"
                />
              </div>
              <button onClick={handleSearch} className="btn-notify" data-testid="search-btn">Search</button>
            </div>
            <div className="space-y-3">
              {searchResults.map(u => (
                <div key={u.id} className="glass-card p-4 flex items-center justify-between" data-testid={`search-result-${u.id}`}>
                  <div className="flex items-center gap-4">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-11 h-11 rounded-full border border-white/10" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center text-lg font-bold text-[#4DA6FF]">
                        {(u.display_name || '?')[0]}
                      </div>
                    )}
                    <p className="font-medium">{u.display_name}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    disabled={u._requested}
                    className={`flex items-center gap-2 text-sm px-4 py-2 rounded-full transition-colors ${u._requested ? 'bg-white/5 text-[#475569]' : 'btn-notify'}`}
                    data-testid={`add-friend-${u.id}`}
                  >
                    {u._requested ? <><UserCheck className="w-4 h-4" /> Sent</> : <><UserPlus className="w-4 h-4" /> Add</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
