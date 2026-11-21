/**
 * Saves the game's playlist to src/data/playlist.json.
 *
 *   npm run sync-playlist
 *
 * Spotify only returns a playlist's tracks to a signed-in user, so this opens
 * a Spotify sign-in page in the browser (Authorization Code flow with PKCE),
 * then reads every page of the playlist and writes the playable tracks to disk.
 * Only SPOTIFY_CLIENT_ID and VITE_PLAYLIST_ID are needed; the client secret and
 * the sign-in token are never stored.
 *
 * The redirect URI below must be listed in the app's settings on the Spotify
 * Developer Dashboard.
 */
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import {
  normalizePlaylistItems,
  parsePlaylistId,
  type SavedPlaylist,
} from '../src/lib/playlist.ts'

const REDIRECT_URI = 'http://127.0.0.1:5173/callback'
const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-private'
const OUTPUT_FILE = new URL('../src/data/playlist.json', import.meta.url)
const SIGN_IN_TIMEOUT_MS = 5 * 60_000
const API = 'https://api.spotify.com/v1'

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

function base64Url(bytes: Buffer) {
  return bytes.toString('base64url')
}

function openInBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  spawn(command, [url], { stdio: 'ignore', detached: true })
    .on('error', () => {}) // the URL is printed too, so a missing opener is fine
    .unref()
}

/** Opens the Spotify sign-in page and resolves with the authorization code. */
function signIn(clientId: string, codeChallenge: string): Promise<string> {
  const state = base64Url(randomBytes(16))
  const redirect = new URL(REDIRECT_URI)
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  }).toString()

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI)
      if (url.pathname !== redirect.pathname) {
        res.writeHead(404).end()
        return
      }
      const finish = (ok: boolean, message: string, result: () => void) => {
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<p style="font:16px system-ui;margin:2rem">${message}</p>`)
        clearTimeout(timer)
        server.close()
        result()
      }

      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      if (url.searchParams.get('state') !== state) {
        finish(false, 'Sign-in failed: state mismatch.', () =>
          reject(new Error('Sign-in response did not match this request. Try again.')),
        )
      } else if (error || !code) {
        finish(false, `Sign-in cancelled (${error ?? 'no code'}).`, () =>
          reject(new Error(`Spotify sign-in was not completed: ${error ?? 'no code returned'}`)),
        )
      } else {
        finish(true, 'Signed in. You can close this tab and return to the terminal.', () =>
          resolve(code),
        )
      }
    })

    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Timed out waiting for Spotify sign-in.'))
    }, SIGN_IN_TIMEOUT_MS)

    server.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(`Port ${redirect.port} is in use. Stop \`npm run dev\` and run this again.`)
          : err,
      )
    })

    server.listen(Number(redirect.port), redirect.hostname, () => {
      console.log('Opening Spotify sign-in in your browser. If it does not open, visit:\n')
      console.log(`  ${authorizeUrl}\n`)
      openInBrowser(authorizeUrl.toString())
    })
  })
}

async function exchangeCode(clientId: string, code: string, codeVerifier: string) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as { access_token?: string }
  if (!response.ok || !body.access_token) {
    throw new Error(`Spotify rejected the sign-in (${response.status}).`)
  }
  return body.access_token
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) {
    // Spotify explains most refusals in the body, e.g. a missing Premium subscription.
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string } | string
      error_description?: string
    } | null
    const reason =
      typeof body?.error === 'object' ? body.error.message : (body?.error_description ?? body?.error)
    const hint =
      response.status === 404
        ? ' Check VITE_PLAYLIST_ID.'
        : response.status === 403
          ? ' Spotify only shares a playlist\'s tracks with its owner or collaborators.'
          : ''
    throw new Error(
      `Spotify returned ${response.status} for ${new URL(url).pathname}` +
        (reason ? `: "${reason}".` : '.') +
        hint,
    )
  }
  return (await response.json()) as Record<string, unknown>
}

/** Follows Spotify's `next` links until every page of items has been read. */
async function fetchAllItems(playlistId: string, accessToken: string) {
  const items: unknown[] = []
  let next: string | null = `${API}/playlists/${playlistId}/items?limit=50&additional_types=track`
  while (next) {
    const page = await getJson(next, accessToken)
    if (Array.isArray(page.items)) items.push(...page.items)
    next = typeof page.next === 'string' ? page.next : null
    process.stdout.write(`\rRead ${items.length} items…`)
  }
  process.stdout.write('\n')
  return items
}

async function main() {
  try {
    process.loadEnvFile('.env')
  } catch {
    fail('No .env file found. Copy .env.example to .env and fill it in.')
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  if (!clientId) fail('SPOTIFY_CLIENT_ID is missing from .env.')
  const playlistId = parsePlaylistId(process.env.VITE_PLAYLIST_ID ?? '')
  if (!playlistId) fail('VITE_PLAYLIST_ID in .env is not a valid playlist ID or link.')

  const codeVerifier = base64Url(randomBytes(64))
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest())

  try {
    const code = await signIn(clientId, codeChallenge)
    const accessToken = await exchangeCode(clientId, code, codeVerifier)

    const me = await getJson(`${API}/me`, accessToken)
    const details = await getJson(
      `${API}/playlists/${playlistId}?fields=name,collaborative,owner(id,display_name)`,
      accessToken,
    )
    const owner = (details.owner ?? {}) as { id?: string; display_name?: string }
    const name = typeof details.name === 'string' ? details.name : 'Untitled playlist'
    console.log(`Signed in as ${String(me.display_name ?? me.id)} (${String(me.id)}, ${String(me.product ?? 'unknown')} plan)`)
    console.log(`Playlist owner: ${String(owner.display_name ?? owner.id)} (${String(owner.id)})`)
    if (owner.id !== me.id && details.collaborative !== true) {
      console.warn('⚠ You are not this playlist\'s owner, so Spotify may refuse to share its tracks.')
    }
    console.log(`Syncing “${name}”…`)

    const items = await fetchAllItems(playlistId, accessToken)
    const tracks = normalizePlaylistItems(items)
    if (tracks.length === 0) fail('The playlist has no playable tracks.')

    const playlist: SavedPlaylist = {
      id: playlistId,
      name,
      syncedAt: new Date().toISOString(),
      tracks,
    }
    await writeFile(OUTPUT_FILE, `${JSON.stringify(playlist, null, 2)}\n`)

    const skipped = items.length - tracks.length
    console.log(
      `✔ Saved ${tracks.length} tracks to src/data/playlist.json` +
        (skipped > 0 ? ` (skipped ${skipped} unplayable or duplicate items)` : ''),
    )
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

await main()
