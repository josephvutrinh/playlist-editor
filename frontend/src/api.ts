import type { CurateResponse, Playlist, User } from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Not logged in");
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const getMe = () => request<User>("/auth/me");

export const logout = () => request<{ ok: boolean }>("/auth/logout", { method: "POST" });

export const getPlaylists = () => request<Playlist[]>("/api/playlists");

export const curatePlaylist = (
  playlistId: string,
  theme: string,
  addSongs: boolean,
  analyzeAudio: boolean,
) =>
  request<CurateResponse>("/api/curate", {
    method: "POST",
    body: JSON.stringify({
      playlist_id: playlistId,
      theme,
      add_songs: addSongs,
      analyze_audio: analyzeAudio,
    }),
  });

export const getPreview = (track: { id: string; name: string; artists: string[] }) =>
  request<{ url: string | null }>(
    `/api/preview/${track.id}?` +
      new URLSearchParams({ title: track.name, artist: track.artists[0] ?? "" }),
  );

export const applyChanges = (playlistId: string, mode: "new" | "replace", uris: string[]) =>
  request<{ playlist_id: string; name?: string }>("/api/apply", {
    method: "POST",
    body: JSON.stringify({ playlist_id: playlistId, mode, uris }),
  });
