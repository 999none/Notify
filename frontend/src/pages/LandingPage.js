import { Music, ArrowRight } from "lucide-react";

const HERO_BG = "https://images.unsplash.com/photo-1765224747205-3c9c23f0553c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwzfHxjb25jZXJ0JTIwY3Jvd2QlMjBhZXN0aGV0aWMlMjBkYXJrJTIwYmx1ZXxlbnwwfHx8fDE3NzMxNzI4MzR8MA&ixlib=rb-4.1.0&q=85";

export default function LandingPage({ onLogin }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black" data-testid="landing-page">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={HERO_BG}
          alt=""
          className="w-full h-full object-cover opacity-40"
        />
        <div className="hero-overlay" />
      </div>

      {/* Floating Orbs */}
      <div className="orb orb-blue" style={{ top: '10%', right: '15%' }} />
      <div className="orb orb-indigo" style={{ bottom: '20%', left: '10%' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 md:px-16 py-6">
          <div className="flex items-center gap-2.5 animate-fade-up">
            <div className="w-9 h-9 rounded-xl bg-notify-blue flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-xl font-bold text-white tracking-tight">
              Notify
            </span>
          </div>
          <button
            data-testid="nav-login-button"
            onClick={onLogin}
            className="animate-fade-up delay-200 text-sm font-medium text-zinc-400 hover:text-white transition-colors px-5 py-2 rounded-full hover:bg-white/5"
          >
            Sign in
          </button>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex items-center px-8 md:px-16 lg:px-24 pb-20">
          <div className="max-w-2xl">
            <div className="animate-fade-up delay-100">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-300 mb-8">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Powered by Spotify
              </span>
            </div>

            <h1 className="animate-fade-up delay-200 font-heading text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tighter leading-[0.95] mb-6">
              Your music,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                your people.
              </span>
            </h1>

            <p className="animate-fade-up delay-300 text-lg text-zinc-400 leading-relaxed max-w-md mb-10">
              A social app built around your music. Connect your Spotify,
              discover what your friends are listening to, and share the vibe.
            </p>

            <div className="animate-fade-up delay-400 flex flex-col sm:flex-row items-start gap-4">
              <button
                data-testid="login-with-spotify-button"
                onClick={onLogin}
                className="btn-neon group flex items-center gap-3 text-base"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Login with Spotify
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="animate-fade-up delay-600 mt-16 flex items-center gap-8 text-zinc-600 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-zinc-600" />
                Shared rooms
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-zinc-600" />
                Social profiles
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-zinc-600" />
                Music discovery
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
