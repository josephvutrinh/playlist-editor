"""Encrypted httpOnly cookie session holding the user's Spotify tokens."""

import base64
import hashlib
import json
import time

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request, Response

from .config import settings

COOKIE_NAME = "session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

_fernet = Fernet(
    base64.urlsafe_b64encode(hashlib.sha256(settings.session_secret.encode()).digest())
)


def set_session_cookie(response: Response, session: dict) -> None:
    token = _fernet.encrypt(json.dumps(session).encode()).decode()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def read_session(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        return json.loads(_fernet.decrypt(token.encode()))
    except (InvalidToken, ValueError):
        return None


async def _refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            auth=(settings.spotify_client_id, settings.spotify_client_secret),
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Spotify token refresh failed")
    return resp.json()


async def get_session(request: Request, response: Response) -> dict:
    """FastAPI dependency: returns the session, refreshing the Spotify access
    token (and re-setting the cookie) when it has expired."""
    session = read_session(request)
    if session is None:
        raise HTTPException(status_code=401, detail="Not logged in")

    if time.time() > session["expires_at"] - 60:
        data = await _refresh_access_token(session["refresh_token"])
        session["access_token"] = data["access_token"]
        session["expires_at"] = time.time() + data.get("expires_in", 3600)
        # Spotify may rotate the refresh token
        if data.get("refresh_token"):
            session["refresh_token"] = data["refresh_token"]
        set_session_cookie(response, session)

    return session
