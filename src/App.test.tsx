import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { PlaylistOption, Track } from './lib/playlist'
import type { LeaderboardClient } from './leaderboard/client'
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

/** A leaderboard that can't be reached: games still work, just unranked. */
const offline: LeaderboardClient = {
  startGame: () => Promise.reject(new Error('offline')),
  getLeaderboard: () => Promise.reject(new Error('offline')),
  submitScore: () => Promise.reject(new Error('offline')),
}

async function renderApp(playlists: PlaylistOption[], leaderboard: LeaderboardClient = offline) {
  const fake = createFakeIframeApi()
  const user = userEvent.setup()
  render(<App playlists={playlists} loadSpotifyApi={fake.loadApi} leaderboard={leaderboard} />)
  // Let the (fake) iFrame API finish loading.
  await act(async () => {})
  return { fake, user }
}

describe('App', () => {
  it('renders the home screen', async () => {
    await renderApp([playlist('a', 'For Coding', manyTracks('a', 3))])
    expect(screen.getByRole('heading', { level: 1, name: /name that tune/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
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
    expect(screen.getByText('Not synced yet')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ready/i })).toBeChecked()
  })

  it('explains how to load songs when nothing has been synced', async () => {
    await renderApp([playlist('a', 'Empty', [])])
    expect(screen.getByRole('status')).toHaveTextContent('npm run sync-playlist')
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('plays a full game: artist first, a wrong title, then the title', async () => {
    const { fake, user } = await renderApp([
      playlist('folk', 'Folk', [track('t1', 'Just Like Honey', 'The Jesus and Mary Chain')]),
    ])

    await user.click(screen.getByRole('button', { name: 'Start' }))

    // The chosen track is loaded into the hidden embed and plays once ready.
    const [controller] = fake.controllers
    expect(controller.options.uri).toBe('spotify:track:t1')
    act(() => controller.emit('ready'))
    expect(controller.calls).toContain('play')
    expect(screen.getByText(/of 1/)).toHaveTextContent('Song 1 of 1')

    // Right artist, wrong title: the artist locks in for 2 points.
    await user.type(screen.getByLabelText('Artist'), 'jesus and mary chain')
    await user.type(screen.getByLabelText('Song title'), 'Some Candy Talking{Enter}')
    expect(screen.getByText(/Correct:/).parentElement).toHaveTextContent('Correct: The Jesus and Mary Chain')
    expect(screen.getByText('+2 so far')).toBeInTheDocument()
    expect(screen.getByText(/not quite/i)).toHaveTextContent('Some Candy Talking')
    const titleInput = screen.getByLabelText('Song title')
    expect(titleInput).toHaveFocus() // the box that was wrong keeps focus
    expect(screen.queryByRole('textbox', { name: 'Artist' })).not.toBeInTheDocument()

    // A close title finishes the round with 3 points.
    await user.clear(titleInput)
    await user.type(titleInput, 'just like hony{Enter}')
    const reveal = screen.getByRole('region', { name: 'Answer' })
    expect(within(reveal).getByRole('status')).toHaveTextContent('Nailed it! +3 points')
    expect(within(reveal).getByRole('heading', { name: 'Just Like Honey' })).toBeInTheDocument()
    expect(within(reveal).getByRole('link', { name: /open in spotify/i })).toHaveAttribute(
      'href',
      'https://open.spotify.com/track/t1',
    )

    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(screen.getByRole('heading', { name: 'Final score: 3 out of 3' })).toBeInTheDocument()
    expect(controller.calls.at(-1)).toBe('pause')

    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('keeps the points earned when revealing, and loads the next song into the same embed', async () => {
    const { fake, user } = await renderApp([
      playlist('p', 'Two', [track('x', 'Mars', 'Nick Cave'), track('y', 'Floe', 'Philip Glass')]),
    ])

    await user.click(screen.getByRole('button', { name: 'Start' }))
    const first = fake.controllers[0].options.uri
    const firstTitle = first === 'spotify:track:x' ? 'Mars' : 'Floe'

    // Title only, then reveal: 1 point.
    await user.type(screen.getByLabelText('Song title'), `${firstTitle}{Enter}`)
    await user.click(screen.getByRole('button', { name: 'Reveal answer' }))
    expect(screen.getByRole('status')).toHaveTextContent('You got the title: +1 point')

    await user.click(screen.getByRole('button', { name: 'Next song' }))
    expect(fake.controllers).toHaveLength(1)
    const second = first === 'spotify:track:x' ? 'spotify:track:y' : 'spotify:track:x'
    expect(fake.controllers[0].calls).toContain(`loadEntity ${second}`)
    expect(screen.getByText(/of 2/)).toHaveTextContent('Song 2 of 2')

    // Nothing, then reveal: 0 points.
    await user.click(screen.getByRole('button', { name: 'Reveal answer' }))
    expect(screen.getByRole('status')).toHaveTextContent('The answer was')
    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(screen.getByRole('heading', { name: 'Final score: 1 out of 6' })).toBeInTheDocument()
  })

  it('does nothing when Guess is pressed with both boxes empty', async () => {
    const { user } = await renderApp([playlist('p', 'One', [track('x', 'Mars')])])
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('button', { name: 'Guess' })).toBeDisabled()
  })

  it('quits to the start screen from the logo', async () => {
    const { user } = await renderApp([playlist('p', 'One', [track('x', 'Mars')])])
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: /quit to start/i }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('still plays when the leaderboard is unreachable, but says the game is unranked', async () => {
    const { user } = await renderApp([playlist('p', 'One', [track('x', 'Mars')])])
    expect(await screen.findByText('The leaderboard is unavailable right now.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Reveal answer' }))
    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(screen.getByText(/wasn.t ranked/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Add your score to the leaderboard')).not.toBeInTheDocument()
  })

  it('keeps the embed hidden and out of the accessibility tree', async () => {
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
        leaderboard={offline}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load/))
  })
})
