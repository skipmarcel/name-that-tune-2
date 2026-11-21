/**
 * Server-side scoring. The client never reports a score: it sends the guess
 * that won each round and how many hints it used, and the server re-checks
 * every guess against the real titles with the same matching rules the game
 * uses.
 */
import { isCorrectGuess } from '../../src/game/match.js'
import { HINTS, MAX_POINTS, pointsFor } from '../../src/game/scoring.js'

export interface SubmittedRound {
  /** The guess that was accepted, or null if the player gave up. */
  guess: string | null
  hintsUsed: number
}

export interface ScoredGame {
  score: number
  maxScore: number
  correct: number
}

const MAX_GUESS_LENGTH = 200

/** Validates the shape of the submitted rounds; returns null if malformed. */
export function parseRounds(value: unknown, expectedCount: number): SubmittedRound[] | null {
  if (!Array.isArray(value) || value.length !== expectedCount) return null
  const rounds: SubmittedRound[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null
    const { guess, hintsUsed } = raw as Record<string, unknown>
    if (!(guess === null || (typeof guess === 'string' && guess.length <= MAX_GUESS_LENGTH))) return null
    if (!Number.isInteger(hintsUsed) || (hintsUsed as number) < 0 || (hintsUsed as number) > HINTS.length) {
      return null
    }
    rounds.push({ guess, hintsUsed: hintsUsed as number })
  }
  return rounds
}

/** Scores each round against the real track titles, in ticket order. */
export function scoreRounds(titles: readonly string[], rounds: readonly SubmittedRound[]): ScoredGame {
  let score = 0
  let correct = 0
  rounds.forEach((round, i) => {
    if (round.guess !== null && isCorrectGuess(round.guess, titles[i])) {
      correct++
      score += pointsFor(round.hintsUsed)
    }
  })
  return { score, maxScore: titles.length * MAX_POINTS, correct }
}
