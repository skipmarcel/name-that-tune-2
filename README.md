# Song Sleuth 🎵

[![CI](https://github.com/skipmarcel/name-that-tune-2/actions/workflows/ci.yml/badge.svg)](https://github.com/skipmarcel/name-that-tune-2/actions/workflows/ci.yml)

A "name that tune" game built on the Spotify Web API. You hear a random track from a playlist and guess the title. Hints cost points, and the game keeps track of your best scores.

This is a ground-up rebuild of [name-that-tune](https://github.com/skipmarcel/name-that-tune), a vanilla-JS project I built with Amanda Guan in coding school in 2023. This version is written in React and TypeScript, has tests, and fixes the problems the original shipped with.

> **Status:** in active development. See the [roadmap](#roadmap) for what's done and what's next.

## How to play

1. Press **Start**. A random track from the playlist starts playing. The title and artist stay hidden.
2. Type your guess. Small differences don't count against you: capitalization, punctuation, "feat." credits and suffixes like "– Remastered 2011" are ignored.
3. Stuck? Each **hint** reveals more (album art, then the artist, then the first letters of the title), but lowers the points the song is worth.
4. After 10 rounds you get your final score, and the best scores are saved to a leaderboard.

| Hints used | Points |
| ---------- | ------ |
| 0          | 3      |
| 1          | 2      |
| 2          | 1      |
| 3          | 0      |

## Tech stack

| Area      | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| UI        | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build     | [Vite](https://vite.dev)                                                   |
| Testing   | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) |
| Linting   | [Oxlint](https://oxc.rs)                                                   |
| Music API | [Spotify Web API](https://developer.spotify.com/documentation/web-api) + [iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api) |
| Hosting   | [Vercel](https://vercel.com) (static site + one serverless function)      |
| CI        | GitHub Actions                                                             |

## How it works

```
┌──────────────┐   GET /api/token    ┌──────────────────────┐   client credentials   ┌──────────────┐
│ React app    │ ──────────────────▶ │ Serverless function  │ ─────────────────────▶ │ Spotify      │
│ (browser)    │ ◀────────────────── │ (holds the secret)   │ ◀───────────────────── │ Accounts API │
└──────┬───────┘   short-lived token └──────────────────────┘      access token      └──────────────┘
       │
       │  GET /v1/playlists/{id}/tracks (Bearer token)
       ▼
┌──────────────┐        ┌─────────────────────────────────────────────────┐
│ Spotify      │        │ Hidden Spotify embed, controlled through the    │
│ Web API      │        │ iFrame API, so the track plays without showing  │
└──────────────┘        │ the answer on screen                            │
                        └─────────────────────────────────────────────────┘
```

Some decisions worth calling out:

- **The Spotify client secret never reaches the browser.** The original project put the secret in the front-end bundle, where anyone could read it. Here a small serverless function exchanges the credentials for a short-lived access token, and the browser only ever sees that token.
  The endpoint caches the token in memory until just before it expires and returns it with `Cache-Control: no-store`. It is public by design, because a client-credentials token can only read public catalog data. The same handler runs as a Vercel function (`api/token.ts`) and as Vite dev-server middleware, so `npm run dev` works without the Vercel CLI.
- **The answer stays hidden.** The track plays through Spotify's embed player, which displays the song title. The player is kept off-screen and controlled with the iFrame API, so the game's own UI handles play and pause, and the title and artist are only revealed after you guess.
- **Guesses are judged leniently.** A guess is normalized (lowercased, accents and punctuation stripped, "feat." and remaster/live suffixes removed) and then compared against the title using a similarity threshold. Small typos are forgiven.
- **Game logic is kept separate from the UI.** Scoring, track selection and guess matching are pure TypeScript functions with unit tests. The React components handle display and user input only.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22 or newer
- A Spotify account and an app created in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), which gives you a client ID and client secret

### Setup

```bash
git clone https://github.com/skipmarcel/name-that-tune-2.git
cd name-that-tune-2
npm install
cp .env.example .env   # then fill in your Spotify credentials
npm run dev
```

Then open http://localhost:5173.

### Environment variables

| Variable                | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `SPOTIFY_CLIENT_ID`     | Client ID from the Spotify Developer Dashboard  |
| `SPOTIFY_CLIENT_SECRET` | Client secret. Server-side only, never exposed to the browser |
| `VITE_PLAYLIST_ID`      | ID of the public playlist to draw tracks from   |

`.env` is ignored by git. Never commit real credentials.

## Project structure

```
api/token.ts            Vercel function: GET /api/token
server/                 Server-only code (never bundled into the browser)
  spotify-token.ts        Client-credentials exchange and token cache
  token-handler.ts        HTTP handler shared by Vercel and the dev server
  vite-api-plugin.ts      Serves /api/* during `npm run dev`
src/                    React app
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

## Roadmap

- [x] Project setup: Vite, React, TypeScript, Vitest, Oxlint
- [x] CI with GitHub Actions (lint, typecheck, test, build)
- [x] Serverless token endpoint (`/api/token`)
- [ ] Load playlist tracks, including playlists over 100 songs (paginated)
- [ ] Random track selection without repeats
- [ ] Hidden player controlled through the Spotify iFrame API
- [ ] Lenient guess matching
- [ ] Hint system and scoring
- [ ] 10-round game with an end screen
- [ ] Saved leaderboard
- [ ] Responsive, accessible UI
- [ ] Deploy to Vercel

## What changed from the original

| Original (2023)                                       | Song Sleuth (this repo)                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| Client secret in the front-end bundle                 | Secret kept in a serverless function              |
| Spotify embed displayed the answer                    | Player hidden; answer revealed after the guess    |
| Exact-match guessing                                  | Normalized, typo-tolerant matching                |
| Game never ended (counter tied to a missing button)   | Round-based game state with an end screen         |
| Only the first 100 playlist tracks loaded             | Paginated playlist loading                        |
| No working tests                                      | Unit and component tests, run in CI               |

## License

[MIT](LICENSE)

---

Built by [Tyler Adams](https://github.com/skipmarcel).
