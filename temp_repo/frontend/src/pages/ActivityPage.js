import React, { useState, useEffect } from 'react';
import { activityAPI } from '../api';
import AppLayout from '../components/AppLayout';
import { Activity as ActivityIcon, Radio, ListMusic, UserPlus, UserCheck, Music, Sparkles } from 'lucide-react';

const actionIcons = {
  room_created: Radio,
  room_joined: Radio,
  playlist_created: ListMusic,
  track_added: Music,
  friend_request_sent: UserPlus,
  friend_request_accepted: UserCheck,
  account_created: Sparkles,
};

const actionTexts = {
  room_created: 'created a JAM room',
  room_joined: 'joined a JAM room',
  playlist_created: 'created a playlist',
  track_added: 'added a track',
  friend_request_sent: 'sent a friend request',
  friend_request_accepted: 'accepted a friend request',
  account_created: 'joined Notify',
};

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await activityAPI.feed();
        setActivities(res.data.activities || []);
      } catch (err) {}
    };
    fetchActivity();
  }, []);

  const timeAgo = (isoDate) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 max-w-3xl" data-testid="activity-page">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne' }}>Activity</h1>
        <p className="text-[#94A3B8] mb-8">See what your friends are up to</p>

        {activities.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <ActivityIcon className="w-16 h-16 text-[#475569] mb-6 mx-auto" strokeWidth={1} />
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Syne' }}>No activity yet</h3>
            <p className="text-[#475569]">Activity from you and your friends will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {activities.map((act, i) => {
              const Icon = actionIcons[act.action] || ActivityIcon;
              return (
                <div key={i} className="glass-card p-5 flex items-start gap-4" data-testid={`activity-item-${i}`}>
                  <div className="flex-shrink-0">
                    {act.user_avatar ? (
                      <img src={act.user_avatar} alt="" className="w-10 h-10 rounded-full border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#4DA6FF]/20 flex items-center justify-center text-sm font-bold text-[#4DA6FF]">
                        {(act.user_display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{act.user_display_name || 'User'}</span>
                      <span className="text-[#94A3B8]"> {actionTexts[act.action] || act.action}</span>
                    </p>
                    {act.details?.room_name && <p className="text-xs text-[#4DA6FF] mt-1">{act.details.room_name}</p>}
                    {act.details?.name && <p className="text-xs text-[#4DA6FF] mt-1">{act.details.name}</p>}
                    {act.details?.track_name && <p className="text-xs text-[#4DA6FF] mt-1">{act.details.track_name}</p>}
                    <p className="text-xs text-[#475569] mt-1">{timeAgo(act.created_at)}</p>
                  </div>
                  <Icon className="w-5 h-5 text-[#4DA6FF]/50 flex-shrink-0 mt-1" strokeWidth={1.5} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
