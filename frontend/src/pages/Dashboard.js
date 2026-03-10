import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Radio,
  Activity,
  Settings,
  LogOut,
  Music,
  Disc3,
  Headphones,
  UserPlus,
  Waves,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const VINYL_IMG = "https://images.unsplash.com/photo-1621940760699-8fe82b462dfa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwzfHx2aW55bCUyMHJlY29yZCUyMGFic3RyYWN0JTIwY3Jvd2QlMjBhZXN0aGV0aWMlMjBkYXJrJTIwYmx1ZXxlbnwwfHx8fDE3NzMxNzI4MzR8MA&ixlib=rb-4.1.0&q=85";
const HEADPHONES_IMG = "https://images.unsplash.com/photo-1697040975575-0baa5b9c7803?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwyfHxwZXJzb24lMjBsaXN0ZW5pbmclMjB0byUyMG11c2ljJTIwaGVhZHBob25lcyUyMGRhcmslMjBhZXN0aGV0aWN8ZW58MHx8fHwxNzczMTcyODM1fDA&ixlib=rb-4.1.0&q=85";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "friends", label: "Friends", icon: Users },
  { id: "rooms", label: "Listening Rooms", icon: Radio },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

function Sidebar({ activeTab, setActiveTab, user, onLogout }) {
  return (
    <aside className="sidebar-desktop glass-sidebar fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50" data-testid="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-7">
        <div className="w-9 h-9 rounded-xl bg-notify-blue flex items-center justify-center">
          <Music className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading text-xl font-bold text-white tracking-tight">
          Notify
        </span>
      </div>

      <Separator className="bg-white/5 mx-4" />

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`nav-item w-full ${activeTab === item.id ? "active" : ""}`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-4 pb-6">
        <Separator className="bg-white/5 mb-4" />
        <div className="flex items-center gap-3 px-2 mb-3">
          <Avatar className="w-9 h-9 border border-white/10">
            <AvatarImage src={user?.avatar} alt={user?.username} />
            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs font-heading">
              {user?.username?.charAt(0)?.toUpperCase() || "N"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={onLogout}
          className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ activeTab, setActiveTab }) {
  return (
    <div className="mobile-nav fixed bottom-0 left-0 right-0 z-50 glass-sidebar border-t border-white/5 px-2 py-2" data-testid="mobile-nav">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button
            key={item.id}
            data-testid={`mobile-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
              activeTab === item.id ? "text-blue-400" : "text-zinc-500"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileCard({ user }) {
  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-100" data-testid="profile-card">
      <div className="flex items-start gap-5">
        <Avatar className="w-20 h-20 rounded-2xl border-2 border-white/10">
          <AvatarImage src={user?.avatar} alt={user?.username} className="rounded-2xl" />
          <AvatarFallback className="rounded-2xl bg-zinc-800 text-zinc-300 text-2xl font-heading">
            {user?.username?.charAt(0)?.toUpperCase() || "N"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-2xl font-bold text-white tracking-tight truncate" data-testid="profile-username">
            {user?.username}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span className="text-sm text-zinc-400" data-testid="profile-spotify-id">{user?.spotify_id}</span>
          </div>
          <div className="mt-3">
            <span
              className={user?.subscription === "premium" ? "badge-premium" : "badge-free"}
              data-testid="profile-subscription"
            >
              {user?.subscription || "free"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Friends</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Rooms</p>
        </div>
        <div>
          <p className="font-heading text-xl font-bold text-white">0</p>
          <p className="text-xs text-zinc-500 mt-1">Sessions</p>
        </div>
      </div>
    </div>
  );
}

function ListeningActivityCard() {
  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-200" data-testid="listening-activity-card">
      <div className="relative h-40 overflow-hidden">
        <img
          src={VINYL_IMG}
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent" />
        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex items-center gap-2 mb-1">
            <Disc3 className="w-5 h-5 text-notify-blue animate-spin" style={{ animationDuration: '3s' }} />
            <h3 className="font-heading text-lg font-semibold text-white">Listening Activity</h3>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Waves className="w-6 h-6 text-zinc-600" />
          </div>
          <div>
            <p className="text-sm text-zinc-300">Your listening activity will appear here.</p>
            <p className="text-xs text-zinc-600 mt-1">Connect to see what you're playing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FriendsCard() {
  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-300" data-testid="friends-card">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-notify-blue" />
          Friends
        </h3>
        <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1" data-testid="add-friends-button">
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-zinc-700" />
        </div>
        <p className="text-sm text-zinc-400">You don't have friends on Notify yet.</p>
        <p className="text-xs text-zinc-600 mt-2">Invite friends to share your music taste</p>
      </div>
    </div>
  );
}

function RoomsCard() {
  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up delay-400" data-testid="rooms-card">
      <div className="relative h-32 overflow-hidden">
        <img
          src={HEADPHONES_IMG}
          alt=""
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent" />
        <div className="absolute bottom-4 left-6">
          <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
            <Headphones className="w-5 h-5 text-notify-blue" />
            Listening Rooms
          </h3>
        </div>
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center py-4 text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
            <Radio className="w-6 h-6 text-zinc-700" />
          </div>
          <p className="text-sm text-zinc-400">No active rooms.</p>
          <p className="text-xs text-zinc-600 mt-2">Create a room and listen together</p>
        </div>
      </div>
    </div>
  );
}

function ActivityFeedCard() {
  return (
    <div className="glass-card card-glow p-6 animate-fade-up delay-500" data-testid="activity-feed-card">
      <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2 mb-5">
        <Activity className="w-5 h-5 text-notify-blue" />
        Activity Feed
      </h3>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800/80" />
            <div className="flex-1">
              <div className="h-3 w-32 rounded bg-zinc-800/60" />
              <div className="h-2 w-20 rounded bg-zinc-800/40 mt-2" />
            </div>
            <div className="h-8 w-8 rounded-lg bg-zinc-800/40" />
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-zinc-500 mt-4">
        Your friends' activity will appear here.
      </p>
    </div>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-black" data-testid="dashboard-page">
      {/* Sidebar - Desktop */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={onLogout}
      />

      {/* Mobile Nav */}
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <main className="md:ml-[260px] min-h-screen p-6 md:p-8 lg:p-10 pb-24 md:pb-10">
        {/* Header */}
        <div className="mb-10 animate-fade-up">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white tracking-tight">
            Welcome back{user?.username ? `, ${user.username}` : ""}
          </h1>
          <p className="text-zinc-500 mt-2 text-base">
            Here's what's happening in your music world
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-5 lg:col-span-4">
            <ProfileCard user={user} />
          </div>

          {/* Listening Activity */}
          <div className="md:col-span-7 lg:col-span-8">
            <ListeningActivityCard />
          </div>

          {/* Friends */}
          <div className="md:col-span-5 lg:col-span-4">
            <FriendsCard />
          </div>

          {/* Rooms */}
          <div className="md:col-span-7 lg:col-span-8">
            <RoomsCard />
          </div>

          {/* Activity Feed */}
          <div className="col-span-full">
            <ActivityFeedCard />
          </div>
        </div>
      </main>
    </div>
  );
}
