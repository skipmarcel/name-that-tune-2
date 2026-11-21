import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SpotifyIFrameAPI } from './spotify-iframe'
import { createFakeIframeApi } from './fake-iframe-api'
import { useSpotifyPlayer } from './useSpotifyPlayer'

function TestPlayer({ loadApi }: { loadApi: () => Promise<SpotifyIFrameAPI> }) {
  const { attachEmbed, ...player } = useSpotifyPlayer({ loadApi })
  return (
    <div>
      <div ref={attachEmbed} data-testid="container" />
      <output data-testid="state">
        {player.status} {player.isPlaying ? 'playing' : 'paused'} {player.position}/{player.duration}
      </output>
      <button onClick={() => player.playTrack('track1')}>one</button>
      <button onClick={() => player.playTrack('track2')}>two</button>
      <button onClick={player.pause}>pause</button>
      <button onClick={player.play}>resume</button>
    </div>
  )
}

function state() {
  return screen.getByTestId('state').textContent
}

describe('useSpotifyPlayer', () => {
  it('is ready once the API loads, without creating an embed yet', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))
    expect(fake.controllers).toHaveLength(0)
  })

  it('creates the embed on the first track and plays when it is ready', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))

    await userEvent.click(screen.getByText('one'))
    const [controller] = fake.controllers
    expect(controller.options).toMatchObject({ uri: 'spotify:track:track1' })
    expect(screen.getByTestId('container').querySelector('[data-fake-embed]')).not.toBeNull()

    act(() => controller.emit('ready'))
    expect(controller.calls).toEqual(['play'])
  })

  it('reuses the embed for later tracks', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))

    await userEvent.click(screen.getByText('one'))
    await userEvent.click(screen.getByText('two'))
    expect(fake.controllers).toHaveLength(1)
    expect(fake.controllers[0].calls).toEqual(['loadEntity spotify:track:track2', 'play'])
  })

  it('reflects playback updates', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))
    await userEvent.click(screen.getByText('one'))

    act(() => fake.controllers[0].update({ isPaused: false, position: 5000, duration: 30_000 }))
    expect(state()).toBe('ready playing 5000/30000')

    act(() => fake.controllers[0].update({ isPaused: true, position: 6000 }))
    expect(state()).toContain('paused 6000')
  })

  it('pauses and resumes the embed', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))
    await userEvent.click(screen.getByText('one'))

    await userEvent.click(screen.getByText('pause'))
    await userEvent.click(screen.getByText('resume'))
    expect(fake.controllers[0].calls).toEqual(['pause', 'resume'])
  })

  it('does not auto-play on ready after the player paused', async () => {
    const fake = createFakeIframeApi()
    render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))
    await userEvent.click(screen.getByText('one'))
    await userEvent.click(screen.getByText('pause'))

    act(() => fake.controllers[0].emit('ready'))
    expect(fake.controllers[0].calls).toEqual(['pause'])
  })

  it('reports an error when the script fails to load', async () => {
    render(<TestPlayer loadApi={() => Promise.reject(new Error('offline'))} />)
    await waitFor(() => expect(state()).toMatch(/^error/))
  })

  it('destroys the embed on unmount', async () => {
    const fake = createFakeIframeApi()
    const { unmount } = render(<TestPlayer loadApi={fake.loadApi} />)
    await waitFor(() => expect(state()).toMatch(/^ready/))
    await userEvent.click(screen.getByText('one'))
    unmount()
    expect(fake.controllers[0].destroyed).toBe(true)
  })
})
