from fastapi import FastAPI, APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
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
import random
import string

# ============================================================
# CONFIGURATION
# ============================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI')
SPOTIFY_SCOPES = "user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming user-read-currently-playing playlist-read-private playlist-modify-public playlist-modify-private user-top-read"

JWT_SECRET = os.environ.get('JWT_SECRET', 'notify-default-secret-change-me')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_DAYS = int(os.environ.get('JWT_EXPIRATION_DAYS', '7'))

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="Notify API", version="2.0.0")
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

class PlayRequest(BaseModel):
    track_uri: str
    position_ms: int = 0
    device_id: Optional[str] = None

class SeekRequest(BaseModel):
    position_ms: int
    device_id: Optional[str] = None

class PlaylistCreate(BaseModel):
    name: str
    description: str = ""
    is_public: bool = True

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class PlaylistTrackAdd(BaseModel):
    track_uri: str
    name: str
    artist: str
    album_art: Optional[str] = None
    duration_ms: int = 0

class FriendRequest(BaseModel):
    target_user_id: str

# ============================================================
# SPOTIFY SERVICE
# ============================================================

def get_spotify_oauth():
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SPOTIFY_SCOPES,
        show_dialog=True,
        cache_handler=spotipy.cache_handler.MemoryCacheHandler()
    )

async def get_user_spotify_client(user_id: str) -> spotipy.Spotify:
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_expires = datetime.fromisoformat(user.get("token_expires_at", "2000-01-01T00:00:00+00:00"))
    now = datetime.now(timezone.utc)

    if now >= token_expires:
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
# ACTIVITY LOG HELPER
# ============================================================

async def log_activity(user_id: str, action: str, details: dict = None):
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })

# ============================================================
# AUTH ROUTES
# ============================================================

@api_router.get("/auth/login")
async def spotify_login():
    sp_oauth = get_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return {"auth_url": auth_url}

async def _handle_spotify_code(code: str):
    sp_oauth = get_spotify_oauth()
    try:
        token_info = sp_oauth.get_access_token(code, as_dict=True, check_cache=False)
    except Exception as e:
        logger.error(f"Spotify token exchange failed: {e}")
        raise HTTPException(status_code=400, detail=f"Spotify auth failed: {str(e)}")

    sp = spotipy.Spotify(auth=token_info["access_token"])
    try:
        spotify_profile = sp.me()
    except spotipy.exceptions.SpotifyException as e:
        if e.http_status == 403:
            raise HTTPException(status_code=403, detail="Ton compte Spotify n'est pas enregistre dans l'app. Va sur developer.spotify.com/dashboard et ajoute ton email Spotify dans User Management.")
        raise

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
            "bio": "",
            "followers_count": 0,
            "following_count": 0,
            "created_at": now,
            "updated_at": now
        }
        await db.users.insert_one(user_doc)
        await log_activity(user_id, "account_created")

    jwt_token = create_jwt(user_id, spotify_profile["id"])
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})

    return jwt_token, user_data

@api_router.get("/auth/spotify/callback")
async def spotify_callback_redirect(code: str = None, error: str = None):
    if error:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={urllib.parse.quote(error)}"
        return RedirectResponse(url=redirect_url)

    if not code:
        redirect_url = f"{FRONTEND_URL}/auth/callback?error=no_code"
        return RedirectResponse(url=redirect_url)

    try:
        jwt_token, user_data = await _handle_spotify_code(code)
        user_json = urllib.parse.quote(json.dumps(user_data))
        # Truncate URL if too long to avoid browser URL limits
        redirect_url = f"{FRONTEND_URL}/auth/callback?token={jwt_token}&user={user_json}"
        if len(redirect_url) > 4000:
            redirect_url = f"{FRONTEND_URL}/auth/callback?token={jwt_token}"
        return RedirectResponse(url=redirect_url)
    except HTTPException as he:
        error_msg = he.detail if isinstance(he.detail, str) else str(he.detail)
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={urllib.parse.quote(error_msg)}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Spotify callback failed: {e}")
        redirect_url = f"{FRONTEND_URL}/auth/callback?error={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=redirect_url)

