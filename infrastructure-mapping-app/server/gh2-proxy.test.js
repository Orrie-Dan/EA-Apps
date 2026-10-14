import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccessMiddleware } from './access-server.js'
import {
  APP_GATE_COOKIE,
  PORTAL_HOST_COOKIE,
  signPayload,
  writeHostTokenMap,
} from './portal-host-session.js'
import { BASE_PATH } from './base-path.js'

/**
 * `gh2` is GeoHub under a second Runtime Config credential ("geohub2"). It has
 * the same URLs as gh, so only its own proxy keys (gh2 / gh2w) keep a gh2 frame
 * on the gh2 token. Before this, the host-session deposit for gh2 was refused
 * (400) and the three gh2 accessibility dashboards never loaded.
 */
const middleware = createAccessMiddleware()
const SECRET = 'infra-dev-session-secret'
const FAR_FUTURE = Date.now() + 60 * 60 * 1000
const PORTAL = 'https://gh.space.gov.rw/portal'

let proxied
let upstreamBody
beforeEach(() => {
  proxied = []
  upstreamBody = '{}'
  vi.stubGlobal('fetch', async (target, init) => {
    const url = new URL(target.toString())
    proxied.push({ url, init })
    // Anything but GeoHub (e.g. a broker renewal) fails, so no token is minted.
    if (url.hostname !== 'gh.space.gov.rw') return new Response('{}', { status: 500 })
    return new Response(upstreamBody, { status: 200, headers: { 'content-type': 'application/json' } })
  })
})
afterEach(() => vi.unstubAllGlobals())

const gate = () =>
  `${APP_GATE_COOKIE}=${encodeURIComponent(signPayload({ authenticated: true, expiresAt: FAR_FUTURE }, process.env.SESSION_SECRET, SECRET))}`

function cookies(tokens = {}) {
  let map = {}
  for (const [key, token] of Object.entries(tokens)) map = writeHostTokenMap(map.hosts || {}, key, token, FAR_FUTURE)
  const hosts = `${PORTAL_HOST_COOKIE}=${encodeURIComponent(signPayload(map, process.env.SESSION_SECRET, SECRET))}`
  return `${gate()}; ${hosts}`
}

async function run(url, { method = 'GET', headers = {}, body } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  const req = {
    method,
    url: `${BASE_PATH}${url}`,
    headers: { host: 'localhost:5181', 'content-type': 'application/json', ...headers },
    socket: { encrypted: true },
    async *[Symbol.asyncIterator]() {
      yield* chunks
    },
  }
  const out = { headers: {}, body: '' }
  let done
  const ended = new Promise((r) => (done = r))
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v },
    getHeader(k) { return out.headers[k.toLowerCase()] },
    removeHeader(k) { delete out.headers[k.toLowerCase()] },
    writeHead(status, headers) { this.statusCode = status; Object.assign(out.headers, headers || {}) },
    write(b) { out.body += String(b) },
    end(b) { if (b !== undefined) out.body += String(b); done() },
  }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true; done() })
  await ended
  const portalCalls = proxied.filter((c) => c.url.hostname === 'gh.space.gov.rw')
  return { ...out, status: res.statusCode, fellThrough, call: portalCalls[0] }
}

describe('gh2 host', () => {
  it('accepts a gh2 host-session deposit', async () => {
    const r = await run('/api/portal/host-session', {
      method: 'POST',
      headers: { cookie: gate() },
      body: { portalHostKey: 'gh2', token: 'GH2-TOKEN', expiresAt: FAR_FUTURE },
    })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toMatchObject({ portalHostKey: 'gh2' })
  })

  it('proxies /api/portal/proxy/gh2/... to GeoHub with the gh2 token', async () => {
    const { call } = await run('/api/portal/proxy/gh2/apps/dashboards/cf44eb1a', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' }) },
    })
    expect(call.url.origin + call.url.pathname).toBe(`${PORTAL}/apps/dashboards/cf44eb1a`)
    expect(call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('uses the gh2 token for the wide gh2w key (ArcGIS Server)', async () => {
    const { call } = await run('/api/portal/proxy/gh2w/server/rest/services/x/FeatureServer/0', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' }) },
    })
    expect(call.url.origin + call.url.pathname).toBe('https://gh.space.gov.rw/server/rest/services/x/FeatureServer/0')
    expect(call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('never lends the gh token to gh2', async () => {
    const r = await run('/api/portal/proxy/gh2/sharing/rest/portals/self', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN' }) },
    })
    expect(r.status).toBe(401)
    expect(r.call).toBeUndefined()
  })

  it('keeps gh on the gh token', async () => {
    const { call } = await run('/api/portal/proxy/gh/sharing/rest/portals/self', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' }) },
    })
    expect(call.url.searchParams.get('token')).toBe('GH-TOKEN')
  })

  it('routes root-relative requests from a gh2 frame with the gh2 token', async () => {
    const referer = `https://localhost:5181${BASE_PATH}/api/portal/proxy/gh2/apps/dashboards/cf44eb1a`
    const sharing = await run('/sharing/rest/content/items/cf44eb1a', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' }), referer },
    })
    expect(sharing.call.url.searchParams.get('token')).toBe('GH2-TOKEN')
    proxied = []
    const server = await run('/server/rest/services/x/MapServer', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN', gh2: 'GH2-TOKEN' }), referer },
    })
    expect(server.call.url.searchParams.get('token')).toBe('GH2-TOKEN')
  })

  it('rewrites GeoHub URLs in a gh2 body back onto the gh2 keys', async () => {
    upstreamBody = JSON.stringify({ a: `${PORTAL}/sharing/rest`, b: 'https://gh.space.gov.rw/server/rest/services' })
    const { body } = await run('/api/portal/proxy/gh2/sharing/rest/portals/self', {
      headers: { cookie: cookies({ gh2: 'GH2-TOKEN' }) },
    })
    expect(body).toContain('/api/portal/proxy/gh2/sharing/rest')
    expect(body).toContain('/api/portal/proxy/gh2w/server/rest/services')
    expect(body).not.toMatch(/\/api\/portal\/proxy\/ghw?\//)
  })

  it('still rewrites a gh body onto the gh keys', async () => {
    upstreamBody = JSON.stringify({ a: `${PORTAL}/sharing/rest` })
    const { body } = await run('/api/portal/proxy/gh/sharing/rest/portals/self', {
      headers: { cookie: cookies({ gh: 'GH-TOKEN' }) },
    })
    expect(body).toContain('/api/portal/proxy/gh/sharing/rest')
    expect(body).not.toContain('/api/portal/proxy/gh2')
  })
})
