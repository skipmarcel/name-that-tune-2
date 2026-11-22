// @vitest-environment node
import { parseRounds, scoreRounds } from './score.js'

describe('parseRounds', () => {
  it('accepts well-formed rounds', () => {
    expect(parseRounds([{ artist: 'nick cave', title: 'mars' }, { artist: null, title: null }], 2)).toEqual([
      { artist: 'nick cave', title: 'mars' },
      { artist: null, title: null },
    ])
  })

  it.each([
    ['not an array', 'nope', 1],
    ['wrong count', [{ artist: null, title: null }], 2],
    ['missing fields', [{}], 1],
    ['non-string guess', [{ artist: 42, title: null }], 1],
    ['huge guess', [{ artist: null, title: 'x'.repeat(201) }], 1],
    ['null round', [null], 1],
  ])('rejects %s', (_label, value, count) => {
    expect(parseRounds(value, count)).toBeNull()
  })
})

describe('scoreRounds', () => {
  const tracks = [
    { name: 'Just Like Honey', artists: ['The Jesus and Mary Chain'] },
    { name: 'Mars', artists: ['Nick Cave', 'Warren Ellis'] },
    { name: 'The Big Ship - 2004 Remaster', artists: ['Brian Eno'] },
  ]

  it('re-checks each guess: artist 2 points, title 1', () => {
    expect(
      scoreRounds(tracks, [
        { artist: 'jesus and mary chain', title: 'just like hony' }, // 3
        { artist: 'warren ellis', title: null }, // 2
        { artist: null, title: 'the big ship' }, // 1
      ]),
    ).toEqual({ score: 6, maxScore: 9, correct: 1 })
  })

  it('gives nothing for guesses that do not match, whatever the client claims', () => {
    expect(scoreRounds([tracks[1]], [{ artist: 'Venus', title: 'Jupiter' }])).toEqual({
      score: 0,
      maxScore: 3,
      correct: 0,
    })
  })
})
