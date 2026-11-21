// @vitest-environment node
import { createTicket, decodeTicket, encodeTicket } from './ticket.js'

const SECRET = 'test-secret'

describe('game tickets', () => {
  const ticket = createTicket('playlist', ['a', 'b', 'c'], 1_000)

  it('round-trips a signed ticket', () => {
    expect(decodeTicket(encodeTicket(ticket, SECRET), SECRET)).toEqual(ticket)
  })

  it('gives every ticket a unique ID', () => {
    expect(createTicket('p', [], 0).id).not.toBe(createTicket('p', [], 0).id)
  })

  it('rejects a ticket signed with another secret', () => {
    expect(decodeTicket(encodeTicket(ticket, 'other'), SECRET)).toBeNull()
  })

  it('rejects a ticket whose tracks were changed', () => {
    const [, signature] = encodeTicket(ticket, SECRET).split('.')
    const forged = Buffer.from(JSON.stringify({ ...ticket, trackIds: ['x', 'y', 'z'] })).toString('base64url')
    expect(decodeTicket(`${forged}.${signature}`, SECRET)).toBeNull()
  })

  it.each([[''], ['abc'], ['a.b.c'], ['....'], ['bm90IGpzb24.c2ln']])('rejects malformed token %j', (token) => {
    expect(decodeTicket(token, SECRET)).toBeNull()
  })
})
