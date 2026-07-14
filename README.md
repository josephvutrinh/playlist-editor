# playlist-editor

An app that lets you reshape your existing Spotify playlists using AI. Give it a playlist and a theme (mood, genre, activity, era, etc.), and it will suggest which tracks to remove and which new tracks to add to better match that theme, then apply the changes directly to your real playlist.

## Demo

Browse the gallery & pick a playlist:

![Gallery](gallery.gif)

Prompt screen:

![Prompt](prompt.gif)

Accepting/denying changes and saving as a new playlist:

![Accept and deny changes](acceptdeny.gif)

## Features

- **Theme curation** — Claude Haiku judges every track against your theme and flags misfits, each with a one-line reason
- **GitHub-style diff review** — removals in red, additions in green; accept or deny every single change, remove unchanged tracks too
- **Deep audio analysis** — analyzes each track's 30-second preview locally (tempo, energy, timbre, rhythm) and flags sonic outliers, so curation goes by how songs actually *sound*, not just their names
- **Audio previews** — click any album cover in the review to hear the track
- **Safe saving** — create a new playlist (`New {name}`, auto-deduped) or overwrite the original, your choice
- **Song suggestions** — optionally have Claude propose new tracks for the theme; every suggestion is verified to exist on Spotify before you see it

## Setup

You need: **Python 3.11+**, **Node 18+**, and **git**.

### 1. Create your Spotify app (free)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in with your normal Spotify account.
2. **Create app** — name and description can be anything.
3. Set **Redirect URI** to exactly: `http://127.0.0.1:8000/auth/callback`
4. Under "Which API/SDKs are you planning to use?", check **Web API**.
5. Save, then copy the **Client ID** and **Client Secret** from the app's settings.

> The account that creates the app is automatically allowed to use it — no extra user management needed for yourself.

### 2. Get an Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Buy the minimum $5 of credits (Plans & Billing) — enough for hundreds of curations.
3. Create an API key (starts with `sk-ant-`).

### 3. Clone and configure

```bash
git clone https://github.com/josephvutrinh/playlist-editor.git
cd playlist-editor
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your Spotify Client ID + Secret, your Anthropic key, and any long random string for `SESSION_SECRET`.

### 4. Run the backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Run the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

### 6. Use it

Open **http://127.0.0.1:5173** — must be `127.0.0.1`, not `localhost`, so the login cookie is shared with the backend. Hit **Connect Spotify** and you're in.

## How it works

Spotify's API exposes no genre data to new apps (tracks/albums never had it; the artist `genres` field and batch artist endpoint were removed in the Feb 2026 API migration), so the backend sends the theme plus every track (name — artists — album) to Claude Haiku (`claude-haiku-4-5`), which judges fit from its own knowledge of the songs and returns removals with reasons. If you opt into additions, a second Haiku call proposes real songs matching the theme; each is verified against Spotify search before it's shown. Only playlists you own appear in the gallery. Spotify restricts playlist-item access to owned/collaborative playlists.

### Stack

- **frontend/** — React + TypeScript + Vite + Tailwind
- **backend/** — FastAPI, Spotify Web API, Anthropic SDK, librosa

## Troubleshooting

| Symptom | Fix |
|---|---|
| Spotify `403 Forbidden` right after login | Your Spotify app is missing the **Web API** checkbox — check it in the dashboard settings, then log out and back in
| `Claude API error: … credit balance is too low` | Add credits at console.anthropic.com → Plans & Billing |
| A track's play button shows ∅ | Neither Deezer nor iTunes has a preview for that song — everything else still works |
| Login loop / cookie problems | Make sure you're on `http://127.0.0.1:5173`, not `localhost:5173` |
| Backend won't start: missing env var | Every value in `backend/.env.example` must be present in `backend/.env` |

## License

MIT — see [LICENSE](LICENSE).
