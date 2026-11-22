# Song Sleuth 🎵

[![CI](https://github.com/skipmarcel/name-that-tune-2/actions/workflows/ci.yml/badge.svg)](https://github.com/skipmarcel/name-that-tune-2/actions/workflows/ci.yml)

**▶ Play it: [name-that-tune-2.vercel.app](https://name-that-tune-2.vercel.app)**

A "name that tune" game built on Spotify. You hear a clip from a playlist and name the artist and the song. The best scores go on a shared leaderboard.

This is a ground-up rebuild of [name-that-tune](https://github.com/skipmarcel/name-that-tune), a vanilla-JS project I built with Amanda Guan in coding school in 2023. This version is written in React and TypeScript, has tests, and fixes the problems the original shipped with.

> **Status:** live. See the [roadmap](#roadmap) for what's been built.

## How to play

1. Pick a playlist and press **Start**. A random track from it starts playing. The title and artist stay hidden.
2. Name the **artist** and the **song title** in their own boxes. Each box is checked on its own: a right answer locks in with a ✓, and you can keep trying the other one.
3. Small differences don't count against you: capitalization, punctuation, a leading "The", swapped letters, "feat." credits and suffixes like "– Remastered 2011" are all forgiven. For songs with several artists, any one of them counts.
4. Can't get it? **Reveal answer** ends the song and keeps any points you've already earned.
5. After 10 songs you get your final score, and the best scores go on a shared leaderboard.

| You name      | Points |
| ------------- | ------ |
| Artist        | 2      |
| Song title    | 1      |
| Both          | 3      |

A perfect game is 30 points.

## Tech stack

| Area      | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| UI        | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build     | [Vite](https://vite.dev)                                                   |
| Testing   | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) |
| Linting   | [Oxlint](https://oxc.rs)                                                   |
| Music API | [Spotify Web API](https://developer.spotify.com/documentation/web-api) + [iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api) |
| Hosting   | [Vercel](https://vercel.com) (static site + two serverless functions)      |
| Storage   | [Upstash Redis](https://upstash.com) via Vercel's Redis integration        |
| CI        | GitHub Actions                                                             |

## How it works

```
 Ahead of time (playlist owner)                    At play time (anyone)
┌───────────────────────┐  sign in (PKCE)        ┌──────────────┐  track IDs   ┌──────────────────────┐
│ npm run sync-playlist │ ─────────────────────▶ │ React app    │ ───────────▶ │ Hidden Spotify embed │
│                       │  GET playlist items    │ (browser)    │              │ (iFrame API)         │
└───────────┬───────────┘  page by page          └──┬────▲──────┘              └──────────────────────┘
            │ writes                    ticket,     │    │ signed ticket,
            ▼                           guesses     ▼    │ server-computed score
   src/data/playlists/*.json ──────────▶ ┌──────────────────────┐      ┌───────────────┐
     (bundled into the app and           │ /api/games           │ ───▶ │ Upstash Redis │
      read by the API)                   │ /api/leaderboard     │      │ (top scores)  │
                                         └──────────────────────┘      └───────────────┘
```

Some decisions worth calling out:

- **The song list is synced ahead of time.** Spotify only returns a playlist's tracks to its signed-in owner or collaborators, so the game can't read them with app credentials alone. `npm run sync-playlist` has the owner sign in once in the browser (Authorization Code flow with PKCE, so no secret is involved), follows Spotify's pagination to read every track, drops local files, episodes and duplicates, and saves each playlist to `src/data/playlists/<id>.json`. The files are committed, so players never need a Spotify account and the game makes no API calls just to start. The trade-off is that the sync has to be run again after a playlist changes.
- **Players choose the playlist.** The playlists on offer, and the names players see, are listed in `src/data/playlists.config.json`, so a playlist called "Faves" on Spotify can appear as "Obscure Folk and Rock" in the game.
- **No Spotify secret anywhere.** The original project put the Spotify client secret in the front-end bundle, where anyone could read it. This version doesn't use one: the sync uses PKCE, which only needs the public client ID, and playback goes through Spotify's embed, which needs no token. (An earlier version served Spotify tokens from a serverless function; it was removed once nothing needed it.) The only server secret is the leaderboard's ticket-signing key.
- **The leaderboard never trusts a score from the browser.** When a game starts, `POST /api/games` picks the 10 tracks on the server and returns them in an HMAC-signed ticket (fetched ahead of time on the home screen, so Start can still begin playback inside the click). When it ends, the browser sends the ticket plus the artist and title guesses that were accepted in each round. The server checks the signature, re-checks every guess against the real artists and titles with the same matching code the game uses, and stores the score it computed. Tickets are single-use and expire after 3 hours, games faster than 2 seconds a song are rejected, submissions are rate-limited per IP, and names are Unicode-normalized and stripped of invisible characters. Someone could still look answers up mid-game; the goal is that the only way onto the board is to actually name the songs. If the API is unreachable, the game still plays, unranked.
- **The answer stays hidden.** The track plays through Spotify's embed player, which displays the song title. The player is kept off-screen (and hidden from screen readers) and controlled with the iFrame API, so the game's own UI handles play and pause, and the title and artist are only revealed after you guess. Playback starts from the Start and Next button clicks, because browsers only allow audio to start from a user gesture. Listeners who aren't signed in to Spotify in their browser may only hear a short preview of each track.
- **Guesses are judged leniently.** A guess is normalized (lowercased, accents and punctuation stripped, "feat.", remaster/live suffixes, subtitles after a dash and bracketed parts optional) and up to two typos are forgiven, with two swapped letters counting as one. Numbers and roman numerals must match, so "Dance II" doesn't count for "Dance I". For artists, any one credited artist counts and a leading "The" is optional. The rules are checked against every title and artist in the synced playlists.
- **No song twice in a game.** Different versions of a song ("Angie" and "Angie - 2015 Remaster") count as the same song when picking the 10 tracks.
- **An animated spirograph background in pure CSS.** About 200 outlined shapes, each placed, colored and timed by CSS custom properties computed from its index, draw themselves in and slowly spin, with no JavaScript animation. Dark mode uses a neon palette that lightens where lines cross; light mode uses a warm palette that darkens instead. The glow is dropped on small screens to keep phones smooth, and the pattern freezes when "reduce motion" is on.
- **Built for phones and keyboards.** The layout is a single column that works from 320px up, in light and dark mode. Inputs are 16px so iOS doesn't zoom, focus moves to the box that still needs an answer after each guess and to "Next song" after each song, results are announced to screen readers, and animations respect "reduce motion".
- **Game logic is kept separate from the UI.** Scoring, track selection and guess matching are pure TypeScript functions with unit tests. The React components handle display and user input only.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22 or newer
- A Spotify account and an app created in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), which gives you a client ID. Add `http://127.0.0.1:5173/callback` as a redirect URI in the app's settings.

### Setup

```bash
git clone https://github.com/skipmarcel/name-that-tune-2.git
cd name-that-tune-2
npm install
cp .env.example .env   # then fill in your Spotify credentials
npm run dev
```

Then open http://localhost:5173.

### Adding or changing playlists

1. Add an entry to `src/data/playlists.config.json` with the playlist's ID (the part of the share link after `/playlist/`) and the title to show players. You must own or collaborate on the playlist.
2. Stop the dev server if it's running (the sync uses the same port for the sign-in redirect).
3. Run `npm run sync-playlist` and approve the Spotify sign-in that opens in your browser. To sync just one playlist, pass its ID or link: `npm run sync-playlist -- <id>`.
4. Commit the updated files in `src/data/playlists/`.

### Environment variables

| Variable                | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `SPOTIFY_CLIENT_ID`     | Client ID from the Spotify Developer Dashboard (used only by `npm run sync-playlist`) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis credentials, set automatically by Vercel's Redis integration. Optional locally: without them `npm run dev` keeps scores in memory |
| `LEADERBOARD_SECRET`    | Long random string that signs game tickets (`openssl rand -hex 32`). Required on Vercel; generated per run locally |

`.env` is ignored by git. Never commit real credentials.

## Project structure

```
api/                    Vercel functions: /api/games and /api/leaderboard
server/
  leaderboard/            Ticket signing, server-side scoring, name cleanup,
                          Redis/in-memory storage and the request handlers
  vite-api-plugin.ts      Serves /api/* during `npm run dev`
scripts/
  sync-playlist.ts      Signs in to Spotify and saves each playlist's tracks
src/                    React app
  data/playlists.config.json  Playlists players can choose, and their display names
  data/playlists/         Synced track lists, bundled into the app
  components/             Game screens (playlist picker, round, answer, results) and the spirograph background
  game/                   Pure, unit-tested game logic
    match.ts                Lenient, typo-tolerant title and artist matching
    scoring.ts              Points for the artist (2) and title (1)
    pick.ts                 Random track selection without repeats
    game.ts                 Round-based game state reducer
  lib/playlist.ts         Saved playlist format and Spotify item parsing
  player/                 Spotify iFrame API loader and the useSpotifyPlayer hook
  leaderboard/            API client and the useLeaderboard hook
tests/                  End-to-end leaderboard flow: the app against the real API in-process
```

## Scripts

| Command              | What it does                         |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the dev server                 |
| `npm run build`      | Type-check and build for production  |
| `npm run preview`    | Serve the production build locally   |
| `npm run lint`       | Lint with Oxlint                     |
| `npm run typecheck`  | Run the TypeScript compiler          |
| `npm test`           | Run the test suite once              |
| `npm run test:watch` | Run tests in watch mode              |
| `npm run sync-playlist` | Save every configured playlist's tracks to `src/data/playlists/` |

## Roadmap

- [x] Project setup: Vite, React, TypeScript, Vitest, Oxlint
- [x] CI with GitHub Actions (lint, typecheck, test, build)
- [x] Load playlist tracks, including playlists over 100 songs (paginated)
- [x] Random track selection without repeats
- [x] Choice of playlists
- [x] Hidden player controlled through the Spotify iFrame API
- [x] Lenient guess matching
- [x] Separate artist (2 pts) and title (1 pt) guesses
- [x] 10-round game with an end screen
- [x] Shared leaderboard with server-side scoring
- [x] Responsive, accessible UI
- [x] Deploy to Vercel

## What changed from the original

| Original (2023)                                       | Song Sleuth (this repo)                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| Client secret in the front-end bundle                 | No secret needed at all (PKCE sync, embed player) |
| Spotify embed displayed the answer                    | Player hidden; answer revealed after the guess    |
| Exact-match guessing                                  | Normalized, typo-tolerant matching                |
| Game never ended (counter tied to a missing button)   | Round-based game state with an end screen         |
| Only the first 100 playlist tracks loaded             | Paginated playlist loading                        |
| No working tests                                      | Unit and component tests, run in CI               |

## License

[MIT](LICENSE)

---

Built by [Tyler Adams](https://github.com/skipmarcel).
