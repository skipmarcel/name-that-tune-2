import { MAX_POINTS, roundPoints } from './scoring'

describe('roundPoints', () => {
  it.each([
    [true, true, 3],
    [true, false, 2],
    [false, true, 1],
    [false, false, 0],
  ])('artist %s, title %s → %i points', (artist, title, points) => {
    expect(roundPoints({ artist, title })).toBe(points)
  })

  it('caps a round at 3 points', () => {
    expect(MAX_POINTS).toBe(3)
  })
})
