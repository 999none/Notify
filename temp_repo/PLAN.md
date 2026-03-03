# Notify - Plan de Developpement MVP

## Phase 1 : MVP (Priorite absolue)

### Etape 1 : Environnement et Auth
- [ ] Configurer .env backend (Spotify credentials, JWT secret, MongoDB)
- [ ] Installer dependances backend (spotipy, pyjwt, etc.)
- [ ] Implementer `/api/auth/login` - retourne URL Spotify OAuth
- [ ] Implementer `/api/auth/callback` - echange code, cree user, genere JWT
- [ ] Implementer `/api/auth/refresh` - refresh token Spotify
- [ ] Implementer middleware JWT (dependency FastAPI)
- [ ] Creer modeles Pydantic (User, Room, Token)
- [ ] Configurer indexes MongoDB
- [ ] Tester flux auth complet

### Etape 2 : Frontend Auth + Layout
- [ ] Configurer CSS variables dark glassmorphism
- [ ] Importer Google Fonts (Manrope, Plus Jakarta Sans)
- [ ] Creer AuthContext provider
- [ ] Creer page Landing (hero + bouton Login Spotify)
- [ ] Creer page AuthCallback (traitement code OAuth)
- [ ] Creer layout AppLayout (Sidebar + content)
- [ ] Creer composant GlassCard reutilisable
- [ ] Router : /, /auth/callback, /dashboard, /jam/:id

### Etape 3 : Dashboard
- [ ] Implementer GET /api/users/me (profil depuis JWT)
- [ ] Implementer GET /api/rooms (lister rooms actives)
- [ ] Creer page Dashboard (Bento Grid)
  - Card profil utilisateur
  - Card "Creer une Room"
  - Liste rooms actives
  - Now Playing (si en lecture)
- [ ] Creer composant RoomCard
- [ ] Creer CreateRoomDialog (modal shadcn Dialog)

### Etape 4 : JAM Room Backend
- [ ] Implementer POST /api/rooms (creer room avec code unique)
- [ ] Implementer GET /api/rooms/{id} (details room)
- [ ] Implementer POST /api/rooms/{id}/join
- [ ] Implementer POST /api/rooms/{id}/leave
- [ ] Implementer WebSocket handler /api/ws/jam/{room_id}
  - Auth JWT a la connexion
  - Gestion rooms (join, leave, broadcast)
  - Messages: play, pause, seek, sync
  - Heartbeat toutes les 5s
  - Gestion deconnexion propre

### Etape 5 : JAM Room Frontend
- [ ] Integrer Spotify Web Playback SDK
  - Charger SDK script
  - Creer player instance
  - Gerer device_id
  - Premium check + message
- [ ] Creer hook useSpotifyPlayer
- [ ] Creer hook useWebSocket (connexion, reconnexion auto)
- [ ] Creer page JamRoom
  - Album art background (blur)
  - Controles player (play/pause/seek)
  - Liste participants
  - Recherche de tracks
  - File d'attente (queue)
- [ ] Synchronisation: recevoir sync WS -> controler SDK

### Etape 6 : Playback API
- [ ] Implementer GET /api/playback/search
- [ ] Implementer POST /api/playback/play
- [ ] Implementer POST /api/playback/pause
- [ ] Implementer GET /api/playback/state
- [ ] Creer composant TrackSearch
- [ ] Creer composant PlayerBar (fixe en bas)

### Etape 7 : Tests et Polish
- [ ] Test e2e flux auth
- [ ] Test creation/join room
- [ ] Test synchronisation WebSocket (2 clients)
- [ ] Test reconnexion apres deconnexion
- [ ] Test Premium gate
- [ ] Animations et transitions
- [ ] Responsive mobile

---

## Phase 2 : Post-MVP (apres validation JAM)

### Playlists collaboratives
- Creer/gerer playlists partagees
- Ajouter/supprimer tracks collaborativement
- Sauvegarder vers Spotify

### Systeme social
- Collection `follows` (follower_id, following_id)
- Recherche utilisateurs
- Profils publics
- Feed d'activite

### Discord Activity
- Structure pour integration Discord SDK
- Shared JAM via Discord

---

## Variables d'Environnement

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=notify_db
SPOTIFY_CLIENT_ID=81d007eb4f4f48febe75f23fba0b3a6e
SPOTIFY_CLIENT_SECRET=b1f183495c8c4c17b74eaea5d181b2e6
SPOTIFY_REDIRECT_URI=https://3667-2a01-e0a-279-7610-a42c-5dd8-23f5-c01a.ngrok-free.app/auth/callback
JWT_SECRET=<generer un secret fort>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
CORS_ORIGINS=*
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=<URL backend>
WDS_SOCKET_PORT=443
```

---

## Dependances a Installer

### Backend (pip)
- spotipy (Spotify API client)
- pyjwt (JWT tokens)
- python-jose (JWT alternative)
- cryptography (encryption)

### Frontend (yarn)
- Deja installe: axios, react-router-dom, lucide-react, shadcn/ui, sonner, tailwindcss

---

## Notes Importantes

1. **Spotify Web Playback SDK** : Necessite Premium. Toujours afficher un message clair si non-Premium.
2. **WebSocket reconnexion** : Implementer backoff exponentiel (1s, 2s, 4s, max 30s).
3. **Token refresh** : Le refresh token Spotify doit etre rafraichi automatiquement avant expiration.
4. **MongoDB _id** : TOUJOURS exclure _id des projections. Utiliser `{"_id": 0}` dans les queries.
5. **Routes API** : TOUJOURS prefixer avec `/api`.
6. **Securite tokens** : Tokens Spotify JAMAIS exposes au frontend. Uniquement JWT interne.
