// Vercel function: POST /api/games. Starts a game and returns a signed ticket.
import { createLeaderboardHandler } from '../server/leaderboard/runtime.js'

const handle = createLeaderboardHandler()

export function POST(request: Request): Promise<Response> {
  return handle(request)
}
