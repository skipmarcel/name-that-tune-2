import { DESIGNS, randomFlower } from './spirograph'

describe('randomFlower', () => {
  it('places a huge design somewhere inside the middle of the screen', () => {
    for (let i = 0; i < 200; i++) {
      const flower = randomFlower(i)
      expect(flower.x).toBeGreaterThanOrEqual(20)
      expect(flower.x).toBeLessThanOrEqual(80)
      expect(flower.y).toBeGreaterThanOrEqual(20)
      expect(flower.y).toBeLessThanOrEqual(80)
      // At least 130% of the larger screen dimension, so it overflows every edge.
      expect(flower.size).toBeGreaterThanOrEqual(130)
      expect(DESIGNS).toContain(flower.design)
    }
  })

  it('never repeats the previous design', () => {
    for (const previous of DESIGNS) {
      for (let i = 0; i < 50; i++) expect(randomFlower(i, previous).design).not.toBe(previous)
    }
  })
})
