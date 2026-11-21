import { displayTitle } from './match.js'

/** Hints unlock in this order; each one used lowers the round's points. */
export const HINTS = ['albumArt', 'artist', 'titleLetters'] as const
export type Hint = (typeof HINTS)[number]

export const MAX_POINTS = HINTS.length

/** Points for a correct guess: 3 with no hints, down to 0 with all three. */
export function pointsFor(hintsUsed: number): number {
  return Math.max(0, MAX_POINTS - hintsUsed)
}

/** The hints a player has unlocked after using `hintsUsed` of them. */
export function unlockedHints(hintsUsed: number): Hint[] {
  return HINTS.slice(0, Math.max(0, hintsUsed))
}

/**
 * Shows the first letter of each word and blanks out the rest, keeping
 * punctuation and digits: "Don't Call Me Hero" → "D__'_ C___ M_ H___".
 * Version suffixes are dropped first so the hint matches what players type.
 */
export function titleLettersHint(title: string): string {
  return displayTitle(title)
    .split(/(\s+)/)
    .map((word) => {
      let seenLetter = false
      return [...word]
        .map((char) => {
          if (!/\p{L}/u.test(char)) return char
          if (seenLetter) return '_'
          seenLetter = true
          return char
        })
        .join('')
    })
    .join('')
}
