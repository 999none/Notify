# Notify - Architecture Technique

## Vue d'ensemble

**Notify** est une application de musique collaborative en temps reel basee sur Spotify. Le coeur produit est le mode **JAM** : une room synchronisee ou plusieurs utilisateurs ecoutent la meme musique en meme temps via Spotify Web Playback SDK.

---

## Stack Technique

| Couche | Technologie | Details |
|--------|-------------|---------|
| Frontend | React 19 + Tailwind CSS + shadcn/ui | SPA, dark glassmorphism |
| Backend | FastAPI (Python) | API REST + WebSocket |
| Base de donnees | MongoDB (Motor async) | Users, Rooms, Sessions |
| Auth | Spotify OAuth 2.0 + JWT interne | Authorization Code Flow |
| Temps reel | WebSocket natif FastAPI | Synchronisation JAM |
| Playback | Spotify Web Playback SDK | Lecture Premium uniquement |

---

## Architecture Backend

```
/app/backend/
├── server.py                 # Point d'entree FastAPI, middleware, DB
├── .env                      # Variables d'environnement
├── requirements.txt          # Dependances Python
├── routers/
│   ├── __init__.py
│   ├── auth.py               # Spotify OAuth + JWT (login, callback, refresh, logout)
│   ├── users.py              # Profil utilisateur, premium check
│   ├── rooms.py              # CRUD JAM Rooms (create, join, leave, list)
│   └── playback.py           # Controle Spotify (play, pause, seek, search)
├── models/
│   ├── __init__.py
│   ├── user.py               # Modeles Pydantic User
│   ├── room.py               # Modeles Pydantic Room
│   └── auth.py               # Modeles Token/JWT
├── services/
│   ├── __init__.py
│   ├── spotify_service.py    # Client Spotify API (spotipy wrapper)
│   ├── jwt_service.py        # Creation/validation JWT
│   └── room_manager.py       # Gestionnaire rooms WebSocket
└── websocket/
    ├── __init__.py
    └── jam_handler.py         # Handler WebSocket JAM rooms
```

### Endpoints API

#### Auth (`/api/auth/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/login` | Retourne l'URL d'autorisation Spotify |
| GET | `/api/auth/callback` | Recoit le code OAuth, echange tokens, cree JWT |
| POST | `/api/auth/refresh` | Refresh le token Spotify via refresh_token |
| POST | `/api/auth/logout` | Invalide la session JWT |

#### Users (`/api/users/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Profil utilisateur courant |
| GET | `/api/users/me/premium` | Verifie le statut Premium |
| PUT | `/api/users/me` | Mise a jour profil |

#### Rooms (`/api/rooms/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms` | Creer une room JAM |
| GET | `/api/rooms` | Lister les rooms actives |
| GET | `/api/rooms/{room_id}` | Details d'une room |
| POST | `/api/rooms/{room_id}/join` | Rejoindre une room |
| POST | `/api/rooms/{room_id}/leave` | Quitter une room |
| DELETE | `/api/rooms/{room_id}` | Supprimer une room (host only) |

#### Playback (`/api/playback/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/playback/search?q=` | Recherche tracks Spotify |
| POST | `/api/playback/play` | Lancer un track |
| POST | `/api/playback/pause` | Pause |
| POST | `/api/playback/seek` | Seek a une position |
| GET | `/api/playback/state` | Etat playback courant |

#### WebSocket (`/api/ws/`)
| Endpoint | Description |
|----------|-------------|
| `/api/ws/jam/{room_id}` | Connexion WebSocket JAM room |

### Messages WebSocket JAM

```json
// Client -> Serveur
{ "type": "play", "track_uri": "spotify:track:xxx", "position_ms": 0 }
{ "type": "pause" }
{ "type": "seek", "position_ms": 30000 }
{ "type": "queue_add", "track_uri": "spotify:track:xxx" }
{ "type": "chat", "message": "Great song!" }
{ "type": "heartbeat" }

// Serveur -> Client
{ "type": "sync", "track_uri": "...", "position_ms": 12345, "is_playing": true }
{ "type": "participant_joined", "user": {...} }
{ "type": "participant_left", "user_id": "..." }
{ "type": "queue_updated", "queue": [...] }
{ "type": "chat_message", "user": {...}, "message": "..." }
{ "type": "room_closed" }
```

---

## Architecture Frontend

