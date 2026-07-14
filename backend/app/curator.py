"""Claude Haiku curation: a remove pass over existing tracks, and an optional
add pass that proposes new tracks (later verified against Spotify search)."""

from anthropic import AsyncAnthropic
from pydantic import BaseModel

from .config import settings

MODEL = "claude-haiku-4-5"
CHUNK_SIZE = 100

client = AsyncAnthropic(api_key=settings.anthropic_api_key)


class RemovedTrack(BaseModel):
    index: int
    reason: str


class RemoveResult(BaseModel):
    remove: list[RemovedTrack]


class Suggestion(BaseModel):
    title: str
    artist: str
    reason: str


class AddResult(BaseModel):
    suggestions: list[Suggestion]


REMOVE_SYSTEM = """You are an expert music curator. The user wants their playlist \
to fit a specific theme, genre, mood, or vibe. You will receive the theme and a \
numbered list of tracks (name, artists, album).

Identify the tracks that do NOT fit the theme and should be removed. Use your \
knowledge of the songs, artists, albums, and their genres, energy, and mood. \
Be decisive but not overzealous: keep tracks that plausibly fit, and keep tracks \
you don't recognize unless the artist or title clearly clashes with the theme. \
Give each removal a short reason (under 12 words)."""

ADD_SYSTEM = """You are an expert music curator. Suggest real, well-known songs that \
fit the user's theme and complement the tracks already in their playlist. Only \
suggest songs you are confident actually exist, with the exact title and primary \
artist name as they appear on streaming services. Do not suggest songs already in \
the playlist. Give each suggestion a short reason (under 12 words)."""


def _format_track_line(index: int, track: dict) -> str:
    artists = ", ".join(track["artists"])
    return f'{index}. "{track["name"]}" — {artists} — album: {track["album"]}'


async def pick_removals(theme: str, tracks: list[dict]) -> dict[int, str]:
    """Returns {track_index: reason} for tracks Claude says don't fit the theme."""
    removals: dict[int, str] = {}
    for start in range(0, len(tracks), CHUNK_SIZE):
        chunk = tracks[start : start + CHUNK_SIZE]
        lines = "\n".join(
            _format_track_line(start + i, t) for i, t in enumerate(chunk)
        )
        prompt = (
            f"Theme: {theme}\n\n"
            f"Tracks (indices {start}-{start + len(chunk) - 1}):\n{lines}\n\n"
            "Which tracks should be removed because they don't fit the theme? "
            "Reference tracks by their index."
        )
        response = await client.messages.parse(
            model=MODEL,
            max_tokens=4096,
            system=REMOVE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            output_format=RemoveResult,
        )
        result = response.parsed_output
        if result:
            for item in result.remove:
                if start <= item.index < start + len(chunk):
                    removals[item.index] = item.reason
    return removals


async def suggest_additions(
    theme: str, kept_tracks: list[dict], count: int = 15
) -> list[Suggestion]:
    kept_lines = "\n".join(
        f'- "{t["name"]}" — {", ".join(t["artists"])}' for t in kept_tracks[:60]
    )
    prompt = (
        f"Theme: {theme}\n\n"
        f"Songs already in the playlist (do not suggest these):\n{kept_lines}\n\n"
        f"Suggest {count} songs that fit the theme."
    )
    response = await client.messages.parse(
        model=MODEL,
        max_tokens=4096,
        system=ADD_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        output_format=AddResult,
    )
    result = response.parsed_output
    return result.suggestions if result else []
