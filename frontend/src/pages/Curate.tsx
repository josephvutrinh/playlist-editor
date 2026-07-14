import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { applyChanges, curatePlaylist } from "../api";
import DiffRow, { type RowKind } from "../components/DiffRow";
import FloatingPrompt from "../components/FloatingPrompt";
import { usePreview } from "../hooks/usePreview";
import type { Track } from "../types";

type Step = "theme" | "add" | "audio" | "loading" | "review" | "apply";

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
  const [addSongs, setAddSongs] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [resolvedName, setResolvedName] = useState(playlistName);
  const [error, setError] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const preview = usePreview();

  async function runCurate(withAudio: boolean) {
    setAudioOn(withAudio);
    setStep("loading");
    try {
      const result = await curatePlaylist(id!, theme, addSongs, withAudio);
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

  async function runApply(mode: "new" | "replace") {
    setApplyBusy(true);
    setApplyError(null);
    try {
      const uris = rows.filter((r) => r.included).map((r) => r.track.uri);
      await applyChanges(id!, mode, uris);
      setApplyDone(true);
      setTimeout(() => navigate("/"), 1500);
    } catch (e) {
      setApplyError((e as Error).message);
      setApplyBusy(false);
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
          question={`What is the theme of “${playlistName}”?`}
          placeholder="e.g. late-night drive, 90s hip hop, cozy acoustic…"
          initialValue={theme}
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
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-10 px-6 text-center">
        {backToPlaylists}
        <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
          Would you like to add songs that fit “{theme}”?
        </h1>
        <div className="flex gap-6">
          <button
            onClick={() => {
              setAddSongs(true);
              setStep("audio");
            }}
            className="rounded-full bg-violet-600 px-8 py-3 text-lg font-semibold transition-transform hover:scale-105"
          >
            Yes, add songs
          </button>
          <button
            onClick={() => {
              setAddSongs(false);
              setStep("audio");
            }}
            className="rounded-full border border-violet-500/40 px-8 py-3 text-lg font-semibold text-violet-200 transition-colors hover:bg-white/10"
          >
            No, just trim
          </button>
        </div>
        <button
          onClick={() => setStep("theme")}
          className="text-sm text-violet-300/60 hover:text-violet-200"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (step === "audio") {
    return (
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-10 px-6 text-center">
        {backToPlaylists}
        <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
          Deep Analysis?
        </h1>
        <p className="max-w-md text-violet-300/70">
          Analyzes each track's 30-second preview — tempo, energy, mood. Deeper
          results.
        </p>
        <div className="flex gap-6">
          <button
            onClick={() => runCurate(true)}
            className="rounded-full bg-violet-600 px-8 py-3 text-lg font-semibold transition-transform hover:scale-105"
          >
            Yes, listen to previews
          </button>
          <button
            onClick={() => runCurate(false)}
            className="rounded-full border border-violet-500/40 px-8 py-3 text-lg font-semibold text-violet-200 transition-colors hover:bg-white/10"
          >
            No, metadata only
          </button>
        </div>
        <button
          onClick={() => setStep("add")}
          className="text-sm text-violet-300/60 hover:text-violet-200"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-400" />
        <p className="animate-pulse text-xl text-violet-200">
          Curating “{resolvedName}” around “{theme}”…
        </p>
        <p className="text-sm text-violet-300/60">
          {audioOn
            ? "Listening to 30-second previews — this takes a minute"
            : "Judging by titles, artists, and albums"}
        </p>
      </div>
    );
  }

  const finalCount = rows.filter((r) => r.included).length;

  if (step === "apply") {
    if (applyDone) {
      return (
        <div className="flex min-h-[90vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-4xl">✅</p>
          <h1 className="text-3xl font-semibold text-violet-100">Playlist saved!</h1>
          <p className="text-violet-300/70">Taking you back to your playlists…</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-10 px-6 text-center">
        <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
          How do you want to save your updated playlist?
        </h1>
        {applyError && <p className="text-red-400">{applyError}</p>}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <button
            disabled={applyBusy}
            onClick={() => runApply("new")}
            className="rounded-full bg-violet-600 px-8 py-3 text-lg font-semibold transition-transform hover:scale-105 disabled:opacity-40"
          >
            Create new playlist
          </button>
          <button
            disabled={applyBusy}
            onClick={() => runApply("replace")}
            className="rounded-full border border-red-400/40 px-8 py-3 text-lg font-semibold text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-40"
          >
            Overwrite “{resolvedName}”
          </button>
        </div>
        {applyBusy && <p className="animate-pulse text-violet-300/70">Talking to Spotify…</p>}
        <button
          disabled={applyBusy}
          onClick={() => setStep("review")}
          className="text-sm text-violet-300/60 hover:text-violet-200"
        >
          ← Back to review
        </button>
      </div>
    );
  }

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
          onClick={() => setStep("apply")}
          className="rounded-full bg-violet-600 px-6 py-2 font-semibold transition-transform hover:scale-105 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
