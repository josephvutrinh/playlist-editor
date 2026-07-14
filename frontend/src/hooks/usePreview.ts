import { useEffect, useRef, useState } from "react";
import { getPreview } from "../api";
import type { Track } from "../types";

// One shared player — starting a preview stops whatever else was playing.
const audio = new Audio();

export interface PreviewState {
  playingId: string | null;
  loadingId: string | null;
  noPreviewId: string | null;
  toggle: (track: Track) => void;
}

export function usePreview(): PreviewState {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [noPreviewId, setNoPreviewId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, []);

  async function toggle(track: Track) {
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    const seq = ++requestSeq.current;
    audio.pause();
    setPlayingId(null);
    setNoPreviewId(null);
    setLoadingId(track.id);

    let url: string | null = null;
    try {
      url = (await getPreview(track)).url;
    } catch {
      url = null;
    }

    // a newer click superseded this request
    if (seq !== requestSeq.current) return;
    setLoadingId(null);

    if (!url) {
      setNoPreviewId(track.id);
      setTimeout(() => setNoPreviewId((id) => (id === track.id ? null : id)), 2000);
      return;
    }

    audio.src = url;
    try {
      await audio.play();
      if (seq === requestSeq.current) setPlayingId(track.id);
    } catch {
      // autoplay rejection or bad media — treat as no preview
      if (seq === requestSeq.current) setNoPreviewId(track.id);
    }
  }

  return { playingId, loadingId, noPreviewId, toggle };
}