@api_router.get("/auth/callback")
async def spotify_callback_json(code: str):
    jwt_token, user_data = await _handle_spotify_code(code)
    return {"access_token": jwt_token, "token_type": "bearer", "user": user_data}

@api_router.post("/auth/refresh")
async def refresh_spotify_token(request_data: dict):
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
        raise HTTPException(status_code=401, detail="Token refresh failed")

# ============================================================
# USER ROUTES
# ============================================================

@api_router.get("/users/me")
async def get_me(request: Request):
    user = await get_user_from_header(request)
    safe_fields = {k: v for k, v in user.items() if k not in ["spotify_access_token", "spotify_refresh_token", "token_expires_at"]}
    return safe_fields

@api_router.get("/users/me/premium")
async def check_premium(request: Request):
    user = await get_user_from_header(request)
    return {"is_premium": user.get("is_premium", False), "product": user.get("product", "free")}

@api_router.get("/users/me/spotify-token")
async def get_spotify_token(request: Request):
    """Get a fresh Spotify access token for the Web Playback SDK."""
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "access_token": fresh_user.get("spotify_access_token"),
        "expires_at": fresh_user.get("token_expires_at")
    }

@api_router.get("/users/me/top-artists")
async def get_top_artists(request: Request):
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        results = sp.current_user_top_artists(limit=10, time_range='medium_term')
        artists = []
        for a in results.get("items", []):
            artists.append({
                "id": a["id"],
                "name": a["name"],
                "image": a["images"][0]["url"] if a.get("images") else None,
                "genres": a.get("genres", [])[:3],
                "popularity": a.get("popularity", 0)
            })
        return {"artists": artists}
    except Exception as e:
        return {"artists": [], "error": str(e)}

@api_router.get("/users/me/top-tracks")
async def get_top_tracks(request: Request):
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        results = sp.current_user_top_tracks(limit=10, time_range='medium_term')
        tracks = []
        for t in results.get("items", []):
            tracks.append({
                "id": t["id"],
                "uri": t["uri"],
                "name": t["name"],
                "artist": ", ".join(a["name"] for a in t["artists"]),
                "album": t["album"]["name"],
                "album_art": t["album"]["images"][0]["url"] if t["album"]["images"] else None,
                "duration_ms": t["duration_ms"]
            })
        return {"tracks": tracks}
    except Exception as e:
        return {"tracks": [], "error": str(e)}

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, request: Request):
    await get_user_from_header(request)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    playlists = await db.playlists.find({"owner_id": user_id, "is_public": True}, {"_id": 0}).to_list(20)
    target["public_playlists"] = playlists
    target["followers_count"] = await db.friendships.count_documents({"target_id": user_id, "status": "accepted"})
    target["following_count"] = await db.friendships.count_documents({"user_id": user_id, "status": "accepted"})
    return target

@api_router.get("/users/search")
async def search_users(q: str, request: Request):
    await get_user_from_header(request)
    users = await db.users.find(
        {"display_name": {"$regex": q, "$options": "i"}},
        {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0}
    ).to_list(20)
    return {"users": users}

# ============================================================
# FRIENDS / SOCIAL ROUTES
# ============================================================

@api_router.post("/friends/request")
async def send_friend_request(data: FriendRequest, request: Request):
    user = await get_user_from_header(request)
    if user["id"] == data.target_user_id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    target = await db.users.find_one({"id": data.target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.friendships.find_one({
        "$or": [
            {"user_id": user["id"], "target_id": data.target_user_id},
            {"user_id": data.target_user_id, "target_id": user["id"]}
        ]
    })
    if existing:
        return {"status": existing.get("status", "exists"), "message": "Friendship already exists"}

    now = datetime.now(timezone.utc).isoformat()
    await db.friendships.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "target_id": data.target_user_id,
        "status": "pending",
        "created_at": now
    })
    await log_activity(user["id"], "friend_request_sent", {"target_id": data.target_user_id, "target_name": target.get("display_name")})
    return {"status": "pending", "message": "Friend request sent"}

