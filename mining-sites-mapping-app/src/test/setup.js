import '@testing-library/jest-dom/vitest'

// jsdom does not implement IntersectionObserver, which Framer Motion's
// useInView (used by Reveal/RevealGroup/Counter) requires. Without this,
// mounting any component that calls useInView throws
// "ReferenceError: IntersectionObserver is not defined" in every test.
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class IntersectionObserverMock {
    constructor(callback) {
      this.callback = callback
    }
    observe(element) {
      // Report the element as visible immediately, the way a real browser does
      // for an element already in the viewport. Without this useInView never
      // fires and anything gated on it silently never runs.
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target: element }],
        this,
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.IntersectionObserver = IntersectionObserverMock
  global.IntersectionObserver = IntersectionObserverMock
}

// jsdom's requestAnimationFrame callback timestamp is NOT on the same clock
// as performance.now() (there is a large, roughly constant offset between
// them for the life of a test file). Real browsers guarantee both share one
// monotonic clock, so a rAF timestamp is always >= the performance.now()
// value captured when the frame was scheduled. Counter.jsx relies on that
// guarantee (`t = (now - start) / duration`, clamped only on the upper
// bound) to animate 0 -> `to`. Under jsdom's mismatched clocks `now - start`
// can come back deeply negative on the very first frame, so `t` goes very
// negative, `Math.pow(2, -10 * t)` overflows, and the rendered value is
// nonsense (e.g. -3.2e+295) instead of a number between 0 and `to`. This
// replaces jsdom's rAF with a minimal polyfill whose callback timestamp is
// performance.now(), matching real-browser behavior, so animation-timing
// components behave the same under test as they do in a browser.
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(performance.now()), 16)
  window.cancelAnimationFrame = (id) => clearTimeout(id)
  global.requestAnimationFrame = window.requestAnimationFrame
  global.cancelAnimationFrame = window.cancelAnimationFrame
}
