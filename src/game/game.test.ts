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
  tracks: [
    { ...track('a', 'Harder Better Faster Stronger'), artists: ['Daft Punk'] },
    { ...track('b', 'Mars'), artists: ['Nick Cave', 'Warren Ellis'] },
  ],
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

  it('awards 3 points and ends the round when artist and title are both right', () => {
    const state = play([twoRounds, { type: 'guess', artist: 'daft punk', title: 'harder better faster stronger' }])
    expect(state.phase).toBe('revealed')
    expect(state.score).toBe(3)
    expect(currentRound(state)).toMatchObject({
      outcome: 'complete',
      artistGuess: 'daft punk',
      titleGuess: 'harder better faster stronger',
      points: 3,
    })
  })

  it('locks in the artist (2 points) and keeps the round open for the title', () => {
    const state = play([twoRounds, { type: 'guess', artist: 'Daft Punk', title: 'One More Time' }])
    expect(state.phase).toBe('guessing')
    expect(state.score).toBe(2)
    expect(currentRound(state)).toMatchObject({ artistGuess: 'Daft Punk', titleGuess: null, wrongTitle: 'One More Time' })

    // A later artist guess can't change the locked-in answer.
    const after = play([{ type: 'guess', artist: 'Justice', title: 'harder better faster stronger' }], state)
    expect(currentRound(after)).toMatchObject({ artistGuess: 'Daft Punk', outcome: 'complete', points: 3 })
    expect(after.score).toBe(3)
  })

  it('gives 1 point for the title alone', () => {
    const state = play([twoRounds, { type: 'guess', title: 'harder better faster stronger' }, { type: 'reveal' }])
    expect(currentRound(state)).toMatchObject({ outcome: 'revealed', points: 1 })
    expect(state.score).toBe(1)
  })

  it('records the latest wrong guesses and clears them once that part is right', () => {
    let state = play([twoRounds, { type: 'guess', artist: 'Justice', title: 'Around the World' }])
    expect(currentRound(state)).toMatchObject({ wrongArtist: 'Justice', wrongTitle: 'Around the World' })
    state = play([{ type: 'guess', artist: 'daft punk' }], state)
    expect(currentRound(state)).toMatchObject({ wrongArtist: null, wrongTitle: 'Around the World' })
  })

  it('ignores blank guesses', () => {
    const state = play([twoRounds])
    expect(gameReducer(state, { type: 'guess', artist: '   ', title: '' })).toBe(state)
    expect(gameReducer(state, { type: 'guess' })).toBe(state)
  })

  it('reveals the answer and keeps points already earned', () => {
    const state = play([twoRounds, { type: 'guess', artist: 'daft punk' }, { type: 'reveal' }])
    expect(state.phase).toBe('revealed')
    expect(state.score).toBe(2)
    expect(currentRound(state)).toMatchObject({ outcome: 'revealed', points: 2 })
  })

  it('scores nothing when revealing straight away', () => {
    const state = play([twoRounds, { type: 'reveal' }])
    expect(state.score).toBe(0)
    expect(currentRound(state)).toMatchObject({ outcome: 'revealed', points: 0 })
  })

  it('accepts any credited artist', () => {
    const state = play([
      twoRounds,
      { type: 'reveal' },
      { type: 'next' },
      { type: 'guess', artist: 'warren ellis', title: 'mars' },
    ])
    expect(currentRound(state)).toMatchObject({ outcome: 'complete', points: 3 })
  })

  it('moves to the next round, then finishes after the last one', () => {
    let state = play([twoRounds, { type: 'guess', artist: 'daft punk', title: 'harder better faster stronger' }, { type: 'next' }])
    expect(state).toMatchObject({ phase: 'guessing', roundIndex: 1 })

    state = play([{ type: 'guess', artist: 'nick cave' }, { type: 'reveal' }, { type: 'next' }], state)
    expect(state).toMatchObject({ phase: 'finished', score: 5 })
    expect(maxScore(state)).toBe(6)
  })

  it('ignores actions that do not fit the current phase', () => {
    const guessing = play([twoRounds])
    expect(gameReducer(guessing, { type: 'next' })).toBe(guessing)

    const revealed = play([{ type: 'reveal' }], guessing)
    for (const action of [{ type: 'guess', artist: 'daft punk' }, { type: 'reveal' }] as const) {
      expect(gameReducer(revealed, action)).toBe(revealed)
    }

    expect(gameReducer(initialGameState, { type: 'reveal' })).toBe(initialGameState)
  })

  it('resets to a fresh game', () => {
    const state = play([twoRounds, { type: 'reveal' }, { type: 'reset' }])
    expect(state).toBe(initialGameState)
  })

  it('never mutates the previous state', () => {
    const before = play([twoRounds])
    const snapshot = structuredClone(before)
    play([{ type: 'guess', artist: 'nope', title: 'nope' }, { type: 'reveal' }, { type: 'next' }], before)
    expect(before).toEqual(snapshot)
  })
})
