import React from 'react';
import { Music, Users, Radio, Zap, ListMusic, Heart } from 'lucide-react';
import { authAPI } from '../api';

export default function Landing() {
  const handleLogin = async () => {
    try {
      const res = await authAPI.getLoginUrl();
      window.location.href = res.data.auth_url;
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const features = [
    { icon: Radio, title: 'JAM Sessions', desc: 'Listen together in perfect sync with friends.' },
    { icon: ListMusic, title: 'Playlists', desc: 'Collaborative playlists synced with Spotify.' },
    { icon: Users, title: 'Social', desc: 'Follow friends and see what they are listening to.' },
    { icon: Zap, title: 'Instant', desc: 'Join with a room code. Plug and play.' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col" data-testid="landing-page">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#0F172A]" />
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[#4DA6FF]/8 blur-[150px]" />
        <div className="absolute bottom-[-100px] right-[-200px] w-[600px] h-[600px] rounded-full bg-[#7CC3FF]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4DA6FF] flex items-center justify-center">
              <Radio className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Syne' }}>Notify</span>
          </div>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
          <div className="stagger-children">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4DA6FF] mb-6">
              Collaborative Music Experience
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mb-8" style={{ fontFamily: 'Syne' }}>
              Listen
              <span className="text-[#4DA6FF]"> Together</span>
              <br />
              In Real Time
            </h1>
            <p className="text-lg md:text-xl text-[#94A3B8] max-w-xl mx-auto mb-12 leading-relaxed">
              Create JAM rooms, build playlists with friends, and sync your Spotify playback. One vibe, everyone in sync.
            </p>
            <button
              onClick={handleLogin}
              className="btn-notify text-lg px-10 py-4 animate-pulse-glow"
              data-testid="login-spotify-btn"
            >
              Connect with Spotify
            </button>
            <p className="text-sm text-[#475569] mt-4">Spotify Premium required for playback</p>
          </div>
        </main>

        {/* Features */}
        <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 glass-card-interactive" data-testid={`feature-card-${i}`}>
                <f.icon className="w-8 h-8 text-[#4DA6FF] mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Syne' }}>{f.title}</h3>
                <p className="text-sm text-[#94A3B8]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
