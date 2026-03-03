from fastapi import FastAPI, APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import json
import asyncio
import io
import zipfile
import urllib.parse

# ============================================================
# CONFIGURATION
# ============================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Spotify
SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI')
SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state user-read-private user-read-email streaming user-read-currently-playing"

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'notify-default-secret-change-me')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', '7'))

# Frontend URL for redirects
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="Notify API", version="1.0.0")

api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# PYDANTIC MODELS
# ============================================================

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    spotify_id: str
    display_name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    product: Optional[str] = None
    is_premium: bool = False
    created_at: str
    updated_at: str

class RoomCreate(BaseModel):
    name: str

class RoomTrack(BaseModel):
    uri: str
    name: str
    artist: str
    album_art: Optional[str] = None
    duration_ms: int = 0
    position_ms: int = 0
    is_playing: bool = False

class RoomResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    code: str
    host_id: str
    host_name: str
    host_avatar: Optional[str] = None
    current_track: Optional[RoomTrack] = None
    queue: List[dict] = []
    participants: List[str] = []
    participant_count: int = 0
    max_participants: int = 10
    is_active: bool = True
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

class PlayRequest(BaseModel):
    track_uri: str
    position_ms: int = 0
    device_id: Optional[str] = None

class SeekRequest(BaseModel):
    position_ms: int
    device_id: Optional[str] = None

# ============================================================
# SPOTIFY SERVICE
# ============================================================

def get_spotify_oauth():
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SPOTIFY_SCOPES,
        show_dialog=True
    )

