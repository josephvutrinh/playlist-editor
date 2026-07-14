import { API_URL } from "../api";

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-violet-100">
        Playlist Curator
      </h1>
      <p className="max-w-md text-lg text-violet-300/80">
        Reshape your Spotify playlists around any theme.
      </p>
      <a
        href={`${API_URL}/auth/login`}
        className="rounded-full bg-[#1DB954] px-8 py-3 text-lg font-semibold text-black transition-transform hover:scale-105"
      >
        Connect Spotify
      </a>
    </div>
  );
}
