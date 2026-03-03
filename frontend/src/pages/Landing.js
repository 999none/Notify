import React from 'react';
import { Music, Users, Radio, Zap } from 'lucide-react';
import { authAPI } from '../api';

const HERO_BG = 'https://images.unsplash.com/photo-1563841930606-67e2bce48b78?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwyfHxjb25jZXJ0JTIwY3Jvd2QlMjBuaWdodCUyMGxpZ2h0c3xlbnwwfHx8fDE3NzI1MzQwMDR8MA&ixlib=rb-4.1.0&q=85';

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
    { icon: Music, title: 'Real Playback', desc: 'Spotify Web Playback SDK. No mocks.' },
    { icon: Users, title: 'JAM Together', desc: 'Synchronized rooms with friends.' },
    { icon: Radio, title: 'Live Sync', desc: 'WebSocket real-time synchronization.' },
    { icon: Zap, title: 'Instant', desc: 'Join with a room code. Plug and play.' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col" data-testid="landing-page">
      {/* Hero background */}
      <div className="absolute inset-0 z-0">
        <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-[#050505]" />
      </div>

      {/* Hero gradient overlay */}
      <div className="absolute inset-0 z-0 hero-gradient" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00C2FF] flex items-center justify-center">
              <Radio className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Manrope' }}>Notify</span>
          </div>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
          <div className="stagger-children">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#00C2FF] mb-6">
              Collaborative Music Experience
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mb-8" style={{ fontFamily: 'Manrope' }}>
              Listen
              <span className="text-[#00C2FF]"> Together</span>
              <br />
              In Real Time
            </h1>
            <p className="text-lg md:text-xl text-[#A1A1AA] max-w-xl mx-auto mb-12 leading-relaxed">
              Create a JAM room, invite your friends, and synchronize your Spotify playback. One track, one vibe, everyone in sync.
            </p>
            <button
              onClick={handleLogin}
              className="btn-notify text-lg px-10 py-4 animate-pulse-glow"
              data-testid="login-spotify-btn"
            >
              Connect with Spotify
            </button>
            <p className="text-sm text-[#52525B] mt-4">Spotify Premium required for playback</p>
          </div>
        </main>

        {/* Features */}
        <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 glass-card-interactive" data-testid={`feature-card-${i}`}>
                <f.icon className="w-8 h-8 text-[#00C2FF] mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Manrope' }}>{f.title}</h3>
                <p className="text-sm text-[#A1A1AA]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
