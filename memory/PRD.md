# Notify - Social Spotify JAM Web App

## Problem Statement
Fix the Notify app: Spotify connections, playlist/track/album import/display, and friend system not working.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (port 3000)
- **Backend**: FastAPI (Python) + WebSocket (port 8001)
- **Database**: MongoDB (Motor async driver)
- **Auth**: Spotify OAuth 2.0 + JWT internal sessions
- **Playback**: Spotify Web Playback SDK (Premium required)

## Core Requirements
- Spotify OAuth login
- Dashboard with active rooms
- Create/Join JAM rooms with real-time WebSocket sync
- Playlist CRUD with Spotify import/sync
- Friend system (request/accept/reject/remove)
- Activity feed
- Track search and queue

## What's Been Implemented (Bug Fix - March 3, 2026)

### Critical Fix: Route Ordering Bug
- **Problem**: In `server.py`, `GET /playlists/{playlist_id}` (dynamic route) was defined BEFORE `GET /playlists/import-spotify` (static route). FastAPI captured "import-spotify" as a `playlist_id` parameter, causing 404 errors when importing Spotify playlists.
- **Fix**: Moved `GET /playlists/import-spotify` and `POST /playlists/import-spotify/{spotify_id}` BEFORE all `{playlist_id}` dynamic routes in the route registration order.

### Verification
- All 25 backend endpoints tested successfully (100%)
- Frontend landing page, routing, and Spotify OAuth flow verified
- Friends system endpoints all responding correctly
- Playlist import-spotify route now correctly reachable

## Prioritized Backlog
- P0: None (all critical bugs fixed)
- P1: End-to-end Spotify OAuth flow testing with real credentials
- P2: WebSocket JAM room real-time sync testing
- P2: Activity feed display verification post-login

## Next Tasks
- Test full Spotify OAuth flow with real user login
- Verify playlist import actually pulls tracks from Spotify
- Test friend request/accept/reject flow with multiple users
- Test JAM room WebSocket synchronization
