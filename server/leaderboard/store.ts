/**
 * Leaderboard storage. Production uses Upstash Redis over its REST API (what
 * Vercel's Redis integration provides); local development and tests use an
 * in-memory store with the same behavior.
 */

export interface LeaderboardEntry {
  id: string
  playlistId: string
  name: string
  score: number
  maxScore: number
  correct: number
  /** Milliseconds since the epoch. */
  createdAt: number
}

export interface LeaderboardStore {
  /** Saves an entry and returns its 1-based rank on that playlist's board. */
  addEntry(entry: LeaderboardEntry): Promise<number>
  topEntries(playlistId: string, limit: number): Promise<LeaderboardEntry[]>
  /** Marks `key` as used. Returns false if it was already used. */
  claimOnce(key: string, ttlSeconds: number): Promise<boolean>
  /** Counts a hit for `key` in the current window and returns the count so far. */
  hit(key: string, windowSeconds: number): Promise<number>
}

/** Entries kept per playlist; lower scores fall off the board. */
export const MAX_ENTRIES = 100

/**
 * Sort key: higher scores first, and for equal scores the earlier entry
 * first. Fits comfortably in a double (scores ≤ 30, timestamps < 10^13).
 */
export function rankValue(entry: Pick<LeaderboardEntry, 'score' | 'createdAt'>): number {
  return entry.score * 1e13 + (1e13 - entry.createdAt)
}

const boardKey = (playlistId: string) => `leaderboard:${playlistId}`

export class MemoryStore implements LeaderboardStore {
  private boards = new Map<string, LeaderboardEntry[]>()
  private claimed = new Map<string, number>()
  private hits = new Map<string, { count: number; expiresAt: number }>()
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  async addEntry(entry: LeaderboardEntry): Promise<number> {
    const board = [...(this.boards.get(entry.playlistId) ?? []), entry].sort(
      (a, b) => rankValue(b) - rankValue(a),
    )
    const rank = board.indexOf(entry) + 1
    this.boards.set(entry.playlistId, board.slice(0, MAX_ENTRIES))
    return rank
  }

  async topEntries(playlistId: string, limit: number): Promise<LeaderboardEntry[]> {
    return (this.boards.get(playlistId) ?? []).slice(0, limit)
  }

  async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    const expiresAt = this.claimed.get(key)
    if (expiresAt !== undefined && expiresAt > this.now()) return false
    this.claimed.set(key, this.now() + ttlSeconds * 1000)
    return true
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const current = this.hits.get(key)
    if (!current || current.expiresAt <= this.now()) {
      this.hits.set(key, { count: 1, expiresAt: this.now() + windowSeconds * 1000 })
      return 1
    }
    current.count++
    return current.count
  }
}

type RedisCommand = (string | number)[]

/** Minimal Upstash Redis REST client: https://upstash.com/docs/redis/features/restapi */
export class UpstashStore implements LeaderboardStore {
  private url: string
  private token: string
  private fetchImpl: typeof fetch

  constructor(url: string, token: string, fetchImpl: typeof fetch = fetch) {
    this.url = url.replace(/\/$/, '')
    this.token = token
    this.fetchImpl = fetchImpl
  }

  /** Runs commands in one round trip and returns each command's result. */
  private async pipeline(commands: RedisCommand[]): Promise<unknown[]> {
    const response = await this.fetchImpl(`${this.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
    if (!response.ok) throw new Error(`Redis request failed: ${response.status}`)
    const results = (await response.json()) as { result?: unknown; error?: string }[]
    return results.map((r) => {
      if (r.error) throw new Error(`Redis error: ${r.error}`)
      return r.result
    })
  }

  async addEntry(entry: LeaderboardEntry): Promise<number> {
    const key = boardKey(entry.playlistId)
    // The entry itself is the set member, so trimming the set also deletes
    // the data for entries that fall off the board.
    const member = JSON.stringify(entry)
    const [, rank] = await this.pipeline([
      ['ZADD', key, rankValue(entry), member],
      ['ZREVRANK', key, member],
      ['ZREMRANGEBYRANK', key, 0, -(MAX_ENTRIES + 1)],
    ])
    return Number(rank) + 1
  }

  async topEntries(playlistId: string, limit: number): Promise<LeaderboardEntry[]> {
    const [members] = await this.pipeline([['ZRANGE', boardKey(playlistId), 0, limit - 1, 'REV']])
    if (!Array.isArray(members)) return []
    return members.flatMap((m) => {
      try {
        return [JSON.parse(String(m)) as LeaderboardEntry]
      } catch {
        return []
      }
    })
  }

  async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    const [result] = await this.pipeline([['SET', key, '1', 'NX', 'EX', ttlSeconds]])
    return result === 'OK'
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const [count] = await this.pipeline([
      ['INCR', key],
      ['EXPIRE', key, windowSeconds, 'NX'],
    ])
    return Number(count)
  }
}
