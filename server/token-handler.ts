import { SpotifyTokenError, createTokenProvider, type AccessToken } from './spotify-token.js'

type Env = Record<string, string | undefined>

export interface TokenHandlerOptions {
  /** Where to read SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET from. Defaults to process.env. */
  getEnv?: () => Env
  fetchImpl?: typeof fetch
}

/** JSON body returned to the browser on success. */
export type TokenResponseBody = AccessToken

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Tokens are bearer credentials: never let a CDN or browser cache store them.
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

/**
 * Builds the `GET /api/token` handler using the web-standard Request/Response
 * API, so the same code runs as a Vercel function and inside the Vite dev server.
 */
export function createTokenHandler({
  getEnv = () => process.env,
  fetchImpl = fetch,
}: TokenHandlerOptions = {}) {
  let getToken: (() => Promise<AccessToken>) | undefined

  return async function handleTokenRequest(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    }

    if (!getToken) {
      const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = getEnv()
      if (!clientId || !clientSecret) {
        console.error('[api/token] SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set')
        return json({ error: 'Server is missing Spotify credentials' }, 500)
      }
      getToken = createTokenProvider({ clientId, clientSecret }, { fetchImpl })
    }

    try {
      const body: TokenResponseBody = await getToken()
      return json(body, 200)
    } catch (error) {
      if (error instanceof SpotifyTokenError) {
        console.error(`[api/token] ${error.message}`)
        return json({ error: 'Could not get an access token from Spotify' }, 502)
      }
      console.error('[api/token] Unexpected error', error)
      return json({ error: 'Internal server error' }, 500)
    }
  }
}
