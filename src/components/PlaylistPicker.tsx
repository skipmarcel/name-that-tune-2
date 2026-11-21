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

export function PlaylistPicker({ playlists, selectedId, onSelect }: PlaylistPickerProps) {
  const groupName = useId()

  return (
    <fieldset className="playlist-picker">
      <legend>Choose a playlist</legend>
      {playlists.map((playlist) => {
        const synced = playlist.tracks.length > 0
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
            <span className="playlist-title">{playlist.title}</span>
            <span className="playlist-count">
              {synced ? songCount(playlist.tracks.length) : 'not synced yet'}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
