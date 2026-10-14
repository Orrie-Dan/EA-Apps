import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAccessMiddleware,
  GH2_PROXY_BASE,
  GH2_SERVER_PROXY_BASE,
  PORTAL_URL,
  PROXY_BASE,
  SERVER_URL,
} from './access-server.js'
import {
  APP_GATE_COOKIE,
  PORTAL_HOST_COOKIE,
  signPayload,
  writeHostTokenMap,
} from './portal-host-session.js'
import { BASE_PATH } from './base-path.js'

/**
 * `gh2` is GeoHub under a second Runtime Config credential ("geohub2"). It has
 * the same URLs as gh, so only its own proxy base keeps a gh2 frame on the gh2
 * token. Before this, the host-session deposit for gh2 was refused (400) and
 * those catalog items never loaded.
 */
const middleware = createAccessMiddleware()
const SECRET = 'rsa-portal-dev-secret'
const FAR_FUTURE = Date.now() + 60 * 60 * 1000
const ORIGIN = 'https://localhost:4173'
const ABS = `${ORIGIN}${BASE_PATH}`

let proxied
let upstreamBody
beforeEach(() => {
  proxied = []
  upstreamBody = '{}'
  vi.stubGlobal('fetch', async (target, init) => {
    proxied.push({ url: new URL(target.toString()), init })
    return new Response(upstreamBody, { status: 200, headers: { 'content-type': 'application/json' } })
  })
})
afterEach(() => vi.unstubAllGlobals())

function hostCookie(tokens) {
  let map = {}
  for (const [key, token] of Object.entries(tokens)) map = writeHostTokenMap(map.hosts || {}, key, token, FAR_FUTURE)
  return `${PORTAL_HOST_COOKIE}=${encodeURIComponent(signPayload(map, process.env.SESSION_SECRET, SECRET))}`
}

async function run(url, { method = 'GET', headers = {}, body } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  const req = {
    method,
    url,
    headers: { host: 'localhost:4173', 'content-type': 'application/json', ...headers },
    socket: { encrypted: true },
    async *[Symbol.asyncIterator]() {
      yield* chunks
    },
  }
  const out = { headers: {}, body: '' }
  const res = {
    statusCode: 200,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v },
    getHeader(k) { return out.headers[k.toLowerCase()] },
    removeHeader(k) { delete out.headers[k.toLowerCase()] },
    end(b) { out.body = b === undefined ? '' : String(b) },
  }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true })
  return { ...out, status: res.statusCode, fellThrough, call: proxied[0] }
}

describe('gh2 host', () => {
  it('accepts a gh2 host-session deposit', async () => {
    const gate = signPayload({ authenticated: true, expiresAt: FAR_FUTURE }, process.env.SESSION_SECRET, SECRET)
    const r = await run('/api/portal/host-session', {
      method: 'POST',
      headers: { cookie: `${APP_GATE_COOKIE}=${encodeURIComponent(gate)}` },
      body: { portalHostKey: 'gh2', token: 'GH2-TOKEN', expiresAt: FAR_FUTURE },
    })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toMatchObject({ ready: true, portalHostKey: 'gh2' })
  })

  it('proxies /api/portal/gh2/... to GeoHub with the gh2 token', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' })
    const { call } = await run(`${GH2_PROXY_BASE}/apps/experiencebuilder/experience/?id=3ab8`, { headers: { cookie } })
    expect(call.url.origin + call.url.pathname).toBe(`${PORTAL_URL}/apps/experiencebuilder/experience/`)
    expect(call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('proxies /api/portal/gh2-srv/... to the GeoHub server with the gh2 token', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' })
    const { call } = await run(`${GH2_SERVER_PROXY_BASE}/rest/services/x/FeatureServer/0`, { headers: { cookie } })
    expect(call.url.origin + call.url.pathname).toBe(`${SERVER_URL}/rest/services/x/FeatureServer/0`)
    expect(call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('never lends the gh token to gh2', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN' })
    const { call } = await run(`${GH2_PROXY_BASE}/sharing/rest/portals/self?f=json`, { headers: { cookie } })
    expect(call.url.searchParams.has('token')).toBe(false)
  })

  it('keeps gh on the gh token', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' })
    const { call } = await run(`${PROXY_BASE}/sharing/rest/portals/self?f=json`, { headers: { cookie } })
    expect(call.url.searchParams.get('token')).toBe('GH-TOKEN')
  })

  it('routes root-relative requests from a gh2 frame with the gh2 token', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' })
    const referer = `${ORIGIN}${GH2_PROXY_BASE}/apps/experiencebuilder/experience/?id=3ab8`
    const { fellThrough, call } = await run('/sharing/rest/content/items/3ab8', { headers: { cookie, referer } })
    expect(fellThrough).toBe(false)
    expect(call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('rewrites GeoHub URLs in a gh2 body back onto the gh2 proxy', async () => {
    upstreamBody = JSON.stringify({
      a: `${PORTAL_URL}/sharing/rest`,
      b: `${SERVER_URL}/rest/services`,
      portalHostname: 'gh.space.gov.rw/portal',
    })
    const { body } = await run(`${GH2_PROXY_BASE}/sharing/rest/portals/self?f=json`)
    expect(body).not.toContain('gh.space.gov.rw')
    expect(body).toContain(`${ABS}${GH2_PROXY_BASE}/sharing/rest`)
    expect(body).toContain(`${ABS}${GH2_SERVER_PROXY_BASE}/rest/services`)
    // The scheme-less host form keeps no base path (as for gh); only its host key matters here.
    expect(body).toMatch(new RegExp(`"portalHostname":"localhost:4173[^"]*${GH2_PROXY_BASE}"`))
    expect(body).not.toContain(`${PROXY_BASE}/`)
  })

  it('still rewrites a gh body onto the gh proxy', async () => {
    upstreamBody = JSON.stringify({ a: `${PORTAL_URL}/sharing/rest` })
    const { body } = await run(`${PROXY_BASE}/sharing/rest/portals/self?f=json`)
    expect(body).toContain(`${ABS}${PROXY_BASE}/sharing/rest`)
    expect(body).not.toContain(GH2_PROXY_BASE)
  })

  it('keeps a gh2 redirect on the gh2 proxy', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, {
      status: 302,
      headers: { location: `${PORTAL_URL}/apps/experiencebuilder/experience/index.html` },
    }))
    const r = await run(`${GH2_PROXY_BASE}/apps/experiencebuilder/experience/`)
    expect(r.status).toBe(302)
    expect(r.headers.location).toContain(`${GH2_PROXY_BASE}/apps/experiencebuilder/experience/index.html`)
  })
})
