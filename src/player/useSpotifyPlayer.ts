import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadSpotifyIframeApi,
  trackUri,
  type EmbedController,
  type SpotifyIFrameAPI,
} from './spotify-iframe'

export type PlayerStatus = 'loading' | 'ready' | 'error'

export interface SpotifyPlayer {
  /** Pass as `ref` to an element that stays mounted; the embed is created inside it. */
  attachEmbed: (element: HTMLDivElement | null) => void
  status: PlayerStatus
  isPlaying: boolean
  isBuffering: boolean
  /** Playback position and length of the current track, in milliseconds. */
  position: number
  duration: number
  /**
   * Loads a track and starts it. Call this from a click handler: browsers
   * (Safari in particular) only allow audio to start from a user gesture.
   */
  playTrack: (trackId: string) => void
  play: () => void
  pause: () => void
  /** Starts the current track again from the beginning. */
  replay: () => void
}

export interface SpotifyPlayerOptions {
  /** Injectable for tests. */
  loadApi?: () => Promise<SpotifyIFrameAPI>
}

const EMBED_SIZE = { width: 300, height: 80 }

/**
 * Drives a Spotify embed through the iFrame API. The embed itself shows the
 * track title, so the caller should keep that element off-screen until the
 * answer is revealed.
 */
export function useSpotifyPlayer({ loadApi = loadSpotifyIframeApi }: SpotifyPlayerOptions = {}): SpotifyPlayer {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<SpotifyIFrameAPI | null>(null)
  const controllerRef = useRef<EmbedController | null>(null)
  const creatingRef = useRef(false)
  /** Track requested before the embed existed, loaded once it's created. */
  const pendingTrackRef = useRef<string | null>(null)
  /** Whether playback should start as soon as the embed can play. */
  const wantPlayingRef = useRef(false)
  const unmountedRef = useRef(false)

  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [playback, setPlayback] = useState({ isPlaying: false, isBuffering: false, position: 0, duration: 0 })

  const createController = useCallback((api: SpotifyIFrameAPI, trackId: string) => {
    const container = containerRef.current
    if (!container || creatingRef.current) return
    creatingRef.current = true

    // The API replaces this element with its iframe, so give it a child that
    // React doesn't manage.
    const placeholder = document.createElement('div')
    container.appendChild(placeholder)

    api.createController(placeholder, { uri: trackUri(trackId), ...EMBED_SIZE }, (controller) => {
      if (unmountedRef.current) {
        controller.destroy()
        return
      }
      controllerRef.current = controller
      // A different track may have been requested while the embed was loading.
      const pending = pendingTrackRef.current
      pendingTrackRef.current = null
      if (pending && pending !== trackId) controller.loadEntity(trackUri(pending))

      controller.addListener('ready', () => {
        if (unmountedRef.current) return
        setStatus('ready')
        if (wantPlayingRef.current) controller.play()
      })
      controller.addListener('playback_update', ({ data }) => {
        if (unmountedRef.current) return
        setStatus('ready')
        setPlayback({
          isPlaying: !data.isPaused,
          isBuffering: data.isBuffering,
          position: data.position,
          duration: data.duration,
        })
      })
    })
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    loadApi().then(
      (api) => {
        if (unmountedRef.current) return
        apiRef.current = api
        setStatus((current) => (current === 'loading' && !pendingTrackRef.current ? 'ready' : current))
        if (pendingTrackRef.current) createController(api, pendingTrackRef.current)
      },
      () => {
        if (!unmountedRef.current) setStatus('error')
      },
    )
    return () => {
      unmountedRef.current = true
      controllerRef.current?.destroy()
      controllerRef.current = null
      creatingRef.current = false
    }
  }, [loadApi, createController])

  const playTrack = useCallback(
    (trackId: string) => {
      wantPlayingRef.current = true
      setPlayback({ isPlaying: false, isBuffering: true, position: 0, duration: 0 })

      const controller = controllerRef.current
      if (controller) {
        controller.loadEntity(trackUri(trackId))
        controller.play()
        return
      }
      pendingTrackRef.current = trackId
      if (apiRef.current) {
        setStatus('loading')
        createController(apiRef.current, trackId)
      }
    },
    [createController],
  )

  const play = useCallback(() => {
    wantPlayingRef.current = true
    controllerRef.current?.resume()
  }, [])

  const pause = useCallback(() => {
    wantPlayingRef.current = false
    controllerRef.current?.pause()
  }, [])

  const attachEmbed = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const replay = useCallback(() => {
    wantPlayingRef.current = true
    controllerRef.current?.restart()
  }, [])

  return { attachEmbed, status, ...playback, playTrack, play, pause, replay }
}
