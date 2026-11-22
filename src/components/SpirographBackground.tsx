import { memo, useEffect, useRef } from 'react'
import { BUILD_MS, createTimeline, drawFrame, type Viewport } from './spirograph'
import './SpirographBackground.css'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Decorative animated background: one huge spirograph at a time, drawing
 * itself in and crossfading into the next (see spirograph.ts). Drawn on a
 * single viewport-sized canvas so its memory use stays small.
 */
function Spirograph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const timeline = createTimeline()
    const reduced = prefersReducedMotion()
    const startedAt = performance.now()
    const view: Viewport = { width: 0, height: 0, pixelRatio: 1, glow: false }

    // With motion turned off, show the first design fully drawn and still.
    const render = (now: number) => drawFrame(ctx, timeline.visibleAt(reduced ? BUILD_MS : now - startedAt), view)

    const resize = () => {
      view.width = window.innerWidth
      view.height = window.innerHeight
      // Capped at 2× to keep the canvas light on 3× phone screens.
      view.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      view.glow = view.width > 640
      canvas.width = Math.round(view.width * view.pixelRatio)
      canvas.height = Math.round(view.height * view.pixelRatio)
      render(performance.now())
    }
    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    if (!reduced) {
      const tick = (now: number) => {
        render(now)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="spiro-canvas" aria-hidden="true" />
}

/** Memoized: it takes no props, so App re-renders (every keystroke) skip it. */
export const SpirographBackground = memo(Spirograph)