@api_router.post("/friends/accept")
async def accept_friend_request(data: FriendRequest, request: Request):
    user = await get_user_from_header(request)
    result = await db.friendships.update_one(
        {"user_id": data.target_user_id, "target_id": user["id"], "status": "pending"},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No pending request found")
    await log_activity(user["id"], "friend_request_accepted", {"from_user_id": data.target_user_id})
    return {"status": "accepted"}

@api_router.post("/friends/reject")
async def reject_friend_request(data: FriendRequest, request: Request):
    user = await get_user_from_header(request)
    await db.friendships.delete_one({"user_id": data.target_user_id, "target_id": user["id"], "status": "pending"})
    return {"status": "rejected"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, request: Request):
    user = await get_user_from_header(request)
    await db.friendships.delete_one({
        "$or": [
            {"user_id": user["id"], "target_id": friend_id},
            {"user_id": friend_id, "target_id": user["id"]}
        ]
    })
    return {"status": "removed"}

@api_router.get("/friends")
async def get_friends(request: Request):
    user = await get_user_from_header(request)
    friendships = await db.friendships.find({
        "$or": [{"user_id": user["id"]}, {"target_id": user["id"]}],
        "status": "accepted"
    }, {"_id": 0}).to_list(100)

    friend_ids = []
    for f in friendships:
        fid = f["target_id"] if f["user_id"] == user["id"] else f["user_id"]
        friend_ids.append(fid)

    friends = []
    for fid in friend_ids:
        friend = await db.users.find_one({"id": fid}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
        if friend:
            friends.append(friend)

    return {"friends": friends}

@api_router.get("/friends/pending")
async def get_pending_requests(request: Request):
    user = await get_user_from_header(request)
    pending = await db.friendships.find({"target_id": user["id"], "status": "pending"}, {"_id": 0}).to_list(50)

    requests = []
    for p in pending:
        requester = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
        if requester:
            requests.append({**p, "requester": requester})

    return {"requests": requests}

@api_router.get("/friends/{user_id}/status")
async def get_friendship_status(user_id: str, request: Request):
    user = await get_user_from_header(request)
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_id": user["id"], "target_id": user_id},
            {"user_id": user_id, "target_id": user["id"]}
        ]
    }, {"_id": 0})
    if not friendship:
        return {"status": "none"}
    return {"status": friendship["status"], "direction": "sent" if friendship["user_id"] == user["id"] else "received"}

# ============================================================
# PLAYLIST ROUTES
# ============================================================

@api_router.post("/playlists")
async def create_playlist(data: PlaylistCreate, request: Request):
    user = await get_user_from_header(request)
    now = datetime.now(timezone.utc).isoformat()
    playlist_id = str(uuid.uuid4())

    playlist_doc = {
        "id": playlist_id,
        "name": data.name,
        "description": data.description,
        "is_public": data.is_public,
        "owner_id": user["id"],
        "owner_name": user.get("display_name", ""),
        "owner_avatar": user.get("avatar_url"),
        "tracks": [],
        "members": [{"user_id": user["id"], "role": "owner", "display_name": user.get("display_name")}],
        "track_count": 0,
        "synced_spotify_id": None,
        "created_at": now,
        "updated_at": now
    }
    await db.playlists.insert_one(playlist_doc)
    playlist_doc.pop("_id", None)
    await log_activity(user["id"], "playlist_created", {"playlist_id": playlist_id, "name": data.name})
    return playlist_doc

@api_router.get("/playlists")
async def list_playlists(request: Request):
    user = await get_user_from_header(request)
    playlists = await db.playlists.find(
        {"$or": [{"owner_id": user["id"]}, {"members.user_id": user["id"]}]},
        {"_id": 0}
    ).to_list(50)
    return {"playlists": playlists}

@api_router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str, request: Request):
    await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist

