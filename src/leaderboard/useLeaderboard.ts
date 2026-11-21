import { useEffect, useState } from 'react'
import type { LeaderboardClient, LeaderboardEntry } from './client'

export type LeaderboardStatus = 'loading' | 'ready' | 'error'

/** Loads a playlist's top scores whenever the playlist (or `refreshKey`) changes. */
export function useLeaderboard(client: LeaderboardClient, playlistId: string | undefined, refreshKey = 0) {
  const [state, setState] = useState<{ key: string; status: LeaderboardStatus; entries: LeaderboardEntry[] }>({
    key: '',
    status: 'loading',
    entries: [],
  })
  const key = `${playlistId}:${refreshKey}`

  useEffect(() => {
    if (!playlistId) return
    let cancelled = false
    client.getLeaderboard(playlistId).then(
      (entries) => !cancelled && setState({ key, status: 'ready', entries }),
      () => !cancelled && setState({ key, status: 'error', entries: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [client, playlistId, key])

  // Until this playlist's request settles, report loading rather than stale rows.
  return state.key === key ? state : { key, status: 'loading' as const, entries: [] }
}
