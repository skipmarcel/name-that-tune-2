import { useEffect, useReducer, useState } from 'react'
import { GameHeader } from './components/GameHeader'
import { Leaderboard } from './components/Leaderboard'
import { PlaylistPicker } from './components/PlaylistPicker'
import { ResultsView } from './components/ResultsView'
import { RevealView } from './components/RevealView'
import { RoundView } from './components/RoundView'
import { ScoreSubmission } from './components/ScoreSubmission'
import { playlistOptions } from './data/playlists'
import { ROUNDS_PER_GAME, currentRound, gameReducer, initialGameState, maxScore, startGame } from './game/game'
import { MAX_POINTS } from './game/scoring'
import { leaderboardClient, type GameTicket, type LeaderboardClient } from './leaderboard/client'
import { useLeaderboard } from './leaderboard/useLeaderboard'
import type { PlaylistOption, Track } from './lib/playlist'
import type { SpotifyIFrameAPI } from './player/spotify-iframe'
import { useSpotifyPlayer } from './player/useSpotifyPlayer'

interface AppProps {
  playlists?: PlaylistOption[]
  /** Injectable for tests; defaults to loading Spotify's real iFrame API. */
  loadSpotifyApi?: () => Promise<SpotifyIFrameAPI>
  /** Injectable for tests; defaults to the /api leaderboard. */
  leaderboard?: LeaderboardClient
}

/** Maps a ticket's track IDs back to tracks; null if any is missing locally. */
function ticketTracks(ticket: GameTicket, tracks: Track[]): Track[] | null {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const picked = ticket.trackIds.map((id) => byId.get(id))
  return picked.length > 0 && picked.every(Boolean) ? (picked as Track[]) : null
}

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M19.5 19.5 28 28" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M11 17.5V9.5l5.5-1.5v7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="9.6" cy="17.6" r="1.6" fill="currentColor" />
      <circle cx="15.1" cy="15.6" r="1.6" fill="currentColor" />
    </svg>
  )
}

function App({ playlists = playlistOptions, loadSpotifyApi, leaderboard = leaderboardClient }: AppProps) {
  const available = playlists.filter((p) => p.tracks.length > 0)
  const [selectedId, setSelectedId] = useState(available[0]?.id)
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const { attachEmbed, ...player } = useSpotifyPlayer({ loadApi: loadSpotifyApi })

  const selected = available.find((p) => p.id === selectedId)
  const round = currentRound(state)
  const inGame = state.phase !== 'ready'

  // A ranked game needs a server-issued ticket. It's fetched ahead of time on
  // the home screen so Start can begin playback immediately (browsers only
  // allow audio from the click itself, not after a network round trip).
  const [nextTicket, setNextTicket] = useState<{ playlistId: string; ticket: GameTicket } | null>(null)
  const [gameTicket, setGameTicket] = useState<string | null>(null)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const board = useLeaderboard(leaderboard, inGame ? undefined : selectedId, gamesPlayed)

  useEffect(() => {
    if (inGame || !selectedId) return
    let cancelled = false
    leaderboard.startGame(selectedId).then(
      (ticket) => !cancelled && setNextTicket({ playlistId: selectedId, ticket }),
      () => !cancelled && setNextTicket(null),
    )
    return () => {
      cancelled = true
    }
  }, [leaderboard, selectedId, inGame, gamesPlayed])

  // Playback starts inside these click handlers so browsers allow the audio.
  function start() {
    if (!selected) return
    const ranked = nextTicket?.playlistId === selected.id ? nextTicket.ticket : null
    const rankedTracks = ranked && ticketTracks(ranked, selected.tracks)
    // Without a ticket (offline, or the server is down) the game is still
    // playable, just not ranked.
    const action = rankedTracks ? { type: 'start' as const, tracks: rankedTracks } : startGame(selected.tracks)
    setGameTicket(rankedTracks && ranked ? ranked.ticket : null)
    setNextTicket(null)
    dispatch(action)
    if (action.type === 'start' && action.tracks[0]) player.playTrack(action.tracks[0].id)
  }

  function next() {
    const upcoming = state.rounds[state.roundIndex + 1]
    dispatch({ type: 'next' })
    if (upcoming) player.playTrack(upcoming.track.id)
    else player.pause()
  }

  function backToStart() {
    player.pause()
    setGamesPlayed((n) => n + 1)
    dispatch({ type: 'reset' })
  }

  return (
    <div className="shell">
      <header className={`site-header${inGame ? ' is-compact' : ''}`}>
        {inGame ? (
          <button type="button" className="brand brand-button" onClick={backToStart} aria-label="Song Sleuth: quit to start">
            <Logo />
            <span>Song Sleuth</span>
          </button>
        ) : (
          <p className="brand">
            <Logo />
            <span>Song Sleuth</span>
          </p>
        )}
      </header>

      <main className="main">
        {state.phase === 'ready' && (
          <section className="home" aria-labelledby="home-heading">
            <h1 id="home-heading" className="home-title">
              Name that tune.
            </h1>
            <p className="home-lede">
              Hear a clip, type the title. {ROUNDS_PER_GAME} songs, up to {MAX_POINTS} points each. Hints help, but
              they cost you.
            </p>
            {available.length === 0 ? (
              <p className="card notice" role="status">
                No songs yet. Run <code>npm run sync-playlist</code> to load the playlists.
              </p>
            ) : (
              <>
                <PlaylistPicker playlists={playlists} selectedId={selectedId} onSelect={setSelectedId} />
                <button type="button" className="button-primary button-wide start-button" onClick={start} disabled={!selected}>
                  Start
                </button>
                <Leaderboard
                  title={`Top scores · ${selected?.title ?? ''}`}
                  status={board.status}
                  entries={board.entries}
                  limit={5}
                />
              </>
            )}
          </section>
        )}

        {(state.phase === 'guessing' || state.phase === 'revealed') && round && (
          <>
            <h1 className="visually-hidden">Song Sleuth</h1>
            <GameHeader rounds={state.rounds} roundIndex={state.roundIndex} score={state.score} />
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
              <RevealView round={round} isLastRound={state.roundIndex === state.rounds.length - 1} onNext={next} />
            )}
          </>
        )}

        {state.phase === 'finished' && (
          <>
            <h1 className="visually-hidden">Song Sleuth results</h1>
            <ResultsView
              rounds={state.rounds}
              score={state.score}
              maxScore={maxScore(state)}
              playlistTitle={selected?.title ?? ''}
              onPlayAgain={backToStart}
            >
              <ScoreSubmission
                client={leaderboard}
                ticket={gameTicket}
                rounds={state.rounds}
                playlistTitle={selected?.title ?? ''}
              />
            </ResultsView>
          </>
        )}
      </main>

      <footer className="site-footer">
        <p>
          Songs play through Spotify. Built by{' '}
          <a href="https://github.com/skipmarcel/name-that-tune-2">Tyler Adams</a>.
        </p>
      </footer>

      {/* The embed shows the song title, so it plays invisibly (see .embed-offscreen). */}
      <div ref={attachEmbed} className="embed-offscreen" aria-hidden="true" inert />
    </div>
  )
}

export default App
