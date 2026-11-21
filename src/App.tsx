import savedPlaylist from './data/playlist.json'
import type { SavedPlaylist } from './lib/playlist'

interface AppProps {
  playlist?: SavedPlaylist
}

function App({ playlist = savedPlaylist }: AppProps) {
  const count = playlist.tracks.length

  return (
    <main className="app">
      <h1>Song Sleuth</h1>
      <p>Hear a clip. Name the tune. Beat your high score.</p>
      <p className="playlist-status" role="status">
        {count > 0 ? (
          <>
            {count} {count === 1 ? 'song' : 'songs'} loaded from “{playlist.name}”
          </>
        ) : (
          <>
            No songs yet. Run <code>npm run sync-playlist</code> to load the playlist.
          </>
        )}
      </p>
    </main>
  )
}

export default App
