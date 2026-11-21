import { useId } from 'react'
import type { PlaylistOption } from '../lib/playlist'

interface PlaylistPickerProps {
  playlists: PlaylistOption[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}

function songCount(count: number) {
  return `${count} ${count === 1 ? 'song' : 'songs'}`
}

/** Up to four album covers from the playlist, for a collage thumbnail. */
function coverCollage(playlist: PlaylistOption): string[] {
  const covers = new Set<string>()
  for (const track of playlist.tracks) {
    if (track.imageUrl) covers.add(track.imageUrl)
    if (covers.size === 4) break
  }
  return [...covers]
}

export function PlaylistPicker({ playlists, selectedId, onSelect }: PlaylistPickerProps) {
  const groupName = useId()

  return (
    <fieldset className="playlist-picker">
      <legend>Choose a playlist</legend>
      <div className="playlist-options">
        {playlists.map((playlist) => {
          const synced = playlist.tracks.length > 0
          const covers = coverCollage(playlist)
          return (
            <label key={playlist.id} className="playlist-option">
              <input
                type="radio"
                name={groupName}
                value={playlist.id}
                checked={selectedId === playlist.id}
                disabled={!synced}
                onChange={() => onSelect(playlist.id)}
              />
              <span className={`playlist-art playlist-art-${Math.min(covers.length, 4)}`} aria-hidden="true">
                {covers.map((url) => (
                  <img key={url} src={url} alt="" loading="lazy" />
                ))}
              </span>
              <span className="playlist-text">
                <span className="playlist-title">{playlist.title}</span>
                <span className="playlist-count">
                  {synced ? songCount(playlist.tracks.length) : 'Not synced yet'}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
