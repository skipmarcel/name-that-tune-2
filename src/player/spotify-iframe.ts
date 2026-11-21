/**
 * Typed loader for Spotify's iFrame API.
 * https://developer.spotify.com/documentation/embeds/references/iframe-api
 */

export const IFRAME_API_URL = 'https://open.spotify.com/embed/iframe-api/v1'

/** Payload of the `playback_update` event. Times are in milliseconds. */
export interface PlaybackUpdate {
  playingURI: string
  isPaused: boolean
  isBuffering: boolean
  duration: number
  position: number
}

export interface EmbedController {
  loadEntity(spotifyUriOrUrl: string, preferVideo?: boolean, startAt?: number): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  restart(): void
  destroy(): void
  addListener(event: 'ready', handler: () => void): void
  addListener(event: 'playback_started', handler: (e: { data: { playingURI: string } }) => void): void
  addListener(event: 'playback_update', handler: (e: { data: PlaybackUpdate }) => void): void
}

export interface EmbedOptions {
  uri?: string
  url?: string
  width?: number | string
  height?: number | string
}

export interface SpotifyIFrameAPI {
  /** Replaces `element` with the embed iframe and passes back its controller. */
  createController(
    element: HTMLElement,
    options: EmbedOptions,
    callback: (controller: EmbedController) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
  }
}

let apiPromise: Promise<SpotifyIFrameAPI> | undefined

/**
 * Loads the iFrame API script once and resolves with the API object. If the
 * script fails to load, the next call tries again.
 */
export function loadSpotifyIframeApi(): Promise<SpotifyIFrameAPI> {
  apiPromise ??= new Promise<SpotifyIFrameAPI>((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady
    window.onSpotifyIframeApiReady = (api) => {
      previous?.(api)
      resolve(api)
    }

    const script = document.createElement('script')
    script.src = IFRAME_API_URL
    script.async = true
    script.onerror = () => {
      script.remove()
      apiPromise = undefined
      reject(new Error('Could not load the Spotify player'))
    }
    document.body.appendChild(script)
  })
  return apiPromise
}

export function trackUri(trackId: string): string {
  return `spotify:track:${trackId}`
}
