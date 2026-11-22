import type { CSSProperties } from 'react'
import './SpirographBackground.css'

/**
 * Decorative animated background: spirograph "flowers" drawn with pure CSS.
 * Each flower is a zero-size anchor; every <i> inside is one outlined shape
 * rotated a step further around it, and the overlapping outlines make the
 * spirograph. All geometry, color and timing come from custom properties
 * (see SpirographBackground.css). Adapted from the spirograph-loop design.
 */

type Shape = 'ellipse' | 'square' | 'ring' | 'petal' | 'loop'

interface Flower {
  shape: Shape
  /** Anchor position, relative to the viewport. */
  x: string
  y: string
  size: string
  /** Number of lines in the flower. */
  lines: number
  /** Seconds for one draw-in / fade-out cycle, and the head start into it. */
  cycle: number
  offset: number
  /** Seconds per full rotation. */
  spin: number
  reverse?: boolean
  /** Which palette hue (1–7) the flower starts from. */
  hue: number
}

const FLOWERS: Flower[] = [
  { shape: 'ellipse', x: '50%', y: '50%', size: '74vmin', lines: 36, cycle: 16, offset: 0, spin: 140, hue: 1 },
  { shape: 'square', x: '14%', y: '22%', size: '36vmin', lines: 30, cycle: 13, offset: 7, spin: 90, reverse: true, hue: 2 },
  { shape: 'ring', x: '86%', y: '24%', size: '40vmin', lines: 40, cycle: 15, offset: 3, spin: 110, hue: 3 },
  { shape: 'petal', x: '13%', y: '80%', size: '42vmin', lines: 24, cycle: 14, offset: 10, spin: 100, hue: 4 },
  { shape: 'loop', x: '87%', y: '79%', size: '38vmin', lines: 28, cycle: 12, offset: 5, spin: 80, reverse: true, hue: 5 },
  { shape: 'ring', x: '33%', y: '6%', size: '22vmin', lines: 20, cycle: 11, offset: 8, spin: 70, reverse: true, hue: 6 },
  { shape: 'square', x: '67%', y: '95%', size: '24vmin', lines: 20, cycle: 10, offset: 2, spin: 60, hue: 7 },
]

function flowerStyle(f: Flower): CSSProperties {
  return {
    '--x': f.x,
    '--y': f.y,
    '--size': f.size,
    '--n': f.lines,
    '--cycle': `${f.cycle}s`,
    '--offset': `${f.offset}s`,
    '--spin': `${f.spin}s`,
    '--dir': f.reverse ? 'reverse' : 'normal',
    '--hue': `var(--spiro-h${f.hue})`,
  } as CSSProperties
}

export function SpirographBackground() {
  return (
    <div className="spiro-stage" aria-hidden="true">
      {FLOWERS.map((flower, f) => (
        <div key={f} className={`spiro-flower spiro-${flower.shape}`} style={flowerStyle(flower)}>
          {Array.from({ length: flower.lines }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      ))}
    </div>
  )
}
