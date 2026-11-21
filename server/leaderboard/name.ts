export const MAX_NAME_LENGTH = 20

/**
 * Cleans a player name for display on a public leaderboard: normalizes
 * Unicode, removes control and invisible characters, collapses whitespace and
 * limits the length. Returns null if nothing usable is left.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    // Remaining control characters, zero-width and bidi-override characters.
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
  if (!name || !/[\p{L}\p{N}]/u.test(name)) return null
  return [...name].slice(0, MAX_NAME_LENGTH).join('').trim()
}
