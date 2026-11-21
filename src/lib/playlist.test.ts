import { normalizePlaylistItems, parsePlaylistId } from './playlist'

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
