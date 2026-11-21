import { render, screen } from '@testing-library/react'
import App from './App'
import type { SavedPlaylist, Track } from './lib/playlist'

function playlistWith(trackCount: number): SavedPlaylist {
  const tracks: Track[] = Array.from({ length: trackCount }, (_, i) => ({
    id: `track${i}`,
    name: `Song ${i}`,
    artists: ['Artist'],
    album: 'Album',
    imageUrl: null,
    durationMs: 180_000,
  }))
  return { id: 'playlist', name: 'For Coding', syncedAt: '2026-11-21T00:00:00.000Z', tracks }
}

describe('App', () => {
  it('renders the game title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /song sleuth/i })).toBeInTheDocument()
  })

  it('shows how many songs were loaded', () => {
    render(<App playlist={playlistWith(42)} />)
    expect(screen.getByRole('status')).toHaveTextContent('42 songs loaded from “For Coding”')
  })

  it('uses the singular for one song', () => {
    render(<App playlist={playlistWith(1)} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 song loaded')
  })

  it('explains how to load songs when the playlist has not been synced', () => {
    render(<App playlist={playlistWith(0)} />)
    expect(screen.getByRole('status')).toHaveTextContent('npm run sync-playlist')
  })
})