async def get_user_spotify_client(user_id: str) -> spotipy.Spotify:
    """Get authenticated Spotify client for a user, refreshing token if needed."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if token is expired
    token_expires = datetime.fromisoformat(user.get("token_expires_at", "2000-01-01T00:00:00+00:00"))
    now = datetime.now(timezone.utc)

    if now >= token_expires:
        # Refresh token
        sp_oauth = get_spotify_oauth()
        try:
            token_info = sp_oauth.refresh_access_token(user["spotify_refresh_token"])
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "spotify_access_token": token_info["access_token"],
                    "token_expires_at": datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc).isoformat(),
                    "updated_at": now.isoformat()
                }}
            )
            return spotipy.Spotify(auth=token_info["access_token"])
        except Exception as e:
            logger.error(f"Token refresh failed for user {user_id}: {e}")
            raise HTTPException(status_code=401, detail="Spotify token refresh failed. Please re-login.")

    return spotipy.Spotify(auth=user["spotify_access_token"])

# ============================================================
# JWT SERVICE
# ============================================================

def create_jwt(user_id: str, spotify_id: str) -> str:
    payload = {
        "sub": user_id,
        "spotify_id": spotify_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str = Query(None, alias="token")) -> dict:
    """Dependency to get current user from JWT. Accepts token from header or query param."""
    # This will be overridden by actual header parsing in middleware
    # For now, placeholder
    pass

# Helper to extract user from Authorization header
async def get_user_from_header(request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth_header.split(" ")[1]
    payload = decode_jwt(token)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============================================================
# AUTH ROUTES
# ============================================================

@api_router.get("/auth/login")
async def spotify_login():
    """Return Spotify OAuth authorization URL."""
    sp_oauth = get_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return {"auth_url": auth_url}

async def _handle_spotify_code(code: str):
    """Shared logic: exchange Spotify code for tokens, create/update user, return JWT + user."""
    sp_oauth = get_spotify_oauth()

    try:
        token_info = sp_oauth.get_access_token(code, as_dict=True)
    except Exception as e:
        logger.error(f"Spotify token exchange failed: {e}")
        raise HTTPException(status_code=400, detail=f"Spotify auth failed: {str(e)}")

    sp = spotipy.Spotify(auth=token_info["access_token"])
    spotify_profile = sp.me()

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())

    existing_user = await db.users.find_one({"spotify_id": spotify_profile["id"]}, {"_id": 0})

    if existing_user:
        user_id = existing_user["id"]
        await db.users.update_one(
            {"spotify_id": spotify_profile["id"]},
            {"$set": {
                "spotify_access_token": token_info["access_token"],
                "spotify_refresh_token": token_info.get("refresh_token", existing_user.get("spotify_refresh_token")),
                "token_expires_at": datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc).isoformat(),
                "display_name": spotify_profile.get("display_name", ""),
                "avatar_url": spotify_profile.get("images", [{}])[0].get("url") if spotify_profile.get("images") else None,
                "product": spotify_profile.get("product", "free"),
                "is_premium": spotify_profile.get("product") == "premium",
                "updated_at": now
            }}
        )
    else:
        user_doc = {
            "id": user_id,
            "spotify_id": spotify_profile["id"],
            "display_name": spotify_profile.get("display_name", ""),
            "email": spotify_profile.get("email", ""),
            "avatar_url": spotify_profile.get("images", [{}])[0].get("url") if spotify_profile.get("images") else None,
            "product": spotify_profile.get("product", "free"),
            "is_premium": spotify_profile.get("product") == "premium",
            "spotify_access_token": token_info["access_token"],
            "spotify_refresh_token": token_info.get("refresh_token", ""),
            "token_expires_at": datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc).isoformat(),
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(user_doc)

    jwt_token = create_jwt(user_id, spotify_profile["id"])
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})

    return jwt_token, user_data

@api_router.get("/auth/spotify/callback")
async def spotify_callback_redirect(code: str = None, error: str = None):
    """Spotify redirects here. Exchange code, then redirect to frontend with JWT in URL."""
    if error:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={urllib.parse.quote(error)}"
        return RedirectResponse(url=redirect_url)

    if not code:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error=no_code"
        return RedirectResponse(url=redirect_url)

    try:
        jwt_token, user_data = await _handle_spotify_code(code)
        user_json = urllib.parse.quote(json.dumps(user_data))
        redirect_url = f"{FRONTEND_URL}/auth/callback?token={jwt_token}&user={user_json}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Spotify callback failed: {e}")
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=redirect_url)

@api_router.get("/auth/callback")
async def spotify_callback_json(code: str):
    """JSON endpoint: exchange code for JWT (used by frontend directly if needed)."""
    jwt_token, user_data = await _handle_spotify_code(code)
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": user_data
    }

@api_router.post("/auth/refresh")
async def refresh_spotify_token(request_data: dict):
    """Refresh the Spotify access token using the stored refresh token."""
    # Extract JWT from header would be done here
    # For now, accepts user_id in body
    user_id = request_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sp_oauth = get_spotify_oauth()
    try:
        token_info = sp_oauth.refresh_access_token(user["spotify_refresh_token"])
        now = datetime.now(timezone.utc).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "spotify_access_token": token_info["access_token"],
                "token_expires_at": datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc).isoformat(),
                "updated_at": now
            }}
        )
        return {"status": "refreshed", "expires_at": token_info["expires_at"]}
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(status_code=401, detail="Token refresh failed")

# ============================================================
# USER ROUTES
# ============================================================

from fastapi import Request

@api_router.get("/users/me")
async def get_me(request: Request):
    """Get current user profile."""
    user = await get_user_from_header(request)
    # Remove sensitive fields
    safe_user = {k: v for k, v in user.items() if k not in ["spotify_access_token", "spotify_refresh_token", "token_expires_at"]}
    return safe_user

@api_router.get("/users/me/premium")
async def check_premium(request: Request):
    """Check if current user has Spotify Premium."""
    user = await get_user_from_header(request)
    return {"is_premium": user.get("is_premium", False), "product": user.get("product", "free")}

# ============================================================
# ROOM ROUTES
# ============================================================

import random
import string

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@api_router.post("/rooms")
async def create_room(room_data: RoomCreate, request: Request):
    """Create a new JAM room."""
    user = await get_user_from_header(request)

    now = datetime.now(timezone.utc).isoformat()
    room_id = str(uuid.uuid4())
    code = generate_room_code()

    # Ensure unique code
    while await db.rooms.find_one({"code": code, "is_active": True}):
        code = generate_room_code()

    room_doc = {
        "id": room_id,
        "name": room_data.name,
        "code": code,
        "host_id": user["id"],
        "host_name": user.get("display_name", "Host"),
        "host_avatar": user.get("avatar_url"),
        "current_track": None,
        "queue": [],
        "participants": [user["id"]],
        "max_participants": 10,
        "is_active": True,
        "created_at": now
    }
    await db.rooms.insert_one(room_doc)

    # Return without _id
    room_doc.pop("_id", None)
    room_doc["participant_count"] = 1
    return room_doc

@api_router.get("/rooms")
async def list_rooms():
    """List all active JAM rooms."""
    rooms = await db.rooms.find({"is_active": True}, {"_id": 0}).to_list(100)
    for room in rooms:
        room["participant_count"] = len(room.get("participants", []))
    return rooms

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    """Get details of a specific room."""
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room["participant_count"] = len(room.get("participants", []))
    return room

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, request: Request):
    """Join a JAM room."""
    user = await get_user_from_header(request)
    room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})

    if not room:
        raise HTTPException(status_code=404, detail="Room not found or inactive")

    if len(room.get("participants", [])) >= room.get("max_participants", 10):
        raise HTTPException(status_code=400, detail="Room is full")

    if user["id"] not in room.get("participants", []):
        await db.rooms.update_one(
            {"id": room_id},
            {"$addToSet": {"participants": user["id"]}}
        )

    updated_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    updated_room["participant_count"] = len(updated_room.get("participants", []))
    return updated_room

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: Request):
    """Leave a JAM room."""
    user = await get_user_from_header(request)

    await db.rooms.update_one(
        {"id": room_id},
        {"$pull": {"participants": user["id"]}}
    )

    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if room and len(room.get("participants", [])) == 0:
        await db.rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})

    return {"status": "left"}

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, request: Request):
    """Delete a JAM room (host only)."""
    user = await get_user_from_header(request)
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can delete this room")

    await db.rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})
    return {"status": "deleted"}

# ============================================================
# PLAYBACK ROUTES
# ============================================================

@api_router.get("/playback/search")
async def search_tracks(q: str, request: Request):
    """Search Spotify tracks."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])

    results = sp.search(q, limit=20, type='track')
    tracks = []
    for item in results.get("tracks", {}).get("items", []):
        tracks.append({
            "uri": item["uri"],
            "name": item["name"],
            "artist": ", ".join(a["name"] for a in item["artists"]),
            "album": item["album"]["name"],
            "album_art": item["album"]["images"][0]["url"] if item["album"]["images"] else None,
            "duration_ms": item["duration_ms"]
        })
    return {"tracks": tracks}

