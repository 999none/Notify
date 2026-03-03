# Notify

Collaborative music listening app powered by Spotify. Create JAM rooms, invite friends, and listen together in real-time.

## Stack

- **Frontend**: React 19 + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) + WebSocket natif
- **Database**: MongoDB (Motor async driver)
- **Auth**: Spotify OAuth 2.0 + JWT internal sessions
- **Playback**: Spotify Web Playback SDK (Premium required)
- **Design**: Glassmorphism / MicaBlur, Sky Blue (#00C2FF)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB running locally
- Spotify Developer App credentials

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
# Configure .env (see below)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend

```bash
cd frontend
yarn install
# Configure .env (see below)
yarn start
```

### 3. Spotify Dashboard Configuration

Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and configure:

```
Website:
https://2805ab5c-e907-4e9f-b1cb-913dcb6dd82e.preview.emergentagent.com

Redirect URI:
https://2805ab5c-e907-4e9f-b1cb-913dcb6dd82e.preview.emergentagent.com/api/auth/spotify/callback
```

## Environment Variables

### Backend (.env)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=notify_db
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=https://YOUR_DOMAIN/api/auth/spotify/callback
JWT_SECRET=your_secure_random_secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
CORS_ORIGINS=*
FRONTEND_URL=https://YOUR_DOMAIN
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL=https://YOUR_DOMAIN
WDS_SOCKET_PORT=443
```

## Features (MVP)

- Spotify OAuth login (server-side callback with redirect)
- JWT-based session management
- Dashboard with active rooms (Bento Grid layout)
- Create/Join JAM rooms with unique codes
- Real-time synchronized playback via WebSocket
- DJ Mode: Host controls play/pause/seek for all participants
- Track search via Spotify API
- In-room chat
- Premium check gate
- ZIP project download page (/download)

## Architecture

See `ARCHITECTURE.md` for full technical documentation.
See `PLAN.md` for development plan and milestones.
See `design_guidelines.json` for UI/UX specifications.

## Auth Flow

1. User clicks "Connect with Spotify"
2. Frontend calls `GET /api/auth/login` -> gets Spotify auth URL
3. User redirects to Spotify consent screen
4. Spotify redirects to `GET /api/auth/spotify/callback?code=xxx`
5. Backend exchanges code for tokens, creates/updates user in MongoDB
6. Backend generates JWT and redirects to frontend: `/auth/callback?token=xxx&user=xxx`
7. Frontend stores JWT in localStorage
8. All API calls include `Authorization: Bearer <JWT>`

## JAM Room Flow

1. Host creates room: `POST /api/rooms`
2. Room gets unique code (e.g., "XK7M9P")
3. Host + guests connect via WebSocket: `/api/ws/jam/{room_id}`
4. Host plays a track -> WebSocket broadcasts sync to all
5. Each client's Spotify SDK plays at the synced position
6. Heartbeat every 5s for re-sync

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with Spotify login |
| `/auth/callback` | OAuth callback handler |
| `/dashboard` | Main dashboard with rooms |
| `/jam/:roomId` | JAM room immersive view |
| `/download` | ZIP download page |

## License

Private
