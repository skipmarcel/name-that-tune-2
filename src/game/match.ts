/**
 * Lenient guess matching.
 *
 * Titles and guesses are normalized (case, accents, punctuation, "&" vs "and")
 * and compared with a typo-tolerant similarity check. Numbers and roman
 * numerals must match exactly, so "Dance II" doesn't count for "Dance I".
 * A guess may leave out version suffixes ("- 2004 Remaster"), subtitles after
 * a dash, featured artists and anything in brackets ("(Prologue)").
 */

/** Minimum similarity (0–1) for a guess to count, after normalization. */
export const SIMILARITY_THRESHOLD = 0.8

/** Most typos forgiven in one guess, however long the title. */
export const MAX_TYPOS = 2

/** Answers this short must be typed exactly; one typo would change the word. */
const EXACT_MATCH_MAX_LENGTH = 4

const VERSION_WORDS =
  /\b(remaster(ed)?|live|version|edit|mix|remix|mono|stereo|demo|acoustic|instrumental|single|radio|extended|deluxe|bonus|re-?recorded|from)\b/i

/** Lowercases and strips accents, punctuation and extra whitespace. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '') // "don't" → "dont", not "don t"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Removes "- 2004 Remaster" style suffixes and featured-artist credits. */
function stripVersionInfo(title: string): string {
  return title
    .replace(/\s+[-–—]\s+(.*)$/, (whole, suffix: string) => (VERSION_WORDS.test(suffix) ? '' : whole))
    .replace(/[([]\s*(feat|ft|with)\.?\s[^)\]]*[)\]]/gi, '')
    .replace(/\s(feat|ft)\.?\s.*$/i, '')
    .trim()
}

/** Removes every "(…)" and "[…]" segment. */
function stripBrackets(title: string): string {
  return title.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').trim()
}

/**
 * The title as a player would think of it: version suffixes and featured
 * artists removed, but parts like "(Prologue)" kept. Used for hints and for
 * revealing the answer.
 */
export function displayTitle(title: string): string {
  return stripVersionInfo(title) || title
}

/** The part before a " - " subtitle: "L'été indien - Septemberwind" → "L'été indien". */
function stripSubtitle(title: string): string {
  return title.split(/\s+[-–—]\s+/)[0]
}

/** Every normalized form of the title that counts as correct. */
export function acceptedAnswers(title: string): string[] {
  const base = stripVersionInfo(title)
  const main = stripSubtitle(base)
  const forms = [title, base, stripBrackets(base), main, stripBrackets(main)].map(normalize).filter(Boolean)
  return [...new Set(forms)]
}

/**
 * Identifies a song regardless of version, so a remaster and the original
 * count as the same song: "Angie - 2015 Remaster" and "Angie" → "angie".
 */
export function songKey(title: string): string {
  return normalize(stripBrackets(stripSubtitle(stripVersionInfo(title)))) || normalize(title)
}

/**
 * Edit distance counting insertions, deletions, substitutions and swaps of
 * two neighboring letters ("brain" → "brian" is one edit). Known as the
 * optimal string alignment distance.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
      }
    }
  }
  return rows[a.length][b.length]
}

/** 1 for identical strings, falling towards 0 as they differ. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}

const NUMBER_TOKEN = /^(\d+|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/

/** The numbers and roman numerals in a normalized string, e.g. "dance ii 2" → "2 ii". */
function numberTokens(normalized: string): string {
  return normalized
    .split(' ')
    .filter((word) => NUMBER_TOKEN.test(word))
    .sort()
    .join(' ')
}

function matches(guess: string, answer: string): boolean {
  if (answer.length <= EXACT_MATCH_MAX_LENGTH) return guess === answer
  if (numberTokens(guess) !== numberTokens(answer)) return false
  const edits = editDistance(guess, answer)
  return edits <= MAX_TYPOS && 1 - edits / Math.max(guess.length, answer.length) >= SIMILARITY_THRESHOLD
}

/** Whether a guess should count as naming the given title. */
export function isCorrectGuess(guess: string, title: string): boolean {
  const normalizedGuess = normalize(guess)
  if (!normalizedGuess) return false
  return acceptedAnswers(title).some((answer) => matches(normalizedGuess, answer))
}

/** Forms of an artist name that count: "The Jesus and Mary Chain" also as "Jesus and Mary Chain". */
function artistForms(name: string): string[] {
  const normalized = normalize(name)
  return [normalized, normalized.replace(/^the /, '')].filter(Boolean)
}

/**
 * Whether a guess names the artist. Any one credited artist counts ("Philip
 * Glass" for "Philip Glass, Michael Riesman"), as does naming them all.
 * A leading "The" is optional, and the same typo rules as titles apply.
 */
export function isCorrectArtist(guess: string, artists: readonly string[]): boolean {
  const normalizedGuess = normalize(guess)
  if (!normalizedGuess) return false
  const names = artists.length > 1 ? [...artists, artists.join(' and ')] : artists
  const answers = [...new Set(names.flatMap(artistForms))]
  const guesses = artistForms(guess)
  return answers.some((answer) => guesses.some((g) => matches(g, answer)))
}