@api_router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: str, data: PlaylistUpdate, request: Request):
    user = await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    member = next((m for m in playlist.get("members", []) if m["user_id"] == user["id"] and m["role"] in ["owner", "editor"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="No edit permission")

    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.description is not None:
        update_fields["description"] = data.description
    if data.is_public is not None:
        update_fields["is_public"] = data.is_public

    await db.playlists.update_one({"id": playlist_id}, {"$set": update_fields})
    return {"status": "updated"}

@api_router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, request: Request):
    user = await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete")
    await db.playlists.delete_one({"id": playlist_id})
    return {"status": "deleted"}

@api_router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(playlist_id: str, data: PlaylistTrackAdd, request: Request):
    user = await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    member = next((m for m in playlist.get("members", []) if m["user_id"] == user["id"] and m["role"] in ["owner", "editor"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="No edit permission")

    track_entry = {
        "id": str(uuid.uuid4()),
        "track_uri": data.track_uri,
        "name": data.name,
        "artist": data.artist,
        "album_art": data.album_art,
        "duration_ms": data.duration_ms,
        "added_by": user["id"],
        "added_by_name": user.get("display_name", ""),
        "added_at": datetime.now(timezone.utc).isoformat()
    }

    await db.playlists.update_one(
        {"id": playlist_id},
        {"$push": {"tracks": track_entry}, "$inc": {"track_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_activity(user["id"], "track_added", {"playlist_id": playlist_id, "track_name": data.name})
    return track_entry

@api_router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(playlist_id: str, track_id: str, request: Request):
    user = await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    member = next((m for m in playlist.get("members", []) if m["user_id"] == user["id"] and m["role"] in ["owner", "editor"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="No edit permission")

    await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"tracks": {"id": track_id}}, "$inc": {"track_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "removed"}

@api_router.post("/playlists/{playlist_id}/members")
async def add_playlist_member(playlist_id: str, request: Request):
    user = await get_user_from_header(request)
    body = await request.json()
    target_user_id = body.get("user_id")
    role = body.get("role", "editor")

    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can add members")

    target = await db.users.find_one({"id": target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    already = next((m for m in playlist.get("members", []) if m["user_id"] == target_user_id), None)
    if already:
        return {"status": "already_member"}

    await db.playlists.update_one(
        {"id": playlist_id},
        {"$push": {"members": {"user_id": target_user_id, "role": role, "display_name": target.get("display_name", "")}}}
    )
    return {"status": "added"}

@api_router.post("/playlists/{playlist_id}/sync-to-spotify")
async def sync_playlist_to_spotify(playlist_id: str, request: Request):
    user = await get_user_from_header(request)
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    sp = await get_user_spotify_client(user["id"])
    try:
        track_uris = [t["track_uri"] for t in playlist.get("tracks", [])]
        if playlist.get("synced_spotify_id"):
            sp.playlist_replace_items(playlist["synced_spotify_id"], track_uris[:100])
            return {"status": "synced", "spotify_id": playlist["synced_spotify_id"]}
        else:
            sp_user = sp.me()
            new_pl = sp.user_playlist_create(sp_user["id"], playlist["name"], public=playlist.get("is_public", True), description=playlist.get("description", ""))
            if track_uris:
                sp.playlist_add_items(new_pl["id"], track_uris[:100])
            await db.playlists.update_one({"id": playlist_id}, {"$set": {"synced_spotify_id": new_pl["id"]}})
            return {"status": "created_and_synced", "spotify_id": new_pl["id"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/playlists/import-spotify")
async def import_spotify_playlists(request: Request):
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        results = sp.current_user_playlists(limit=50)
        playlists = []
        for p in results.get("items", []):
            playlists.append({
                "spotify_id": p["id"],
                "name": p["name"],
                "description": p.get("description", ""),
                "image": p["images"][0]["url"] if p.get("images") else None,
                "track_count": p["tracks"]["total"],
                "owner": p["owner"]["display_name"],
                "is_collaborative": p.get("collaborative", False)
            })
        return {"playlists": playlists}
    except Exception as e:
        return {"playlists": [], "error": str(e)}

@api_router.post("/playlists/import-spotify/{spotify_id}")
async def import_spotify_playlist(spotify_id: str, request: Request):
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        sp_playlist = sp.playlist(spotify_id)
        now = datetime.now(timezone.utc).isoformat()
        playlist_id = str(uuid.uuid4())

        tracks = []
        for item in sp_playlist["tracks"]["items"][:100]:
            t = item.get("track")
            if not t:
                continue
            tracks.append({
                "id": str(uuid.uuid4()),
                "track_uri": t["uri"],
                "name": t["name"],
                "artist": ", ".join(a["name"] for a in t["artists"]),
                "album_art": t["album"]["images"][0]["url"] if t["album"]["images"] else None,
                "duration_ms": t["duration_ms"],
                "added_by": user["id"],
                "added_by_name": user.get("display_name", ""),
                "added_at": now
            })

        playlist_doc = {
            "id": playlist_id,
            "name": sp_playlist["name"],
            "description": sp_playlist.get("description", ""),
            "is_public": True,
            "owner_id": user["id"],
            "owner_name": user.get("display_name", ""),
            "owner_avatar": user.get("avatar_url"),
            "tracks": tracks,
            "members": [{"user_id": user["id"], "role": "owner", "display_name": user.get("display_name")}],
            "track_count": len(tracks),
            "synced_spotify_id": spotify_id,
            "created_at": now,
            "updated_at": now
        }
        await db.playlists.insert_one(playlist_doc)
        playlist_doc.pop("_id", None)
        return playlist_doc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# ACTIVITY ROUTES
# ============================================================

@api_router.get("/activity")
async def get_activity_feed(request: Request):
    user = await get_user_from_header(request)

    friendships = await db.friendships.find({
        "$or": [{"user_id": user["id"]}, {"target_id": user["id"]}],
        "status": "accepted"
    }, {"_id": 0}).to_list(100)

    friend_ids = [user["id"]]
    for f in friendships:
        fid = f["target_id"] if f["user_id"] == user["id"] else f["user_id"]
        friend_ids.append(fid)

    activities = await db.activity_log.find(
        {"user_id": {"$in": friend_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    for act in activities:
        u = await db.users.find_one({"id": act["user_id"]}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
        if u:
            act["user_display_name"] = u.get("display_name", "")
            act["user_avatar"] = u.get("avatar_url")

    return {"activities": activities}

@api_router.get("/activity/me")
async def get_my_activity(request: Request):
    user = await get_user_from_header(request)
    activities = await db.activity_log.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    return {"activities": activities}

# ============================================================
# ROOM ROUTES
# ============================================================

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@api_router.post("/rooms")
async def create_room(room_data: RoomCreate, request: Request):
    user = await get_user_from_header(request)
    now = datetime.now(timezone.utc).isoformat()
    room_id = str(uuid.uuid4())
    code = generate_room_code()

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
    room_doc.pop("_id", None)
    room_doc["participant_count"] = 1
    await log_activity(user["id"], "room_created", {"room_id": room_id, "room_name": room_data.name})
    return room_doc

@api_router.get("/rooms")
async def list_rooms():
    rooms = await db.rooms.find({"is_active": True}, {"_id": 0}).to_list(100)
    for room in rooms:
        room["participant_count"] = len(room.get("participants", []))
    return rooms

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room["participant_count"] = len(room.get("participants", []))
    return room

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, request: Request):
    user = await get_user_from_header(request)
    room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found or inactive")
    if len(room.get("participants", [])) >= room.get("max_participants", 10):
        raise HTTPException(status_code=400, detail="Room is full")
    if user["id"] not in room.get("participants", []):
        await db.rooms.update_one({"id": room_id}, {"$addToSet": {"participants": user["id"]}})
    updated_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    updated_room["participant_count"] = len(updated_room.get("participants", []))
    await log_activity(user["id"], "room_joined", {"room_id": room_id})
    return updated_room

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: Request):
    user = await get_user_from_header(request)
    await db.rooms.update_one({"id": room_id}, {"$pull": {"participants": user["id"]}})
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if room and len(room.get("participants", [])) == 0:
        await db.rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})
    return {"status": "left"}

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, request: Request):
    user = await get_user_from_header(request)
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can delete this room")
    await db.rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})
    return {"status": "deleted"}

@api_router.get("/rooms/join-by-code/{code}")
async def get_room_by_code(code: str):
    room = await db.rooms.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room["participant_count"] = len(room.get("participants", []))
    return room

# ============================================================
# PLAYBACK ROUTES
# ============================================================

@api_router.get("/playback/search")
async def search_tracks(q: str, request: Request):
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
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        sp.pause_playback()
        return {"status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/playback/seek")
async def seek_playback(seek_data: SeekRequest, request: Request):
    user = await get_user_from_header(request)
    sp = await get_user_spotify_client(user["id"])
    try:
        sp.seek_track(seek_data.position_ms, device_id=seek_data.device_id)
        return {"status": "seeked", "position_ms": seek_data.position_ms}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/playback/state")
async def get_playback_state(request: Request):
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
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][user_id] = websocket

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].pop(user_id, None)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

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
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_jwt(token)
        user_id = payload["sub"]
    except HTTPException:
        await websocket.close(code=4001, reason="Invalid token")
        return

    room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    await room_manager.connect(room_id, user_id, websocket)

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})

    await room_manager.broadcast(room_id, {
        "type": "participant_joined",
        "user": {"id": user["id"], "display_name": user.get("display_name"), "avatar_url": user.get("avatar_url")}
    }, exclude_user=user_id)

    if room.get("current_track"):
        await room_manager.send_to_user(room_id, user_id, {"type": "sync", **room["current_track"]})

    connected = room_manager.get_connected_users(room_id)
    participants_info = []
    for uid in connected:
        p = await db.users.find_one({"id": uid}, {"_id": 0, "spotify_access_token": 0, "spotify_refresh_token": 0, "token_expires_at": 0})
        if p:
            participants_info.append({"id": p["id"], "display_name": p.get("display_name"), "avatar_url": p.get("avatar_url")})

    await room_manager.send_to_user(room_id, user_id, {"type": "participants_list", "participants": participants_info})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "play":
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

            room = await db.rooms.find_one({"id": room_id, "is_active": True}, {"_id": 0})
            if not room:
                await websocket.close(code=4004, reason="Room closed")
                break

    except WebSocketDisconnect:
        room_manager.disconnect(room_id, user_id)
        await db.rooms.update_one({"id": room_id}, {"$pull": {"participants": user_id}})
        await room_manager.broadcast(room_id, {"type": "participant_left", "user_id": user_id})
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id} in room {room_id}: {e}")
        room_manager.disconnect(room_id, user_id)

# ============================================================
# DOWNLOAD - ZIP PROJECT
# ============================================================

@api_router.get("/download/project")
async def download_project():
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
    return StreamingResponse(buffer, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=Notify.zip"})

# ============================================================
# HEALTH CHECK
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "Notify API v2.0", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "service": "notify-api"}

# ============================================================
# STARTUP / SHUTDOWN
# ============================================================

@app.on_event("startup")
async def startup():
    await db.users.create_index("spotify_id", unique=True)
    await db.users.create_index("id", unique=True)
    await db.rooms.create_index("id", unique=True)
    await db.rooms.create_index("code")
    await db.rooms.create_index("is_active")
    await db.playlists.create_index("id", unique=True)
    await db.playlists.create_index("owner_id")
    await db.friendships.create_index([("user_id", 1), ("target_id", 1)])
    await db.friendships.create_index("status")
    await db.activity_log.create_index("user_id")
    await db.activity_log.create_index("created_at")
    logger.info("Notify API v2.0 started. MongoDB indexes created.")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    logger.info("Notify API shutdown.")

app.include_router(api_router)
