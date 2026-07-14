from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import audio, curator, preview, spotify
from ..session import get_session

router = APIRouter(prefix="/api", tags=["playlists"])

MAX_ADDS = 10


class CurateRequest(BaseModel):
    playlist_id: str
    theme: str
    add_songs: bool = False
    analyze_audio: bool = False


class ApplyRequest(BaseModel):
    playlist_id: str
    mode: Literal["new", "replace"]
    uris: list[str]


@router.get("/playlists")
async def list_playlists(session: dict = Depends(get_session)) -> list[dict]:
    return await spotify.get_playlists(session["access_token"], session["user_id"])


@router.get("/playlists/{playlist_id}/tracks")
async def playlist_tracks(playlist_id: str, session: dict = Depends(get_session)) -> list[dict]:
    return await spotify.get_playlist_tracks(session["access_token"], playlist_id)


@router.post("/curate")
async def curate(body: CurateRequest, session: dict = Depends(get_session)) -> dict:
    token = session["access_token"]
    tracks = await spotify.get_playlist_tracks(token, body.playlist_id)

    sound = await audio.analyze_playlist(tracks) if body.analyze_audio else None
    removals = await curator.pick_removals(body.theme, tracks, sound)

    diff_tracks = [
        {
            "track": track,
            "status": "removed" if i in removals else "kept",
            "reason": removals.get(i),
        }
        for i, track in enumerate(tracks)
    ]
    kept = [t for i, t in enumerate(tracks) if i not in removals]

    added: list[dict] = []
    if body.add_songs:
        suggestions = await curator.suggest_additions(body.theme, kept)
        existing_ids = {t["id"] for t in tracks}
        for suggestion in suggestions:
            if len(added) >= MAX_ADDS:
                break
            found = await spotify.search_track(token, suggestion.title, suggestion.artist)
            if found and found["id"] not in existing_ids:
                existing_ids.add(found["id"])
                added.append({"track": found, "reason": suggestion.reason})

    playlist_name = await spotify.get_playlist_name(token, body.playlist_id)
    return {"playlist_name": playlist_name, "tracks": diff_tracks, "added": added}


@router.get("/preview/{track_id}")
async def get_preview(
    track_id: str, title: str, artist: str, session: dict = Depends(get_session)
) -> dict:
    url = await preview.find_preview_url(track_id, title, artist)
    return {"url": url}


def _new_playlist_name(original: str, existing_names: set[str]) -> str:
    """"New {original}", deduped OS-style: "New {original} (2)", "(3)", ..."""
    base = f"New {original}"
    if base not in existing_names:
        return base
    n = 2
    while f"{base} ({n})" in existing_names:
        n += 1
    return f"{base} ({n})"


@router.post("/apply")
async def apply(body: ApplyRequest, session: dict = Depends(get_session)) -> dict:
    token = session["access_token"]
    if body.mode == "new":
        original = await spotify.get_playlist_name(token, body.playlist_id)
        existing = await spotify.get_playlists(token, session["user_id"])
        name = _new_playlist_name(original, {p["name"] for p in existing})
        playlist = await spotify.create_playlist(token, name, "Curated with Claude")
        await spotify.add_tracks(token, playlist["id"], body.uris)
        return {"playlist_id": playlist["id"], "name": name}
    await spotify.replace_tracks(token, body.playlist_id, body.uris)
    return {"playlist_id": body.playlist_id}
