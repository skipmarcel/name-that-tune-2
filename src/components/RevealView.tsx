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

  return (
    <section className="reveal" aria-label="Answer">
      <h2>{outcome === 'correct' ? `Correct! +${pointsLabel(points)}` : 'The answer was'}</h2>
      <div className="reveal-track">
        {track.imageUrl && <img src={track.imageUrl} alt="" width={160} height={160} />}
        <div>
          <p className="reveal-title">{track.name}</p>
          <p className="reveal-artist">{track.artists.join(', ')}</p>
          <p className="reveal-album">{track.album}</p>
          <a href={`https://open.spotify.com/track/${track.id}`} target="_blank" rel="noreferrer">
            Open in Spotify
          </a>
        </div>
      </div>
      {/* Focus moves here after answering so Enter goes straight to the next song. */}
      <button type="button" onClick={onNext} autoFocus>
        {isLastRound ? 'See results' : 'Next song'}
      </button>
    </section>
  )
}
