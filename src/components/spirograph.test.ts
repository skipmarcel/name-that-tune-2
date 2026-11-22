import {
  BUILD_MS,
  DESIGNS,
  FADE_MS,
  PERIOD_MS,
  createTimeline,
  drawFrame,
  flowerOpacity,
  lineProgress,
  randomFlower,
  type Visible,
} from './spirograph'

describe('randomFlower', () => {
  it('places a huge design somewhere in the middle of the screen', () => {
    for (let i = 0; i < 200; i++) {
      const flower = randomFlower()
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
      for (let i = 0; i < 50; i++) expect(randomFlower(previous).design).not.toBe(previous)
    }
  })
})

describe('createTimeline', () => {
  it('shows one design, then two during each crossfade, then the next alone', () => {
    const timeline = createTimeline()
    expect(timeline.visibleAt(0)).toHaveLength(1)
    expect(timeline.visibleAt(PERIOD_MS - 1)).toHaveLength(1)

    const crossfade = timeline.visibleAt(PERIOD_MS + 1000)
    expect(crossfade.map((v) => v.flower)).toEqual([timeline.flowerAt(0), timeline.flowerAt(1)])
    expect(crossfade.map((v) => v.elapsed)).toEqual([PERIOD_MS + 1000, 1000])

    const after = timeline.visibleAt(PERIOD_MS + FADE_MS + 1)
    expect(after.map((v) => v.flower)).toEqual([timeline.flowerAt(1)])
  })

  it('keeps going with a different design each time', () => {
    const timeline = createTimeline()
    for (let k = 1; k < 30; k++) {
      expect(timeline.flowerAt(k).design).not.toBe(timeline.flowerAt(k - 1).design)
      expect(timeline.visibleAt(k * PERIOD_MS + FADE_MS + 1)).toHaveLength(1)
    }
  })
})

describe('lineProgress', () => {
  it('draws lines in one after another, all finished by the end of the build', () => {
    expect(lineProgress(0, 36, 0)).toBe(0)
    expect(lineProgress(0, 36, 5000)).toBe(1)
    expect(lineProgress(35, 36, 3000)).toBe(0)
    expect(lineProgress(35, 36, BUILD_MS)).toBe(1)
    expect(lineProgress(10, 36, 4000)).toBeGreaterThan(lineProgress(20, 36, 4000))
  })
})

describe('flowerOpacity', () => {
  it('stays full while building and holding, then fades to nothing', () => {
    expect(flowerOpacity(0)).toBe(1)
    expect(flowerOpacity(PERIOD_MS)).toBe(1)
    expect(flowerOpacity(PERIOD_MS + FADE_MS / 2)).toBeCloseTo(0.5)
    expect(flowerOpacity(PERIOD_MS + FADE_MS)).toBe(0)
  })
})

describe('drawFrame', () => {
  /** A stand-in canvas context that counts strokes and records settings. */
  function fakeContext() {
    const log = { strokes: 0, composite: [] as string[], fills: 0 }
    const ctx = {
      canvas: { width: 780, height: 1688 },
      set globalCompositeOperation(value: string) {
        log.composite.push(value)
      },
      fillRect: () => log.fills++,
      stroke: () => log.strokes++,
    }
    const noop = () => {}
    for (const name of ['setTransform', 'translate', 'rotate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'ellipse', 'closePath']) {
      Object.assign(ctx, { [name]: noop })
    }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, log }
  }

  const view = { width: 390, height: 844, pixelRatio: 2, glow: false }
  const flower = { ...randomFlower(), design: DESIGNS[0] } // 36-line ellipse

  it('paints the background black, then blends lines with screen', () => {
    const { ctx, log } = fakeContext()
    drawFrame(ctx, [{ flower, elapsed: BUILD_MS }], view)
    expect(log.fills).toBe(1)
    expect(log.composite).toEqual(['source-over', 'screen'])
    expect(log.strokes).toBe(36)
  })

  it('draws only the lines that have started, and a second pass when glowing', () => {
    const early = fakeContext()
    drawFrame(early.ctx, [{ flower, elapsed: 1000 }], view)
    expect(early.log.strokes).toBeGreaterThan(0)
    expect(early.log.strokes).toBeLessThan(36)

    const glowing = fakeContext()
    drawFrame(glowing.ctx, [{ flower, elapsed: BUILD_MS }], { ...view, glow: true })
    expect(glowing.log.strokes).toBe(72)
  })

  it('skips flowers that have fully faded', () => {
    const { ctx, log } = fakeContext()
    const gone: Visible = { flower, elapsed: PERIOD_MS + FADE_MS }
    drawFrame(ctx, [gone], view)
    expect(log.strokes).toBe(0)
  })
})
