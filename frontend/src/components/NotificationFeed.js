import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import {
  Bell,
  Music,
  Radio,
  Users,
  ThumbsUp,
  Check,
  CheckCheck,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("notify_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "A l'instant";
  if (diffMins < 60) return `il y a ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR");
}

const NOTIF_ICONS = {
  track_added: { icon: Music, color: "text-green-400", bg: "bg-green-500/10" },
  track_played: { icon: Music, color: "text-blue-400", bg: "bg-blue-500/10" },
  room_joined: { icon: Radio, color: "text-purple-400", bg: "bg-purple-500/10" },
  room_created: { icon: Radio, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  room_left: { icon: Radio, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  friend_added: { icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  vote: { icon: ThumbsUp, color: "text-amber-400", bg: "bg-amber-500/10" },
};

const FILTER_OPTIONS = [
  { id: "all", label: "Toutes" },
  { id: "track_added", label: "Musique" },
  { id: "room_joined", label: "Rooms" },
  { id: "vote", label: "Votes" },
  { id: "friend_added", label: "Amis" },
];

function NotificationCard({ notification, onMarkRead }) {
  const config = NOTIF_ICONS[notification.type] || NOTIF_ICONS.track_added;
  const IconComponent = config.icon;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl transition-all group ${
        notification.read
          ? "bg-white/[0.01] opacity-60"
          : "bg-white/[0.03] border border-white/[0.06] hover:border-white/10"
      }`}
      data-testid={`notification-${notification.id}`}
    >
      {/* Source Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="w-10 h-10 border border-white/10">
          <AvatarImage src={notification.source_avatar} alt={notification.source_username} />
          <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
            {notification.source_username?.charAt(0)?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${config.bg} flex items-center justify-center border-2 border-[#09090b]`}>
          <IconComponent className={`w-2.5 h-2.5 ${config.color}`} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-relaxed">
          {notification.content}
        </p>
        <p className="text-xs text-zinc-600 mt-1">{formatTimeAgo(notification.created_at)}</p>
      </div>

      {/* Track Image (if applicable) */}
      {notification.track_image && (
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
          <img
            src={notification.track_image}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Mark as read */}
      {!notification.read && (
        <button
          onClick={() => onMarkRead(notification.id)}
          className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
          title="Marquer comme lu"
          data-testid={`mark-read-${notification.id}`}
        >
          <Check className="w-4 h-4 text-zinc-500 hover:text-green-400 transition-colors" />
        </button>
      )}
    </div>
  );
}


export function NotificationBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
      data-testid="notification-badge"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}


export function useNotificationSocket(userId) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [newNotification, setNewNotification] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("notify_token");
    if (!token) return;

    const socket = io(BACKEND_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("authenticate", { token });
    });

    socket.on("unread_count", (data) => {
      setUnreadCount(data.count || 0);
    });

    socket.on("new_notification", (notif) => {
      setNewNotification(notif);
      setUnreadCount((prev) => prev + 1);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const decrementCount = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const resetCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, newNotification, decrementCount, resetCount };
}


export default function NotificationFeed({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showFilter, setShowFilter] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API}/notifications/${userId}`, {
        headers: getAuthHeaders(),
      });
      setNotifications(res.data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen for new notifications via parent component
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setNotifications((prev) => [e.detail, ...prev]);
      }
    };
    window.addEventListener("new_notification", handler);
    return () => window.removeEventListener("new_notification", handler);
  }, []);

  const handleMarkRead = async (notifId) => {
    try {
      await axios.post(`${API}/notifications/mark-read/${notifId}`, {}, {
        headers: getAuthHeaders(),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      window.dispatchEvent(new CustomEvent("notification_read"));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`, {}, {
        headers: getAuthHeaders(),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new CustomEvent("notification_all_read"));
    } catch {
      // ignore
    }
  };

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-up" data-testid="notifications-loading">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-5 h-5 text-notify-blue" />
          <h3 className="font-heading text-lg font-semibold text-white">Notifications</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card card-glow overflow-hidden animate-fade-up" data-testid="notification-feed">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-notify-blue" />
          <h3 className="font-heading text-lg font-semibold text-white">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5"
              data-testid="mark-all-read-btn"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout lire
            </button>
          )}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-2 rounded-lg transition-colors ${showFilter ? "bg-notify-blue/10 text-notify-blue" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
            data-testid="filter-toggle-btn"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilter && (
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap" data-testid="filter-bar">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === opt.id
                  ? "bg-notify-blue/20 text-notify-blue border border-notify-blue/30"
                  : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10"
              }`}
              data-testid={`filter-${opt.id}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Notifications List */}
      <div className="px-4 pb-4 space-y-1 max-h-[600px] overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-400">
              {filter === "all"
                ? "Aucune notification pour le moment."
                : "Aucune notification de ce type."}
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              L'activité de vos amis et rooms apparaîtra ici
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onMarkRead={handleMarkRead}
            />
          ))
        )}
      </div>
    </div>
  );
}
