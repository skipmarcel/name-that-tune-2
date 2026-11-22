import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Round } from '../game/game'
import { displayTitle } from '../game/match'
import { ARTIST_POINTS, TITLE_POINTS } from '../game/scoring'
import { PlayerControls, type PlayerState } from './PlayerControls'

interface RoundViewProps {
  round: Round
  player: PlayerState
  onGuess: (guess: { artist?: string; title?: string }) => void
  onReveal: () => void
}

/** Focus a guess box on devices with a keyboard; on phones it would cover the screen. */
const prefersAutoFocus =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true

function shake(element: HTMLElement | null) {
  if (!element || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  element.animate?.(
    [0, -6, 6, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 350 },
  )
}

interface GuessFieldProps {
  id: string
  label: string
  points: number
  /** The real answer, shown once this part is named. */
  solvedAs: string | null
  wrongGuess: string | null
  value: string
  onChange: (value: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  autoFocus: boolean
}

function GuessField({ id, label, points, solvedAs, wrongGuess, value, onChange, inputRef, autoFocus }: GuessFieldProps) {
  const feedbackId = `${id}-feedback`
  return (
    <div className={`guess-field${solvedAs ? ' is-solved' : ''}`}>
      <div className="guess-field-head">
        <label htmlFor={id}>{label}</label>
        <span className="guess-field-points">
          {solvedAs ? `+${points}` : `${points} ${points === 1 ? 'pt' : 'pts'}`}
        </span>
      </div>
      {solvedAs ? (
        <p className="guess-solved" id={id} role="status">
          <span aria-hidden="true">✓</span>
          <span className="visually-hidden">Correct: </span>
          {solvedAs}
        </p>
      ) : (
        <>
          <input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={`Type the ${label.toLowerCase()}`}
            aria-describedby={wrongGuess ? feedbackId : undefined}
            autoFocus={autoFocus}
          />
          <p className="guess-feedback" id={feedbackId} aria-live="polite">
            {wrongGuess && (
              <>
                Not quite: <q>{wrongGuess}</q>
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

export function RoundView({ round, player, onGuess, onReveal }: RoundViewProps) {
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const id = useId()
  const artistRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  /** Which fields the last Guess press checked, so only those shake. */
  const lastSubmitted = useRef({ artist: false, title: false })

  const artistSolved = round.artistGuess !== null
  const titleSolved = round.titleGuess !== null

  // After each guess: shake the boxes that were wrong, and move focus to the
  // box that still needs an answer.
  useEffect(() => {
    const submitted = lastSubmitted.current
    lastSubmitted.current = { artist: false, title: false }
    if (!submitted.artist && !submitted.title) return
    const artistWrong = submitted.artist && !artistSolved
    const titleWrong = submitted.title && !titleSolved
    if (artistWrong) shake(artistRef.current)
    if (titleWrong) shake(titleRef.current)
    const target = artistWrong
      ? artistRef.current
      : titleWrong
        ? titleRef.current
        : !artistSolved
          ? artistRef.current
          : titleRef.current
    target?.focus()
  }, [round, artistSolved, titleSolved])

  function submit(event: FormEvent) {
    event.preventDefault()
    const guess = {
      artist: artistSolved ? undefined : artist.trim() || undefined,
      title: titleSolved ? undefined : title.trim() || undefined,
    }
    if (!guess.artist && !guess.title) return
    lastSubmitted.current = { artist: Boolean(guess.artist), title: Boolean(guess.title) }
    onGuess(guess)
  }

  const nothingTyped = (artistSolved || !artist.trim()) && (titleSolved || !title.trim())

  return (
    <section className="card round" aria-labelledby={`${id}-heading`}>
      <div className="round-top">
        <h2 id={`${id}-heading`} className="round-heading">
          What&rsquo;s this song?
        </h2>
        {round.points > 0 && <span className="worth">+{round.points} so far</span>}
      </div>

      <PlayerControls player={player} />

      <form className="guess-form" onSubmit={submit}>
        <GuessField
          id={`${id}-artist`}
          label="Artist"
          points={ARTIST_POINTS}
          solvedAs={artistSolved ? round.track.artists.join(', ') : null}
          wrongGuess={round.wrongArtist}
          value={artist}
          onChange={setArtist}
          inputRef={artistRef}
          autoFocus={prefersAutoFocus}
        />
        <GuessField
          id={`${id}-title`}
          label="Song title"
          points={TITLE_POINTS}
          solvedAs={titleSolved ? displayTitle(round.track.name) : null}
          wrongGuess={round.wrongTitle}
          value={title}
          onChange={setTitle}
          inputRef={titleRef}
          autoFocus={false}
        />
        <div className="round-actions">
          <button type="button" className="button-ghost" onClick={onReveal}>
            Reveal answer
          </button>
          <button type="submit" className="button-primary" disabled={nothingTyped}>
            Guess
          </button>
        </div>
      </form>
    </section>
  )
}
