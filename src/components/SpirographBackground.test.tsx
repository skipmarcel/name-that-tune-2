import { render } from '@testing-library/react'
import { SpirographBackground } from './SpirographBackground'

describe('SpirographBackground', () => {
  it('renders a single decorative canvas hidden from assistive technology', () => {
    const { container } = render(<SpirographBackground />)
    const canvases = container.querySelectorAll('canvas')
    expect(canvases).toHaveLength(1)
    expect(canvases[0]).toHaveAttribute('aria-hidden', 'true')
  })
})
