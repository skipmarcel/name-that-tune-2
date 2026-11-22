import { buildPlaylistOptions, isTypeable, normalizePlaylistItems, parsePlaylistId } from './playlist'

const ID = '4j9MhzbUmYadbnn4qBJiSC'

describe('parsePlaylistId', () => {
  it.each([
    [`https://open.spotify.com/playlist/${ID}?si=edab7099a87e4fe0`],
    [`https://open.spotify.com/intl-de/playlist/${ID}`],
    [`spotify:playlist:${ID}`],
    [`  ${ID}  `],
  ])('extracts the ID from %s', (input) => {
    expect(parsePlaylistId(input)).toBe(ID)
  })

  it.each([[''], ['not a playlist'], ['https://open.spotify.com/album/4j9MhzbUmYadbnn4qBJiSC']])(
    'rejects %j',
    (input) => {
      expect(parsePlaylistId(input)).toBeNull()
    },
  )
})

function spotifyTrack(overrides: Record<string, unknown> = {}) {
  return {
    type: 'track',
    id: 'track1',
    name: 'Harder, Better, Faster, Stronger',
    artists: [{ name: 'Daft Punk' }],
    album: {
      name: 'Discovery',
      images: [
        { url: 'small.jpg', width: 64, height: 64 },
        { url: 'large.jpg', width: 640, height: 640 },
      ],
    },
    duration_ms: 224_693,
    is_local: false,
    ...overrides,
  }
}

describe('normalizePlaylistItems', () => {
  it('maps a Spotify track to the saved shape', () => {
    expect(normalizePlaylistItems([{ item: spotifyTrack() }])).toEqual([
      {
        id: 'track1',
        name: 'Harder, Better, Faster, Stronger',
        artists: ['Daft Punk'],
        album: 'Discovery',
        imageUrl: 'large.jpg',
        durationMs: 224_693,
      },
    ])
  })

  it('accepts the older `track` field', () => {
    expect(normalizePlaylistItems([{ track: spotifyTrack() }])).toHaveLength(1)
  })

  it('keeps every artist in order', () => {
    const [track] = normalizePlaylistItems([
      { item: spotifyTrack({ artists: [{ name: 'Calvin Harris' }, { name: 'Dua Lipa' }] }) },
    ])
    expect(track.artists).toEqual(['Calvin Harris', 'Dua Lipa'])
  })

  it('drops items that cannot be played', () => {
    const items = [
      { item: null }, // track removed from Spotify
      { item: spotifyTrack({ id: 'local', is_local: true }) },
      { item: spotifyTrack({ id: 'ep', type: 'episode' }) },
      { item: spotifyTrack({ id: 'blocked', is_playable: false }) },
      { item: spotifyTrack({ id: 'no-artist', artists: [] }) },
      { item: spotifyTrack({ id: null }) },
      'garbage',
      { item: spotifyTrack({ id: 'ok' }) },
    ]
    expect(normalizePlaylistItems(items).map((t) => t.id)).toEqual(['ok'])
  })

  it('removes duplicate tracks, keeping the first', () => {
    const items = [
      { item: spotifyTrack({ id: 'a' }) },
      { item: spotifyTrack({ id: 'b' }) },
      { item: spotifyTrack({ id: 'a', name: 'Duplicate' }) },
    ]
    expect(normalizePlaylistItems(items).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('copes with a missing album or cover art', () => {
    const [track] = normalizePlaylistItems([{ item: spotifyTrack({ album: undefined }) }])
    expect(track).toMatchObject({ album: '', imageUrl: null })
  })
})

describe('buildPlaylistOptions', () => {
  const saved = (id: string, name: string, trackCount: number) => ({
    id,
    name,
    syncedAt: '2026-11-21T00:00:00.000Z',
    tracks: normalizePlaylistItems(
      Array.from({ length: trackCount }, (_, i) => ({ item: spotifyTrack({ id: `${id}-${i}` }) })),
    ),
  })

  it('keeps the config order and uses config titles over Spotify names', () => {
    const options = buildPlaylistOptions(
      [{ id: 'b', title: 'Obscure Folk and Rock' }, { id: 'a' }],
      [saved('a', 'For Coding', 2), saved('b', 'Faves', 3)],
    )
    expect(options.map((o) => [o.id, o.title, o.tracks.length])).toEqual([
      ['b', 'Obscure Folk and Rock', 3],
      ['a', 'For Coding', 2],
    ])
  })

  it('includes playlists that have not been synced, with no tracks', () => {
    expect(buildPlaylistOptions([{ id: 'new', title: 'New' }], [])).toEqual([
      { id: 'new', title: 'New', tracks: [] },
    ])
    expect(buildPlaylistOptions([{ id: 'new' }], [])[0].title).toBe('Untitled playlist')
  })

  it('ignores synced files that are no longer in the config', () => {
    expect(buildPlaylistOptions([], [saved('a', 'Old', 1)])).toEqual([])
  })
})

describe('isTypeable', () => {
  it('accepts titles and artists with English letters or digits, accents included', () => {
    expect(isTypeable({ name: "L'été indien", artists: ['Joe Dassin'] })).toBe(true)
    expect(isTypeable({ name: '1979', artists: ['The Smashing Pumpkins'] })).toBe(true)
  })

  it('rejects a track if the title or any artist has none', () => {
    expect(isTypeable({ name: "You Don't Remember", artists: ['イングヴェイ・マルムスティーン'] })).toBe(false)
    expect(isTypeable({ name: 'Mars', artists: ['Nick Cave', 'ウォーレン'] })).toBe(false)
    expect(isTypeable({ name: '夜に駆ける', artists: ['YOASOBI'] })).toBe(false)
  })
})
