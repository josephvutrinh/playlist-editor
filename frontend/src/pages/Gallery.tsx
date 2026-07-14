import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, getPlaylists, logout } from "../api";
import type { Playlist, User } from "../types";

export default function Gallery() {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
    getPlaylists()
      .then(setPlaylists)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-violet-100">Your playlists</h1>
        {user && (
          <div className="flex items-center gap-4 text-sm text-violet-300/80">
            <span>{user.display_name}</span>
            <button
              onClick={() => logout().then(() => window.location.assign("/login"))}
              className="rounded-md border border-white/15 px-3 py-1 transition-colors hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {error && <p className="text-red-400">{error}</p>}

      {playlists === null && !error && (
        <p className="animate-pulse text-violet-300/70">Loading playlists…</p>
      )}

      {playlists && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/playlist/${p.id}`, { state: { name: p.name } })}
              className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.08]"
            >
              {p.image ? (
                <img
                  src={p.image}
                  alt=""
                  className="mb-3 aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-lg bg-violet-900/40 text-4xl">
                  🎵
                </div>
              )}
              <p className="truncate font-semibold text-violet-50">{p.name}</p>
              <p className="text-sm text-violet-300/60">{p.tracks_total} tracks</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
