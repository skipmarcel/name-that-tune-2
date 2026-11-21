// Vercel function: GET /api/leaderboard (top scores) and POST (submit a score).
import { createLeaderboardHandler } from '../server/leaderboard/runtime.js'

const handle = createLeaderboardHandler()

export function GET(request: Request): Promise<Response> {
  return handle(request)
}

export function POST(request: Request): Promise<Response> {
  return handle(request)
}
