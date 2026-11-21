import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { createTokenHandler } from './token-handler.js'

/**
 * Serves the same `/api/*` routes the Vercel functions provide, so
 * `npm run dev` works end to end without the Vercel CLI.
 */
export function apiDevServer(env: Record<string, string | undefined>): Plugin {
  const handleTokenRequest = createTokenHandler({ getEnv: () => env })

  return {
    name: 'song-sleuth:api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/token', (req: IncomingMessage, res: ServerResponse, next) => {
        const request = new Request(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'), {
          method: req.method,
        })
        handleTokenRequest(request)
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
          .catch(next)
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
