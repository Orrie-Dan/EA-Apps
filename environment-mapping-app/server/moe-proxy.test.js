import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAccessMiddleware,
  MOE_PORTAL_URL,
  MOE_PROXY_BASE,
  MOE_SERVER_PROXY_BASE,
  MOE_SERVER_URL,
  PORTAL_URL,
  PROXY_BASE,
} from './access-server.js'
import { PORTAL_HOST_COOKIE, signPayload, writeHostTokenMap } from './portal-host-session.js'
import { BASE_PATH } from './base-path.js'

/**
 * The Ministry of Environment's Enterprise is proxied like GeoHub, with its own
 * `moe` broker token. Framed directly, its private apps asked for a MoE
 * sign-in even though the Runtime Config held a MoE credential.
 */
const middleware = createAccessMiddleware()
const FAR_FUTURE = Date.now() + 60 * 60 * 1000

let proxied
beforeEach(() => {
  proxied = []
  vi.stubGlobal('fetch', async (target, init) => {
    proxied.push({ url: new URL(target.toString()), init })
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  })
})
afterEach(() => vi.unstubAllGlobals())

/** A host cookie carrying a token per host key, as the browser would send it. */
function hostCookie(tokens) {
  let map = {}
  for (const [key, token] of Object.entries(tokens)) map = writeHostTokenMap(map.hosts || {}, key, token, FAR_FUTURE)
  return `${PORTAL_HOST_COOKIE}=${encodeURIComponent(signPayload(map, process.env.SESSION_SECRET, 'rsa-portal-dev-secret'))}`
}

async function run(url, headers = {}) {
  const req = { method: 'GET', url, headers: { host: 'localhost:4173', ...headers } }
  const res = { statusCode: 200, setHeader() {}, getHeader() {}, removeHeader() {}, end() {} }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true })
  return { fellThrough, call: proxied[0] }
}

describe('MoE proxy', () => {
  it('proxies /api/portal/moe/... to the MoE portal', async () => {
    const { fellThrough, call } = await run(`${MOE_PROXY_BASE}/apps/dashboards/5205ea5a64b44bdb8ae4873f5597c8ea`)
    expect(fellThrough).toBe(false)
    expect(`${call.url.origin}${call.url.pathname}`).toBe(`${MOE_PORTAL_URL}/apps/dashboards/5205ea5a64b44bdb8ae4873f5597c8ea`)
  })

  it('proxies /api/portal/moe-srv/... to the MoE ArcGIS Server', async () => {
    const { call } = await run(`${MOE_SERVER_PROXY_BASE}/rest/services/Hosted/x/FeatureServer/0`)
    expect(`${call.url.origin}${call.url.pathname}`).toBe(`${MOE_SERVER_URL}/rest/services/Hosted/x/FeatureServer/0`)
  })

  it('attaches the moe host token, never the GeoHub one', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', moe: 'MOE-TOKEN' })
    const { call } = await run(`${MOE_PROXY_BASE}/sharing/rest/portals/self?f=json`, { cookie })
    expect(call.url.searchParams.get('token')).toBe('MOE-TOKEN')
    expect(call.init.headers.authorization).toBe('Bearer MOE-TOKEN')
  })

  it('keeps sending the gh token to GeoHub', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN', moe: 'MOE-TOKEN' })
    const { call } = await run(`${PROXY_BASE}/sharing/rest/portals/self?f=json`, { cookie })
    expect(call.url.origin + call.url.pathname).toBe(`${PORTAL_URL}/sharing/rest/portals/self`)
    expect(call.url.searchParams.get('token')).toBe('GH-TOKEN')
  })

  it('sends no token to MoE when there is no moe host token', async () => {
    const cookie = hostCookie({ gh: 'GH-TOKEN' })
    const { call } = await run(`${MOE_PROXY_BASE}/sharing/rest/portals/self?f=json`, { cookie })
    expect(call.url.searchParams.has('token')).toBe(false)
  })

  it('routes root-relative requests from a MoE frame to MoE', async () => {
    const referer = `https://localhost:4173${MOE_PROXY_BASE}/apps/dashboards/abc`
    const { fellThrough, call } = await run('/sharing/rest/portals/self', { referer })
    expect(fellThrough).toBe(false)
    expect(call.url.origin + call.url.pathname).toBe(`${MOE_PORTAL_URL}/sharing/rest/portals/self`)
  })

  it('routes root-relative /server/... from a MoE frame to the MoE server', async () => {
    const referer = `https://localhost:4173${MOE_PROXY_BASE}/apps/dashboards/abc`
    const { call } = await run('/server/rest/services/x/MapServer', { referer })
    expect(call.url.origin + call.url.pathname).toBe(`${MOE_SERVER_URL}/rest/services/x/MapServer`)
  })

  it('reads a frame referer under the app base path', async () => {
    const referer = `https://localhost:4173${BASE_PATH}${MOE_PROXY_BASE}/apps/dashboards/abc`
    const { fellThrough, call } = await run('/sharing/rest/portals/self', { referer })
    expect(fellThrough).toBe(false)
    expect(call.url.origin + call.url.pathname).toBe(`${MOE_PORTAL_URL}/sharing/rest/portals/self`)
  })

  it('rewrites absolute MoE URLs in proxied bodies back onto the proxy', async () => {
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ a: `${MOE_PORTAL_URL}/sharing`, b: `${MOE_SERVER_URL}/rest`, portalHostname: 'moegis.environment.gov.rw/portal' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    let body = ''
    const req = { method: 'GET', url: `${MOE_PROXY_BASE}/sharing/rest/portals/self`, headers: { host: 'localhost:4173' } }
    const res = { statusCode: 200, setHeader() {}, getHeader() {}, removeHeader() {}, end(b) { body = String(b) } }
    await middleware(req, res, () => {})
    expect(body).not.toContain('moegis.environment.gov.rw')
    expect(body).toContain(`${MOE_PROXY_BASE}/sharing`)
    expect(body).toContain(`${MOE_SERVER_PROXY_BASE}/rest`)
  })

  it('leaves StoryMap links on their portal, since a story cannot run under a proxy base', async () => {
    const story = `${MOE_PORTAL_URL}/apps/storymaps/stories/0ad919ea544d408da446c518ab8da0e8`
    const ghStory = `${PORTAL_URL}/apps/storymaps/stories/abc`
    const dashboard = `${MOE_PORTAL_URL}/apps/dashboards/0057b13db2d04c46b85c90189dbba5ca`
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ staticUrl: story, expression: `<p>${story}</p>`, encoded: encodeURIComponent(story), ghStory, dashboard }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    let body = ''
    const req = { method: 'GET', url: `${MOE_PROXY_BASE}/sharing/rest/content/items/x/data`, headers: { host: 'localhost:4173' } }
    const res = { statusCode: 200, setHeader() {}, getHeader() {}, removeHeader() {}, end(b) { body = String(b) } }
    await middleware(req, res, () => {})
    const json = JSON.parse(body)
    expect(json.staticUrl).toBe(story)
    expect(json.expression).toBe(`<p>${story}</p>`)
    expect(json.encoded).toBe(encodeURIComponent(story))
    expect(json.ghStory).toBe(ghStory)
    // Everything else from the portal still goes through the proxy.
    expect(json.dashboard).toBe(`http://localhost:4173${MOE_PROXY_BASE}/apps/dashboards/0057b13db2d04c46b85c90189dbba5ca`)
  })
})
