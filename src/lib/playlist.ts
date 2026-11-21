/**
 * Playlist data shared by the game and the `sync-playlist` script.
 *
 * Spotify only returns a playlist's tracks to its signed-in owner, so the
 * track lists are fetched ahead of time by `npm run sync-playlist` and saved to
 * `src/data/playlists/<id>.json`. This module defines that file's shape, turns
 * raw Spotify API items into it and joins it with the playlist config. It has no browser or Node dependencies.
 */

export interface Track {
  /** Spotify track ID, used to play the song in the embedded player. */
  id: string
  name: string
  artists: string[]
  album: string
  /** Largest available album cover, or null when Spotify has none. */
  imageUrl: string | null
  durationMs: number
}

export interface SavedPlaylist {
  id: string
  name: string
  /** ISO timestamp of the last sync, or null if the playlist was never synced. */
  syncedAt: string | null
  tracks: Track[]
}

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{22}$/

/**
 * Extracts a playlist ID from a share link, a `spotify:playlist:` URI or a
 * bare ID. Returns null if the input isn't any of those.
 */
export function parsePlaylistId(input: string): string | null {
  const value = input.trim()
  const match =
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?playlist\/([A-Za-z0-9]+)/i.exec(value) ??
    /^spotify:playlist:([A-Za-z0-9]+)$/.exec(value)
  const id = match ? match[1] : value
  return PLAYLIST_ID_PATTERN.test(id) ? id : null
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null
}

function largestImageUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  let best: { url: string; area: number } | null = null
  for (const image of images) {
    if (!isObject(image) || typeof image.url !== 'string') continue
    const area = (Number(image.width) || 0) * (Number(image.height) || 0)
    if (!best || area > best.area) best = { url: image.url, area }
  }
  return best?.url ?? null
}

/** Converts one Spotify track object, or returns null if it can't be played. */
function toTrack(raw: unknown): Track | null {
  if (!isObject(raw)) return null
  if (raw.type !== undefined && raw.type !== 'track') return null // podcast episodes
  if (raw.is_local === true || raw.is_playable === false) return null
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || raw.name === '') return null

  const artists = Array.isArray(raw.artists)
    ? raw.artists.flatMap((a) => (isObject(a) && typeof a.name === 'string' ? [a.name] : []))
    : []
  if (artists.length === 0) return null

  const album = isObject(raw.album) ? raw.album : {}
  return {
    id: raw.id,
    name: raw.name,
    artists,
    album: typeof album.name === 'string' ? album.name : '',
    imageUrl: largestImageUrl(album.images),
    durationMs: typeof raw.duration_ms === 'number' ? raw.duration_ms : 0,
  }
}

/**
 * Turns the `items` arrays from Spotify's playlist items endpoint into
 * playable tracks. Local files, podcast episodes, removed tracks and
 * duplicates are dropped. Accepts both the current `item` field and the
 * older `track` field Spotify used for the same data.
 */
export function normalizePlaylistItems(items: readonly unknown[]): Track[] {
  const seen = new Set<string>()
  const tracks: Track[] = []
  for (const entry of items) {
    if (!isObject(entry)) continue
    const track = toTrack(entry.item ?? entry.track)
    if (track && !seen.has(track.id)) {
      seen.add(track.id)
      tracks.push(track)
    }
  }
  return tracks
}

/** One entry in src/data/playlists.config.json. */
export interface PlaylistConfigEntry {
  /** Spotify playlist ID. */
  id: string
  /** Name shown to players; defaults to the playlist's Spotify name. */
  title?: string
}

/** A playlist players can choose, in the order listed in the config. */
export interface PlaylistOption {
  id: string
  title: string
  tracks: Track[]
}

/**
 * Combines the config with the synced playlist files. Playlists that haven't
 * been synced yet (no file, or no tracks) are included with no tracks, so the
 * UI can show them as unavailable instead of silently dropping them.
 */
export function buildPlaylistOptions(
  config: readonly PlaylistConfigEntry[],
  saved: readonly SavedPlaylist[],
): PlaylistOption[] {
  const savedById = new Map(saved.map((playlist) => [playlist.id, playlist]))
  return config.map(({ id, title }) => {
    const playlist = savedById.get(id)
    return {
      id,
      title: title?.trim() || playlist?.name || 'Untitled playlist',
      tracks: playlist?.tracks ?? [],
    }
  })
}
