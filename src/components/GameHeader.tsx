import type { Round } from '../game/game'

interface GameHeaderProps {
  rounds: Round[]
  roundIndex: number
  score: number
}

function dotState(round: Round, index: number, roundIndex: number) {
  if (round.outcome === 'correct') return 'correct'
  if (round.outcome === 'gaveUp') return 'missed'
  return index === roundIndex ? 'current' : 'upcoming'
}

export function GameHeader({ rounds, roundIndex, score }: GameHeaderProps) {
  return (
    <div className="game-header">
      <p className="game-header-round">
        Song <strong>{roundIndex + 1}</strong> of {rounds.length}
      </p>
      <ol className="round-dots" aria-hidden="true">
        {rounds.map((round, i) => (
          <li key={round.track.id} className={`round-dot round-dot-${dotState(round, i, roundIndex)}`} />
        ))}
      </ol>
      <p className="score-pill">
        <span className="visually-hidden">Score: </span>
        <strong>{score}</strong> pts
      </p>
    </div>
  )
}
