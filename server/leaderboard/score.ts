/**
 * Server-side scoring. The client never reports a score: it sends the artist
 * and title guesses that were accepted in each round, and the server
 * re-checks them against the real track with the same matching rules the
 * game uses.
 */
import { isCorrectArtist, isCorrectGuess } from '../../src/game/match.js'
import { MAX_POINTS, roundPoints } from '../../src/game/scoring.js'
import type { Track } from '../../src/lib/playlist.js'

export interface SubmittedRound {
  /** The accepted artist guess, or null if the player didn't name the artist. */
  artist: string | null
  /** The accepted title guess, or null if the player didn't name the title. */
  title: string | null
}

export interface ScoredGame {
  score: number
  maxScore: number
  /** Rounds where both the artist and the title were named. */
  correct: number
}

const MAX_GUESS_LENGTH = 200

const isGuess = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && value.length <= MAX_GUESS_LENGTH)

/** Validates the shape of the submitted rounds; returns null if malformed. */
export function parseRounds(value: unknown, expectedCount: number): SubmittedRound[] | null {
  if (!Array.isArray(value) || value.length !== expectedCount) return null
  const rounds: SubmittedRound[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null
    const { artist, title } = raw as Record<string, unknown>
    if (!isGuess(artist) || !isGuess(title)) return null
    rounds.push({ artist, title })
  }
  return rounds
}

/** Scores each round against the real tracks, in ticket order. */
export function scoreRounds(tracks: readonly Pick<Track, 'name' | 'artists'>[], rounds: readonly SubmittedRound[]): ScoredGame {
  let score = 0
  let correct = 0
  rounds.forEach((round, i) => {
    const artist = round.artist !== null && isCorrectArtist(round.artist, tracks[i].artists)
    const title = round.title !== null && isCorrectGuess(round.title, tracks[i].name)
    score += roundPoints({ artist, title })
    if (artist && title) correct++
  })
  return { score, maxScore: tracks.length * MAX_POINTS, correct }
}
