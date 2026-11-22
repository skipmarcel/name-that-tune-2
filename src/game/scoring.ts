/** Naming the artist is worth the most; the song title adds a point on top. */
export const ARTIST_POINTS = 2
export const TITLE_POINTS = 1
export const MAX_POINTS = ARTIST_POINTS + TITLE_POINTS

/** Points for a round, given which parts the player named. */
export function roundPoints({ artist, title }: { artist: boolean; title: boolean }): number {
  return (artist ? ARTIST_POINTS : 0) + (title ? TITLE_POINTS : 0)
}
