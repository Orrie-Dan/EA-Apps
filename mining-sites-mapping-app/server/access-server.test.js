import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccessMiddleware, PORTAL_URL, PROXY_BASE, SERVER_URL } from './access-server.js'

/**
 * Routing tests for the frame fallback.
 *
 * The framed ArcGIS apps request plenty of paths root-relative — the proxy
 * deliberately does not rewrite those, because the app derives its own base
 * from window.location. Anything this middleware fails to recognise falls
 * through to the static handler, which answers EVERY unknown path with
 * index.html; the app then parses the portal's React SPA as its own payload.
 */
const middleware = createAccessMiddleware()

/** Records where a request was proxied to, without touching the network. */
let proxied
beforeEach(() => {
  proxied = []
  vi.stubGlobal('fetch', async (target) => {
    proxied.push(target.toString())
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  })
})
afterEach(() => vi.unstubAllGlobals())

/** Drive the middleware for a GET made from inside a proxied frame. */
async function fromFrame(pathname) {
  const req = {
    method: 'GET',
    url: pathname,
    headers: { host: 'localhost:4173', referer: `https://localhost:4173${PROXY_BASE}/apps/sites/` },
  }
  const res = {
    statusCode: 200,
    setHeader() {}, removeHeader() {}, end() {},
  }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true })
  return { fellThrough, target: proxied[0] }
}

describe('frame fallback routing', () => {
  it('proxies root-relative /portal/... instead of serving index.html', async () => {
    const { fellThrough, target } = await fromFrame(
      '/portal/apps/storymaps/_next/static/chunks/webpack-703b001fdc20ddea.js',
    )
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${PORTAL_URL}/apps/storymaps/_next/static/chunks/webpack-703b001fdc20ddea.js`)
  })

  it('proxies the Hub API /api/sharing/... to the portal', async () => {
    const { fellThrough, target } = await fromFrame('/api/sharing/rest/portals/self/settings')
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${PORTAL_URL}/sharing/rest/portals/self/settings`)
  })

  it('proxies root-relative /server/... to the ArcGIS Server, not the portal', async () => {
    const { fellThrough, target } = await fromFrame('/server/rest/services/Hosted/x/FeatureServer/0')
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${SERVER_URL}/rest/services/Hosted/x/FeatureServer/0`)
  })

  it('still proxies the paths that already worked', async () => {
    const { fellThrough, target } = await fromFrame('/sharing/rest/portals/self')
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${PORTAL_URL}/sharing/rest/portals/self`)
  })

  it('does not hijack this portal\'s own routes', async () => {
    const req = {
      method: 'GET', url: '/images/hero-1-640.webp',
      headers: { host: 'localhost:4173' },
    }
    let fellThrough = false
    await middleware(req, { statusCode: 200, setHeader() {}, removeHeader() {}, end() {} },
      () => { fellThrough = true })
    expect(fellThrough).toBe(true)
  })
})
