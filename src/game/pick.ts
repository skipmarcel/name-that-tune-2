/**
 * Picks `count` distinct items in random order (a Fisher–Yates shuffle that
 * stops once it has enough). Returns every item, shuffled, if there are fewer
 * than `count`. `random` is injectable so tests can be deterministic.
 *
 * With `isDuplicate`, an item is skipped when it duplicates one already
 * picked, e.g. a second version of the same song.
 */
export function pickRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
  isDuplicate?: (candidate: T, alreadyPicked: T) => boolean,
): T[] {
  const pool = [...items]
  const wanted = Math.max(0, Math.floor(count))
  const picked: T[] = []
  for (let i = 0; i < pool.length && picked.length < wanted; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    const candidate = pool[i]
    if (!isDuplicate || !picked.some((other) => isDuplicate(candidate, other))) {
      picked.push(candidate)
    }
  }
  return picked
}
