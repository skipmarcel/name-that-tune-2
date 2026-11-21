/**
 * Builds the leaderboard API from environment variables. Shared by the
 * Vercel functions in api/ and the Vite dev server.
 *
 * - KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN):
 *   Upstash Redis, as set up by Vercel's Redis integration. Without them,
 *   scores are kept in memory, which is fine for local development only.
 * - LEADERBOARD_SECRET: signs game tickets. Generated per process in
 *   development; required in production.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PlaylistConfigEntry, SavedPlaylist, Track } from '../../src/lib/playlist.js'
import { createLeaderboardApi } from './api.js'
import { MemoryStore, UpstashStore, type LeaderboardStore } from './store.js'

type Env = Record<string, string | undefined>

const DATA_DIR = join(process.cwd(), 'src', 'data')

/** Reads the configured playlists' tracks from src/data (bundled via vercel.json includeFiles). */
export function loadPlaylistTracks(dataDir = DATA_DIR): Map<string, Track[]> {
  const config = JSON.parse(readFileSync(join(dataDir, 'playlists.config.json'), 'utf8')) as PlaylistConfigEntry[]
  const tracks = new Map<string, Track[]>()
  for (const { id } of config) {
    try {
      const saved = JSON.parse(readFileSync(join(dataDir, 'playlists', `${id}.json`), 'utf8')) as SavedPlaylist
      if (saved.tracks.length > 0) tracks.set(id, saved.tracks)
    } catch {
      // Not synced yet: the playlist simply isn't offered.
    }
  }
  return tracks
}

function createStore(env: Env, isProduction: boolean): LeaderboardStore | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return new UpstashStore(url, token)
  return isProduction ? null : new MemoryStore()
}

export function createLeaderboardHandler(env: Env = process.env) {
  const isProduction = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
  const store = createStore(env, isProduction)
  const secret = env.LEADERBOARD_SECRET || (isProduction ? '' : randomBytes(32).toString('hex'))

  if (!store || !secret) {
    console.error('[leaderboard] Missing Redis credentials or LEADERBOARD_SECRET')
    return async () =>
      new Response(JSON.stringify({ error: 'The leaderboard is not set up yet' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
  }

  const playlists = loadPlaylistTracks()
  return createLeaderboardApi({ store, secret, getTracks: (id) => playlists.get(id) })
}
