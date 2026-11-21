import type { ReactNode } from 'react'
import type { Round } from '../game/game'
import { verdict } from '../game/verdict'

interface ResultsViewProps {
  rounds: Round[]
  score: number
  maxScore: number
  playlistTitle: string
  onPlayAgain: () => void
  /** Shown between the song list and the Play again button (the leaderboard). */
  children?: ReactNode
}

export function ResultsView({ rounds, score, maxScore, playlistTitle, onPlayAgain, children }: ResultsViewProps) {
  const correct = rounds.filter((r) => r.outcome === 'correct').length

  return (
    <section className="card results" aria-labelledby="results-heading">
      <p className="results-eyebrow">{playlistTitle}</p>
      <h2 id="results-heading" className="results-score" aria-label={`Final score: ${score} out of ${maxScore}`}>
        {score}
        <span className="results-max">/ {maxScore}</span>
      </h2>
      <p className="results-verdict">{verdict(score, maxScore)}</p>
      <p className="results-summary">
        You named {correct} of {rounds.length} songs.
      </p>

      <ol className="results-list">
        {rounds.map(({ track, outcome, points }) => (
          <li key={track.id} className={outcome === 'correct' ? 'is-correct' : 'is-missed'}>
            {track.imageUrl ? <img src={track.imageUrl} alt="" /> : <span className="results-thumb" />}
            <span className="results-song">
              <span className="results-title">{track.name}</span>
              <span className="results-artist">{track.artists.join(', ')}</span>
            </span>
            <span className="results-points">
              {outcome === 'correct' ? `+${points}` : <span aria-label="missed">—</span>}
            </span>
          </li>
        ))}
      </ol>

      {children}

      <button type="button" className="button-primary button-wide" onClick={onPlayAgain}>
        Play again
      </button>
    </section>
  )
}
