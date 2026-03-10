# Notify - Social Music App PRD

## Original Problem Statement
Build a social music app called **Notify** around Spotify data. Users connect their Spotify account, view listening data, create music profiles, add friends, join shared listening rooms, and share music.

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI (CRA)
- **Backend**: FastAPI (Python) + MongoDB
- **Auth**: Spotify OAuth 2.0 → JWT sessions
- **Database**: MongoDB (users collection)

## User Personas
- Music lovers (18-35) who want to share listening experience
- Spotify users (free & premium)

## Core Requirements
- Spotify OAuth login
- User profile creation from Spotify data
- Social dashboard with friends, rooms, activity feed

## What's Been Implemented (March 2026)
- [x] Landing page with dark AMOLED / glassmorphism / blue fade theme
- [x] Spotify OAuth 2.0 full flow (login → callback → JWT)
- [x] User creation/upsert in MongoDB
- [x] Protected dashboard with sidebar navigation
- [x] Profile card (avatar, username, spotify_id, subscription badge)
- [x] Listening Activity placeholder card
- [x] Friends placeholder card
- [x] Listening Rooms placeholder card
- [x] Activity Feed placeholder card
- [x] Mobile responsive with bottom nav
- [x] All tests passing (backend + frontend 100%)

## Prioritized Backlog
### P0 (Critical)
- Friends system (add/remove/search)
- Music rooms (create/join real-time listening sessions)

### P1 (Important)
- Real-time listening activity (currently playing track)
- Social activity feed (friends' recent plays)
- User search & discovery

### P2 (Nice to have)
- Music statistics dashboard
- Playlist mixing
- Listening history analytics
- Settings page (notifications, privacy)

## Next Tasks
1. Implement friends system (send/accept/reject requests)
2. Build real-time listening rooms with WebSocket
3. Connect real listening activity from Spotify API
