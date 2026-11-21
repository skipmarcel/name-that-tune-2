// @vitest-environment node
import { cleanName } from './name.js'

describe('cleanName', () => {
  it.each([
    ['  Tyler   Adams ', 'Tyler Adams'],
    ['Zoë', 'Zoë'],
    ['ｆｕｌｌｗｉｄｔｈ', 'fullwidth'],
    ['a‮b​c', 'abc'], // bidi override and zero-width space removed
    ['line\nbreak', 'line break'],
    ['x'.repeat(40), 'x'.repeat(20)],
    ['DJ 👾', 'DJ 👾'],
  ])('%j → %j', (raw, clean) => {
    expect(cleanName(raw)).toBe(clean)
  })

  it.each([[''], ['   '], ['!!!'], [42], [null], ['​​']])('rejects %j', (raw) => {
    expect(cleanName(raw)).toBeNull()
  })
})
