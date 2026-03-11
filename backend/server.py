from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import uuid
from datetime import datetime, timezone
import jwt
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import zipfile
import io
import re
import urllib.parse
import requests as sync_requests
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

# Spotify config
SPOTIFY_CLIENT_ID = os.environ['SPOTIFY_CLIENT_ID']
SPOTIFY_CLIENT_SECRET = os.environ['SPOTIFY_CLIENT_SECRET']
SPOTIFY_REDIRECT_URI = os.environ['SPOTIFY_REDIRECT_URI']
JWT_SECRET = os.environ['JWT_SECRET']
FRONTEND_URL = os.environ['FRONTEND_URL']

SPOTIFY_SCOPES = "user-read-private user-read-email user-read-playback-state user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative streaming user-modify-playback-state"

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Socket.IO Setup ───
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', logger=False, engineio_logger=False)

# FastAPI app
fastapi_app = FastAPI()
api_router = APIRouter(prefix="/api")

# ─── Models ───
class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    spotify_id: str
    username: str
    avatar: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    subscription: Optional[str] = None
    created_at: str

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class CreateRoomRequest(BaseModel):
    name: str

class JoinRoomRequest(BaseModel):
    room_id: str

class AddToQueueRequest(BaseModel):
    room_id: str
    track_id: str
    track_name: str
    artist: str
    album: str = ""
    image: Optional[str] = None
    duration_ms: int = 0
    external_url: Optional[str] = None

class VoteRequest(BaseModel):
    room_id: str
    queue_item_id: str

class SearchTrackRequest(BaseModel):
    query: str


# ─── Notification Helper ───
async def create_notification(user_id: str, notif_type: str, source_user_id: str, content: str, room_id: str = None, track_id: str = None, track_image: str = None):
    """Create a notification and push via Socket.IO"""
    notif_id = str(uuid.uuid4())
    source_user = await db.users.find_one({"id": source_user_id}, {"_id": 0})
    notif = {
        "id": notif_id,
        "user_id": user_id,
        "type": notif_type,
        "source_user_id": source_user_id,
        "source_username": source_user.get("username", "Unknown") if source_user else "Unknown",
        "source_avatar": source_user.get("avatar") if source_user else None,
        "room_id": room_id,
        "track_id": track_id,
        "track_image": track_image,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)
    # Push via Socket.IO to user
    await sio.emit("new_notification", notif, room=f"user_{user_id}")
    return notif


# ─── Auth Helpers ───
def get_spotify_oauth():
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SPOTIFY_SCOPES,
        show_dialog=True
    )

