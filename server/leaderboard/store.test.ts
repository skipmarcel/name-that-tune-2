// @vitest-environment node
import { MAX_ENTRIES, MemoryStore, UpstashStore, rankValue, type LeaderboardEntry } from './store.js'

function entry(id: string, score: number, createdAt: number, playlistId = 'p'): LeaderboardEntry {
  return { id, playlistId, name: id, score, maxScore: 30, correct: score, createdAt }
}

describe('rankValue', () => {
  it('orders by score, then earliest first', () => {
    expect(rankValue(entry('a', 10, 5_000))).toBeGreaterThan(rankValue(entry('b', 9, 1_000)))
    expect(rankValue(entry('a', 10, 1_000))).toBeGreaterThan(rankValue(entry('b', 10, 2_000)))
  })
})

describe('MemoryStore', () => {
  it('ranks entries and keeps boards separate per playlist', async () => {
    const store = new MemoryStore()
    expect(await store.addEntry(entry('a', 10, 1))).toBe(1)
    expect(await store.addEntry(entry('b', 20, 2))).toBe(1)
    expect(await store.addEntry(entry('c', 10, 3))).toBe(3)
    await store.addEntry(entry('z', 30, 4, 'other'))
    expect((await store.topEntries('p', 10)).map((e) => e.id)).toEqual(['b', 'a', 'c'])
    expect((await store.topEntries('p', 2)).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it(`keeps only the top ${MAX_ENTRIES} entries`, async () => {
    const store = new MemoryStore()
    for (let i = 0; i < MAX_ENTRIES + 5; i++) await store.addEntry(entry(`e${i}`, i % 31, i))
    expect(await store.topEntries('p', 1000)).toHaveLength(MAX_ENTRIES)
  })

  it('lets a key be claimed once until it expires', async () => {
    let now = 0
    const store = new MemoryStore(() => now)
    expect(await store.claimOnce('k', 10)).toBe(true)
    expect(await store.claimOnce('k', 10)).toBe(false)
    now = 11_000
    expect(await store.claimOnce('k', 10)).toBe(true)
  })

  it('counts hits per window', async () => {
    let now = 0
    const store = new MemoryStore(() => now)
    expect(await store.hit('ip', 60)).toBe(1)
    expect(await store.hit('ip', 60)).toBe(2)
    now = 61_000
    expect(await store.hit('ip', 60)).toBe(1)
  })
})

describe('UpstashStore', () => {
  function fakeRedis(results: unknown[]) {
    const requests: { url: string; commands: unknown; auth: string | null }[] = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({
        url,
        commands: JSON.parse(String(init.body)),
        auth: new Headers(init.headers).get('authorization'),
      })
      return new Response(JSON.stringify(results.map((result) => ({ result }))))
    }) as typeof fetch
    return { requests, fetchImpl }
  }

  it('adds an entry, reads its rank and trims the board in one pipeline', async () => {
    const redis = fakeRedis([1, 4, 0])
    const store = new UpstashStore('https://redis.example/', 'token', redis.fetchImpl)
    const e = entry('a', 12, 1_000)
    expect(await store.addEntry(e)).toBe(5)
    expect(redis.requests[0]).toEqual({
      url: 'https://redis.example/pipeline',
      auth: 'Bearer token',
      commands: [
        ['ZADD', 'leaderboard:p', rankValue(e), JSON.stringify(e)],
        ['ZREVRANK', 'leaderboard:p', JSON.stringify(e)],
        ['ZREMRANGEBYRANK', 'leaderboard:p', 0, -(MAX_ENTRIES + 1)],
      ],
    })
  })

  it('reads the top entries highest first', async () => {
    const e = entry('a', 12, 1_000)
    const redis = fakeRedis([[JSON.stringify(e), 'not json']])
    const store = new UpstashStore('https://redis.example', 'token', redis.fetchImpl)
    expect(await store.topEntries('p', 10)).toEqual([e])
    expect(redis.requests[0].commands).toEqual([['ZRANGE', 'leaderboard:p', 0, 9, 'REV']])
  })

  it('claims a key with SET NX EX', async () => {
    const store = new UpstashStore('https://r', 't', fakeRedis(['OK']).fetchImpl)
    expect(await store.claimOnce('ticket:1', 60)).toBe(true)
    expect(await new UpstashStore('https://r', 't', fakeRedis([null]).fetchImpl).claimOnce('ticket:1', 60)).toBe(false)
  })

  it('throws on Redis errors', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify([{ error: 'WRONGTYPE' }]))) as unknown as typeof fetch
    await expect(new UpstashStore('https://r', 't', fetchImpl).hit('k', 60)).rejects.toThrow('WRONGTYPE')
  })
})
