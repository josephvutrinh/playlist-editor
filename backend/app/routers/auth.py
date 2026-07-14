import secrets
import time
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from .. import spotify
from ..config import settings
from ..session import clear_session_cookie, get_session, set_session_cookie

router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private"
STATE_COOKIE = "oauth_state"


@router.get("/login")
async def login() -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": settings.spotify_client_id,
        "scope": SCOPES,
        "redirect_uri": settings.spotify_redirect_uri,
        "state": state,
    }
    response = RedirectResponse(f"https://accounts.spotify.com/authorize?{urlencode(params)}")
    response.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/callback")
async def callback(request: Request, code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/?error=auth_denied")
    if not state or state != request.cookies.get(STATE_COOKIE):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.spotify_redirect_uri,
            },
            auth=(settings.spotify_client_id, settings.spotify_client_secret),
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Spotify token exchange failed")
    tokens = resp.json()

    me = await spotify.get_me(tokens["access_token"])

    session = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_at": time.time() + tokens.get("expires_in", 3600),
        "user_id": me["id"],
        "display_name": me.get("display_name") or me["id"],
    }
    response = RedirectResponse(settings.frontend_url)
    set_session_cookie(response, session)
    response.delete_cookie(STATE_COOKIE)
    return response


@router.get("/me")
async def me(session: dict = Depends(get_session)) -> dict:
    return {"id": session["user_id"], "display_name": session["display_name"]}


@router.post("/logout")
async def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"ok": True}
