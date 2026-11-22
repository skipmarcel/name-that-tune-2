import {
  acceptedAnswers,
  displayTitle,
  isCorrectArtist,
  isCorrectGuess,
  editDistance,
  normalize,
  similarity,
  songKey,
} from './match'

describe('normalize', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normalize('  Retour au Champ-de-Mars! ')).toBe('retour au champ de mars')
    expect(normalize('Café Déjà Vu')).toBe('cafe deja vu')
  })

  it('keeps contractions together and spells out "&"', () => {
    expect(normalize("Don't Call Me Hero")).toBe('dont call me hero')
    expect(normalize('Mind & Body')).toBe('mind and body')
  })
})

describe('editDistance / similarity', () => {
  it('counts single-character edits', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('same', 'same')).toBe(0)
  })

  it('counts swapped neighboring letters as one edit', () => {
    expect(editDistance('brain', 'brian')).toBe(1)
    expect(editDistance('hte', 'the')).toBe(1)
  })

  it('scales similarity to the longer string', () => {
    expect(similarity('abcd', 'abcd')).toBe(1)
    expect(similarity('abcd', 'abce')).toBe(0.75)
    expect(similarity('', '')).toBe(1)
  })
})

describe('displayTitle', () => {
  it.each([
    ['The Big Ship - 2004 Remaster', 'The Big Ship'],
    ['An Ending (Ascent) - Remastered 2005', 'An Ending (Ascent)'],
    ['Levitating (feat. DaBaby)', 'Levitating'],
    ['Pistolero (Prologue)', 'Pistolero (Prologue)'],
    ['MAR-X', 'MAR-X'],
    ['Song 2 - Blur Cover', 'Song 2 - Blur Cover'],
  ])('%s → %s', (title, expected) => {
    expect(displayTitle(title)).toBe(expected)
  })
})

describe('acceptedAnswers', () => {
  it('offers the full title, the base title and the title without brackets', () => {
    expect(acceptedAnswers('An Ending (Ascent) - Remastered 2005')).toEqual([
      'an ending ascent remastered 2005',
      'an ending ascent',
      'an ending',
    ])
  })
})

describe('songKey', () => {
  it('treats different versions of a song as the same song', () => {
    expect(songKey('Angie - 2015 Remaster')).toBe(songKey('Angie'))
    expect(songKey('A Real Hero (feat. Electric Youth)')).toBe(songKey('A Real Hero'))
    expect(songKey('In My Room - Remastered')).toBe('in my room')
  })

  it('keeps different songs apart', () => {
    expect(songKey('Into The Breach I')).not.toBe(songKey('Into The Breach II'))
  })
})

describe('isCorrectGuess', () => {
  it.each([
    ['the big ship', 'The Big Ship - 2004 Remaster'],
    ['The Big Ship - 2004 Remaster', 'The Big Ship - 2004 Remaster'],
    ['pistolero', 'Pistolero (Prologue)'],
    ['pistolero prologue', 'Pistolero (Prologue)'],
    ['love theme', '[BONUS TRACK] Love Theme'],
    ['dont call me hero', "Don't Call Me Hero"],
    ['Dont Cal Me Hero', "Don't Call Me Hero"], // one typo
    ['retour au champ de mars', 'Retour au Champ-de-Mars'],
    ['mar x', 'MAR-X'],
    ['levitating', 'Levitating (feat. DaBaby)'],
    ['mind and body', 'Mind & Body'],
    ['into the breach 1', 'Into The Breach 1'],
    ["l'ete indien", "L'été indien - Septemberwind"], // subtitle after a dash is optional
    ["L'été indien - Septemberwind", "L'été indien - Septemberwind"],
    ['song 2', 'Song 2 - Blur Cover'],
    ['glassworks i opening', 'Glassworks: I. Opening'],
  ])('accepts %j for %j', (guess, title) => {
    expect(isCorrectGuess(guess, title)).toBe(true)
  })

  it.each([
    ['', 'Mars'],
    ['   ', 'Mars'],
    ['mats', 'Mars'], // short titles must be exact
    ['the ship', 'The Big Ship - 2004 Remaster'],
    ['glassworks', 'Glassworks: I. Opening'],
    ['completely wrong', "Don't Call Me Hero"],
    ['into the breach ii', 'Into The Breach I'], // numbers must match
    ['in the upper room dance i', 'In the Upper Room: Dance II'],
    ['connection with root chakra 9 hz', 'Connection with Root Chakra: 8 Hz'],
    ['binaural beats study aid', 'Binaural Beats Study Music'], // too many edits
    ['Dnot Cal Me Heor', "Don't Call Me Hero"], // three typos
  ])('rejects %j for %j', (guess, title) => {
    expect(isCorrectGuess(guess, title)).toBe(false)
  })
})

describe('isCorrectArtist', () => {
  const glass = ['Philip Glass', 'Michael Riesman', 'Philip Glass Ensemble']

  it.each([
    ['the jesus and mary chain', ['The Jesus and Mary Chain']],
    ['jesus and mary chain', ['The Jesus and Mary Chain']], // "The" is optional
    ['Jesus & Mary Chain', ['The Jesus and Mary Chain']],
    ['the beatles', ['Beatles']],
    ['philip glass', glass], // any one credited artist
    ['michael riesman', glass],
    ['calvin harris and dua lipa', ['Calvin Harris', 'Dua Lipa']], // all of them
    ['brian eno', ['Brian Eno']],
    ['brain eno', ['Brian Eno']], // a typo
    ['sibylle baier', ['Sibylle Baier']],
    ['joe dassin', ['Joe Dassin']],
    ['ABBA', ['ABBA']],
    ['blink 182', ['blink-182']],
  ])('accepts %j for %j', (guess, artists) => {
    expect(isCorrectArtist(guess, artists)).toBe(true)
  })

  it.each([
    ['', ['Brian Eno']],
    ['the', ['The Jesus and Mary Chain']],
    ['abbo', ['ABBA']], // short names must be exact
    ['philip', glass],
    ['blink 183', ['blink-182']],
    ['nick cave', ['Warren Ellis']],
  ])('rejects %j for %j', (guess, artists) => {
    expect(isCorrectArtist(guess, artists)).toBe(false)
  })
})
