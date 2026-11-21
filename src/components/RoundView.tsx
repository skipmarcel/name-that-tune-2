import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Round } from '../game/game'
import { HINTS, pointsFor, titleLettersHint, type Hint } from '../game/scoring'
import { PlayerControls, type PlayerState } from './PlayerControls'

interface RoundViewProps {
  round: Round
  player: PlayerState
  onGuess: (text: string) => void
  onHint: () => void
  onGiveUp: () => void
}

const HINT_LABELS: Record<Hint, string> = {
  albumArt: 'Album art',
  artist: 'Artist',
  titleLetters: 'Title',
}

/** Focus the guess box on devices with a keyboard; on phones it would cover the screen. */
const prefersAutoFocus =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true

function HintSlot({ hint, round }: { hint: Hint; round: Round }) {
  const unlocked = HINTS.indexOf(hint) < round.hintsUsed
  const { track } = round

  let content: React.ReactNode = <span className="hint-locked" aria-hidden="true">?</span>
  if (unlocked && hint === 'albumArt') {
    content = track.imageUrl ? <img src={track.imageUrl} alt="Album cover" /> : <span>No art</span>
  } else if (unlocked && hint === 'artist') {
    content = <span className="hint-text">{track.artists.join(', ')}</span>
  } else if (unlocked && hint === 'titleLetters') {
    content = <span className="hint-text title-letters">{titleLettersHint(track.name)}</span>
  }

  return (
    <li className={`hint-slot hint-slot-${hint}${unlocked ? ' is-unlocked' : ''}`}>
      <span className="hint-label">
        {HINT_LABELS[hint]}
        {!unlocked && <span className="visually-hidden"> (locked)</span>}
      </span>
      <div className="hint-content">{content}</div>
    </li>
  )
}

export function RoundView({ round, player, onGuess, onHint, onGiveUp }: RoundViewProps) {
  const [guess, setGuess] = useState('')
  const inputId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const { hintsUsed, wrongGuesses } = round
  const hintsLeft = HINTS.length - hintsUsed
  const worth = pointsFor(hintsUsed)

  // Shake the guess box on each wrong guess, without remounting it (that
  // would drop focus from the input).
  useEffect(() => {
    if (wrongGuesses.length === 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    rowRef.current?.animate?.(
      [0, -6, 6, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 350 },
    )
  }, [wrongGuesses.length])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!guess.trim()) return
    onGuess(guess)
    setGuess('')
  }

  return (
    <section className="card round" aria-labelledby={`${inputId}-heading`}>
      <div className="round-top">
        <h2 id={`${inputId}-heading`} className="round-heading">
          What&rsquo;s this song?
        </h2>
        <span className={`worth worth-${worth}`}>
          Worth {worth} {worth === 1 ? 'point' : 'points'}
        </span>
      </div>

      <PlayerControls player={player} />

      <ul className="hint-slots" aria-label="Hints">
        {HINTS.map((hint) => (
          <HintSlot key={hint} hint={hint} round={round} />
        ))}
      </ul>

      <form className="guess-form" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          Song title
        </label>
        <div className="guess-row" ref={rowRef}>
          <input
            id={inputId}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Type the song title"
            autoFocus={prefersAutoFocus}
          />
          <button type="submit" className="button-primary">
            Guess
          </button>
        </div>
      </form>

      <p className="feedback" aria-live="polite">
        {wrongGuesses.length > 0 && (
          <>
            Not quite: <q>{wrongGuesses.at(-1)}</q>. Try again.
          </>
        )}
      </p>

      <div className="round-actions">
        <button type="button" className="button-secondary" onClick={onHint} disabled={hintsLeft === 0}>
          {hintsLeft === 0 ? 'No hints left' : `Hint: ${HINT_LABELS[HINTS[hintsUsed]].toLowerCase()} (−1)`}
        </button>
        <button type="button" className="button-ghost" onClick={onGiveUp}>
          Give up
        </button>
      </div>
    </section>
  )
}
