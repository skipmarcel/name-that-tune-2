// @vitest-environment node
import type { Track } from '../../src/lib/playlist.js'
import { MIN_MS_PER_ROUND, TICKET_MAX_AGE_MS, createLeaderboardApi } from './api.js'
import { MemoryStore } from './store.js'
import { createTicket, encodeTicket } from './ticket.js'

const SECRET = 'secret'

function track(id: string, name: string): Track {
  return { id, name, artists: ['Artist'], album: 'Album', imageUrl: null, durationMs: 1000 }
}

const playlist = Array.from({ length: 12 }, (_, i) => track(`t${i}`, `Song Number ${i}`))

function setup() {
  let now = 1_000_000
  const store = new MemoryStore(() => now)
  const handle = createLeaderboardApi({
    store,
    secret: SECRET,
    getTracks: (id) => (id === 'p' ? playlist : undefined),
    now: () => now,
  })
  const call = (method: string, path: string, body?: unknown, ip = '1.2.3.4') =>
    handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { 'x-forwarded-for': ip },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      }),
    )
  const advance = (ms: number) => {
    now += ms
  }
  return { call, advance, store }
}

interface ApiBody {
  rank: number
  entry: { name: string; score: number; maxScore: number; correct: number }
  entries: { name: string; score: number }[]
}

const readBody = async (res: Response) => (await res.json()) as ApiBody

const titleOf = (id: string) => playlist.find((t) => t.id === id)!.name

async function startGame(call: ReturnType<typeof setup>['call']) {
  const res = await call('POST', '/api/games', { playlistId: 'p' })
  return (await res.json()) as { ticket: string; trackIds: string[] }
}

/** Correct guesses for the first `correct` rounds, give-ups after. */
function rounds(trackIds: string[], correct: number, hintsUsed = 0) {
  return trackIds.map((id, i) => ({ guess: i < correct ? titleOf(id) : null, hintsUsed }))
}

describe('POST /api/games', () => {
  it('picks 10 distinct tracks from the playlist and signs them', async () => {
    const { call } = setup()
    const { ticket, trackIds } = await startGame(call)
    expect(trackIds).toHaveLength(10)
    expect(new Set(trackIds).size).toBe(10)
    trackIds.forEach((id) => expect(playlist.map((t) => t.id)).toContain(id))
    expect(ticket).toMatch(/^[\w-]+\.[\w-]+$/)
  })

  it('rejects unknown playlists and wrong methods', async () => {
    const { call } = setup()
    expect((await call('POST', '/api/games', { playlistId: 'nope' })).status).toBe(404)
    expect((await call('GET', '/api/games')).status).toBe(405)
  })
})

describe('POST /api/leaderboard', () => {
  it('scores the game on the server and ranks it', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(60_000)

    const res = await call('POST', '/api/leaderboard', { ticket, name: ' Tyler ', rounds: rounds(trackIds, 4, 1) })
    expect(res.status).toBe(201)
    const body = await readBody(res)
    expect(body.rank).toBe(1)
    expect(body.entry).toMatchObject({ name: 'Tyler', score: 8, maxScore: 30, correct: 4 })
    expect(body.entry).not.toHaveProperty('playlistId')

    const board = await readBody(await call('GET', '/api/leaderboard?playlist=p'))
    expect(board.entries.map((e) => e.name)).toEqual(['Tyler'])
  })

  it('ignores wrong guesses even if the client sends them as wins', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(60_000)
    const fake = trackIds.map(() => ({ guess: 'I definitely got this', hintsUsed: 0 }))
    const body = await readBody(await call('POST', '/api/leaderboard', { ticket, name: 'Cheater', rounds: fake }))
    expect(body.entry.score).toBe(0)
  })

  it('accepts each ticket only once', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(60_000)
    const submission = { ticket, name: 'A', rounds: rounds(trackIds, 10) }
    expect((await call('POST', '/api/leaderboard', submission)).status).toBe(201)
    expect((await call('POST', '/api/leaderboard', submission)).status).toBe(409)
  })

  it('rejects games finished impossibly fast, or too long ago', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(10 * MIN_MS_PER_ROUND - 1)
    expect((await call('POST', '/api/leaderboard', { ticket, name: 'A', rounds: rounds(trackIds, 10) })).status).toBe(422)

    advance(TICKET_MAX_AGE_MS)
    expect((await call('POST', '/api/leaderboard', { ticket, name: 'A', rounds: rounds(trackIds, 10) })).status).toBe(410)
  })

  it('does not burn the ticket when a submission is rejected', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(60_000)
    expect((await call('POST', '/api/leaderboard', { ticket, name: '!!!', rounds: rounds(trackIds, 1) })).status).toBe(400)
    expect((await call('POST', '/api/leaderboard', { ticket, name: 'Fixed', rounds: rounds(trackIds, 1) })).status).toBe(201)
  })

  it('rejects forged tickets, malformed bodies and bad rounds', async () => {
    const { call, advance } = setup()
    const { ticket, trackIds } = await startGame(call)
    advance(60_000)
    const forged = encodeTicket(createTicket('p', trackIds, 0), 'wrong-secret')
    expect((await call('POST', '/api/leaderboard', { ticket: forged, name: 'A', rounds: rounds(trackIds, 1) })).status).toBe(400)
    expect((await call('POST', '/api/leaderboard', 'not json')).status).toBe(400)
    expect((await call('POST', '/api/leaderboard', { ticket, name: 'A', rounds: [] })).status).toBe(400)
    expect((await call('POST', '/api/leaderboard', 'x'.repeat(20_000))).status).toBe(400)
  })

  it('rejects tickets for tracks no longer in the playlist', async () => {
    const { call, advance } = setup()
    const stale = encodeTicket(createTicket('p', ['gone', ...playlist.slice(0, 9).map((t) => t.id)], 1_000_000), SECRET)
    advance(60_000)
    const res = await call('POST', '/api/leaderboard', { ticket: stale, name: 'A', rounds: Array(10).fill({ guess: null, hintsUsed: 0 }) })
    expect(res.status).toBe(409)
  })

  it('rate-limits submissions per address', async () => {
    const { call } = setup()
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await call('POST', '/api/leaderboard', 'not json')).status)
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true)
    expect(statuses[10]).toBe(429)
    // Another address is unaffected.
    expect((await call('POST', '/api/leaderboard', 'not json', '5.6.7.8')).status).toBe(400)
  })
})

describe('GET /api/leaderboard', () => {
  it('returns the top 10 for a playlist, best first', async () => {
    const { call, advance } = setup()
    for (let i = 0; i < 12; i++) {
      const { ticket, trackIds } = await startGame(call)
      advance(60_000)
      await call('POST', '/api/leaderboard', { ticket, name: `P${i}`, rounds: rounds(trackIds, i % 11) }, `10.0.0.${i}`)
    }
    const { entries } = await readBody(await call('GET', '/api/leaderboard?playlist=p'))
    expect(entries).toHaveLength(10)
    const scores = entries.map((e) => e.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(scores[0]).toBe(30)
  })

  it('rejects unknown playlists and paths', async () => {
    const { call } = setup()
    expect((await call('GET', '/api/leaderboard?playlist=nope')).status).toBe(404)
    expect((await call('GET', '/api/nothing')).status).toBe(404)
  })
})
