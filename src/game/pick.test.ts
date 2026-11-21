import { pickRandom } from './pick'

/** Deterministic pseudo-random numbers (mulberry32) for repeatable tests. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const items = Array.from({ length: 115 }, (_, i) => i)

describe('pickRandom', () => {
  it('returns the requested number of distinct items from the list', () => {
    const picked = pickRandom(items, 10, seeded(1))
    expect(picked).toHaveLength(10)
    expect(new Set(picked).size).toBe(10)
    picked.forEach((item) => expect(items).toContain(item))
  })

  it('returns everything, shuffled, when asked for more than exist', () => {
    const picked = pickRandom([1, 2, 3], 10, seeded(2))
    expect([...picked].sort()).toEqual([1, 2, 3])
  })

  it('handles empty input and non-positive counts', () => {
    expect(pickRandom([], 10)).toEqual([])
    expect(pickRandom(items, 0)).toEqual([])
    expect(pickRandom(items, -3)).toEqual([])
  })

  it('does not modify the input', () => {
    const input = [1, 2, 3, 4]
    pickRandom(input, 2, seeded(3))
    expect(input).toEqual([1, 2, 3, 4])
  })

  it('works with the extreme values Math.random can return', () => {
    expect(pickRandom([1, 2, 3], 3, () => 0)).toHaveLength(3)
    expect(new Set(pickRandom([1, 2, 3], 3, () => 0.999999))).toEqual(new Set([1, 2, 3]))
  })

  it('skips items that duplicate one already picked', () => {
    const songs = ['Angie', 'Angie (Remaster)', 'Mars', 'Mars (Live)', 'Floe']
    const sameFirstWord = (a: string, b: string) => a.split(' ')[0] === b.split(' ')[0]
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickRandom(songs, 5, seeded(seed), sameFirstWord)
      expect(picked.map((s) => s.split(' ')[0]).sort()).toEqual(['Angie', 'Floe', 'Mars'])
    }
  })

  it('gives every item a fair chance of being picked', () => {
    const random = seeded(4)
    const counts = new Array<number>(20).fill(0)
    for (let run = 0; run < 20_000; run++) {
      for (const item of pickRandom(counts.map((_, i) => i), 5, random)) counts[item]++
    }
    // Each item is expected 5,000 times (20,000 runs × 5 picks ÷ 20 items).
    counts.forEach((count) => expect(Math.abs(count - 5000)).toBeLessThan(300))
  })
})
