import { useState } from 'react'

type Status = 'idle' | 'copied' | 'error'

/**
 * Shares `text` with the device's share sheet where there is one (phones,
 * and some desktop browsers), otherwise copies it to the clipboard.
 */
export function ShareButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>('idle')

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        return
      } catch (error) {
        // The player closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === 'AbortError') return
        // Otherwise fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="share">
      <button type="button" className="button-secondary button-wide" onClick={share}>
        Share your score
      </button>
      <p className="share-status" role="status">
        {status === 'copied' && 'Copied! Paste it anywhere to challenge your friends.'}
        {status === 'error' && 'Couldn’t copy automatically. Take a screenshot instead!'}
      </p>
    </div>
  )
}
