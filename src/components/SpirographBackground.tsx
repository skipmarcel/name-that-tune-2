import { memo, useEffect, useState, type CSSProperties } from 'react'
import { BUILD_MS, FADE_MS, HOLD_MS, randomFlower, type ActiveFlower } from './spirograph'
import './SpirographBackground.css'

/**
 * Decorative animated background: one huge spirograph "flower" at a time.
 * Each design draws itself in line by line, holds, then fades out while the
 * next one (a different design, at a random spot and size) builds in on top.
 *
 * Each flower is a zero-size anchor; every <i> inside is one outlined shape
 * rotated a step further around it, and the overlapping outlines make the
 * spirograph. Geometry, color and timing come from CSS custom properties
 * (see SpirographBackground.css). Based on Tyler Adams' spirograph-loop design.
 */

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function flowerStyle({ design, x, y, size, angle, reverse }: ActiveFlower): CSSProperties {
  return {
    '--x': `${x}%`,
    '--y': `${y}%`,
    '--size': `${size}vmax`,
    '--n': design.lines,
    '--spin': `${design.spin}s`,
    '--dir': reverse ? 'reverse' : 'normal',
    '--start': `${angle}deg`,
    '--hue': `var(--spiro-h${design.hue})`,
    '--build': `${BUILD_MS}ms`,
    '--fade-delay': `${BUILD_MS + HOLD_MS}ms`,
    '--fade': `${FADE_MS}ms`,
  } as CSSProperties
}

function Spirograph() {
  const [flowers, setFlowers] = useState<ActiveFlower[]>(() => [randomFlower(0)])

  useEffect(() => {
    // With motion turned off, the first design simply stays, fully drawn.
    if (prefersReducedMotion()) return

    const timers = new Set<number>()
    const after = (ms: number, run: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id)
        run()
      }, ms)
      timers.add(id)
    }

    let nextKey = 1
    // Every BUILD + HOLD, start the next design. The one before it is fading
    // out by then (its CSS fade starts at the same moment) and is removed
    // once the fade has finished.
    const startNext = () => {
      const key = nextKey++
      setFlowers((current) => [...current, randomFlower(key, current.at(-1)?.design)])
      after(FADE_MS, () => setFlowers((current) => current.filter((f) => f.key >= key)))
      after(BUILD_MS + HOLD_MS, startNext)
    }
    after(BUILD_MS + HOLD_MS, startNext)

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  return (
    <div className="spiro-stage" aria-hidden="true">
      {flowers.map((flower) => (
        <div key={flower.key} className={`spiro-flower spiro-${flower.design.shape}`} style={flowerStyle(flower)}>
          {Array.from({ length: flower.design.lines }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Memoized: it takes no props, so App re-renders (every keystroke) skip it. */
export const SpirographBackground = memo(Spirograph)
