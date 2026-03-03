# Notify - PRD

## Problem Statement
Continue the Notify project (Spotify collaborative music app). Create a simple download.html page with a direct zip download link for the complete project.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (served via CRA on port 3000)
- **Backend**: FastAPI + WebSocket + Motor (MongoDB async) on port 8001
- **Database**: MongoDB
- **Auth**: Spotify OAuth 2.0 + JWT
- **Playback**: Spotify Web Playback SDK

## What's Been Implemented (2026-03-03)
- Cloned Notify project from GitHub (https://github.com/999none/Notify)
- Updated .env files with current preview URL
- Generated Notify.zip (285K) containing complete project
- Created download.html - simple page with direct download link
- All backend API endpoints operational (auth, rooms, playback, download, websocket)
- All tests passing (100% backend, 100% frontend)

## Core Requirements
- Spotify OAuth login flow
- JAM rooms (create/join/leave/delete)
- Real-time sync via WebSocket
- Track search + playback control
- Download page for project zip

## Prioritized Backlog
- P0: Done - download page + zip
- P1: Spotify Premium gate enforcement
- P2: Chat improvements in JAM rooms
- P3: Queue management UI

## Next Tasks
- User can test Spotify OAuth flow with real Spotify account
- Extend JAM room features if needed
