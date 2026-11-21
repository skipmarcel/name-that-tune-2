import { verdict } from './verdict'

describe('verdict', () => {
  it.each([
    [30, 30, 'Perfect score. Nothing gets past you.'],
    [21, 30, 'Sharp ears. Case closed.'],
    [12, 30, 'Solid detective work.'],
    [1, 30, 'A few leads. Keep listening.'],
    [0, 30, 'The trail went cold this time.'],
    [0, 0, 'The trail went cold this time.'],
  ])('%i / %i → %s', (score, max, text) => {
    expect(verdict(score, max)).toBe(text)
  })
})
