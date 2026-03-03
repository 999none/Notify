# Notify

Collaborative music listening app powered by Spotify. Create JAM rooms, invite friends, and listen together in real-time.

## Stack

- **Frontend**: React 19 + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) + WebSocket
- **Database**: MongoDB (Motor async driver)
- **Auth**: Spotify OAuth 2.0 + JWT internal sessions
- **Playback**: Spotify Web Playback SDK (Premium required)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB running locally
- Spotify Developer App credentials

### Backend
```bash
cd backend
pip install -r requirements.txt
# Configure .env (see .env.example)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
# Configure .env (REACT_APP_BACKEND_URL)
yarn start
```

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=notify_db
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback
JWT_SECRET=your_secure_secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
CORS_ORIGINS=*
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Architecture

See `ARCHITECTURE.md` for full technical documentation.
See `PLAN.md` for development plan and milestones.
See `design_guidelines.json` for UI/UX specifications.

## Features (MVP)
- Spotify OAuth login
- Dashboard with active rooms
- Create/Join JAM rooms
- Real-time synchronized playback via WebSocket
- Track search and queue
- In-room chat
- Premium gate

## License
Private
