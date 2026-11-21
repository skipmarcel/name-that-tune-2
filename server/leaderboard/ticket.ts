/**
 * Game tickets: the server picks a game's tracks and signs the list, so a
 * score can later be checked against tracks the client didn't choose.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
 * The payload is readable by the client (it only holds track IDs, which the
 * client needs to play the songs anyway) but can't be altered.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export interface GameTicket {
  v: 1
  /** Unique ID; a ticket can be redeemed for a score only once. */
  id: string
  playlistId: string
  trackIds: string[]
  /** Milliseconds since the epoch. */
  issuedAt: number
}

function sign(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

export function createTicket(playlistId: string, trackIds: string[], issuedAt: number): GameTicket {
  return { v: 1, id: randomUUID(), playlistId, trackIds, issuedAt }
}

export function encodeTicket(ticket: GameTicket, secret: string): string {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url')
  return `${payload}.${sign(payload, secret).toString('base64url')}`
}

function isTicket(value: unknown): value is GameTicket {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    t.v === 1 &&
    typeof t.id === 'string' &&
    typeof t.playlistId === 'string' &&
    typeof t.issuedAt === 'number' &&
    Array.isArray(t.trackIds) &&
    t.trackIds.every((id) => typeof id === 'string')
  )
}

/** Returns the ticket if the signature is valid, otherwise null. */
export function decodeTicket(token: string, secret: string): GameTicket | null {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null

  const expected = sign(payload, secret)
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    const ticket: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return isTicket(ticket) ? ticket : null
  } catch {
    return null
  }
}
