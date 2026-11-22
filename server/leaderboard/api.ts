/**
 * The leaderboard API, written against web-standard Request/Response so the
 * same code runs as Vercel functions and inside the Vite dev server.
 *
 *   POST /api/games         { playlistId }                 → { ticket, trackIds }
 *   GET  /api/leaderboard?playlist=<id>                    → { entries }
 *   POST /api/leaderboard   { ticket, name, rounds: [{ artist, title }] } → { rank, entry, entries }
 */
import { startGame } from '../../src/game/game.js'
import type { Track } from '../../src/lib/playlist.js'
import { cleanName } from './name.js'
import { parseRounds, scoreRounds } from './score.js'
import type { LeaderboardEntry, LeaderboardStore } from './store.js'
import { createTicket, decodeTicket, encodeTicket } from './ticket.js'

export interface LeaderboardApiOptions {
  store: LeaderboardStore
  secret: string
  /** Looks up a playlist's tracks; undefined if the ID isn't offered. */
  getTracks: (playlistId: string) => Track[] | undefined
  now?: () => number
  random?: () => number
}

/** Entries returned to the client. */
export const LEADERBOARD_SIZE = 10
/** Tickets older than this can't be submitted. */
export const TICKET_MAX_AGE_MS = 3 * 60 * 60 * 1000
/** No one can play a song and type its title faster than this. */
export const MIN_MS_PER_ROUND = 2000
const RATE_WINDOW_SECONDS = 10 * 60
const MAX_GAMES_PER_WINDOW = 60
const MAX_SUBMISSIONS_PER_WINDOW = 10
const MAX_BODY_BYTES = 16 * 1024

export type PublicEntry = Omit<LeaderboardEntry, 'playlistId'>

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })
}

const error = (status: number, message: string) => json({ error: message }, status)

function clientAddress(request: Request): string {
  // Vercel sets x-forwarded-for; the first address is the client.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return null
  try {
    const body: unknown = JSON.parse(text)
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function toPublic({ playlistId: _playlistId, ...entry }: LeaderboardEntry): PublicEntry {
  return entry
}

export function createLeaderboardApi({
  store,
  secret,
  getTracks,
  now = Date.now,
  random = Math.random,
}: LeaderboardApiOptions) {
  async function rateLimited(kind: string, request: Request, limit: number) {
    const count = await store.hit(`rate:${kind}:${clientAddress(request)}`, RATE_WINDOW_SECONDS)
    return count > limit
  }

  async function startNewGame(request: Request) {
    if (await rateLimited('games', request, MAX_GAMES_PER_WINDOW)) {
      return error(429, 'Too many games started. Try again in a few minutes.')
    }
    const body = await readJson(request)
    const playlistId = typeof body?.playlistId === 'string' ? body.playlistId : ''
    const tracks = getTracks(playlistId)
    if (!tracks || tracks.length === 0) return error(404, 'Unknown playlist')

    const action = startGame(tracks, random)
    if (action.type !== 'start') return error(500, 'Could not pick tracks')
    const trackIds = action.tracks.map((t) => t.id)
    const ticket = encodeTicket(createTicket(playlistId, trackIds, now()), secret)
    return json({ ticket, trackIds })
  }

  async function listEntries(request: Request) {
    const playlistId = new URL(request.url).searchParams.get('playlist') ?? ''
    if (!getTracks(playlistId)) return error(404, 'Unknown playlist')
    const entries = await store.topEntries(playlistId, LEADERBOARD_SIZE)
    return json({ entries: entries.map(toPublic) })
  }

  async function submitScore(request: Request) {
    if (await rateLimited('scores', request, MAX_SUBMISSIONS_PER_WINDOW)) {
      return error(429, 'Too many scores submitted. Try again in a few minutes.')
    }
    const body = await readJson(request)
    if (!body) return error(400, 'Invalid request')

    const ticket = typeof body.ticket === 'string' ? decodeTicket(body.ticket, secret) : null
    if (!ticket) return error(400, 'Invalid game ticket')

    const playlistTracks = getTracks(ticket.playlistId)
    const tracks = ticket.trackIds.map((id) => playlistTracks?.find((t) => t.id === id))
    if (tracks.some((t) => t === undefined)) {
      return error(409, 'This playlist has changed since the game started')
    }

    const elapsed = now() - ticket.issuedAt
    if (elapsed > TICKET_MAX_AGE_MS) return error(410, 'This game is too old to submit')
    if (elapsed < ticket.trackIds.length * MIN_MS_PER_ROUND) return error(422, 'That game finished impossibly fast')

    const name = cleanName(body.name)
    if (!name) return error(400, 'Enter a name with at least one letter or number')

    const rounds = parseRounds(body.rounds, ticket.trackIds.length)
    if (!rounds) return error(400, 'Invalid rounds')

    // Claim last, so a rejected submission doesn't burn the ticket.
    if (!(await store.claimOnce(`ticket:${ticket.id}`, TICKET_MAX_AGE_MS / 1000))) {
      return error(409, 'This game has already been submitted')
    }

    const { score, maxScore, correct } = scoreRounds(tracks as Track[], rounds)
    const entry: LeaderboardEntry = {
      id: ticket.id,
      playlistId: ticket.playlistId,
      name,
      score,
      maxScore,
      correct,
      createdAt: now(),
    }
    const rank = await store.addEntry(entry)
    const entries = await store.topEntries(ticket.playlistId, LEADERBOARD_SIZE)
    return json({ rank, entry: toPublic(entry), entries: entries.map(toPublic) }, 201)
  }

  /** Routes a request to the matching endpoint. */
  return async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/api/games') {
        return request.method === 'POST' ? await startNewGame(request) : error(405, 'Method not allowed')
      }
      if (pathname === '/api/leaderboard') {
        if (request.method === 'GET') return await listEntries(request)
        if (request.method === 'POST') return await submitScore(request)
        return error(405, 'Method not allowed')
      }
      return error(404, 'Not found')
    } catch (err) {
      console.error('[leaderboard]', err)
      return error(500, 'Something went wrong. Try again.')
    }
  }
}

