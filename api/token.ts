// Vercel function: GET /api/token
// Returns a short-lived Spotify access token. The client secret stays on the server.
import { createTokenHandler } from '../server/token-handler.js'

const handleTokenRequest = createTokenHandler()

export function GET(request: Request): Promise<Response> {
  return handleTokenRequest(request)
}
