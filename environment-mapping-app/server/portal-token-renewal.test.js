import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_GATE_COOKIE, signPayload } from './portal-host-session.js'
import { browserOrigin, hostTokenWithRenewal } from './portal-token-renewal.js'

const FALLBACK = 'test-fallback'
const gateCookie = () =>
  `${APP_GATE_COOKIE}=${encodeURIComponent(signPayload({ authenticated: true, expiresAt: Date.now() + 3600_000 }, undefined, FALLBACK))}`

let port = 7000
function makeReq({ gate = true, http2 = false } = {}) {
  // A distinct origin per test keeps the module's in-flight / backoff state apart.
  const host = `localhost:${port++}`
  const headers = { cookie: gate ? gateCookie() : '' }
  if (http2) Object.assign(headers, { ':authority': host, ':scheme': 'https' })
  else headers.host = host
  return { headers, socket: { encrypted: true } }
}

function opts(hostMap) {
  const setHostCookie = vi.fn()
  return { hostMap, sessionSecret: undefined, sessionFallback: FALLBACK, setHostCookie }
}

describe('hostTokenWithRenewal', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'fresh', expiresAt: Date.now() + 20 * 60_000 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses a token with time left without calling the broker', async () => {
    const o = opts({ gh: { token: 'current', expiresAt: Date.now() + 10 * 60_000 } })
    expect(await hostTokenWithRenewal(makeReq(), {}, 'gh', o)).toBe('current')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(o.setHostCookie).not.toHaveBeenCalled()
  })

  it('renews a missing token for the browser origin and writes the cookie', async () => {
    const req = makeReq()
    const o = opts({})
    expect(await hostTokenWithRenewal(req, {}, 'gh', o)).toBe('fresh')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/portal-auth\/token$/)
    expect(init.headers.origin).toBe(`https://${req.headers.host}`)
    expect(JSON.parse(init.body)).toEqual({ appKey: 'environment-mapping', portalHostKey: 'gh' })
    expect(o.setHostCookie).toHaveBeenCalledTimes(1)
    expect(o.setHostCookie.mock.calls[0][1].hosts.gh.token).toBe('fresh')
    expect(o.hostMap.gh.token).toBe('fresh')
  })

  it('renews a token about to expire', async () => {
    const o = opts({ gh: { token: 'old', expiresAt: Date.now() + 30_000 } })
    expect(await hostTokenWithRenewal(makeReq(), {}, 'gh', o)).toBe('fresh')
  })

  it('derives the origin from HTTP/2 pseudo-headers', () => {
    const req = makeReq({ http2: true })
    expect(browserOrigin(req)).toBe(`https://${req.headers[':authority']}`)
  })

  it('never renews without an application gate', async () => {
    const o = opts({})
    expect(await hostTokenWithRenewal(makeReq({ gate: false }), {}, 'gh', o)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores hosts that are not portal credential hosts', async () => {
    expect(await hostTokenWithRenewal(makeReq(), {}, 'web', opts({}))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shares one broker call between concurrent requests', async () => {
    const req = makeReq()
    const results = await Promise.all([1, 2, 3].map(() => hostTokenWithRenewal(req, {}, 'gh', opts({}))))
    expect(results).toEqual(['fresh', 'fresh', 'fresh'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('backs off after a broker failure and keeps the existing token', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 503 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const req = makeReq()
    const o = opts({ gh: { token: 'old', expiresAt: Date.now() + 30_000 } })
    expect(await hostTokenWithRenewal(req, {}, 'gh', o)).toBe('old')
    expect(await hostTokenWithRenewal(req, {}, 'gh', o)).toBe('old')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(o.setHostCookie).not.toHaveBeenCalled()
  })
})
