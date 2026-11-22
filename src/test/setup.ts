import '@testing-library/jest-dom/vitest'

// jsdom has no canvas; components that draw on one get no context in tests.
// (Server tests run in the Node environment, where there's no DOM at all.)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
}
