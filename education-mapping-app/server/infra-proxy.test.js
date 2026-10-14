import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccessMiddleware } from './access-server.js'
import {
  APP_GATE_COOKIE,
  PORTAL_HOST_COOKIE,
  signPayload,
  writeHostTokenMap,
} from './portal-host-session.js'
import { BASE_PATH } from './base-path.js'
import { fallbackProxyTarget, rewritePayload } from './embed-proxy.js'

/**
 * `infra` is the infrastructure.space.gov.rw portal (Runtime Config credential
 * "infra"), used by the "ECD Mapping Tool" dashboard. Before this, the
 * host-session deposit for infra was refused (400 "Unsupported portalHostKey")
 * and the dashboard never loaded.
 */
const middleware = createAccessMiddleware()
const SECRET = 'demotrade-dev-session-secret'
const FAR_FUTURE = Date.now() + 60 * 60 * 1000
const INFRA = 'infrastructure.space.gov.rw'
const ECD = 'c47589bd02614102bfbb1eceb3371283'

let proxied
let upstreamBody
beforeEach(() => {
  proxied = []
  upstreamBody = '{}'
  vi.stubGlobal('fetch', async (target, init) => {
    const url = new URL(target.toString())
    proxied.push({ url, init })
    // Anything but the infra portal (e.g. a broker renewal) fails, so no token is minted.
    if (url.hostname !== INFRA) return new Response('{}', { status: 500 })
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
    headers: { host: 'localhost:5186', 'content-type': 'application/json', ...headers },
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
  await middleware(req, res, () => done())
  await ended
  const portalCalls = proxied.filter((c) => c.url.hostname === INFRA)
  return { ...out, status: res.statusCode, call: portalCalls[0] }
}

describe('infra host', () => {
  it('accepts an infra host-session deposit', async () => {
    const r = await run('/api/portal/host-session', {
      method: 'POST',
      headers: { cookie: gate() },
      body: { portalHostKey: 'infra', token: 'infra-token', expiresAt: FAR_FUTURE },
    })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toMatchObject({ ready: true, portalHostKey: 'infra' })
  })

  it('proxies an infra dashboard to the infra portal with the infra token', async () => {
    const r = await run(`/api/portal/proxy/infra/apps/dashboards/${ECD}`, {
      headers: { cookie: cookies({ gh: 'gh-token', infra: 'infra-token' }) },
    })
    expect(r.status).toBe(200)
    expect(r.call.url.origin + r.call.url.pathname).toBe(`https://${INFRA}/portal/apps/dashboards/${ECD}`)
    expect(r.call.url.searchParams.get('token')).toBe('infra-token')
  })

  it('uses the infra token for the wide infraw origin (/server)', async () => {
    const r = await run('/api/portal/proxy/infraw/server/rest/services/x/FeatureServer/0/query', {
      headers: { cookie: cookies({ gh: 'gh-token', infra: 'infra-token' }) },
    })
    expect(r.status).toBe(200)
    expect(r.call.url.pathname).toBe('/server/rest/services/x/FeatureServer/0/query')
    expect(r.call.url.searchParams.get('token')).toBe('infra-token')
  })

  it('rewrites infra URLs in payloads to the infra proxy keys', () => {
    const req = { headers: { host: 'localhost:5186' } }
    const body = JSON.stringify({
      portal: `https://${INFRA}/portal/sharing/rest`,
      service: `https://${INFRA}/server/rest/services/x/FeatureServer/0`,
    })
    const json = JSON.parse(rewritePayload(body, 'infra', req, 'application/json'))
    expect(json.portal).toContain('/api/portal/proxy/infra/sharing/rest')
    expect(json.service).toContain('/api/portal/proxy/infraw/server/rest/services/x/FeatureServer/0')
  })

  it('leaves gh and infra sign-in links on their real portals', () => {
    const req = { headers: { host: 'localhost:5186' } }
    const body = JSON.stringify({
      gh: 'https://gh.space.gov.rw/portal/sharing/rest/oauth2/authorize',
      ghw: 'https://gh.space.gov.rw/portal/home/signin.html',
      infra: `https://${INFRA}/portal/sharing/rest/oauth2/authorize`,
    })
    const json = JSON.parse(rewritePayload(body, 'infra', req, 'application/json'))
    expect(json.gh).toBe('https://gh.space.gov.rw/portal/sharing/rest/oauth2/authorize')
    expect(json.ghw).toBe('https://gh.space.gov.rw/portal/home/signin.html')
    expect(json.infra).toBe(`https://${INFRA}/portal/sharing/rest/oauth2/authorize`)
  })

  it('routes root-relative requests from an infra frame to infra, not gh', () => {
    const req = { headers: { referer: `https://localhost:5186${BASE_PATH}/api/portal/proxy/infra/apps/dashboards/${ECD}` } }
    expect(fallbackProxyTarget(new URL('https://x/sharing/rest/portals/self'), req)).toEqual({
      hostKey: 'infra',
      path: 'sharing/rest/portals/self',
    })
    expect(fallbackProxyTarget(new URL('https://x/server/rest/info'), req)).toEqual({
      hostKey: 'infraw',
      path: 'server/rest/info',
    })
  })
})
