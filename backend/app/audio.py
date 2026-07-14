"""Local acoustic analysis of 30s previews via librosa.

Downloads each track's preview (Deezer mp3 via preview.find_preview_url),
extracts features on CPU, and produces a one-line sonic description that gets
appended to the curator prompt. Claude never receives audio — only this text.
Tracks whose preview is missing or undecodable (e.g. iTunes m4a) are simply
omitted and fall back to metadata-only judgment.
"""

import asyncio
import os
import tempfile
from dataclasses import dataclass

import httpx
import numpy as np

from . import preview

# track_id -> Features (None = no preview / decode failure; not retried)
_cache: dict[str, "Features | None"] = {}

_CONCURRENCY = 4
_OUTLIER_Z_DISTANCE = 2.5
_MIN_TRACKS_FOR_OUTLIERS = 8


@dataclass
class Features:
    text: str
    vector: list[float]  # [bpm, rms, centroid, onset_rate, harmonic_ratio]


def _pick(value: float, cuts: tuple[float, float], labels: tuple[str, str, str]) -> str:
    if value < cuts[0]:
        return labels[0]
    if value < cuts[1]:
        return labels[1]
    return labels[2]


def _extract(path: str) -> Features:
    import librosa  # heavy import — keep lazy so app startup/reload stays fast

    y, sr = librosa.load(path, sr=22050, mono=True, duration=30)
    duration = len(y) / sr

    tempo = float(np.atleast_1d(librosa.beat.beat_track(y=y, sr=sr)[0])[0])
    rms = float(np.mean(librosa.feature.rms(y=y)))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    onset_rate = len(librosa.onset.onset_detect(y=y, sr=sr)) / max(duration, 1.0)
    harmonic, percussive = librosa.effects.hpss(y)
    h_energy = float(np.mean(harmonic**2))
    p_energy = float(np.mean(percussive**2))
    harmonic_ratio = h_energy / (h_energy + p_energy + 1e-12)

    energy = _pick(rms, (0.04, 0.09), ("low", "medium", "high"))
    timbre = _pick(centroid, (1500, 2600), ("dark", "warm", "bright"))
    rhythm = _pick(onset_rate, (1.5, 3.5), ("sparse", "steady", "dense"))
    character = _pick(harmonic_ratio, (0.35, 0.65), ("beat-driven", "balanced", "melodic"))

    text = f"~{round(tempo)} BPM, {energy} energy, {timbre} timbre, {rhythm} rhythm, {character}"
    return Features(text=text, vector=[tempo, rms, centroid, onset_rate, harmonic_ratio])


async def _analyze_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, track: dict) -> None:
    track_id = track["id"]
    if track_id in _cache:
        return
    async with sem:
        artist = track["artists"][0] if track["artists"] else ""
        url = await preview.find_preview_url(track_id, track["name"], artist)
        if not url:
            _cache[track_id] = None
            return
        tmp_path = None
        try:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp.write(resp.content)
                tmp_path = tmp.name
            _cache[track_id] = await asyncio.to_thread(_extract, tmp_path)
        except Exception as exc:  # bad download, undecodable format (m4a), etc.
            print(f"[audio] skipping {track['name']}: {exc}", flush=True)
            _cache[track_id] = None
        finally:
            if tmp_path:
                os.unlink(tmp_path)


def _flag_outliers(analyzed: dict[str, Features]) -> dict[str, str]:
    """Return feature text per track, marking tracks that sound very different
    from the rest of the playlist (z-score distance across feature dims)."""
    texts = {tid: f.text for tid, f in analyzed.items()}
    if len(analyzed) < _MIN_TRACKS_FOR_OUTLIERS:
        return texts

    ids = list(analyzed)
    matrix = np.array([analyzed[tid].vector for tid in ids])
    std = matrix.std(axis=0)
    std[std == 0] = 1.0
    z = (matrix - matrix.mean(axis=0)) / std
    distances = np.linalg.norm(z, axis=1)
    for tid, dist in zip(ids, distances):
        if dist > _OUTLIER_Z_DISTANCE:
            texts[tid] += ", sonic outlier in this playlist"
    return texts


async def analyze_playlist(tracks: list[dict]) -> dict[str, str]:
    """track_id -> one-line sonic description, for tracks we could analyze."""
    sem = asyncio.Semaphore(_CONCURRENCY)
    async with httpx.AsyncClient(timeout=20) as client:
        await asyncio.gather(*(_analyze_one(client, sem, t) for t in tracks))
    analyzed = {
        t["id"]: _cache[t["id"]]
        for t in tracks
        if _cache.get(t["id"]) is not None
    }
    return _flag_outliers(analyzed)  # type: ignore[arg-type]
