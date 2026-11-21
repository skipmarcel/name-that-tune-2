import type { LeaderboardEntry } from '../leaderboard/client'
import type { LeaderboardStatus } from '../leaderboard/useLeaderboard'

interface LeaderboardProps {
  title: string
  status: LeaderboardStatus
  entries: LeaderboardEntry[]
  /** Entry to highlight, e.g. the score just submitted. */
  highlightId?: string
  limit?: number
}

export function Leaderboard({ title, status, entries, highlightId, limit = 10 }: LeaderboardProps) {
  return (
    <section className="leaderboard" aria-label={title}>
      <h2 className="leaderboard-title">{title}</h2>
      {status === 'loading' && <p className="leaderboard-note">Loading scores…</p>}
      {status === 'error' && <p className="leaderboard-note">The leaderboard is unavailable right now.</p>}
      {status === 'ready' && entries.length === 0 && (
        <p className="leaderboard-note">No scores yet. Be the first.</p>
      )}
      {status === 'ready' && entries.length > 0 && (
        <ol className="leaderboard-list">
          {entries.slice(0, limit).map((entry, i) => (
            <li key={entry.id} className={entry.id === highlightId ? 'is-you' : undefined}>
              <span className="leaderboard-rank">{i + 1}</span>
              <span className="leaderboard-name">
                {entry.name}
                {entry.id === highlightId && <span className="leaderboard-you"> (you)</span>}
              </span>
              <span className="leaderboard-score">
                {entry.score}
                <span className="visually-hidden"> out of {entry.maxScore}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
