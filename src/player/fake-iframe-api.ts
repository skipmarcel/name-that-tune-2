/**
 * In-memory stand-in for Spotify's iFrame API, for tests. Records every call
 * and lets a test fire the events the real embed would send.
 */
import type { EmbedController, EmbedOptions, PlaybackUpdate, SpotifyIFrameAPI } from './spotify-iframe'

type Handler = (event: { data: never }) => void

export class FakeEmbedController implements EmbedController {
  calls: string[] = []
  destroyed = false
  private handlers = new Map<string, Handler[]>()
  readonly options: EmbedOptions

  constructor(options: EmbedOptions) {
    this.options = options
  }

  loadEntity(uri: string) {
    this.calls.push(`loadEntity ${uri}`)
  }
  play() {
    this.calls.push('play')
  }
  pause() {
    this.calls.push('pause')
  }
  resume() {
    this.calls.push('resume')
  }
  togglePlay() {
    this.calls.push('togglePlay')
  }
  restart() {
    this.calls.push('restart')
  }
  destroy() {
    this.destroyed = true
  }

  addListener(event: string, handler: (...args: never[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler as Handler])
  }

  emit(event: 'ready'): void
  emit(event: 'playback_update', data: Partial<PlaybackUpdate>): void
  emit(event: string, data: unknown = {}) {
    for (const handler of this.handlers.get(event) ?? []) handler({ data } as { data: never })
  }

  /** Sends a playback update with sensible defaults. */
  update(data: Partial<PlaybackUpdate>) {
    this.emit('playback_update', {
      playingURI: '',
      isPaused: false,
      isBuffering: false,
      duration: 30_000,
      position: 0,
      ...data,
    })
  }
}

export function createFakeIframeApi() {
  const controllers: FakeEmbedController[] = []
  const api: SpotifyIFrameAPI = {
    createController(element, options, callback) {
      const controller = new FakeEmbedController(options)
      controllers.push(controller)
      element.setAttribute('data-fake-embed', options.uri ?? '')
      callback(controller)
    },
  }
  const loadApi = () => Promise.resolve(api)
  return { api, loadApi, controllers }
}
