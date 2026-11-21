import { useId, useState } from 'react'
import { playlistOptions } from './data/playlists'
import type { PlaylistOption } from './lib/playlist'

interface AppProps {
  playlists?: PlaylistOption[]
}

function songCount(count: number) {
  return `${count} ${count === 1 ? 'song' : 'songs'}`
}

function App({ playlists = playlistOptions }: AppProps) {
  const available = playlists.filter((p) => p.tracks.length > 0)
  const [selectedId, setSelectedId] = useState(available[0]?.id)
  const groupName = useId()

  return (
    <main className="app">
      <h1>Song Sleuth</h1>
      <p>Hear a clip. Name the tune. Beat your high score.</p>

      {available.length === 0 ? (
        <p role="status">
          No songs yet. Run <code>npm run sync-playlist</code> to load the playlists.
        </p>
      ) : (
        <fieldset className="playlist-picker">
          <legend>Choose a playlist</legend>
          {playlists.map((playlist) => {
            const synced = playlist.tracks.length > 0
            return (
              <label key={playlist.id} className="playlist-option">
                <input
                  type="radio"
                  name={groupName}
                  value={playlist.id}
                  checked={selectedId === playlist.id}
                  disabled={!synced}
                  onChange={() => setSelectedId(playlist.id)}
                />
                <span className="playlist-title">{playlist.title}</span>
                <span className="playlist-count">
                  {synced ? songCount(playlist.tracks.length) : 'not synced yet'}
                </span>
              </label>
            )
          })}
        </fieldset>
      )}
    </main>
  )
}

export default App
