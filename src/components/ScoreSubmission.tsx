import { useId, useState, type FormEvent } from 'react'
import { LeaderboardError, type LeaderboardClient, type SubmitResult } from '../leaderboard/client'
import type { Round } from '../game/game'
import { Leaderboard } from './Leaderboard'

interface ScoreSubmissionProps {
  client: LeaderboardClient
  ticket: string | null
  rounds: Round[]
  playlistTitle: string
}

const NAME_KEY = 'songSleuth.playerName'
const MAX_NAME_LENGTH = 20

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // Private browsing or storage disabled: just don't remember it.
  }
}

/** Name entry after a ranked game, then the leaderboard with the new score highlighted. */
export function ScoreSubmission({ client, ticket, rounds, playlistTitle }: ScoreSubmissionProps) {
  const [name, setName] = useState(savedName)
  const [state, setState] = useState<
    { status: 'idle' } | { status: 'sending' } | { status: 'error'; message: string } | { status: 'done'; result: SubmitResult }
  >({ status: 'idle' })
  const inputId = useId()

  if (!ticket) {
    return (
      <p className="leaderboard-note">
        This game wasn&rsquo;t ranked because the leaderboard couldn&rsquo;t be reached when it started.
      </p>
    )
  }

  if (state.status === 'done') {
    const { rank, entry, entries } = state.result
    return (
      <>
        <p className="submit-result" role="status">
          You&rsquo;re <strong>#{rank}</strong> on the {playlistTitle} leaderboard.
        </p>
        <Leaderboard title="Top scores" status="ready" entries={entries} highlightId={entry.id} />
      </>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ticket || !name.trim()) return
    setState({ status: 'sending' })
    try {
      const result = await client.submitScore({
        ticket,
        name: name.trim(),
        rounds: rounds.map((r) => ({ artist: r.artistGuess, title: r.titleGuess })),
      })
      rememberName(name.trim())
      setState({ status: 'done', result })
    } catch (error) {
      const message = error instanceof LeaderboardError ? error.message : 'Something went wrong. Try again.'
      setState({ status: 'error', message })
    }
  }

  return (
    <form className="submit-form" onSubmit={submit}>
      <label htmlFor={inputId} className="submit-label">
        Add your score to the leaderboard
      </label>
      <div className="guess-row">
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          placeholder="Your name"
          required
        />
        <button type="submit" className="button-primary" disabled={state.status === 'sending' || !name.trim()}>
          {state.status === 'sending' ? 'Saving…' : 'Submit'}
        </button>
      </div>
      {state.status === 'error' && (
        <p className="submit-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
