/** Browser client for the leaderboard API in server/leaderboard/api.ts. */

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  maxScore: number
  correct: number
  createdAt: number
}

export interface GameTicket {
  ticket: string
  trackIds: string[]
}

export interface SubmittedRound {
  guess: string | null
  hintsUsed: number
}

export interface Submission {
  ticket: string
  name: string
  rounds: SubmittedRound[]
}

export interface SubmitResult {
  rank: number
  entry: LeaderboardEntry
  entries: LeaderboardEntry[]
}

export interface LeaderboardClient {
  startGame(playlistId: string): Promise<GameTicket>
  getLeaderboard(playlistId: string): Promise<LeaderboardEntry[]>
  submitScore(submission: Submission): Promise<SubmitResult>
}

/** An API error with a message that's safe to show the player. */
export class LeaderboardError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LeaderboardError'
    this.status = status
  }
}

export function createLeaderboardClient(fetchImpl: typeof fetch = (...args) => fetch(...args)): LeaderboardClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      })
    } catch {
      throw new LeaderboardError('Could not reach the leaderboard. Check your connection.', 0)
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      throw new LeaderboardError(body.error ?? 'The leaderboard is unavailable right now.', response.status)
    }
    return body as T
  }

  return {
    startGame: (playlistId) =>
      request<GameTicket>('/api/games', { method: 'POST', body: JSON.stringify({ playlistId }) }),
    getLeaderboard: async (playlistId) =>
      (await request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?playlist=${encodeURIComponent(playlistId)}`))
        .entries,
    submitScore: (submission) =>
      request<SubmitResult>('/api/leaderboard', { method: 'POST', body: JSON.stringify(submission) }),
  }
}

export const leaderboardClient = createLeaderboardClient()
