/**
 * The spirograph background: designs, timeline and drawing. Based on Tyler
 * Adams' spirograph-loop design.
 *
 * A flower is a set of outlined shapes (ellipses, rounded squares, rings,
 * leaves, loops), each rotated a step further around a shared anchor; the
 * overlapping outlines make the spirograph. One huge flower shows at a time:
 * it draws itself in line by line, holds, then fades out while the next one
 * builds in on top.
 *
 * Everything is drawn on one viewport-sized canvas. (An earlier version
 * animated ~200 oversized DOM elements, which needed hundreds of MB of GPU
 * memory on phones and made the page's own content flicker.)
 */

export type Shape = 'ellipse' | 'square' | 'ring' | 'petal' | 'loop'

export interface Design {
  shape: Shape
  /** Number of lines in the flower. */
  lines: number
  /** Seconds per full rotation. */
  spin: number
  /** Index into PALETTE: the hue the flower starts from. */
  hue: number
}

export const DESIGNS: Design[] = [
  { shape: 'ellipse', lines: 36, spin: 280, hue: 0 },
  { shape: 'square', lines: 30, spin: 180, hue: 1 },
  { shape: 'ring', lines: 40, spin: 220, hue: 2 },
  { shape: 'petal', lines: 24, spin: 200, hue: 3 },
  { shape: 'loop', lines: 28, spin: 160, hue: 4 },
  { shape: 'ring', lines: 20, spin: 140, hue: 5 },
  { shape: 'square', lines: 20, spin: 120, hue: 6 },
]

/** Neon palette: each flower's hue walks SPAN degrees across its lines. */
export const PALETTE = [315, 185, 48, 268, 140, 18, 225]
const SPAN = 90

/**
 * Shape recipes, as multiples of the flower's size: width, height, how far
 * each outline is pushed out from the anchor, and the rotational symmetry
 * the lines are spread over.
 */
const SHAPES: Record<Shape, { w: number; h: number; offset: number; symmetry: number }> = {
  ellipse: { w: 1, h: 0.3, offset: 0, symmetry: 180 },
  square: { w: 0.64, h: 0.64, offset: 0, symmetry: 90 },
  ring: { w: 0.5, h: 0.5, offset: 0.25, symmetry: 360 },
  petal: { w: 0.46, h: 0.46, offset: 0.2, symmetry: 360 },
  loop: { w: 0.42, h: 0.24, offset: 0.29, symmetry: 360 },
}

/** How long a design takes to draw in, how long it holds, and its fade-out. */
export const BUILD_MS = 9000
export const HOLD_MS = 3000
export const FADE_MS = 4000
/** A new design starts every PERIOD_MS, as the previous one starts fading. */
export const PERIOD_MS = BUILD_MS + HOLD_MS
/** Each line takes this long to draw in. */
const LINE_DRAW_MS = 1400
/** Overall strength of the lines against the black background. */
const OPACITY = 0.6

export interface Flower {
  design: Design
  /** Anchor position as a percentage of the viewport. */
  x: number
  y: number
  /** Size in vmax, so it overflows the screen whatever its shape. */
  size: number
  /** Starting angle in degrees, and spin direction. */
  angle: number
  reverse: boolean
}

const between = (min: number, max: number, random: () => number) => min + random() * (max - min)

/** A random design (never the same one twice in a row) at a random spot and size. */
export function randomFlower(previous?: Design, random: () => number = Math.random): Flower {
  const choices = DESIGNS.filter((d) => d !== previous)
  return {
    design: choices[Math.floor(random() * choices.length)],
    x: between(20, 80, random),
    y: between(20, 80, random),
    size: between(130, 190, random),
    angle: between(0, 360, random),
    reverse: random() < 0.5,
  }
}

export interface Visible {
  flower: Flower
  /** Milliseconds since this flower started building. */
  elapsed: number
}

/**
 * The sequence of flowers over time. Flower k starts at k × PERIOD_MS; flowers
 * are created on demand, each a different design from the one before.
 */
