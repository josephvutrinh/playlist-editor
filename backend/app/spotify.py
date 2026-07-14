"""Thin async client for the Spotify Web API endpoints this app uses."""

from typing import Any

import httpx
from fastapi import HTTPException

API = "https://api.spotify.com/v1"


def _headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def _get(client: httpx.AsyncClient, access_token: str, url: str, **params) -> dict:
    resp = await client.get(url, headers=_headers(access_token), params=params or None)
    if resp.status_code >= 400:
        print(f"[spotify] {resp.status_code} on GET {url} -> {resp.text}", flush=True)
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Spotify {resp.status_code} on {url.removeprefix(API)}: {resp.text}",
        )
    return resp.json()


def _track_summary(track: dict) -> dict:
    images = track.get("album", {}).get("images") or []
    return {
        "id": track["id"],
        "uri": track["uri"],
        "name": track["name"],
        "artists": [a["name"] for a in track.get("artists", [])],
        "artist_ids": [a["id"] for a in track.get("artists", []) if a.get("id")],
        "album": track.get("album", {}).get("name", ""),
        "image": images[-1]["url"] if images else None,
    }


async def get_me(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        return await _get(client, access_token, f"{API}/me")


async def get_playlists(access_token: str, user_id: str) -> list[dict]:
    items: list[dict] = []
    url = f"{API}/me/playlists?limit=50"
    async with httpx.AsyncClient() as client:
        while url:
            data = await _get(client, access_token, url)
            items.extend(data["items"])
            url = data.get("next")
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "image": p["images"][0]["url"] if p.get("images") else None,
            "tracks_total": p.get("tracks", {}).get("total", 0),
            "owner": p.get("owner", {}).get("display_name", ""),
        }
        for p in items
        # only the user's own playlists — the playlist items endpoint is
        # restricted to playlists the user owns or collaborates on
        if p and p.get("owner", {}).get("id") == user_id
    ]


async def get_playlist_name(access_token: str, playlist_id: str) -> str:
    async with httpx.AsyncClient() as client:
        data = await _get(
            client, access_token, f"{API}/playlists/{playlist_id}", fields="name"
        )
    return data.get("name", "Playlist")


async def get_playlist_tracks(access_token: str, playlist_id: str) -> list[dict]:
    tracks: list[dict] = []
    # /playlists/{id}/items replaced the deprecated /tracks endpoint (Feb 2026);
    # entries carry the track under "item" and pages cap at 50
    url = f"{API}/playlists/{playlist_id}/items?limit=50"
    async with httpx.AsyncClient() as client:
        while url:
            data = await _get(client, access_token, url)
            for entry in data["items"]:
                track = entry.get("item") or entry.get("track")
                # skip local files and episodes (no id / not a track)
                if track and track.get("id") and track.get("type") == "track":
                    tracks.append(_track_summary(track))
            url = data.get("next")
    return tracks


async def search_track(access_token: str, title: str, artist: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        data = await _get(
            client,
            access_token,
            f"{API}/search",
            q=f'track:"{title}" artist:"{artist}"',
            type="track",
            limit=1,
        )
    items = data.get("tracks", {}).get("items", [])
    return _track_summary(items[0]) if items else None


def _check(resp: httpx.Response, action: str) -> None:
    if resp.status_code >= 400:
        print(f"[spotify] {resp.status_code} on {action} -> {resp.text}", flush=True)
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Spotify {resp.status_code} on {action}: {resp.text}",
        )


async def create_playlist(access_token: str, name: str, description: str) -> dict:
    async with httpx.AsyncClient() as client:
        # POST /me/playlists replaced /users/{id}/playlists (Feb 2026 migration)
        resp = await client.post(
            f"{API}/me/playlists",
            headers=_headers(access_token),
            json={"name": name, "description": description, "public": False},
        )
        _check(resp, "create playlist")
        return resp.json()


async def add_tracks(access_token: str, playlist_id: str, uris: list[str]) -> None:
    async with httpx.AsyncClient() as client:
        for i in range(0, len(uris), 100):
            resp = await client.post(
                f"{API}/playlists/{playlist_id}/items",
                headers=_headers(access_token),
                json={"uris": uris[i : i + 100]},
            )
            _check(resp, "add tracks")


async def replace_tracks(access_token: str, playlist_id: str, uris: list[str]) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{API}/playlists/{playlist_id}/items",
            headers=_headers(access_token),
            json={"uris": uris[:100]},
        )
        _check(resp, "replace tracks")
    if len(uris) > 100:
        await add_tracks(access_token, playlist_id, uris[100:])
