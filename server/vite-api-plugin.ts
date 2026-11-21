import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { createLeaderboardHandler } from './leaderboard/runtime.js'

/**
 * Serves the same /api/* routes as the Vercel functions during `npm run dev`,
 * so the leaderboard works locally without the Vercel CLI. Without Redis
 * credentials in .env, scores are kept in memory until the server restarts.
 */
export function apiDevServer(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'song-sleuth:api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Created lazily so `vite build` never reads env or playlist files.
      let handle: ((request: Request) => Promise<Response>) | undefined

      server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next) => {
        handle ??= createLeaderboardHandler(env)
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const request = new Request(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'), {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            body: hasBody ? Buffer.concat(chunks) : undefined,
          })
          handle!(request)
            .then(async (response) => {
              res.statusCode = response.status
              response.headers.forEach((value, key) => res.setHeader(key, value))
              res.end(await response.text())
            })
            .catch(next)
        })
      })
    },
  }
}

declare module 'node:http' {
  interface IncomingMessage {
    /** Set by Connect: the URL before the mount path is stripped. */
    originalUrl?: string
  }
}
