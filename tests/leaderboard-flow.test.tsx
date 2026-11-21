/**
 * End-to-end leaderboard flow: the React app talking to the real leaderboard
 * API (server/leaderboard) running in-process with an in-memory store.
 * Lives outside src/ because it type-checks against both DOM and Node APIs.
 */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createLeaderboardApi } from '../server/leaderboard/api.js'
import { MemoryStore } from '../server/leaderboard/store.js'
import App from '../src/App.js'
import { createLeaderboardClient } from '../src/leaderboard/client.js'
import type { PlaylistOption, Track } from '../src/lib/playlist.js'
import { createFakeIframeApi } from '../src/player/fake-iframe-api.js'

function track(id: string, name: string, artist = 'Artist'): Track {
  return { id, name, artists: [artist], album: 'Album', imageUrl: null, durationMs: 180_000 }
}

function playlist(id: string, title: string, tracks: Track[]): PlaylistOption {
  return { id, title, tracks }
}

/** The real leaderboard API running in-process, with a controllable clock. */
function inProcessLeaderboard(playlists: PlaylistOption[]) {
  let now = 1_000_000
  const handle = createLeaderboardApi({
    store: new MemoryStore(() => now),
    secret: 'test',
    getTracks: (id) => playlists.find((p) => p.id === id)?.tracks,
    now: () => now,
  })
  const client = createLeaderboardClient((input, init) =>
    handle(new Request(new URL(String(input), 'http://localhost'), init)),
  )
  return { client, advance: (ms: number) => (now += ms) }
}

async function renderApp(playlists: PlaylistOption[]) {
  const server = inProcessLeaderboard(playlists)
  const user = userEvent.setup()
  render(<App playlists={playlists} loadSpotifyApi={createFakeIframeApi().loadApi} leaderboard={server.client} />)
  await act(async () => {})
  return { user, server }
}

describe('shared leaderboard', () => {
  it('ranks a game on the shared leaderboard', async () => {
    const playlists = [playlist('folk', 'Folk', [track('t1', 'Just Like Honey', 'The Jesus and Mary Chain')])]
    const { user, server } = await renderApp(playlists)

    const home = await screen.findByRole('region', { name: /top scores · folk/i })
    await within(home).findByText('No scores yet. Be the first.')

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.type(screen.getByLabelText('Song title'), 'just like honey{Enter}')
    server.advance(30_000)
    await user.click(screen.getByRole('button', { name: 'See results' }))

    await user.type(screen.getByLabelText('Add your score to the leaderboard'), 'Tyler')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText(/on the Folk leaderboard/)).toHaveTextContent('You’re #1 on the Folk leaderboard.')
    const board = screen.getByRole('region', { name: 'Top scores' })
    expect(within(board).getByText('Tyler')).toBeInTheDocument()
    expect(within(board).getByText('(you)')).toBeInTheDocument()

    // Back on the home screen, the new score is on the board.
    await user.click(screen.getByRole('button', { name: 'Play again' }))
    const updated = screen.getByRole('region', { name: /top scores · folk/i })
    expect(await within(updated).findByText('Tyler')).toBeInTheDocument()
  })

  it('shows the server error when a score is rejected', async () => {
    const playlists = [playlist('folk', 'Folk', [track('t1', 'Just Like Honey')])]
    const { user } = await renderApp(playlists)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Give up' }))
    await user.click(screen.getByRole('button', { name: 'See results' })) // no time has passed
    await user.type(screen.getByLabelText('Add your score to the leaderboard'), 'Speedy')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That game finished impossibly fast')
  })

})