```
/app/frontend/src/
├── App.js                    # Routes principales
├── App.css                   # Styles globaux custom
├── index.js                  # Point d'entree React
├── index.css                 # Tailwind + CSS variables dark glass
├── api/
│   └── index.js              # Client axios configure
├── context/
│   └── AuthContext.js        # Provider auth (JWT + Spotify tokens)
├── hooks/
│   ├── useAuth.js            # Hook auth (login, logout, refresh)
│   ├── useSpotifyPlayer.js   # Hook Spotify Web Playback SDK
│   └── useWebSocket.js       # Hook WebSocket JAM
├── pages/
│   ├── Landing.js            # Page d'accueil + Login Spotify
│   ├── AuthCallback.js       # Callback OAuth (/auth/callback)
│   ├── Dashboard.js          # Dashboard principal (Bento Grid)
│   └── JamRoom.js            # Vue room JAM immersive
├── components/
│   ├── layout/
│   │   ├── Sidebar.js        # Navigation desktop (glass)
│   │   ├── MobileNav.js      # Navigation mobile bottom bar
│   │   ├── AppLayout.js      # Layout wrapper (sidebar + content)
│   │   └── GlassCard.js      # Composant card glassmorphism
│   ├── player/
│   │   ├── SpotifyPlayer.js  # Wrapper Spotify Web Playback SDK
│   │   ├── PlayerControls.js # Boutons play/pause/skip
│   │   ├── NowPlaying.js     # Affichage track en cours
│   │   └── PlayerBar.js      # Barre player fixe en bas
│   ├── room/
│   │   ├── RoomCard.js       # Card preview d'une room
│   │   ├── CreateRoomDialog.js # Modal creation room
│   │   ├── ParticipantList.js  # Liste participants
│   │   └── RoomQueue.js      # File d'attente tracks
│   ├── search/
│   │   └── TrackSearch.js    # Recherche de tracks
│   └── ui/                   # Composants shadcn (existants)
└── lib/
    └── utils.js              # Utilitaires (cn, etc.)
```

### Routes Frontend

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Login Spotify, hero, features |
| `/auth/callback` | AuthCallback | Traitement callback OAuth |
| `/dashboard` | Dashboard | Dashboard principal |
| `/jam/:roomId` | JamRoom | Room JAM immersive |

---

## Schema MongoDB

### Collection: `users`
```json
{
  "id": "uuid",
  "spotify_id": "spotify_user_id",
  "display_name": "John",
  "email": "john@example.com",
  "avatar_url": "https://...",
  "product": "premium",
  "is_premium": true,
  "spotify_access_token": "encrypted_token",
  "spotify_refresh_token": "encrypted_refresh_token",
  "token_expires_at": "2024-01-01T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Collection: `rooms`
```json
{
  "id": "uuid",
  "name": "My JAM Room",
  "code": "ABC123",
  "host_id": "user_uuid",
  "host_name": "John",
  "host_avatar": "https://...",
  "current_track": {
    "uri": "spotify:track:xxx",
    "name": "Track Name",
    "artist": "Artist Name",
    "album_art": "https://...",
    "duration_ms": 240000,
    "position_ms": 30000,
    "is_playing": true
  },
  "queue": [
    { "uri": "spotify:track:xxx", "name": "...", "artist": "...", "added_by": "user_id" }
  ],
  "participants": ["user_uuid_1", "user_uuid_2"],
  "max_participants": 10,
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Collection: `sessions`
```json
{
  "id": "uuid",
  "user_id": "user_uuid",
  "jwt_token_hash": "hash",
  "created_at": "2024-01-01T00:00:00Z",
  "expires_at": "2024-01-08T00:00:00Z",
  "is_active": true
}
```

### Index MongoDB
```python
# users
db.users.create_index("spotify_id", unique=True)
db.users.create_index("id", unique=True)

# rooms
db.rooms.create_index("id", unique=True)
db.rooms.create_index("code", unique=True)
db.rooms.create_index("is_active")

# sessions
db.sessions.create_index("user_id")
db.sessions.create_index("expires_at", expireAfterSeconds=0)
```

---

## Flux d'authentification

```
1. User clique "Login with Spotify"
2. Frontend -> GET /api/auth/login -> retourne auth_url Spotify
3. Redirect vers Spotify OAuth
4. Spotify redirige vers /auth/callback?code=xxx
5. Frontend AuthCallback -> GET /api/auth/callback?code=xxx
6. Backend echange code -> tokens Spotify
7. Backend cree/update user MongoDB
8. Backend genere JWT interne (signe, expire 7j)
9. Retourne JWT au frontend
10. Frontend stocke JWT dans localStorage
11. Toutes les requetes API incluent header: Authorization: Bearer <JWT>
12. Backend valide JWT, recupere user, utilise ses tokens Spotify
```

---

## Flux JAM Room

```
1. Host cree room: POST /api/rooms
2. Room recoit un code unique (ex: "XK7M9P")
3. Host + Invites se connectent: WebSocket /api/ws/jam/{room_id}
4. Host lance un track: WS message { type: "play", track_uri: "..." }
5. Serveur broadcast a tous: { type: "sync", track_uri: "...", position_ms: 0 }
6. Chaque client demarre playback via Spotify SDK a la position recue
7. Heartbeat toutes les 5s pour re-sync si drift
8. Gestion deconnexion: tentative reconnexion auto (3 essais, backoff)
9. Si host quitte: room fermee ou transfert host
```

---

## Securite

- **Tokens Spotify** : stockes uniquement cote serveur (MongoDB), jamais exposes au frontend
- **JWT** : signe avec secret fort (HS256), expiration 7 jours, refresh possible
- **CORS** : configure strictement
- **.env** : dans .gitignore, jamais commit
- **WebSocket auth** : token JWT envoye a la connexion, valide avant join
- **Rate limiting** : a implementer sur les endpoints sensibles

---

## Design System

Voir `/app/design_guidelines.json` pour les specifications completes :
- **Theme** : Dark glassmorphism (Mica)
- **Couleur primaire** : Sky Blue (#00C2FF)
- **Fonts** : Manrope (headings) + Plus Jakarta Sans (body)
- **Effets** : backdrop-blur, glass cards, neon glow, smooth animations
- **Layout** : Bento Grid dashboard, sidebar desktop, bottom bar mobile
