import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAccessMiddleware,
  FORMS_PROXY_BASE,
  FORMS_URL,
  PORTAL_URL,
  PROXY_BASE,
  SERVER_URL,
} from './access-server.js'

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

/**
 * Survey123 forms.
 *
 * A form is framed same-origin like everything else, but its upstream is Esri's
 * SaaS rather than the portal. Its own portal calls come back through
 * /api/portal/gh and pick up the session token there, which is the whole reason
 * to proxy it: framed at survey123.arcgis.com the token cannot reach it, and
 * ArcGIS Identity Manager prompts the user to sign in inside the frame.
 */
async function fromFormFrame(pathname, { method = 'GET', portalUrlParam = true } = {}) {
  // The real referer carries portalUrl pointing back at our portal proxy.
  const query = portalUrlParam
    ? `?portalUrl=https://localhost:4173${PROXY_BASE}`
    : ''
  const req = {
    method,
    url: pathname,
    headers: {
      host: 'localhost:4173',
      referer: `https://localhost:4173${FORMS_PROXY_BASE}/share/abc123${query}`,
    },
  }
  const res = { statusCode: 200, setHeader() {}, removeHeader() {}, end() {} }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true })
  return { fellThrough, target: proxied[0] }
}

describe('Survey123 form routing', () => {
  it('proxies the form itself to Survey123', async () => {
    const req = {
      method: 'GET',
      url: `${FORMS_PROXY_BASE}/share/abc123?portalUrl=https://localhost:4173${PROXY_BASE}`,
      headers: { host: 'localhost:4173' },
    }
    let fellThrough = false
    await middleware(req, { statusCode: 200, setHeader() {}, removeHeader() {}, end() {} },
      () => { fellThrough = true })
    expect(fellThrough).toBe(false)
    expect(proxied[0]).toContain(`${FORMS_URL}/share/abc123`)
  })

  /*
   * The regression that made the form fail with "Unexpected token '<'".
   *
   * A form's referer carries portalUrl=<origin>/api/portal/gh in its QUERY, so
   * a substring test against the whole referer reads the form frame as a portal
   * frame. Its own API calls then match no rule, fall through to the static
   * handler, and come back as index.html — which the app tries to parse as JSON.
   * Matching the referer's PATH is what keeps the two apart.
   */
  it('routes a form API call to Survey123 even though portalUrl is in the referer query', async () => {
    const { fellThrough, target } = await fromFormFrame('/api/updateWebform', { method: 'POST' })
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${FORMS_URL}/api/updateWebform`)
  })

  it('routes a form asset root-relative to Survey123, not the portal', async () => {
    const { fellThrough, target } = await fromFormFrame('/assets/js/router-index.js')
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${FORMS_URL}/assets/js/router-index.js`)
  })

  it('never attaches the portal token to Survey123 itself', async () => {
    // The token belongs to RDB's Enterprise. Only the portal calls the form
    // makes need it, and those go back through /api/portal/gh to collect it.
    await fromFormFrame('/api/updateWebform', { method: 'POST' })
    expect(proxied[0]).not.toContain('token=')
  })

  it('still reads a portal frame as a portal frame', async () => {
    // The path-based match must not break the case it was guarding.
    const { fellThrough, target } = await fromFrame('/sharing/rest/portals/self')
    expect(fellThrough).toBe(false)
    expect(target).toBe(`${PORTAL_URL}/sharing/rest/portals/self`)
  })
})
