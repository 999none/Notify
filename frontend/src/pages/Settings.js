import React from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { LogOut, ExternalLink, Crown, Shield, Info } from 'lucide-react';

export default function SettingsPage() {
  const { user, isPremium, logout } = useAuth();

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-3xl" data-testid="settings-page">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne' }}>Settings</h1>
        <p className="text-[#94A3B8] mb-8">Manage your account</p>

        {/* Account */}
        <div className="glass-card p-6 mb-6" data-testid="account-section">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
            <Shield className="w-5 h-5 text-[#4DA6FF]" /> Account
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-[#94A3B8] text-sm">Display Name</span>
              <span className="font-medium">{user?.display_name}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-[#94A3B8] text-sm">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-[#94A3B8] text-sm">Spotify Plan</span>
              <span className={`flex items-center gap-1.5 text-sm font-medium ${isPremium ? 'text-[#4DA6FF]' : 'text-yellow-400'}`}>
                {isPremium && <Crown className="w-3.5 h-3.5" />}
                {isPremium ? 'Premium' : 'Free'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[#94A3B8] text-sm">Spotify ID</span>
              <span className="mono text-sm text-[#475569]">{user?.spotify_id}</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="glass-card p-6 mb-6" data-testid="links-section">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
            <Info className="w-5 h-5 text-[#7CC3FF]" /> Resources
          </h2>
          <div className="space-y-3">
            <a href="https://www.spotify.com/account/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
              <span className="text-sm">Spotify Account</span>
              <ExternalLink className="w-4 h-4 text-[#475569]" />
            </a>
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
              <span className="text-sm">Spotify Developer Dashboard</span>
              <ExternalLink className="w-4 h-4 text-[#475569]" />
            </a>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border border-red-400/20 text-red-400 hover:bg-red-400/5 transition-colors"
          data-testid="logout-settings-btn"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log out</span>
        </button>
      </div>
    </AppLayout>
  );
}