@api_router.post("/playback/play")
async def play_track(play_data: PlayRequest, request: Request):
    """Start playback of a track."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])

    try:
        kwargs = {"uris": [play_data.track_uri], "position_ms": play_data.position_ms}
        if play_data.device_id:
            kwargs["device_id"] = play_data.device_id
        sp.start_playback(**kwargs)
        return {"status": "playing", "track_uri": play_data.track_uri, "position_ms": play_data.position_ms}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/playback/pause")
async def pause_playback(request: Request):
    """Pause playback."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])

    try:
        sp.pause_playback()
        return {"status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/playback/seek")
async def seek_playback(seek_data: SeekRequest, request: Request):
    """Seek to position."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])

    try:
        sp.seek_track(seek_data.position_ms, device_id=seek_data.device_id)
        return {"status": "seeked", "position_ms": seek_data.position_ms}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/playback/state")
async def get_playback_state(request: Request):
    """Get current playback state."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])

    try:
        state = sp.current_playback()
        if not state:
            return {"is_playing": False}
        return {
            "is_playing": state.get("is_playing", False),
            "track": {
                "uri": state["item"]["uri"] if state.get("item") else None,
                "name": state["item"]["name"] if state.get("item") else None,
                "artist": ", ".join(a["name"] for a in state["item"]["artists"]) if state.get("item") else None,
                "album_art": state["item"]["album"]["images"][0]["url"] if state.get("item") and state["item"]["album"]["images"] else None,
                "duration_ms": state["item"]["duration_ms"] if state.get("item") else 0,
            },
            "progress_ms": state.get("progress_ms", 0),
            "device": state.get("device", {})
        }
    except Exception as e:
        return {"is_playing": False, "error": str(e)}

# ============================================================
# WEBSOCKET - JAM ROOM HANDLER
# ============================================================

class RoomManager:
    """Manages WebSocket connections for JAM rooms."""

    def __init__(self):
        # room_id -> {user_id: WebSocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][user_id] = websocket
        logger.info(f"User {user_id} connected to room {room_id}")

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].pop(user_id, None)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        logger.info(f"User {user_id} disconnected from room {room_id}")

    async def broadcast(self, room_id: str, message: dict, exclude_user: str = None):
        if room_id not in self.active_connections:
            return
        disconnected = []
        for user_id, ws in self.active_connections[room_id].items():
            if user_id == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(room_id, uid)

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        if room_id in self.active_connections and user_id in self.active_connections[room_id]:
            try:
                await self.active_connections[room_id][user_id].send_json(message)
            except Exception:
                self.disconnect(room_id, user_id)

    def get_connected_users(self, room_id: str) -> List[str]:
        if room_id in self.active_connections:
            return list(self.active_connections[room_id].keys())
        return []


room_manager = RoomManager()

