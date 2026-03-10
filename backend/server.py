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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Spotify config
SPOTIFY_CLIENT_ID = os.environ['SPOTIFY_CLIENT_ID']
SPOTIFY_CLIENT_SECRET = os.environ['SPOTIFY_CLIENT_SECRET']
SPOTIFY_REDIRECT_URI = os.environ['SPOTIFY_REDIRECT_URI']
JWT_SECRET = os.environ['JWT_SECRET']
FRONTEND_URL = os.environ['FRONTEND_URL']

SPOTIFY_SCOPES = "user-read-private user-read-email user-read-playback-state user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative streaming user-modify-playback-state"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
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
    sp = spotipy.Spotify(auth=token_info["access_token"])
    return sp


async def get_valid_spotify_token(user_id: str):
    """Get a valid Spotify token, refreshing if needed."""
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


# ─── Root ───
@api_router.get("/")
async def root():
    return {"message": "Notify API"}


# ─── Status (existing) ───
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

        # Store Spotify tokens
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


# ─── Alternative Player: YouTube Search ───
def search_youtube_video(query: str):
    """Search YouTube for a video and return the first result."""
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={encoded_query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        response = sync_requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # Extract video IDs from the page
        video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
        if not video_ids:
            return None

        video_id = video_ids[0]

        # Try to extract title
        title_match = re.search(r'"title":\{"runs":\[\{"text":"([^"]+)"\}', response.text)
        title = title_match.group(1) if title_match else query

        # Try to extract channel name
        channel_matches = re.findall(r'"ownerText":\{"runs":\[\{"text":"([^"]+)"', response.text)
        channel = channel_matches[0] if channel_matches else ""

        # Try to extract duration
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
    """Search YouTube for an alternative version of a track."""
    if not track_name.strip() or not artist_name.strip():
        return {"found": False, "message": "Aucune version alternative disponible"}

    query = f"{track_name} {artist_name} official audio"
    result = search_youtube_video(query)

    if result:
        # Verify relevance: check if track name or artist appears in the title
        title_lower = result["title"].lower()
        track_lower = track_name.lower()
        artist_lower = artist_name.lower()
        # Accept if at least one word from track or artist is in the title
        track_words = [w for w in track_lower.split() if len(w) > 2]
        artist_words = [w for w in artist_lower.split() if len(w) > 2]
        has_match = any(w in title_lower for w in track_words) or any(w in title_lower for w in artist_words)
        if has_match:
            return {"found": True, **result}

    return {"found": False, "message": "Aucune version alternative disponible"}


# ─── Spotify Access Token for Web Playback SDK ───
@api_router.get("/player/spotify-token")
async def get_spotify_access_token(request: Request):
    """Return Spotify access token for Web Playback SDK (Premium users)."""
    user = await get_user_from_request(request)
    token_info = await get_valid_spotify_token(user["id"])
    return {
        "access_token": token_info["access_token"],
        "subscription": user.get("subscription", "free"),
    }


# ─── ZIP Download Endpoint ───
@api_router.get("/download/project-zip")
async def download_project_zip():
    """Generate and return a zip file of the complete project."""
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


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
