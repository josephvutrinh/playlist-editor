import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { applyChanges } from "../api";

interface ApplyState {
  playlistId: string;
  playlistName: string;
  theme: string;
  uris: string[];
}

export default function Apply() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ApplyState | null;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) return <Navigate to="/" replace />;

  async function run(mode: "new" | "replace") {
    const s = state!;
    setBusy(true);
    setError(null);
    try {
      await applyChanges(s.playlistId, mode, s.uris);
      setDone(true);
      setTimeout(() => navigate("/"), 1500);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-3xl font-semibold text-violet-100">Playlist saved!</h1>
        <p className="text-violet-300/70">Taking you back to your playlists…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-10 px-6 text-center">
      <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
        How should I save the {state.uris.length}-track result?
      </h1>
      {error && <p className="text-red-400">{error}</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <button
          disabled={busy}
          onClick={() => run("new")}
          className="rounded-full bg-violet-600 px-8 py-3 text-lg font-semibold transition-transform hover:scale-105 disabled:opacity-40"
        >
          Create new playlist
        </button>
        <button
          disabled={busy}
          onClick={() => run("replace")}
          className="rounded-full border border-red-400/40 px-8 py-3 text-lg font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          Overwrite “{state.playlistName}”
        </button>
      </div>
      {busy && <p className="animate-pulse text-violet-300/70">Talking to Spotify…</p>}
      <button
        disabled={busy}
        onClick={() => navigate(-1)}
        className="text-sm text-violet-300/60 hover:text-violet-200"
      >
        ← Back to review
      </button>
    </div>
  );
}
