import type { Track } from '../lib/playlist'
import {
  ROUNDS_PER_GAME,
  currentRound,
  gameReducer,
  isSameSong,
  initialGameState,
  maxScore,
  startGame,
  type GameAction,
  type GameState,
} from './game'

function track(id: string, name = `Song ${id}`): Track {
  return { id, name, artists: ['Artist'], album: 'Album', imageUrl: null, durationMs: 180_000 }
}

const playlist = Array.from({ length: 30 }, (_, i) => track(String(i)))

function play(actions: GameAction[], state: GameState = initialGameState): GameState {
  return actions.reduce(gameReducer, state)
}

const twoRounds: GameAction = {
  type: 'start',
  tracks: [track('a', 'Harder Better Faster Stronger'), track('b', 'Mars')],
}

describe('startGame', () => {
  it('picks 10 distinct tracks from the playlist', () => {
    const action = startGame(playlist)
    if (action.type !== 'start') throw new Error('expected a start action')
    expect(action.tracks).toHaveLength(ROUNDS_PER_GAME)
    expect(new Set(action.tracks.map((t) => t.id)).size).toBe(ROUNDS_PER_GAME)
  })

  it('never picks two versions of the same song', () => {
    const versions = [track('1', 'Angie'), track('2', 'Angie - 2015 Remaster'), track('3', 'Mars')]
    for (let i = 0; i < 20; i++) {
      const action = startGame(versions)
      if (action.type !== 'start') throw new Error('expected a start action')
      expect(action.tracks).toHaveLength(2)
    }
  })

  it('treats differently spelled versions of a song as the same song', () => {
    expect(isSameSong(track('1', 'Racing in the Street'), track('2', 'Racing in the Streets - 2008 Remaster'))).toBe(true)
    expect(isSameSong(track('1', 'Into The Breach I'), track('2', 'Into The Breach II'))).toBe(false)
  })

  it('uses every track when the playlist is shorter than a game', () => {
    const state = play([startGame(playlist.slice(0, 4))])
    expect(state.rounds).toHaveLength(4)
    expect(maxScore(state)).toBe(12)
  })
})

describe('gameReducer', () => {
  it('starts in the ready phase and begins guessing on start', () => {
    expect(initialGameState.phase).toBe('ready')
    const state = play([twoRounds])
    expect(state).toMatchObject({ phase: 'guessing', roundIndex: 0, score: 0 })
    expect(currentRound(state)?.track.id).toBe('a')
  })

  it('ignores a start with no tracks', () => {
    expect(play([{ type: 'start', tracks: [] }])).toBe(initialGameState)
  })

  it('awards 3 points for a correct guess with no hints', () => {
    const state = play([twoRounds, { type: 'guess', text: 'harder better faster stronger' }])
    expect(state.phase).toBe('revealed')
    expect(state.score).toBe(3)
    expect(currentRound(state)).toMatchObject({
      outcome: 'correct',
      winningGuess: 'harder better faster stronger',
      points: 3,
    })
  })

  it('takes a point off for each hint, up to three hints', () => {
    const state = play([
      twoRounds,
      { type: 'hint' },
      { type: 'hint' },
      { type: 'guess', text: 'Harder Better Faster Stronger' },
    ])
    expect(currentRound(state)?.points).toBe(1)

    const maxed = play([twoRounds, { type: 'hint' }, { type: 'hint' }, { type: 'hint' }, { type: 'hint' }])
    expect(currentRound(maxed)?.hintsUsed).toBe(3)
  })

  it('records wrong guesses and keeps the round open', () => {
    const state = play([twoRounds, { type: 'guess', text: 'Around the World' }, { type: 'guess', text: 'One More Time' }])
    expect(state.phase).toBe('guessing')
    expect(currentRound(state)?.wrongGuesses).toEqual(['Around the World', 'One More Time'])
  })

  it('ignores blank guesses', () => {
    const state = play([twoRounds])
    expect(gameReducer(state, { type: 'guess', text: '   ' })).toBe(state)
  })

  it('scores nothing when the player gives up', () => {
    const state = play([twoRounds, { type: 'giveUp' }])
    expect(state.phase).toBe('revealed')
    expect(state.score).toBe(0)
    expect(currentRound(state)).toMatchObject({ outcome: 'gaveUp', winningGuess: null, points: 0 })
  })

  it('moves to the next round, then finishes after the last one', () => {
    let state = play([twoRounds, { type: 'guess', text: 'harder better faster stronger' }, { type: 'next' }])
    expect(state).toMatchObject({ phase: 'guessing', roundIndex: 1 })

    state = play([{ type: 'hint' }, { type: 'guess', text: 'mars' }, { type: 'next' }], state)
    expect(state).toMatchObject({ phase: 'finished', score: 5 })
    expect(maxScore(state)).toBe(6)
  })

  it('ignores actions that do not fit the current phase', () => {
    const guessing = play([twoRounds])
    expect(gameReducer(guessing, { type: 'next' })).toBe(guessing)

    const revealed = play([{ type: 'giveUp' }], guessing)
    for (const action of [{ type: 'hint' }, { type: 'guess', text: 'mars' }, { type: 'giveUp' }] as const) {
      expect(gameReducer(revealed, action)).toBe(revealed)
    }

    expect(gameReducer(initialGameState, { type: 'hint' })).toBe(initialGameState)
  })

  it('resets to a fresh game', () => {
    const state = play([twoRounds, { type: 'giveUp' }, { type: 'reset' }])
    expect(state).toBe(initialGameState)
  })

  it('never mutates the previous state', () => {
    const before = play([twoRounds])
    const snapshot = structuredClone(before)
    play([{ type: 'hint' }, { type: 'guess', text: 'nope' }, { type: 'giveUp' }, { type: 'next' }], before)
    expect(before).toEqual(snapshot)
  })
})
