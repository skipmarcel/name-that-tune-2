import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { PlaylistOption, Track } from './lib/playlist'
import { createFakeIframeApi } from './player/fake-iframe-api'

function track(id: string, name: string, artist = 'Artist'): Track {
  return { id, name, artists: [artist], album: 'Album', imageUrl: null, durationMs: 180_000 }
}

function playlist(id: string, title: string, tracks: Track[]): PlaylistOption {
  return { id, title, tracks }
}

function manyTracks(id: string, count: number) {
  return Array.from({ length: count }, (_, i) => track(`${id}-${i}`, `Song ${id} ${i}`))
}

async function renderApp(playlists: PlaylistOption[]) {
  const fake = createFakeIframeApi()
  const user = userEvent.setup()
  render(<App playlists={playlists} loadSpotifyApi={fake.loadApi} />)
  // Let the (fake) iFrame API finish loading.
  await act(async () => {})
  return { fake, user }
}

describe('App', () => {
  it('renders the game title', async () => {
    await renderApp([playlist('a', 'For Coding', manyTracks('a', 3))])
    expect(screen.getByRole('heading', { name: /song sleuth/i })).toBeInTheDocument()
  })

  it('lets the player choose between playlists, with the first selected', async () => {
    const { user } = await renderApp([
      playlist('a', 'For Coding', manyTracks('a', 115)),
      playlist('b', 'Obscure Folk and Rock', manyTracks('b', 1)),
    ])

    const coding = screen.getByRole('radio', { name: /for coding/i })
    const folk = screen.getByRole('radio', { name: /obscure folk and rock/i })
    expect(coding).toBeChecked()
    expect(screen.getByText('115 songs')).toBeInTheDocument()
    expect(screen.getByText('1 song')).toBeInTheDocument()

    await user.click(folk)
    expect(folk).toBeChecked()
  })

  it('shows unsynced playlists as unavailable', async () => {
    await renderApp([playlist('a', 'Empty', []), playlist('b', 'Ready', manyTracks('b', 3))])
    expect(screen.getByRole('radio', { name: /empty/i })).toBeDisabled()
    expect(screen.getByText('not synced yet')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ready/i })).toBeChecked()
  })

  it('explains how to load songs when nothing has been synced', async () => {
    await renderApp([playlist('a', 'Empty', [])])
    expect(screen.getByRole('status')).toHaveTextContent('npm run sync-playlist')
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('plays a full game: wrong guess, hints, correct guess and results', async () => {
    const { fake, user } = await renderApp([
      playlist('folk', 'Folk', [track('t1', 'Just Like Honey', 'The Jesus and Mary Chain')]),
    ])

    await user.click(screen.getByRole('button', { name: 'Start' }))

    // The chosen track is loaded into the hidden embed and plays once ready.
    const [controller] = fake.controllers
    expect(controller.options.uri).toBe('spotify:track:t1')
    act(() => controller.emit('ready'))
    expect(controller.calls).toContain('play')
    expect(screen.getByText('Song 1 of 1 · Score 0')).toBeInTheDocument()

    // A wrong guess keeps the round open.
    const input = screen.getByLabelText('Name that tune')
    await user.type(input, 'Some Candy Talking{Enter}')
    expect(screen.getByText(/not quite/i)).toHaveTextContent('Some Candy Talking')

    // Hints: album art, then artist, then title letters.
    await user.click(screen.getByRole('button', { name: /hint/i }))
    await user.click(screen.getByRole('button', { name: /hint/i }))
    expect(screen.getByText('The Jesus and Mary Chain')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hint/i }))
    expect(screen.getByText('J___ L___ H____')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No hints left' })).toBeDisabled()

    // A sloppy but close guess counts; three hints leave 0 points.
    await user.type(input, 'just like hony{Enter}')
    const reveal = screen.getByRole('region', { name: 'Answer' })
    expect(within(reveal).getByRole('heading')).toHaveTextContent('Correct! +0 points')
    expect(within(reveal).getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute(
      'href',
      'https://open.spotify.com/track/t1',
    )

    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(screen.getByRole('heading', { name: 'Final score: 0 / 3' })).toBeInTheDocument()
    expect(controller.calls.at(-1)).toBe('pause')

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('loads the next song into the same embed and counts give-ups as zero', async () => {
    const { fake, user } = await renderApp([playlist('p', 'Two', [track('x', 'Mars'), track('y', 'Floe')])])

    await user.click(screen.getByRole('button', { name: 'Start' }))
    const first = fake.controllers[0].options.uri

    await user.click(screen.getByRole('button', { name: 'Give up' }))
    expect(screen.getByRole('heading', { name: 'The answer was' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next song' }))
    expect(fake.controllers).toHaveLength(1)
    const second = first === 'spotify:track:x' ? 'spotify:track:y' : 'spotify:track:x'
    expect(fake.controllers[0].calls).toContain(`loadEntity ${second}`)
    expect(screen.getByText('Song 2 of 2 · Score 0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Give up' }))
    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(screen.getByRole('heading', { name: 'Final score: 0 / 6' })).toBeInTheDocument()
  })

  it('keeps the embed off-screen and out of the accessibility tree', async () => {
    const { user } = await renderApp([playlist('p', 'One', [track('x', 'Mars')])])
    await user.click(screen.getByRole('button', { name: 'Start' }))
    const embed = document.querySelector('.embed-offscreen')
    expect(embed).toHaveAttribute('aria-hidden', 'true')
    expect(embed).toHaveAttribute('inert')
  })

  it('tells the player when Spotify cannot load', async () => {
    const user = userEvent.setup()
    render(
      <App
        playlists={[playlist('p', 'One', [track('x', 'Mars')])]}
        loadSpotifyApi={() => Promise.reject(new Error('blocked'))}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load/))
  })
})
