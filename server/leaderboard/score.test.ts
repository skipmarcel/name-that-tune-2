// @vitest-environment node
import { parseRounds, scoreRounds } from './score.js'

describe('parseRounds', () => {
  it('accepts well-formed rounds', () => {
    expect(parseRounds([{ guess: 'mars', hintsUsed: 1 }, { guess: null, hintsUsed: 0 }], 2)).toEqual([
      { guess: 'mars', hintsUsed: 1 },
      { guess: null, hintsUsed: 0 },
    ])
  })

  it.each([
    ['not an array', 'nope', 1],
    ['wrong count', [{ guess: null, hintsUsed: 0 }], 2],
    ['negative hints', [{ guess: 'x', hintsUsed: -1 }], 1],
    ['too many hints', [{ guess: 'x', hintsUsed: 4 }], 1],
    ['fractional hints', [{ guess: 'x', hintsUsed: 1.5 }], 1],
    ['non-string guess', [{ guess: 42, hintsUsed: 0 }], 1],
    ['huge guess', [{ guess: 'x'.repeat(201), hintsUsed: 0 }], 1],
    ['null round', [null], 1],
  ])('rejects %s', (_label, value, count) => {
    expect(parseRounds(value, count)).toBeNull()
  })
})

describe('scoreRounds', () => {
  const titles = ['Just Like Honey', 'Mars', 'The Big Ship - 2004 Remaster']

  it('scores rounds by re-checking each guess against the real title', () => {
    expect(
      scoreRounds(titles, [
        { guess: 'just like hony', hintsUsed: 0 }, // 3
        { guess: 'mars', hintsUsed: 2 }, // 1
        { guess: null, hintsUsed: 3 }, // gave up
      ]),
    ).toEqual({ score: 4, maxScore: 9, correct: 2 })
  })

  it('gives nothing for a guess that does not match, whatever the client claims', () => {
    expect(scoreRounds(['Mars'], [{ guess: 'Venus', hintsUsed: 0 }])).toEqual({ score: 0, maxScore: 3, correct: 0 })
  })
})
