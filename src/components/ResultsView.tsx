import type { Round } from '../game/game'

interface ResultsViewProps {
  rounds: Round[]
  score: number
  maxScore: number
  onPlayAgain: () => void
}

export function ResultsView({ rounds, score, maxScore, onPlayAgain }: ResultsViewProps) {
  return (
    <section className="results" aria-label="Results">
      <h2>
        Final score: {score} / {maxScore}
      </h2>
      <ol className="results-list">
        {rounds.map(({ track, outcome, points }) => (
          <li key={track.id}>
            <span className="results-song">
              {track.name} <span className="results-artist">— {track.artists.join(', ')}</span>
            </span>
            <span className="results-points">{outcome === 'correct' ? `+${points}` : '—'}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onPlayAgain}>
        Play again
      </button>
    </section>
  )
}
