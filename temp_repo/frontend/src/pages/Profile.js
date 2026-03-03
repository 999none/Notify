import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Crown, Music, Mic2, Disc3 } from 'lucide-react';

export default function Profile() {
  const { user, isPremium } = useAuth();
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [artistsRes, tracksRes] = await Promise.allSettled([
          userAPI.getTopArtists(),
          userAPI.getTopTracks()
        ]);
        if (artistsRes.status === 'fulfilled') setTopArtists(artistsRes.value.data.artists || []);
        if (tracksRes.status === 'fulfilled') setTopTracks(tracksRes.value.data.tracks || []);
      } catch (err) {}
    };
    fetchData();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-5xl" data-testid="profile-page">
        {/* Header */}
        <div className="glass-card p-8 mb-8 flex items-center gap-8" data-testid="profile-header">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-24 h-24 rounded-2xl border-2 border-white/10 shadow-xl" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-[#4DA6FF]/20 flex items-center justify-center text-3xl font-bold text-[#4DA6FF]">
              {(user?.display_name || '?')[0]}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Syne' }}>{user?.display_name}</h1>
            <p className="text-[#94A3B8] mb-3">{user?.email}</p>
            <div className="flex items-center gap-3">
              {isPremium && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#4DA6FF] bg-[#4DA6FF]/10 px-3 py-1.5 rounded-full">
                  <Crown className="w-3.5 h-3.5" /> Premium
                </span>
              )}
              <span className="text-xs text-[#475569]">Spotify ID: {user?.spotify_id}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Artists */}
          <div data-testid="top-artists">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
              <Mic2 className="w-5 h-5 text-[#4DA6FF]" /> Top Artists
            </h2>
            {topArtists.length === 0 ? (
              <div className="glass-card p-8 text-center text-[#475569]">
                <p>Listen to more music to see your top artists</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topArtists.map((a, i) => (
                  <div key={a.id} className="glass-card p-3 flex items-center gap-4" data-testid={`artist-${a.id}`}>
                    <span className="text-xs text-[#475569] w-6 text-right font-bold">{i + 1}</span>
                    {a.image ? (
                      <img src={a.image} alt="" className="w-11 h-11 rounded-full" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#4DA6FF]/10 flex items-center justify-center">
                        <Mic2 className="w-5 h-5 text-[#4DA6FF]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.name}</p>
                      <p className="text-xs text-[#475569] truncate">{a.genres?.join(', ') || 'No genres'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Tracks */}
          <div data-testid="top-tracks">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
              <Disc3 className="w-5 h-5 text-[#7CC3FF]" /> Top Tracks
            </h2>
            {topTracks.length === 0 ? (
              <div className="glass-card p-8 text-center text-[#475569]">
                <p>Listen to more music to see your top tracks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topTracks.map((t, i) => (
                  <div key={t.id} className="glass-card p-3 flex items-center gap-4" data-testid={`top-track-${t.id}`}>
                    <span className="text-xs text-[#475569] w-6 text-right font-bold">{i + 1}</span>
                    {t.album_art ? (
                      <img src={t.album_art} alt="" className="w-11 h-11 rounded-xl" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#7CC3FF]/10 flex items-center justify-center">
                        <Music className="w-5 h-5 text-[#7CC3FF]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-[#475569] truncate">{t.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
