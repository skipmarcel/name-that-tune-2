// @vitest-environment node
import { createTokenHandler } from './token-handler.js'

const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret' }
const get = () => new Request('http://localhost/api/token')

function spotifyOk() {
  return new Response(
    JSON.stringify({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
    { status: 200 },
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('token handler', () => {
  it('returns the access token as uncacheable JSON', async () => {
    const handler = createTokenHandler({
      getEnv: () => env,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(spotifyOk()),
    })

    const res = await handler(get())

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ accessToken: 'tok', expiresIn: 3600 })
  })

  it('never includes the client secret in the response', async () => {
    const handler = createTokenHandler({
      getEnv: () => env,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(spotifyOk()),
    })

    const text = await (await handler(get())).text()

    expect(text).not.toContain('secret')
  })

  it('rejects methods other than GET', async () => {
    const handler = createTokenHandler({ getEnv: () => env })

    const res = await handler(new Request('http://localhost/api/token', { method: 'POST' }))

    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe('GET')
  })

  it('returns 500 when credentials are not configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const handler = createTokenHandler({ getEnv: () => ({}), fetchImpl })

    const res = await handler(get())

    expect(res.status).toBe(500)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 502 without leaking details when Spotify rejects the credentials', async () => {
    const handler = createTokenHandler({
      getEnv: () => env,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"error":"invalid_client"}', { status: 400 })),
    })

    const res = await handler(get())

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Could not get an access token from Spotify' })
  })
})
