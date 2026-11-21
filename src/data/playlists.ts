/**
 * The playlists players can choose from: the entries in playlists.config.json
 * joined with the track lists `npm run sync-playlist` saved in ./playlists/.
 */
import { buildPlaylistOptions, type PlaylistConfigEntry, type SavedPlaylist } from '../lib/playlist'
import config from './playlists.config.json'

const savedFiles = import.meta.glob<SavedPlaylist>('./playlists/*.json', {
  eager: true,
  import: 'default',
})

export const playlistOptions = buildPlaylistOptions(
  config satisfies PlaylistConfigEntry[],
  Object.values(savedFiles),
)
