/**
 * Game state as a pure reducer, ready for React's `useReducer`.
 *
 *   ready ──start──▶ guessing ──artist and title named / reveal──▶ revealed ──next──▶ guessing …
 *                                                              └──next (last round)──▶ finished
 *
 * Randomness stays outside the reducer: `startGame` picks the tracks and
 * passes them in the `start` action, so the reducer is deterministic.
 */
import type { Track } from '../lib/playlist.js'
import { displayTitle, isCorrectArtist, isCorrectGuess, songKey } from './match.js'
import { pickRandom } from './pick.js'
import { MAX_POINTS, roundPoints } from './scoring.js'

export const ROUNDS_PER_GAME = 10

export type Phase = 'ready' | 'guessing' | 'revealed' | 'finished'

export interface Round {
  track: Track
  /** The guesses that were accepted, sent to the server for scoring. */
  artistGuess: string | null
  titleGuess: string | null
  /** Most recent wrong guesses, shown as feedback; cleared once that part is right. */
  wrongArtist: string | null
  wrongTitle: string | null
  /** How the round ended: both named, or the player revealed the answer. */
  outcome: 'complete' | 'revealed' | null
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
  /** Checks whichever fields are filled in; parts already named are ignored. */
  | { type: 'guess'; artist?: string; title?: string }
  /** Ends the round and shows the answer, keeping any points already earned. */
  | { type: 'reveal' }
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
        (track): Round => ({
          track,
          artistGuess: null,
          titleGuess: null,
          wrongArtist: null,
          wrongTitle: null,
          outcome: null,
          points: 0,
        }),
      )
      return { phase: 'guessing', rounds, roundIndex: 0, score: 0 }
    }

    case 'guess': {
      if (state.phase !== 'guessing' || !round) return state
      const artist = round.artistGuess === null ? action.artist?.trim() : undefined
      const title = round.titleGuess === null ? action.title?.trim() : undefined
      if (!artist && !title) return state

      const changes: Partial<Round> = {}
      if (artist) {
        if (isCorrectArtist(artist, round.track.artists)) Object.assign(changes, { artistGuess: artist, wrongArtist: null })
        else changes.wrongArtist = artist
      }
      if (title) {
        if (isCorrectGuess(title, round.track.name)) Object.assign(changes, { titleGuess: title, wrongTitle: null })
        else changes.wrongTitle = title
      }

      const updated = { ...round, ...changes }
      const points = roundPoints({ artist: updated.artistGuess !== null, title: updated.titleGuess !== null })
      const complete = updated.artistGuess !== null && updated.titleGuess !== null
      return {
        ...updateCurrentRound(state, { ...changes, points, outcome: complete ? 'complete' : null }),
        phase: complete ? 'revealed' : 'guessing',
        score: state.score - round.points + points,
      }
    }

    case 'reveal':
      if (state.phase !== 'guessing' || !round) return state
      return { ...updateCurrentRound(state, { outcome: 'revealed' }), phase: 'revealed' }

    case 'next':
      if (state.phase !== 'revealed') return state
      if (state.roundIndex >= state.rounds.length - 1) return { ...state, phase: 'finished' }
      return { ...state, phase: 'guessing', roundIndex: state.roundIndex + 1 }

    case 'reset':
      return initialGameState
  }
}
