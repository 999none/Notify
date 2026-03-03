import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, Radio, Users, ListMusic, Activity, Settings, LogOut, Crown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/jam-rooms', icon: Radio, label: 'Jam Rooms' },
  { to: '/friends', icon: Users, label: 'Friends' },
  { to: '/playlists', icon: ListMusic, label: 'Playlists' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, isPremium, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside
      className={`glass-sidebar fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[240px]'}`}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-9 h-9 rounded-xl bg-[#4DA6FF] flex items-center justify-center flex-shrink-0">
          <Radio className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Syne' }}>
            Notify
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 mt-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
            }
            data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className={`px-3 pb-4 space-y-3 ${collapsed ? 'items-center' : ''}`}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-white/5 transition-colors text-[#475569]"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Profile */}
        <div
          className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
          onClick={() => navigate('/profile')}
          data-testid="sidebar-profile"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-white/10 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#4DA6FF]">
              {(user?.display_name || '?')[0]}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.display_name}</p>
              <div className="flex items-center gap-1">
                {isPremium && <Crown className="w-3 h-3 text-[#4DA6FF]" />}
                <span className="text-xs text-[#475569]">{isPremium ? 'Premium' : 'Free'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full p-2 rounded-xl text-[#475569] hover:text-red-400 hover:bg-red-400/5 transition-colors ${collapsed ? 'justify-center' : ''}`}
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
