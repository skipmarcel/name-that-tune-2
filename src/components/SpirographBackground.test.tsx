import { act, render } from '@testing-library/react'
import { SpirographBackground } from './SpirographBackground'
import { BUILD_MS, FADE_MS, HOLD_MS } from './spirograph'

const flowers = (container: HTMLElement) => container.querySelectorAll('.spiro-flower')

describe('SpirographBackground', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows one design, crossfades to the next after it builds and holds, then drops the old one', () => {
    vi.useFakeTimers()
    const { container } = render(<SpirographBackground />)
    expect(flowers(container)).toHaveLength(1)
    const first = flowers(container)[0]

    act(() => vi.advanceTimersByTime(BUILD_MS + HOLD_MS))
    expect(flowers(container)).toHaveLength(2) // overlapping during the fade
    expect(flowers(container)[0]).toBe(first)

    act(() => vi.advanceTimersByTime(FADE_MS))
    expect(flowers(container)).toHaveLength(1)
    expect(flowers(container)[0]).not.toBe(first)
  })

  it('keeps cycling', () => {
    vi.useFakeTimers()
    const { container } = render(<SpirographBackground />)
    act(() => vi.advanceTimersByTime((BUILD_MS + HOLD_MS) * 5 + FADE_MS))
    expect(flowers(container)).toHaveLength(1)
  })

  it('stays on one still design when motion is reduced', () => {
    vi.useFakeTimers()
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query })) as typeof window.matchMedia
    try {
      const { container } = render(<SpirographBackground />)
      act(() => vi.advanceTimersByTime((BUILD_MS + HOLD_MS) * 3))
      expect(flowers(container)).toHaveLength(1)
    } finally {
      window.matchMedia = original
    }
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(<SpirographBackground />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
