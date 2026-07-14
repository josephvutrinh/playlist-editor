"""Resolve 30s audio preview URLs from public no-auth sources.

Spotify removed preview_url for new apps (Nov 2024), so we ask Deezer first
(30s mp3) and fall back to the iTunes Search API (30s m4a). The browser
streams the returned CDN URL directly.
"""

import httpx

# track_id -> preview url (None = looked up, nothing found)
_cache: dict[str, str | None] = {}


async def _deezer(client: httpx.AsyncClient, title: str, artist: str) -> str | None:
    for query in (f'track:"{title}" artist:"{artist}"', f"{title} {artist}"):
        try:
            resp = await client.get(
                "https://api.deezer.com/search", params={"q": query, "limit": 1}
            )
            items = resp.json().get("data") or []
        except (httpx.HTTPError, ValueError):
            return None
        if items and items[0].get("preview"):
            return items[0]["preview"]
    return None


async def _itunes(client: httpx.AsyncClient, title: str, artist: str) -> str | None:
    try:
        resp = await client.get(
            "https://itunes.apple.com/search",
            params={"term": f"{title} {artist}", "media": "music", "entity": "song", "limit": 1},
        )
        results = resp.json().get("results") or []
    except (httpx.HTTPError, ValueError):
        return None
    return results[0].get("previewUrl") if results else None


async def find_preview_url(track_id: str, title: str, artist: str) -> str | None:
    if track_id in _cache:
        return _cache[track_id]
    async with httpx.AsyncClient(timeout=8) as client:
        url = await _deezer(client, title, artist) or await _itunes(client, title, artist)
    _cache[track_id] = url
    return url
