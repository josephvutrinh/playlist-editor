import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { curatePlaylist } from "../api";
import DiffRow, { type RowKind } from "../components/DiffRow";
import FloatingPrompt from "../components/FloatingPrompt";
import { usePreview } from "../hooks/usePreview";
import type { Track } from "../types";

type Step = "theme" | "add" | "loading" | "review";

interface Row {
  kind: RowKind;
  track: Track;
  reason: string | null;
  included: boolean;
}

export default function Curate() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const playlistName = (location.state as { name?: string } | null)?.name ?? "this playlist";

  const [step, setStep] = useState<Step>("theme");
  const [theme, setTheme] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [resolvedName, setResolvedName] = useState(playlistName);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreview();

  async function runCurate(chosenTheme: string, addSongs: boolean) {
    setStep("loading");
    try {
      const result = await curatePlaylist(id!, chosenTheme, addSongs);
      setResolvedName(result.playlist_name);
      setRows([
        ...result.tracks.map((t) => ({
          kind: t.status as RowKind,
          track: t.track,
          reason: t.reason,
          included: t.status === "kept",
        })),
        ...result.added.map((a) => ({
          kind: "added" as RowKind,
          track: a.track,
          reason: a.reason,
          included: true,
        })),
      ]);
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    }
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, included: !row.included } : row)),
    );
  }

  const backToPlaylists = (
    <button
      onClick={() => navigate("/")}
      className="fixed left-6 top-6 text-sm text-violet-300/70 transition-colors hover:text-violet-200"
    >
      ← Back to playlists
    </button>
  );

  if (step === "theme") {
    return (
      <>
        {backToPlaylists}
        <FloatingPrompt
          question={`What theme should “${playlistName}” follow?`}
          placeholder="e.g. late-night drive, 90s hip hop, cozy acoustic…"
          onSubmit={(value) => {
            setTheme(value);
            setStep("add");
          }}
        />
      </>
    );
  }

  if (step === "add") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-10 px-6 text-center">
        {backToPlaylists}
        <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
          Should I also add new songs that fit “{theme}”?
        </h1>
        <div className="flex gap-6">
          <button
            onClick={() => runCurate(theme, true)}
            className="rounded-full bg-violet-600 px-8 py-3 text-lg font-semibold transition-transform hover:scale-105"
          >
            Yes, add songs
          </button>
          <button
            onClick={() => runCurate(theme, false)}
            className="rounded-full border border-violet-500/40 px-8 py-3 text-lg font-semibold text-violet-200 transition-colors hover:bg-white/10"
          >
            No, just trim
          </button>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-400" />
        <p className="animate-pulse text-xl text-violet-200">
          Curating “{resolvedName}” around “{theme}”…
        </p>
        <p className="text-sm text-violet-300/60">
          Reading genres, listening with our mind's ear
        </p>
      </div>
    );
  }

  const finalCount = rows.filter((r) => r.included).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <button
          onClick={() => navigate("/")}
          className="mb-4 text-sm text-violet-300/70 hover:text-violet-200"
        >
          ← Back to playlists
        </button>
        <h1 className="text-2xl font-bold text-violet-100">
          {resolvedName} <span className="text-violet-300/60">→ {theme}</span>
        </h1>
        <p className="mt-1 text-sm text-violet-300/70">
          Review the changes — toggle anything you disagree with.
        </p>
      </header>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <DiffRow
            key={`${row.track.id}-${i}`}
            kind={row.kind}
            included={row.included}
            track={row.track}
            reason={row.reason}
            onToggle={() => toggleRow(i)}
            previewPlaying={preview.playingId === row.track.id}
            previewLoading={preview.loadingId === row.track.id}
            previewMissing={preview.noPreviewId === row.track.id}
            onPreview={() => preview.toggle(row.track)}
          />
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-[#160829]/90 px-5 py-4 backdrop-blur">
        <span className="text-violet-200">{finalCount} tracks in final playlist</span>
        <button
          disabled={finalCount === 0}
          onClick={() =>
            navigate("/apply", {
              state: {
                playlistId: id,
                playlistName: resolvedName,
                theme,
                uris: rows.filter((r) => r.included).map((r) => r.track.uri),
              },
            })
          }
          className="rounded-full bg-violet-600 px-6 py-2 font-semibold transition-transform hover:scale-105 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
