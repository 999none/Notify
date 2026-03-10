from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid
from datetime import datetime, timezone
import jwt
import spotipy
from spotipy.oauth2 import SpotifyOAuth

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

SPOTIFY_SCOPES = "user-read-private user-read-email user-read-playback-state user-read-recently-played"

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@api_router.get("/")
async def root():
    return {"message": "Notify API"}


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

        token = create_jwt(user_id, spotify_id)

        return RedirectResponse(url=f"{FRONTEND_URL}/callback?token={token}")

    except Exception as e:
        logger.error(f"Spotify callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=auth_failed")


@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split("Bearer ")[1]
    payload = decode_jwt(token)

    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(**user)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
