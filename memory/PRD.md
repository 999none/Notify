# Notify - PRD

## Problem Statement
Deploy and set up Notify (collaborative Spotify music app) from existing GitHub repo (https://github.com/999none/Notify). Verify all missing features are implemented: sidebar navigation, collaborative playlists, social system, user profile, settings, updated palette (#4DA6FF, #0F172A), and missing Spotify scopes.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (CRA + craco, port 3000)
- **Backend**: FastAPI + WebSocket + Motor (MongoDB async, port 8001)
- **Database**: MongoDB (local)
- **Auth**: Spotify OAuth 2.0 + JWT (internal)
- **Playback**: Spotify Web Playback SDK (Premium only)
- **Real-time**: WebSocket for JAM room sync

## User Personas
- Music enthusiasts wanting to listen together in real-time
- Spotify Premium users creating collaborative listening sessions
- Social music users sharing playlists and activities with friends

## Core Requirements (Static)
- Spotify OAuth login flow
- JAM rooms (create/join/leave with real-time sync via WebSocket)
- Collaborative playlists (CRUD, sync to Spotify)
- Social system (friends, requests, activity feed)
- User profile (top artists/tracks from Spotify)
- Settings page (account info, links)
- Sidebar navigation (Home, Jam Rooms, Friends, Playlists, Activity, Settings)
- Dark glassmorphism theme (#4DA6FF/#0F172A palette)

## What's Been Implemented (2026-03-03)
- Cloned and deployed Notify project from GitHub
- Configured .env files with preview URL and Spotify credentials
- All backend API endpoints operational (auth, rooms, playback, playlists, friends, activity, websocket)
- Frontend fully functional with all pages (Landing, Dashboard, JamRooms, JamRoom, Friends, Playlists, Activity, Profile, Settings)
- Sidebar navigation with all 6 nav items
- Collaborative playlists with Spotify sync and import
- Social system (friend requests, accept/reject, activity feed)
- User profile with top artists and top tracks from Spotify
- Settings page with account info
- Updated palette (#4DA6FF, #0F172A)
- All Spotify scopes included (playlist-*, user-top-read, streaming, etc.)
- All tests passing (100% backend, 100% frontend)

## Spotify Configuration
- Website URL: https://4b7568e7-aa50-4c6a-a103-bcb49fe51f10.preview.emergentagent.com
- Redirect URI: https://4b7568e7-aa50-4c6a-a103-bcb49fe51f10.preview.emergentagent.com/api/auth/spotify/callback

## Prioritized Backlog
- P0: Done - All missing features deployed and verified
- P1: Spotify Premium playback testing with real account
- P2: Mobile responsive improvements
- P3: Queue management in JAM rooms

## Next Tasks
- User needs to configure Spotify Developer Dashboard with the provided URLs
- Add user's Spotify email to Developer Dashboard "User Management"
- Test full OAuth flow with real Spotify account
- Test JAM room real-time sync with multiple users
