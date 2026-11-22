import type { Round } from './game.js'
import { MAX_POINTS } from './scoring.js'

/** One square per song: both named, part named, or nothing. */
export function roundEmoji(round: Pick<Round, 'points'>): string {
  if (round.points >= MAX_POINTS) return '🟩'
  if (round.points > 0) return '🟧'
  return '🟥'
}

/**
 * The text players share after a game. Shows the score and how each song
 * went, without giving away any answers.
 *
 *   🎵 TuneIn · 80s Hits: 24/30
 *   🟩🟩🟧🟩🟥🟩🟩🟧🟩🟩
 *   Can you beat me? https://…
 */
export function shareText({
  rounds,
  score,
  maxScore,
  playlistTitle,
  url,
}: {
  rounds: Pick<Round, 'points'>[]
  score: number
  maxScore: number
  playlistTitle: string
  url: string
}): string {
  return [
    `🎵 TuneIn · ${playlistTitle}: ${score}/${maxScore}`,
    rounds.map(roundEmoji).join(''),
    `Can you beat me? ${url}`,
  ].join('\n')
}
