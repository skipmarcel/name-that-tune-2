import { useId, useState, type FormEvent } from 'react'
import type { Round } from '../game/game'
import { HINTS, titleLettersHint } from '../game/scoring'
import type { SpotifyPlayer } from '../player/useSpotifyPlayer'

interface RoundViewProps {
  round: Round
  player: Omit<SpotifyPlayer, 'attachEmbed'>
  onGuess: (text: string) => void
  onHint: () => void
  onGiveUp: () => void
}

function PlayerControls({ player }: { player: RoundViewProps['player'] }) {
  if (player.status === 'error') {
    return (
      <p className="player-error" role="alert">
        The Spotify player couldn&rsquo;t load. Check your connection, or allow open.spotify.com if you use a
        content blocker.
      </p>
    )
  }

  const loading = player.status === 'loading' || (player.isBuffering && !player.isPlaying)
  return (
    <div className="player-controls">
      <button
        type="button"
        className="play-button"
        onClick={player.isPlaying ? player.pause : player.play}
        aria-label={player.isPlaying ? 'Pause' : 'Play'}
      >
        {player.isPlaying ? '❚❚' : '▶'}
      </button>
      <progress
        className="player-progress"
        aria-label="Song progress"
        value={player.position}
        max={player.duration || 1}
      />
      <span className="player-status" aria-live="polite">
        {loading ? 'Loading…' : ''}
      </span>
    </div>
  )
}

export function RoundView({ round, player, onGuess, onHint, onGiveUp }: RoundViewProps) {
  const [guess, setGuess] = useState('')
  const inputId = useId()
  const { track, hintsUsed, wrongGuesses } = round
  const hintsLeft = HINTS.length - hintsUsed

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!guess.trim()) return
    onGuess(guess)
    setGuess('')
  }

  return (
    <section className="round" aria-label="Current song">
      <PlayerControls player={player} />

      {hintsUsed > 0 && (
        <dl className="hints">
          {hintsUsed >= 1 && (
            <div className="hint hint-art">
              <dt>Album</dt>
              <dd>
                {track.imageUrl ? <img src={track.imageUrl} alt="Album cover" width={160} height={160} /> : '—'}
              </dd>
            </div>
          )}
          {hintsUsed >= 2 && (
            <div className="hint">
              <dt>Artist</dt>
              <dd>{track.artists.join(', ')}</dd>
            </div>
          )}
          {hintsUsed >= 3 && (
            <div className="hint">
              <dt>Title</dt>
              <dd className="title-letters">{titleLettersHint(track.name)}</dd>
            </div>
          )}
        </dl>
      )}

      <form className="guess-form" onSubmit={submit}>
        <label htmlFor={inputId}>Name that tune</label>
        <div className="guess-row">
          <input
            id={inputId}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Song title"
          />
          <button type="submit">Guess</button>
        </div>
      </form>

      <p className="feedback" aria-live="polite">
        {wrongGuesses.length > 0 && `Not quite: “${wrongGuesses.at(-1)}”. Try again.`}
      </p>

      <div className="round-actions">
        <button type="button" onClick={onHint} disabled={hintsLeft === 0}>
          {hintsLeft === 0 ? 'No hints left' : `Hint (−1 point)`}
        </button>
        <button type="button" className="secondary" onClick={onGiveUp}>
          Give up
        </button>
      </div>
    </section>
  )
}
