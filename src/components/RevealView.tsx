import type { Round } from '../game/game'

interface RevealViewProps {
  round: Round
  isLastRound: boolean
  onNext: () => void
}

function pointsLabel(points: number) {
  return `${points} ${points === 1 ? 'point' : 'points'}`
}

export function RevealView({ round, isLastRound, onNext }: RevealViewProps) {
  const { track, outcome, points } = round
  const correct = outcome === 'correct'

  return (
    <section className={`card reveal ${correct ? 'is-correct' : 'is-missed'}`} aria-label="Answer">
      <p className="reveal-banner" role="status">
        {correct ? (
          <>
            <span aria-hidden="true">✓ </span>Correct! +{pointsLabel(points)}
          </>
        ) : (
          'The answer was'
        )}
      </p>
      <div className="reveal-track">
        {track.imageUrl && <img className="reveal-cover" src={track.imageUrl} alt="" />}
        <div className="reveal-details">
          <h2 className="reveal-title">{track.name}</h2>
          <p className="reveal-artist">{track.artists.join(', ')}</p>
          <p className="reveal-album">{track.album}</p>
          <a
            className="spotify-link"
            href={`https://open.spotify.com/track/${track.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Spotify<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      {/* Focus moves here after answering so Enter goes straight to the next song. */}
      <button type="button" className="button-primary button-wide" onClick={onNext} autoFocus>
        {isLastRound ? 'See results' : 'Next song'}
      </button>
    </section>
  )
}
