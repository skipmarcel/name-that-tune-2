/**
 * The spirograph designs and how the background picks the next one. Kept
 * apart from the component so it can be tested on its own.
 */

export type Shape = 'ellipse' | 'square' | 'ring' | 'petal' | 'loop'

export interface Design {
  shape: Shape
  /** Number of lines in the flower. */
  lines: number
  /** Seconds per full rotation. */
  spin: number
  /** Which palette hue (1–7) the flower starts from. */
  hue: number
}

export const DESIGNS: Design[] = [
  { shape: 'ellipse', lines: 36, spin: 280, hue: 1 },
  { shape: 'square', lines: 30, spin: 180, hue: 2 },
  { shape: 'ring', lines: 40, spin: 220, hue: 3 },
  { shape: 'petal', lines: 24, spin: 200, hue: 4 },
  { shape: 'loop', lines: 28, spin: 160, hue: 5 },
  { shape: 'ring', lines: 20, spin: 140, hue: 6 },
  { shape: 'square', lines: 20, spin: 120, hue: 7 },
]

/** How long a design takes to draw in, how long it holds, and its fade-out. */
export const BUILD_MS = 9000
export const HOLD_MS = 3000
export const FADE_MS = 4000

export interface ActiveFlower {
  key: number
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
export function randomFlower(key: number, previous?: Design, random: () => number = Math.random): ActiveFlower {
  const choices = DESIGNS.filter((d) => d !== previous)
  return {
    key,
    design: choices[Math.floor(random() * choices.length)],
    x: between(20, 80, random),
    y: between(20, 80, random),
    size: between(130, 190, random),
    angle: between(0, 360, random),
    reverse: random() < 0.5,
  }
}
