export interface Playlist {
  id: string;
  name: string;
  image: string | null;
  tracks_total: number;
  owner: string;
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artist_ids: string[];
  album: string;
  image: string | null;
}

export interface DiffTrack {
  track: Track;
  status: "kept" | "removed";
  reason: string | null;
}

export interface AddedTrack {
  track: Track;
  reason: string;
}

export interface CurateResponse {
  playlist_name: string;
  tracks: DiffTrack[];
  added: AddedTrack[];
}

export interface User {
  id: string;
  display_name: string;
}
