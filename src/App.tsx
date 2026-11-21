import { useReducer, useState } from 'react'
import { PlaylistPicker } from './components/PlaylistPicker'
import { ResultsView } from './components/ResultsView'
import { RevealView } from './components/RevealView'
import { RoundView } from './components/RoundView'
import { playlistOptions } from './data/playlists'
import { currentRound, gameReducer, initialGameState, maxScore, startGame } from './game/game'
import type { PlaylistOption } from './lib/playlist'
import type { SpotifyIFrameAPI } from './player/spotify-iframe'
import { useSpotifyPlayer } from './player/useSpotifyPlayer'

interface AppProps {
  playlists?: PlaylistOption[]
  /** Injectable for tests; defaults to loading Spotify's real iFrame API. */
  loadSpotifyApi?: () => Promise<SpotifyIFrameAPI>
}

function App({ playlists = playlistOptions, loadSpotifyApi }: AppProps) {
  const available = playlists.filter((p) => p.tracks.length > 0)
  const [selectedId, setSelectedId] = useState(available[0]?.id)
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const { attachEmbed, ...player } = useSpotifyPlayer({ loadApi: loadSpotifyApi })

  const selected = available.find((p) => p.id === selectedId)
  const round = currentRound(state)

  // Playback starts inside these click handlers so browsers allow the audio.
  function start() {
    if (!selected) return
    const action = startGame(selected.tracks)
    dispatch(action)
    if (action.type === 'start' && action.tracks[0]) player.playTrack(action.tracks[0].id)
  }

  function next() {
    const upcoming = state.rounds[state.roundIndex + 1]
    dispatch({ type: 'next' })
    if (upcoming) player.playTrack(upcoming.track.id)
    else player.pause()
  }

  function playAgain() {
    player.pause()
    dispatch({ type: 'reset' })
  }

  return (
    <main className="app">
      <h1>Song Sleuth</h1>

      {state.phase === 'ready' && (
        <>
          <p>Hear a clip. Name the tune. Beat your high score.</p>
          {available.length === 0 ? (
            <p role="status">
              No songs yet. Run <code>npm run sync-playlist</code> to load the playlists.
            </p>
          ) : (
            <>
              <PlaylistPicker playlists={playlists} selectedId={selectedId} onSelect={setSelectedId} />
              <button type="button" className="start-button" onClick={start} disabled={!selected}>
                Start
              </button>
            </>
          )}
        </>
      )}

      {(state.phase === 'guessing' || state.phase === 'revealed') && round && (
        <>
          <p className="round-status">
            Song {state.roundIndex + 1} of {state.rounds.length} · Score {state.score}
          </p>
          {state.phase === 'guessing' ? (
            <RoundView
              key={state.roundIndex}
              round={round}
              player={player}
              onGuess={(text) => dispatch({ type: 'guess', text })}
              onHint={() => dispatch({ type: 'hint' })}
              onGiveUp={() => dispatch({ type: 'giveUp' })}
            />
          ) : (
            <RevealView
              round={round}
              isLastRound={state.roundIndex === state.rounds.length - 1}
              onNext={next}
            />
          )}
        </>
      )}

      {state.phase === 'finished' && (
        <ResultsView
          rounds={state.rounds}
          score={state.score}
          maxScore={maxScore(state)}
          onPlayAgain={playAgain}
        />
      )}

      {/* The embed shows the song title, so it plays invisibly (see .embed-offscreen). */}
      <div ref={attachEmbed} className="embed-offscreen" aria-hidden="true" inert />
    </main>
  )
}

export default App
