/** Formats milliseconds as m:ss, e.g. 29713 → "0:29". */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Whether a clip has played to the end (the embed reports position ≈ duration). */
export function hasEnded(position: number, duration: number, isPlaying: boolean): boolean {
  return !isPlaying && duration > 0 && position >= duration - 750
}
