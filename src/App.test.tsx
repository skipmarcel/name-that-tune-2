import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { PlaylistOption, Track } from './lib/playlist'

function playlist(id: string, title: string, trackCount: number): PlaylistOption {
  const tracks: Track[] = Array.from({ length: trackCount }, (_, i) => ({
    id: `${id}-${i}`,
    name: `Song ${i}`,
    artists: ['Artist'],
    album: 'Album',
    imageUrl: null,
    durationMs: 180_000,
  }))
  return { id, title, tracks }
}

describe('App', () => {
  it('renders the game title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /song sleuth/i })).toBeInTheDocument()
  })

  it('lets the player choose between playlists, with the first selected', async () => {
    render(<App playlists={[playlist('a', 'For Coding', 115), playlist('b', 'Obscure Folk and Rock', 1)]} />)

    const coding = screen.getByRole('radio', { name: /for coding/i })
    const folk = screen.getByRole('radio', { name: /obscure folk and rock/i })
    expect(screen.getByRole('group', { name: /choose a playlist/i })).toBeInTheDocument()
    expect(coding).toBeChecked()
    expect(screen.getByText('115 songs')).toBeInTheDocument()
    expect(screen.getByText('1 song')).toBeInTheDocument()

    await userEvent.click(folk)
    expect(folk).toBeChecked()
    expect(coding).not.toBeChecked()
  })

  it('shows unsynced playlists as unavailable', () => {
    render(<App playlists={[playlist('a', 'Empty', 0), playlist('b', 'Ready', 3)]} />)
    expect(screen.getByRole('radio', { name: /empty/i })).toBeDisabled()
    expect(screen.getByText('not synced yet')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ready/i })).toBeChecked()
  })

  it('explains how to load songs when nothing has been synced', () => {
    render(<App playlists={[playlist('a', 'Empty', 0)]} />)
    expect(screen.getByRole('status')).toHaveTextContent('npm run sync-playlist')
  })
})
