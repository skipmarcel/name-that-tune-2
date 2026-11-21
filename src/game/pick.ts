/**
 * Picks `count` distinct items in random order (a partial Fisher–Yates
 * shuffle). Returns every item, shuffled, if there are fewer than `count`.
 * `random` is injectable so tests can be deterministic.
 */
export function pickRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  const pool = [...items]
  const n = Math.min(Math.max(0, Math.floor(count)), pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}
