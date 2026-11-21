import { formatTime, hasEnded } from './format'

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [29_713, '0:29'],
    [61_000, '1:01'],
    [-5, '0:00'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatTime(ms)).toBe(text)
  })
})

describe('hasEnded', () => {
  it('is true once a paused clip reaches its end', () => {
    expect(hasEnded(29_500, 29_713, false)).toBe(true)
  })

  it('is false while playing, mid-clip or before loading', () => {
    expect(hasEnded(29_500, 29_713, true)).toBe(false)
    expect(hasEnded(10_000, 29_713, false)).toBe(false)
    expect(hasEnded(0, 0, false)).toBe(false)
  })
})
