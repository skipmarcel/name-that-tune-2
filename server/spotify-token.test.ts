// @vitest-environment node
import {
  SPOTIFY_TOKEN_URL,
  SpotifyTokenError,
  createTokenProvider,
  requestAccessToken,
} from './spotify-token.js'

const credentials = { clientId: 'my-id', clientSecret: 'my-secret' }

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function tokenResponse(token = 'token-1', expiresIn = 3600) {
  return jsonResponse({ access_token: token, token_type: 'Bearer', expires_in: expiresIn })
}

describe('requestAccessToken', () => {
  it('posts client credentials with Basic auth and returns the token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(tokenResponse('abc', 3600))

    const token = await requestAccessToken(credentials, fetchImpl)

    expect(token).toEqual({ accessToken: 'abc', expiresIn: 3600 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(SPOTIFY_TOKEN_URL)
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${btoa('my-id:my-secret')}`)
    expect(String(init?.body)).toBe('grant_type=client_credentials')
  })

  it('throws a SpotifyTokenError with the status when Spotify rejects the request', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'invalid_client' }, { status: 400, statusText: 'Bad Request' }))

    const error = await requestAccessToken(credentials, fetchImpl).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SpotifyTokenError)
    expect((error as SpotifyTokenError).status).toBe(400)
  })

  it('throws when the response body is not a token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ nope: true }))

    await expect(requestAccessToken(credentials, fetchImpl)).rejects.toThrow(SpotifyTokenError)
  })
})

describe('createTokenProvider', () => {
  it('reuses a cached token until shortly before it expires', async () => {
    let time = 0
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse('first', 3600))
      .mockResolvedValueOnce(tokenResponse('second', 3600))
    const getToken = createTokenProvider(credentials, { fetchImpl, now: () => time })

    expect((await getToken()).accessToken).toBe('first')

    time = 30 * 60_000 // 30 minutes later
    const cached = await getToken()
    expect(cached).toEqual({ accessToken: 'first', expiresIn: 1800 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    time = 59.5 * 60_000 // inside the 60s refresh buffer
    expect((await getToken()).accessToken).toBe('second')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('shares one request between concurrent callers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(tokenResponse())
    const getToken = createTokenProvider(credentials, { fetchImpl })

    await Promise.all([getToken(), getToken(), getToken()])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, { status: 503 }))
      .mockResolvedValueOnce(tokenResponse('recovered'))
    const getToken = createTokenProvider(credentials, { fetchImpl })

    await expect(getToken()).rejects.toThrow(SpotifyTokenError)
    expect((await getToken()).accessToken).toBe('recovered')
  })
})