@app.websocket("/api/ws/jam/{room_id}")
async def websocket_jam(websocket: WebSocket, room_id: str, token: str = Query(None)):
    """WebSocket endpoint for JAM room real-time sync."""

    # Authenticate via JWT token in query param
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_jwt(token)
        user_id = payload["sub"]
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Check room exists
    room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    # Connect
    await room_manager.connect(room_id, user_id, websocket)

    # Get user info for broadcast
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})

    # Notify others
    await room_manager.broadcast(room_id, {
        "type": "participant_joined",
        "user": {"id": user["id"], "display_name": user.get("display_name"), "avatar_url": user.get("avatar_url")}
    }, exclude_user=user_id)

    # Send current room state to new user
    if room.get("current_track"):
        await room_manager.send_to_user(room_id, user_id, {
            "type": "sync",
            **room["current_track"]
        })

    # Send connected participants list
    connected = room_manager.get_connected_users(room_id)
    participants_info = []
    for uid in connected:
        p = await db.users.find_one({"id": uid}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
        if p:
            participants_info.append({"id": p["id"], "display_name": p.get("display_name"), "avatar_url": p.get("avatar_url")})

    await room_manager.send_to_user(room_id, user_id, {
        "type": "participants_list",
        "participants": participants_info
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "play":
                # Host plays a track - broadcast to all
                track_data = {
                    "uri": data.get("track_uri"),
                    "name": data.get("name", ""),
                    "artist": data.get("artist", ""),
                    "album_art": data.get("album_art"),
                    "duration_ms": data.get("duration_ms", 0),
                    "position_ms": data.get("position_ms", 0),
                    "is_playing": True
                }
                await db.rooms.update_one({"id": room_id}, {"$set": {"current_track": track_data}})
                await room_manager.broadcast(room_id, {"type": "sync", **track_data})

            elif msg_type == "pause":
                current = room.get("current_track", {})
                if current:
                    current["is_playing"] = False
                    current["position_ms"] = data.get("position_ms", 0)
                    await db.rooms.update_one({"id": room_id}, {"$set": {"current_track": current}})
                await room_manager.broadcast(room_id, {"type": "pause", "position_ms": data.get("position_ms", 0)})

            elif msg_type == "seek":
                await room_manager.broadcast(room_id, {"type": "seek", "position_ms": data.get("position_ms", 0)})

            elif msg_type == "resume":
                current = room.get("current_track", {})
                if current:
                    current["is_playing"] = True
                    current["position_ms"] = data.get("position_ms", 0)
                    await db.rooms.update_one({"id": room_id}, {"$set": {"current_track": current}})
                await room_manager.broadcast(room_id, {"type": "resume", "position_ms": data.get("position_ms", 0)})

            elif msg_type == "queue_add":
                queue_item = {
                    "uri": data.get("track_uri"),
                    "name": data.get("name", ""),
                    "artist": data.get("artist", ""),
                    "album_art": data.get("album_art"),
                    "added_by": user_id
                }
                await db.rooms.update_one({"id": room_id}, {"$push": {"queue": queue_item}})
                updated_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
                await room_manager.broadcast(room_id, {"type": "queue_updated", "queue": updated_room.get("queue", [])})

            elif msg_type == "chat":
                await room_manager.broadcast(room_id, {
                    "type": "chat_message",
                    "user": {"id": user["id"], "display_name": user.get("display_name"), "avatar_url": user.get("avatar_url")},
                    "message": data.get("message", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            elif msg_type == "heartbeat":
                await room_manager.send_to_user(room_id, user_id, {"type": "heartbeat_ack"})

            # Refresh room state for next iteration
            room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})
            if not room:
                await websocket.close(code=4004, reason="Room closed")
                break

    except WebSocketDisconnect:
        room_manager.disconnect(room_id, user_id)
        await db.rooms.update_one({"id": room_id}, {"$pull": {"participants": user_id}})
        await room_manager.broadcast(room_id, {
            "type": "participant_left",
            "user_id": user_id
        })
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id} in room {room_id}: {e}")
        room_manager.disconnect(room_id, user_id)

# ============================================================
# DOWNLOAD - ZIP PROJECT
# ============================================================

@api_router.get("/download/project")
async def download_project():
    """Generate and download the Notify project as a ZIP file."""
    project_root = Path(__file__).parent.parent
    buffer = io.BytesIO()

    skip_dirs = {'.git', 'node_modules', '__pycache__', '.next', 'build', 'dist', '.emergent', '.cache', 'test_reports'}
    skip_files = {'.DS_Store', 'Thumbs.db'}

    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for file in files:
                if file in skip_files:
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(project_root)
                try:
                    zf.write(file_path, f"Notify/{arcname}")
                except Exception:
                    pass

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=Notify.zip"}
    )

# ============================================================
# HEALTH CHECK
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "Notify API v1.0", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "notify-api"}

# ============================================================
# STARTUP / SHUTDOWN
# ============================================================

@app.on_event("startup")
async def startup():
    """Create MongoDB indexes on startup."""
    await db.users.create_index("spotify_id", unique=True)
    await db.users.create_index("id", unique=True)
    await db.rooms.create_index("id", unique=True)
    await db.rooms.create_index("code")
    await db.rooms.create_index("is_active")
    logger.info("Notify API started. MongoDB indexes created.")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    logger.info("Notify API shutdown.")

# Include router
app.include_router(api_router)
