import type { Track } from "../types";

export type RowKind = "kept" | "removed" | "added";

interface Props {
  kind: RowKind;
  included: boolean;
  track: Track;
  reason?: string | null;
  onToggle: () => void;
  previewPlaying: boolean;
  previewLoading: boolean;
  previewMissing: boolean;
  onPreview: () => void;
}

/**
 * GitHub-diff-style row. `included` = will be in the final playlist.
 *  kept    included: neutral        excluded: red (user removed it)
 *  removed excluded: red (AI)       included: neutral (user restored it)
 *  added   included: green (AI)     excluded: dimmed (user denied it)
 */
export default function DiffRow({
  kind,
  included,
  track,
  reason,
  onToggle,
  previewPlaying,
  previewLoading,
  previewMissing,
  onPreview,
}: Props) {
  const showRed = !included && kind !== "added";
  const showGreen = included && kind === "added";
  const dimmed = !included && kind === "added";

  const rowClass = showGreen
    ? "border-emerald-500/40 bg-emerald-500/10"
    : showRed
      ? "border-red-500/40 bg-red-500/10"
      : dimmed
        ? "border-white/5 bg-white/[0.02] opacity-50"
        : "border-white/10 bg-white/[0.04]";

  const marker = showGreen ? "+" : showRed ? "−" : " ";
  const markerClass = showGreen ? "text-emerald-400" : showRed ? "text-red-400" : "";

  const buttonLabel = included
    ? kind === "added"
      ? "Deny"
      : "Remove"
    : kind === "added"
      ? "Re-add"
      : "Restore";

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${rowClass}`}>
      <span className={`w-4 text-center font-mono text-lg font-bold ${markerClass}`}>{marker}</span>
      <button
        onClick={onPreview}
        title={previewMissing ? "No preview available" : "Play preview"}
        className="group/art relative h-10 w-10 shrink-0 overflow-hidden rounded"
      >
        {track.image ? (
          <img src={track.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-violet-900/50" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white transition-opacity ${
            previewPlaying || previewLoading || previewMissing
              ? "opacity-100"
              : "opacity-0 group-hover/art:opacity-100"
          }`}
        >
          {previewLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : previewMissing ? (
            "∅"
          ) : previewPlaying ? (
            "❚❚"
          ) : (
            "▶"
          )}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${showRed ? "line-through opacity-70" : ""}`}>
          {track.name}
        </p>
        <p className="truncate text-sm text-violet-300/70">
          {track.artists.join(", ")} · {track.album}
        </p>
        {reason && (
          <p className={`truncate text-xs italic ${showGreen ? "text-emerald-300/80" : "text-red-300/80"}`}>
            {reason}
          </p>
        )}
      </div>
      <button
        onClick={onToggle}
        className="shrink-0 rounded-md border border-white/15 px-3 py-1 text-sm text-violet-200 transition-colors hover:bg-white/10"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