def create_jwt(user_id: str, spotify_id: str) -> str:
    payload = {
        "user_id": user_id,
        "spotify_id": spotify_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_from_request(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = auth_header.split("Bearer ")[1]
    payload = decode_jwt(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_spotify_client(token_info: dict):
    return spotipy.Spotify(auth=token_info["access_token"])

async def get_valid_spotify_token(user_id: str):
    token_doc = await db.spotify_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Spotify not connected. Please login again.")
    sp_oauth = get_spotify_oauth()
    token_info = {
        "access_token": token_doc["access_token"],
        "refresh_token": token_doc["refresh_token"],
        "expires_at": token_doc["expires_at"],
        "token_type": token_doc.get("token_type", "Bearer"),
        "scope": token_doc.get("scope", ""),
    }
    if sp_oauth.is_token_expired(token_info):
        try:
            new_token = sp_oauth.refresh_access_token(token_doc["refresh_token"])
            await db.spotify_tokens.update_one(
                {"user_id": user_id},
                {"$set": {
                    "access_token": new_token["access_token"],
                    "refresh_token": new_token.get("refresh_token", token_doc["refresh_token"]),
                    "expires_at": new_token["expires_at"],
                    "scope": new_token.get("scope", ""),
                }}
            )
            token_info = new_token
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            raise HTTPException(status_code=401, detail="Spotify session expired. Please login again.")
    return token_info

async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        return user
    except Exception:
        return None


# ─── Root ───
@api_router.get("/")
async def root():
    return {"message": "Notify API"}

# ─── Status ───
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# ─── Auth ───
@api_router.get("/auth/spotify/login")
async def spotify_login():
    sp_oauth = get_spotify_oauth()
    auth_url = sp_oauth.get_authorize_url()
    return {"auth_url": auth_url}

@api_router.get("/auth/spotify/callback")
async def spotify_callback(code: str = None, error: str = None):
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error={error}")
    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=no_code")
    try:
        sp_oauth = get_spotify_oauth()
        token_info = sp_oauth.get_access_token(code, as_dict=True)
        sp = spotipy.Spotify(auth=token_info["access_token"])
        spotify_user = sp.me()
        spotify_id = spotify_user.get("id", "")
        display_name = spotify_user.get("display_name", spotify_id)
        email = spotify_user.get("email")
        images = spotify_user.get("images", [])
        avatar = images[0]["url"] if images else None
        country = spotify_user.get("country")
        subscription = spotify_user.get("product", "free")
        existing_user = await db.users.find_one({"spotify_id": spotify_id}, {"_id": 0})
        if existing_user:
            await db.users.update_one(
                {"spotify_id": spotify_id},
                {"$set": {
                    "username": display_name,
                    "avatar": avatar,
                    "email": email,
                    "country": country,
                    "subscription": subscription,
                }}
            )
            user_id = existing_user["id"]
        else:
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "spotify_id": spotify_id,
                "username": display_name,
                "avatar": avatar,
                "email": email,
                "country": country,
                "subscription": subscription,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user_doc)
        await db.spotify_tokens.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "access_token": token_info["access_token"],
                "refresh_token": token_info.get("refresh_token", ""),
                "expires_at": token_info.get("expires_at", 0),
                "scope": token_info.get("scope", ""),
                "token_type": token_info.get("token_type", "Bearer"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )
        token = create_jwt(user_id, spotify_id)
        return RedirectResponse(url=f"{FRONTEND_URL}/callback?token={token}")
    except Exception as e:
        logger.error(f"Spotify callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=auth_failed")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user(request: Request):
    user = await get_user_from_request(request)
    return UserResponse(**user)


# ─── Spotify Data Endpoints ───
@api_router.get("/spotify/top-artists")
async def get_top_artists(request: Request):
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    sp = get_spotify_client(token_info)
    try:
        results = sp.current_user_top_artists(limit=10, time_range="medium_term")
        artists = []
        for artist in results.get("items", []):
            artists.append({
                "id": artist["id"],
                "name": artist["name"],
                "popularity": artist.get("popularity", 0),
                "genres": artist.get("genres", [])[:3],
                "image": artist["images"][0]["url"] if artist.get("images") else None,
                "external_url": artist.get("external_urls", {}).get("spotify"),
            })
        return {"artists": artists}
    except Exception as e:
        logger.error(f"Top artists error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch top artists")

@api_router.get("/spotify/top-tracks")
async def get_top_tracks(request: Request):
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    sp = get_spotify_client(token_info)
    try:
        results = sp.current_user_top_tracks(limit=10, time_range="medium_term")
        tracks = []
        for track in results.get("items", []):
            tracks.append({
                "id": track["id"],
                "name": track["name"],
                "artist": ", ".join(a["name"] for a in track.get("artists", [])),
                "album": track.get("album", {}).get("name", ""),
                "image": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "duration_ms": track.get("duration_ms", 0),
                "external_url": track.get("external_urls", {}).get("spotify"),
            })
        return {"tracks": tracks}
    except Exception as e:
        logger.error(f"Top tracks error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch top tracks")

@api_router.get("/spotify/recently-played")
async def get_recently_played(request: Request):
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    sp = get_spotify_client(token_info)
    try:
        results = sp.current_user_recently_played(limit=15)
        tracks = []
        for item in results.get("items", []):
            track = item.get("track", {})
            tracks.append({
                "id": track["id"],
                "name": track["name"],
                "artist": ", ".join(a["name"] for a in track.get("artists", [])),
                "album": track.get("album", {}).get("name", ""),
                "image": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "played_at": item.get("played_at", ""),
                "external_url": track.get("external_urls", {}).get("spotify"),
            })
        return {"tracks": tracks}
    except Exception as e:
        logger.error(f"Recently played error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recently played")

@api_router.get("/spotify/playlists")
async def get_playlists(request: Request):
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    sp = get_spotify_client(token_info)
    try:
        results = sp.current_user_playlists(limit=20)
        playlists = []
        for pl in results.get("items", []):
            playlists.append({
                "id": pl["id"],
                "name": pl["name"],
                "image": pl["images"][0]["url"] if pl.get("images") else None,
                "tracks_total": pl.get("tracks", {}).get("total", 0),
                "owner": pl.get("owner", {}).get("display_name", ""),
                "public": pl.get("public", False),
                "external_url": pl.get("external_urls", {}).get("spotify"),
            })
        return {"playlists": playlists}
    except Exception as e:
        logger.error(f"Playlists error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch playlists")

# ─── Spotify Search ───
@api_router.get("/spotify/search")
async def search_spotify_tracks(request: Request, q: str = ""):
    if not q.strip():
        return {"tracks": []}
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    sp = get_spotify_client(token_info)
    try:
        results = sp.search(q=q, type="track", limit=10)
        tracks = []
        for track in results.get("tracks", {}).get("items", []):
            tracks.append({
                "id": track["id"],
                "name": track["name"],
                "artist": ", ".join(a["name"] for a in track.get("artists", [])),
                "album": track.get("album", {}).get("name", ""),
                "image": track["album"]["images"][0]["url"] if track.get("album", {}).get("images") else None,
                "duration_ms": track.get("duration_ms", 0),
                "external_url": track.get("external_urls", {}).get("spotify"),
            })
        return {"tracks": tracks}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search tracks")


# ─── YouTube Search (Alternative Player) ───
def search_youtube_video(query: str):
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={encoded_query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        response = sync_requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
        if not video_ids:
            return None
        video_id = video_ids[0]
        title_match = re.search(r'"title":\{"runs":\[\{"text":"([^"]+)"\}', response.text)
        title = title_match.group(1) if title_match else query
        channel_matches = re.findall(r'"ownerText":\{"runs":\[\{"text":"([^"]+)"', response.text)
        channel = channel_matches[0] if channel_matches else ""
        duration_matches = re.findall(r'"simpleText":"(\d+:\d+(?::\d+)?)"', response.text)
        duration = duration_matches[0] if duration_matches else ""
        return {
            "video_id": video_id,
            "title": title,
            "channel": channel,
            "duration": duration,
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
            "url": f"https://www.youtube.com/watch?v={video_id}",
        }
    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        return None

@api_router.get("/player/search-youtube")
async def search_youtube(track_name: str, artist_name: str):
    if not track_name.strip() or not artist_name.strip():
        return {"found": False, "message": "Aucune version alternative disponible"}
    query = f"{track_name} {artist_name} official audio"
    result = search_youtube_video(query)
    if result:
        title_lower = result["title"].lower()
        track_lower = track_name.lower()
        artist_lower = artist_name.lower()
        track_words = [w for w in track_lower.split() if len(w) > 2]
        artist_words = [w for w in artist_lower.split() if len(w) > 2]
        has_match = any(w in title_lower for w in track_words) or any(w in title_lower for w in artist_words)
        if has_match:
            return {"found": True, **result}
    return {"found": False, "message": "Aucune version alternative disponible"}

@api_router.get("/player/spotify-token")
async def get_spotify_access_token(request: Request):
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    return {
        "access_token": token_info["access_token"],
        "subscription": user.get("subscription", "free"),
    }


# ─── LISTENING ROOMS ───

@api_router.post("/rooms/create")
async def create_room(body: CreateRoomRequest, request: Request):
    user = await get_user_from_request(request)
    room_id = str(uuid.uuid4())[:8]
    room = {
        "id": room_id,
        "name": body.name.strip(),
        "host_id": user["id"],
        "host_name": user.get("username", "Unknown"),
        "host_avatar": user.get("avatar"),
        "current_track": None,
        "is_playing": False,
        "play_started_at": None,
        "play_position_ms": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rooms.insert_one(room)
    # Host auto-joins
    await db.room_participants.insert_one({
        "room_id": room_id,
        "user_id": user["id"],
        "username": user.get("username", "Unknown"),
        "avatar": user.get("avatar"),
        "subscription": user.get("subscription", "free"),
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
    room.pop("_id", None)
    # Notify: room created (broadcast to all connected users could be done, but for now we skip self-notification)
    return room

@api_router.post("/rooms/join")
async def join_room(body: JoinRoomRequest, request: Request):
    user = await get_user_from_request(request)
    room = await db.rooms.find_one({"id": body.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    existing = await db.room_participants.find_one({"room_id": body.room_id, "user_id": user["id"]})
    if not existing:
        await db.room_participants.insert_one({
            "room_id": body.room_id,
            "user_id": user["id"],
            "username": user.get("username", "Unknown"),
            "avatar": user.get("avatar"),
            "subscription": user.get("subscription", "free"),
            "joined_at": datetime.now(timezone.utc).isoformat(),
        })
        # Notify host that someone joined
        if room.get("host_id") and room["host_id"] != user["id"]:
            await create_notification(
                user_id=room["host_id"],
                notif_type="room_joined",
                source_user_id=user["id"],
                content=f'{user.get("username", "Someone")} a rejoint votre room "{room.get("name", "")}"',
                room_id=body.room_id,
            )
    return {"message": "Joined room", "room": room}

@api_router.post("/rooms/leave")
async def leave_room(body: JoinRoomRequest, request: Request):
    user = await get_user_from_request(request)
    await db.room_participants.delete_one({"room_id": body.room_id, "user_id": user["id"]})
    # If host leaves, delete room
    room = await db.rooms.find_one({"id": body.room_id}, {"_id": 0})
    if room and room.get("host_id") == user["id"]:
        await db.rooms.delete_one({"id": body.room_id})
        await db.room_participants.delete_many({"room_id": body.room_id})
        await db.room_queue.delete_many({"room_id": body.room_id})
        return {"message": "Room deleted (host left)"}
    return {"message": "Left room"}

@api_router.get("/rooms/list")
async def list_rooms(request: Request):
    await get_user_from_request(request)
    rooms = await db.rooms.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for room in rooms:
        count = await db.room_participants.count_documents({"room_id": room["id"]})
        room["participant_count"] = count
    return {"rooms": rooms}

@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str, request: Request):
    await get_user_from_request(request)
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    participants = await db.room_participants.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    room["participants"] = participants
    room["queue"] = queue
    return room

@api_router.post("/rooms/queue/add")
async def add_to_queue(body: AddToQueueRequest, request: Request):
    user = await get_user_from_request(request)
    room = await db.rooms.find_one({"id": body.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    # Check if track already in queue
    existing = await db.room_queue.find_one({"room_id": body.room_id, "track_id": body.track_id})
    if existing:
        raise HTTPException(status_code=400, detail="Track already in queue")
    queue_item_id = str(uuid.uuid4())[:8]
    queue_item = {
        "id": queue_item_id,
        "room_id": body.room_id,
        "track_id": body.track_id,
        "track_name": body.track_name,
        "artist": body.artist,
        "album": body.album,
        "image": body.image,
        "duration_ms": body.duration_ms,
        "external_url": body.external_url,
        "added_by": user["id"],
        "added_by_name": user.get("username", "Unknown"),
        "votes": 0,
        "voted_by": [],
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.room_queue.insert_one(queue_item)
    queue_item.pop("_id", None)
    # Notify room participants about new track
    room_for_notif = await db.rooms.find_one({"id": body.room_id}, {"_id": 0})
    participants_list = await db.room_participants.find({"room_id": body.room_id}, {"_id": 0}).to_list(100)
    for p in participants_list:
        if p["user_id"] != user["id"]:
            await create_notification(
                user_id=p["user_id"],
                notif_type="track_added",
                source_user_id=user["id"],
                content=f'{user.get("username", "Someone")} a ajouté "{body.track_name}" dans "{room_for_notif.get("name", "la room")}"',
                room_id=body.room_id,
                track_id=body.track_id,
                track_image=body.image,
            )
    # Search for YouTube alternative
    yt_result = search_youtube_video(f"{body.track_name} {body.artist} official audio")
    if yt_result:
        title_lower = yt_result["title"].lower()
        track_words = [w for w in body.track_name.lower().split() if len(w) > 2]
        artist_words = [w for w in body.artist.lower().split() if len(w) > 2]
        has_match = any(w in title_lower for w in track_words) or any(w in title_lower for w in artist_words)
        if has_match:
            await db.track_alternatives.update_one(
                {"track_id": body.track_id},
                {"$set": {
                    "track_id": body.track_id,
                    "video_id": yt_result["video_id"],
                    "url": yt_result["url"],
                    "platform": "youtube",
                    "title": yt_result["title"],
                    "channel": yt_result["channel"],
                    "thumbnail": yt_result["thumbnail"],
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True
            )
            queue_item["youtube_video_id"] = yt_result["video_id"]
    return queue_item

@api_router.post("/rooms/queue/vote")
async def vote_queue_item(body: VoteRequest, request: Request):
    user = await get_user_from_request(request)
    item = await db.room_queue.find_one({"id": body.queue_item_id, "room_id": body.room_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    voted_by = item.get("voted_by", [])
    if user["id"] in voted_by:
        # Unvote
        await db.room_queue.update_one(
            {"id": body.queue_item_id},
            {"$inc": {"votes": -1}, "$pull": {"voted_by": user["id"]}}
        )
        return {"message": "Vote removed", "votes": item["votes"] - 1}
    else:
        await db.room_queue.update_one(
            {"id": body.queue_item_id},
            {"$inc": {"votes": 1}, "$push": {"voted_by": user["id"]}}
        )
        # Notify the person who added the track
        if item.get("added_by") and item["added_by"] != user["id"]:
            await create_notification(
                user_id=item["added_by"],
                notif_type="vote",
                source_user_id=user["id"],
                content=f'{user.get("username", "Someone")} a voté pour "{item.get("track_name", "un morceau")}"',
                room_id=body.room_id,
                track_id=item.get("track_id"),
                track_image=item.get("image"),
            )
        return {"message": "Voted", "votes": item["votes"] + 1}

@api_router.get("/rooms/{room_id}/queue")
async def get_room_queue(room_id: str, request: Request):
    await get_user_from_request(request)
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    # Attach YouTube alternatives
    for item in queue:
        alt = await db.track_alternatives.find_one({"track_id": item["track_id"]}, {"_id": 0})
        if alt:
            item["youtube_video_id"] = alt.get("video_id")
    return {"queue": queue}

@api_router.get("/rooms/{room_id}/alternative/{track_id}")
async def get_track_alternative(room_id: str, track_id: str, request: Request):
    await get_user_from_request(request)
    alt = await db.track_alternatives.find_one({"track_id": track_id}, {"_id": 0})
    if alt:
        return {"found": True, **alt}
    return {"found": False}


# ─── ZIP Download Endpoint ───
@api_router.get("/download/project-zip")
async def download_project_zip():
    zip_buffer = io.BytesIO()
    project_root = ROOT_DIR.parent
    excluded_dirs = {'.git', 'node_modules', '__pycache__', '.next', 'build', 'dist', '.emergent', 'test_reports', 'memory', '.venv', 'venv', '.cache', 'logs'}
    excluded_files = {'.DS_Store', 'Thumbs.db', 'yarn.lock', '.gitignore'}
    excluded_extensions = {'.pyc', '.pyo', '.log'}
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            for file in files:
                if file in excluded_files:
                    continue
                if any(file.endswith(ext) for ext in excluded_extensions):
                    continue
                file_path = Path(root) / file
                arcname = Path("notify") / file_path.relative_to(project_root)
                try:
                    zf.write(file_path, arcname)
                except Exception:
                    pass
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=notify-project.zip"}
    )

@api_router.get("/download")
async def download_redirect():
    """Redirect /api/download to /api/download/project-zip"""
    return RedirectResponse(url="/api/download/project-zip", status_code=302)


# ─── URLs Info ───
@api_router.get("/info/urls")
async def get_urls():
    return {
        "frontend_url": FRONTEND_URL,
        "backend_api": f"{FRONTEND_URL}/api",
        "spotify_login": f"{FRONTEND_URL}/api/auth/spotify/login",
        "spotify_callback": SPOTIFY_REDIRECT_URI,
        "zip_download": f"{FRONTEND_URL}/api/download/project-zip",
    }


# ─── NOTIFICATIONS ───
@api_router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, request: Request):
    user = await get_user_from_request(request)
    if user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    notifications = await db.notifications.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"notifications": notifications}

@api_router.post("/notifications/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str, request: Request):
    user = await get_user_from_request(request)
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    user = await get_user_from_request(request)
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}

@api_router.get("/notifications/unread-count/{user_id}")
async def get_unread_count(user_id: str, request: Request):
    user = await get_user_from_request(request)
    if user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    count = await db.notifications.count_documents({"user_id": user_id, "read": False})
    return {"count": count}


# Include router
fastapi_app.include_router(api_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Socket.IO Events ───
# In-memory room state for real-time sync
room_sids = {}  # room_id -> set of sids
sid_info = {}  # sid -> {user_id, room_id, username, avatar}

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")

@sio.event
async def authenticate(sid, data):
    """Authenticate user and join their notification room"""
    token = data.get("token", "")
    user = await get_user_from_token(token)
    if user:
        user_room = f"user_{user['id']}"
        sio.enter_room(sid, user_room)
        logger.info(f"User {user['id']} authenticated on socket {sid}, joined room {user_room}")
        # Send unread count
        count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
        await sio.emit("unread_count", {"count": count}, to=sid)
    else:
        await sio.emit("error", {"message": "Authentication failed"}, to=sid)

@sio.event
async def disconnect(sid):
    info = sid_info.pop(sid, None)
    if info:
        room_id = info.get("room_id")
        if room_id and room_id in room_sids:
            room_sids[room_id].discard(sid)
            sio.leave_room(sid, room_id)
            # Notify others
            participants = await _get_room_participants(room_id)
            await sio.emit("participants_update", {"participants": participants}, room=room_id)
    logger.info(f"Socket disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    token = data.get("token", "")
    room_id = data.get("room_id", "")
    user = await get_user_from_token(token)
    if not user or not room_id:
        await sio.emit("error", {"message": "Invalid token or room"}, to=sid)
        return
    # Join socket.io room
    sio.enter_room(sid, room_id)
    if room_id not in room_sids:
        room_sids[room_id] = set()
    room_sids[room_id].add(sid)
    sid_info[sid] = {
        "user_id": user["id"],
        "room_id": room_id,
        "username": user.get("username", "Unknown"),
        "avatar": user.get("avatar"),
    }
    # Ensure in DB participants
    existing = await db.room_participants.find_one({"room_id": room_id, "user_id": user["id"]})
    if not existing:
        await db.room_participants.insert_one({
            "room_id": room_id,
            "user_id": user["id"],
            "username": user.get("username", "Unknown"),
            "avatar": user.get("avatar"),
            "subscription": user.get("subscription", "free"),
            "joined_at": datetime.now(timezone.utc).isoformat(),
        })
    # Send current room state
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    for item in queue:
        alt = await db.track_alternatives.find_one({"track_id": item["track_id"]}, {"_id": 0})
        if alt:
            item["youtube_video_id"] = alt.get("video_id")
    participants = await _get_room_participants(room_id)
    await sio.emit("room_state", {
        "room": room,
        "queue": queue,
        "participants": participants,
    }, to=sid)
    # Notify everyone of updated participants
    await sio.emit("participants_update", {"participants": participants}, room=room_id)

@sio.event
async def leave_room(sid, data):
    info = sid_info.pop(sid, None)
    if info:
        room_id = info.get("room_id")
        if room_id and room_id in room_sids:
            room_sids[room_id].discard(sid)
            sio.leave_room(sid, room_id)
            participants = await _get_room_participants(room_id)
            await sio.emit("participants_update", {"participants": participants}, room=room_id)

@sio.event
async def queue_add(sid, data):
    """Track added to queue - broadcast updated queue"""
    room_id = data.get("room_id")
    if not room_id:
        return
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    for item in queue:
        alt = await db.track_alternatives.find_one({"track_id": item["track_id"]}, {"_id": 0})
        if alt:
            item["youtube_video_id"] = alt.get("video_id")
    await sio.emit("queue_update", {"queue": queue}, room=room_id)

@sio.event
async def queue_vote(sid, data):
    """Vote changed - broadcast updated queue"""
    room_id = data.get("room_id")
    if not room_id:
        return
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    for item in queue:
        alt = await db.track_alternatives.find_one({"track_id": item["track_id"]}, {"_id": 0})
        if alt:
            item["youtube_video_id"] = alt.get("video_id")
    await sio.emit("queue_update", {"queue": queue}, room=room_id)

@sio.event
async def play_track(sid, data):
    """Host plays a track - sync to all"""
    room_id = data.get("room_id")
    track = data.get("track")
    info = sid_info.get(sid)
    if not info or not room_id:
        return
    # Verify host
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or room.get("host_id") != info["user_id"]:
        await sio.emit("error", {"message": "Only the host can control playback"}, to=sid)
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {
            "current_track": track,
            "is_playing": True,
            "play_started_at": now,
            "play_position_ms": 0,
        }}
    )
    # Get YouTube alternative for the track
    youtube_video_id = None
    alt = await db.track_alternatives.find_one({"track_id": track.get("track_id", track.get("id", ""))}, {"_id": 0})
    if alt:
        youtube_video_id = alt.get("video_id")
    await sio.emit("playback_sync", {
        "action": "play",
        "track": track,
        "position_ms": 0,
        "timestamp": now,
        "youtube_video_id": youtube_video_id,
    }, room=room_id)

@sio.event
async def pause_track(sid, data):
    room_id = data.get("room_id")
    position_ms = data.get("position_ms", 0)
    info = sid_info.get(sid)
    if not info or not room_id:
        return
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or room.get("host_id") != info["user_id"]:
        return
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"is_playing": False, "play_position_ms": position_ms}}
    )
    await sio.emit("playback_sync", {
        "action": "pause",
        "position_ms": position_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, room=room_id)

@sio.event
async def resume_track(sid, data):
    room_id = data.get("room_id")
    position_ms = data.get("position_ms", 0)
    info = sid_info.get(sid)
    if not info or not room_id:
        return
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or room.get("host_id") != info["user_id"]:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": {"is_playing": True, "play_started_at": now, "play_position_ms": position_ms}}
    )
    await sio.emit("playback_sync", {
        "action": "resume",
        "position_ms": position_ms,
        "timestamp": now,
    }, room=room_id)

@sio.event
async def next_track(sid, data):
    """Skip to next track in queue"""
    room_id = data.get("room_id")
    info = sid_info.get(sid)
    if not info or not room_id:
        return
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or room.get("host_id") != info["user_id"]:
        return
    # Remove current track from queue if present
    current = room.get("current_track")
    if current:
        await db.room_queue.delete_one({"room_id": room_id, "track_id": current.get("track_id", current.get("id", ""))})
    # Get next track from queue
    queue = await db.room_queue.find({"room_id": room_id}, {"_id": 0}).to_list(200)
    queue.sort(key=lambda x: (-x.get("votes", 0), x.get("added_at", "")))
    if queue:
        next_item = queue[0]
        track_data = {
            "track_id": next_item["track_id"],
            "track_name": next_item["track_name"],
            "artist": next_item["artist"],
            "album": next_item.get("album", ""),
            "image": next_item.get("image"),
            "duration_ms": next_item.get("duration_ms", 0),
            "external_url": next_item.get("external_url"),
        }
        now = datetime.now(timezone.utc).isoformat()
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {
                "current_track": track_data,
                "is_playing": True,
                "play_started_at": now,
                "play_position_ms": 0,
            }}
        )
        youtube_video_id = None
        alt = await db.track_alternatives.find_one({"track_id": next_item["track_id"]}, {"_id": 0})
        if alt:
            youtube_video_id = alt.get("video_id")
        # Update queue list
        remaining_queue = queue[1:] if len(queue) > 1 else []
        for item in remaining_queue:
            a = await db.track_alternatives.find_one({"track_id": item["track_id"]}, {"_id": 0})
            if a:
                item["youtube_video_id"] = a.get("video_id")
        await sio.emit("playback_sync", {
            "action": "play",
            "track": track_data,
            "position_ms": 0,
            "timestamp": now,
            "youtube_video_id": youtube_video_id,
        }, room=room_id)
        await sio.emit("queue_update", {"queue": remaining_queue}, room=room_id)
    else:
        # No more tracks
        await db.rooms.update_one(
            {"id": room_id},
            {"$set": {"current_track": None, "is_playing": False, "play_position_ms": 0}}
        )
        await sio.emit("playback_sync", {"action": "stop"}, room=room_id)
        await sio.emit("queue_update", {"queue": []}, room=room_id)


async def _get_room_participants(room_id: str):
    participants = await db.room_participants.find({"room_id": room_id}, {"_id": 0}).to_list(100)
    # Check which are online via socket
    online_user_ids = set()
    for s, info in sid_info.items():
        if info.get("room_id") == room_id:
            online_user_ids.add(info["user_id"])
    for p in participants:
        p["online"] = p["user_id"] in online_user_ids
    return participants


@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()


# Wrap FastAPI with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="/socket.io")
