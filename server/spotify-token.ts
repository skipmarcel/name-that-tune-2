/**
 * Server-side Spotify token exchange (Client Credentials flow).
 *
 * This module runs only on the server: in the Vercel function in production
 * and in Vite dev-server middleware locally. The client secret never leaves it.
 * https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
 */

export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

/** Refresh this many ms before Spotify's stated expiry, to absorb clock skew and latency. */
const EXPIRY_BUFFER_MS = 60_000

export interface SpotifyCredentials {
  clientId: string
  clientSecret: string
}

export interface AccessToken {
  accessToken: string
  /** Seconds until the token expires, as seen by the caller. */
  expiresIn: number
}

/** Thrown when Spotify rejects the request or returns something unexpected. */
export class SpotifyTokenError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SpotifyTokenError'
    this.status = status
  }
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

function isTokenResponse(value: unknown): value is SpotifyTokenResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.access_token === 'string' && typeof v.expires_in === 'number'
}

/** Requests a fresh app access token from Spotify. */
export async function requestAccessToken(
  { clientId, clientSecret }: SpotifyCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessToken> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) {
    throw new SpotifyTokenError(
      `Spotify token request failed: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  const data: unknown = await response.json()
  if (!isTokenResponse(data)) {
    throw new SpotifyTokenError('Spotify token response was missing expected fields')
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

/**
 * Wraps {@link requestAccessToken} with an in-memory cache, so a warm server
 * instance reuses one token (valid for an hour) instead of hitting Spotify on
 * every request. Concurrent callers share a single in-flight request.
 */
export function createTokenProvider(
  credentials: SpotifyCredentials,
  { fetchImpl = fetch, now = Date.now }: { fetchImpl?: typeof fetch; now?: () => number } = {},
): () => Promise<AccessToken> {
  let cached: { accessToken: string; expiresAt: number } | undefined
  let inFlight: Promise<AccessToken> | undefined

  return async function getToken() {
    if (cached && now() < cached.expiresAt - EXPIRY_BUFFER_MS) {
      return {
        accessToken: cached.accessToken,
        expiresIn: Math.floor((cached.expiresAt - now()) / 1000),
      }
    }

    inFlight ??= requestAccessToken(credentials, fetchImpl)
      .then((token) => {
        cached = { accessToken: token.accessToken, expiresAt: now() + token.expiresIn * 1000 }
        return token
      })
      .finally(() => {
        inFlight = undefined
      })

    return inFlight
  }
}
