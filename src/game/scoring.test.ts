import { pointsFor, titleLettersHint, unlockedHints } from './scoring'

describe('pointsFor', () => {
  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
    [4, 0],
  ])('%i hints → %i points', (hints, points) => {
    expect(pointsFor(hints)).toBe(points)
  })
})

describe('unlockedHints', () => {
  it('unlocks album art, then artist, then title letters', () => {
    expect(unlockedHints(0)).toEqual([])
    expect(unlockedHints(1)).toEqual(['albumArt'])
    expect(unlockedHints(2)).toEqual(['albumArt', 'artist'])
    expect(unlockedHints(3)).toEqual(['albumArt', 'artist', 'titleLetters'])
    expect(unlockedHints(9)).toHaveLength(3)
  })
})

describe('titleLettersHint', () => {
  it.each([
    ['Mars', 'M___'],
    ['The Big Ship - 2004 Remaster', 'T__ B__ S___'],
    ["Don't Call Me Hero", "D__'_ C___ M_ H___"],
    ['Alpha Waves: 8 Hz', 'A____ W____: 8 H_'],
    ['MAR-X', 'M__-_'],
    ['Pistolero (Prologue)', 'P________ (P_______)'],
    ['Retour au Champ-de-Mars', 'R_____ a_ C____-__-____'],
  ])('%s → %s', (title, hint) => {
    expect(titleLettersHint(title)).toBe(hint)
  })
})
