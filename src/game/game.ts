/**
 * Game state as a pure reducer, ready for React's `useReducer`.
 *
 *   ready ──start──▶ guessing ──correct guess / give up──▶ revealed ──next──▶ guessing …
 *                                                              └──next (last round)──▶ finished
 *
 * Randomness stays outside the reducer: `startGame` picks the tracks and
 * passes them in the `start` action, so the reducer is deterministic.
 */
import type { Track } from '../lib/playlist.js'
import { displayTitle, isCorrectGuess, songKey } from './match.js'
import { pickRandom } from './pick.js'
import { HINTS, MAX_POINTS, pointsFor } from './scoring.js'

export const ROUNDS_PER_GAME = 10

export type Phase = 'ready' | 'guessing' | 'revealed' | 'finished'

export interface Round {
  track: Track
  hintsUsed: number
  /** Wrong guesses so far, newest last. */
  wrongGuesses: string[]
  /** How the round ended; null while it's still being played. */
  outcome: 'correct' | 'gaveUp' | null
  points: number
}

export interface GameState {
  phase: Phase
  rounds: Round[]
  roundIndex: number
  score: number
}

export type GameAction =
  | { type: 'start'; tracks: Track[] }
  | { type: 'hint' }
  | { type: 'guess'; text: string }
  | { type: 'giveUp' }
  | { type: 'next' }
  | { type: 'reset' }

export const initialGameState: GameState = { phase: 'ready', rounds: [], roundIndex: 0, score: 0 }

/**
 * Builds a `start` action with up to 10 random tracks. Different versions of
 * the same song (a remaster and the original, say) never both appear.
 */
export function startGame(
  playlistTracks: readonly Track[],
  random: () => number = Math.random,
): GameAction {
  const tracks = pickRandom(playlistTracks, ROUNDS_PER_GAME, random, isSameSong)
  return { type: 'start', tracks }
}

/**
 * Two tracks are the same song if they share a song key, or if either title
 * would be accepted as a guess for the other ("Racing in the Street" and
 * "Racing in the Streets - 2008 Remaster").
 */
export function isSameSong(a: Track, b: Track): boolean {
  return (
    songKey(a.name) === songKey(b.name) ||
    isCorrectGuess(displayTitle(a.name), b.name) ||
    isCorrectGuess(displayTitle(b.name), a.name)
  )
}

export function currentRound(state: GameState): Round | undefined {
  return state.rounds[state.roundIndex]
}

/** Highest score possible in this game (3 points per round). */
export function maxScore(state: GameState): number {
  return state.rounds.length * MAX_POINTS
}

function updateCurrentRound(state: GameState, changes: Partial<Round>): GameState {
  const rounds = state.rounds.map((round, i) => (i === state.roundIndex ? { ...round, ...changes } : round))
  return { ...state, rounds }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const round = currentRound(state)

  switch (action.type) {
    case 'start': {
      if (action.tracks.length === 0) return state
      const rounds = action.tracks.map(
        (track): Round => ({ track, hintsUsed: 0, wrongGuesses: [], outcome: null, points: 0 }),
      )
      return { phase: 'guessing', rounds, roundIndex: 0, score: 0 }
    }

    case 'hint':
      if (state.phase !== 'guessing' || !round || round.hintsUsed >= HINTS.length) return state
      return updateCurrentRound(state, { hintsUsed: round.hintsUsed + 1 })

    case 'guess': {
      const text = action.text.trim()
      if (state.phase !== 'guessing' || !round || !text) return state
      if (!isCorrectGuess(text, round.track.name)) {
        return updateCurrentRound(state, { wrongGuesses: [...round.wrongGuesses, text] })
      }
      const points = pointsFor(round.hintsUsed)
      return {
        ...updateCurrentRound(state, { outcome: 'correct', points }),
        phase: 'revealed',
        score: state.score + points,
      }
    }

    case 'giveUp':
      if (state.phase !== 'guessing' || !round) return state
      return { ...updateCurrentRound(state, { outcome: 'gaveUp', points: 0 }), phase: 'revealed' }

    case 'next':
      if (state.phase !== 'revealed') return state
      if (state.roundIndex >= state.rounds.length - 1) return { ...state, phase: 'finished' }
      return { ...state, phase: 'guessing', roundIndex: state.roundIndex + 1 }

    case 'reset':
      return initialGameState
  }
}
