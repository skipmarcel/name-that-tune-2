import { formatTime, hasEnded } from '../player/format'
import type { SpotifyPlayer } from '../player/useSpotifyPlayer'

export type PlayerState = Omit<SpotifyPlayer, 'attachEmbed'>

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  )
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5V2L7.5 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"
        fill="currentColor"
      />
    </svg>
  )
}

export function PlayerControls({ player }: { player: PlayerState }) {
  if (player.status === 'error') {
    return (
      <p className="player-error" role="alert">
        The Spotify player couldn&rsquo;t load. Check your connection, or allow open.spotify.com if you use a
        content blocker, then reload the page.
      </p>
    )
  }

  const ended = hasEnded(player.position, player.duration, player.isPlaying)
  const loading = player.status === 'loading' || (player.isBuffering && !player.isPlaying && !ended)
  const { label, icon, onClick } = player.isPlaying
    ? { label: 'Pause', icon: <PauseIcon />, onClick: player.pause }
    : ended
      ? { label: 'Play again from the start', icon: <ReplayIcon />, onClick: player.replay }
      : { label: 'Play', icon: <PlayIcon />, onClick: player.play }

  const percent = player.duration > 0 ? Math.min(100, (player.position / player.duration) * 100) : 0

  return (
    <div className="player">
      <button
        type="button"
        className={`play-button${player.isPlaying ? ' is-playing' : ''}`}
        onClick={onClick}
        aria-label={label}
      >
        {icon}
      </button>
      <div className="player-track">
        <div
          className="player-bar"
          role="progressbar"
          aria-label="Clip progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(player.duration / 1000)}
          aria-valuenow={Math.round(player.position / 1000)}
          aria-valuetext={`${formatTime(player.position)} of ${formatTime(player.duration)}`}
        >
          <div className="player-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="player-times">
          <span>{formatTime(player.position)}</span>
          <span aria-live="polite">{loading ? 'Loading…' : ended ? 'Clip over' : ''}</span>
          <span>{player.duration > 0 ? formatTime(player.duration) : '–:––'}</span>
        </div>
      </div>
    </div>
  )
}
