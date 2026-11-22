import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton } from './ShareButton'

function stubNavigator(overrides: { share?: (data: ShareData) => Promise<void>; writeText?: (text: string) => Promise<void> }) {
  Object.defineProperty(navigator, 'share', { value: overrides.share, configurable: true })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: overrides.writeText ?? (() => Promise.reject(new Error('no clipboard'))) },
    configurable: true,
  })
}

describe('ShareButton', () => {
  afterEach(() => stubNavigator({}))

  it('opens the share sheet when the device has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share })
    render(<ShareButton text="🎵 TuneIn · 80s Hits: 24/30" />)
    await userEvent.click(screen.getByRole('button', { name: 'Share your score' }))
    expect(share).toHaveBeenCalledWith({ text: '🎵 TuneIn · 80s Hits: 24/30' })
  })

  it('copies to the clipboard when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ writeText })
    render(<ShareButton text="score" />)
    await userEvent.click(screen.getByRole('button', { name: 'Share your score' }))
    expect(writeText).toHaveBeenCalledWith('score')
    expect(screen.getByRole('status')).toHaveTextContent('Copied!')
  })

  it('does nothing more when the player closes the share sheet', async () => {
    const writeText = vi.fn()
    stubNavigator({ share: () => Promise.reject(new DOMException('cancelled', 'AbortError')), writeText })
    render(<ShareButton text="score" />)
    await userEvent.click(screen.getByRole('button', { name: 'Share your score' }))
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says so when copying fails', async () => {
    stubNavigator({})
    render(<ShareButton text="score" />)
    await userEvent.click(screen.getByRole('button', { name: 'Share your score' }))
    expect(screen.getByRole('status')).toHaveTextContent('Take a screenshot')
  })
})