export function createTimeline(random: () => number = Math.random) {
  const flowers: Flower[] = []
  const flowerAt = (k: number): Flower => {
    while (flowers.length <= k) flowers.push(randomFlower(flowers.at(-1)?.design, random))
    return flowers[k]
  }

  return {
    flowerAt,
    /** The flowers on screen at `time` ms: one, or two during a crossfade. */
    visibleAt(time: number): Visible[] {
      const k = Math.max(0, Math.floor(time / PERIOD_MS))
      const visible: Visible[] = []
      const previousElapsed = time - (k - 1) * PERIOD_MS
      if (k > 0 && previousElapsed < PERIOD_MS + FADE_MS) {
        visible.push({ flower: flowerAt(k - 1), elapsed: previousElapsed })
      }
      visible.push({ flower: flowerAt(k), elapsed: time - k * PERIOD_MS })
      return visible
    },
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** How far line `i` of `n` has drawn in (0–1): lines start one after another across the build. */
export function lineProgress(i: number, n: number, elapsed: number): number {
  const start = (BUILD_MS * 0.85 * i) / n
  return easeOut(clamp01((elapsed - start) / LINE_DRAW_MS))
}

/** The whole flower's opacity (0–1): full while building and holding, then fading out. */
export function flowerOpacity(elapsed: number): number {
  if (elapsed <= PERIOD_MS) return 1
  return 1 - easeInOut(clamp01((elapsed - PERIOD_MS) / FADE_MS))
}

/** Outlines one shape centred on the origin. */
function tracePath(ctx: CanvasRenderingContext2D, shape: Shape, w: number, h: number) {
  const x = -w / 2
  const y = -h / 2
  ctx.beginPath()
  if (shape === 'square') {
    // Rounded square, corner radius 6% of each side.
    const rx = w * 0.06
    const ry = h * 0.06
    ctx.moveTo(x + rx, y)
    ctx.lineTo(x + w - rx, y)
    ctx.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0)
    ctx.lineTo(x + w, y + h - ry)
    ctx.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2)
    ctx.lineTo(x + rx, y + h)
    ctx.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI)
    ctx.lineTo(x, y + ry)
    ctx.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5)
  } else if (shape === 'petal') {
    // Leaf: two opposite corners fully rounded (CSS border-radius: 0 100%).
    ctx.moveTo(x, y)
    ctx.ellipse(x, y + h, w, h, 0, -Math.PI / 2, 0)
    ctx.ellipse(x + w, y, w, h, 0, Math.PI / 2, Math.PI)
  } else {
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
  }
  ctx.closePath()
}

export interface Viewport {
  width: number
  height: number
  /** Device pixels per CSS pixel the canvas is drawn at. */
  pixelRatio: number
  /** Soft glow around lines; skipped on small screens to save work. */
  glow: boolean
}

/** Paints one frame: black, then each visible flower's lines blended with "screen". */
export function drawFrame(ctx: CanvasRenderingContext2D, visible: Visible[], view: Viewport) {
  const { width, height, pixelRatio, glow } = view
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.globalCompositeOperation = 'screen' // crossings get brighter

  const vmax = Math.max(width, height) / 100
  for (const { flower, elapsed } of visible) {
    const fade = flowerOpacity(elapsed)
    if (fade <= 0) continue
    const { design } = flower
    const recipe = SHAPES[design.shape]
    const size = flower.size * vmax
    const spin = ((flower.reverse ? -1 : 1) * 360 * elapsed) / (design.spin * 1000)
    const rotation = ((flower.angle + spin) * Math.PI) / 180

    for (let i = 0; i < design.lines; i++) {
      const progress = lineProgress(i, design.lines, elapsed)
      if (progress <= 0) continue
      const scale = 0.15 + 0.85 * progress

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      ctx.translate((flower.x / 100) * width, (flower.y / 100) * height)
      ctx.rotate(rotation)
      ctx.scale(scale, scale)
      ctx.rotate((((i * recipe.symmetry) / design.lines) * Math.PI) / 180)
      ctx.translate(size * recipe.offset, 0)
      tracePath(ctx, design.shape, size * recipe.w, size * recipe.h)

      const hue = PALETTE[design.hue] + (SPAN * i) / design.lines
      ctx.strokeStyle = `hsl(${hue} 100% 62%)`
      const alpha = OPACITY * fade * progress
      if (glow) {
        ctx.globalAlpha = alpha * 0.25
        ctx.lineWidth = 6
        ctx.stroke()
      }
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
}
