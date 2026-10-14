import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccessMiddleware } from './access-server.js'
import { APP_GATE_COOKIE, readAppGate, signPayload } from './portal-host-session.js'

/**
 * The application gate is what lets a browser use the portal proxy and the
 * token broker. Only a successful sign-in may open it: /api/auth/ui-session
 * used to issue it to any caller, which handed out portal tokens to anyone who
 * could reach the server.
 */
const middleware = createAccessMiddleware()
const SESSION_FALLBACK = 'derma-dev-session-secret'

let fetched
beforeEach(() => {
  fetched = []
  vi.stubGlobal('fetch', async (target) => {
    fetched.push(target.toString())
    // Serves generateToken / oauth2 token and community/self alike.
    return Response.json({ token: 'portal-token', expires: Date.now() + 3_600_000, username: 'alice' })
  })
})
afterEach(() => vi.unstubAllGlobals())

async function call(method, pathname, { cookie = '', body } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  const req = {
    method,
    url: pathname,
    headers: { host: 'localhost:5180', cookie, 'content-type': 'application/json' },
    socket: {},
    async *[Symbol.asyncIterator]() {
      yield* chunks
    },
  }
  const headers = {}
  let resolveEnd
  const ended = new Promise((r) => (resolveEnd = r))
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) { headers[k.toLowerCase()] = v },
    getHeader(k) { return headers[k.toLowerCase()] },
    removeHeader(k) { delete headers[k.toLowerCase()] },
    end(text) { resolveEnd(text) },
  }
  let fellThrough = false
  await middleware(req, res, () => { fellThrough = true; resolveEnd() })
  const text = await ended
  const cookies = [].concat(headers['set-cookie'] || [])
  return { status: res.statusCode, fellThrough, body: text ? JSON.parse(text) : null, cookies }
}

const cookiePair = (setCookie) => setCookie.split(';')[0]
const gateFrom = (cookies) => cookies.find((c) => c.startsWith(`${APP_GATE_COOKIE}=`) && !c.includes('Max-Age=0'))
function liveGate(expiresAt = Date.now() + 3_600_000) {
  const value = signPayload({ authenticated: true, expiresAt }, process.env.SESSION_SECRET, SESSION_FALLBACK)
  return { cookie: `${APP_GATE_COOKIE}=${encodeURIComponent(value)}`, expiresAt }
}

describe('application gate', () => {
  it('refuses to open the gate for a caller that has not signed in', async () => {
    const r = await call('POST', '/api/auth/ui-session', { body: {} })
    expect(r.status).toBe(401)
    expect(gateFrom(r.cookies)).toBeUndefined()
  })

  it('opens the gate on a successful sign-in', async () => {
    const r = await call('POST', '/api/auth/login', { body: { username: 'alice', password: 'pw' } })
    expect(r.status).toBe(200)
    const gate = gateFrom(r.cookies)
    expect(gate).toBeDefined()
    expect(readAppGate(cookiePair(gate), process.env.SESSION_SECRET, SESSION_FALLBACK)).toBeTruthy()
  })

  it('does not open the gate when sign-in fails', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: { message: 'Invalid username or password.' } }))
    const r = await call('POST', '/api/auth/login', { body: { username: 'alice', password: 'bad' } })
    expect(r.status).toBe(401)
    expect(gateFrom(r.cookies)).toBeUndefined()
  })

  it('re-affirms a live gate without extending it', async () => {
    const { cookie, expiresAt } = liveGate()
    const r = await call('POST', '/api/auth/ui-session', { cookie, body: { expiresAt: Date.now() + 99 * 86_400_000 } })
    expect(r.status).toBe(200)
    expect(r.body.expiresAt).toBe(expiresAt)
    expect(gateFrom(r.cookies)).toBeUndefined()
  })

  it('has no server session to reissue a gate from', async () => {
    const login = await call('POST', '/api/auth/login', { body: { username: 'alice', password: 'pw' } })
    const rest = login.cookies.map(cookiePair).filter((c) => !c.startsWith(`${APP_GATE_COOKIE}=`)).join('; ')
    const r = await call('POST', '/api/auth/ui-session', { cookie: rest, body: {} })
    expect(r.status).toBe(401)
  })

  it('refuses an expired or forged gate', async () => {
    const expired = await call('POST', '/api/auth/ui-session', { cookie: liveGate(Date.now() - 1000).cookie, body: {} })
    expect(expired.status).toBe(401)
    const forged = signPayload({ authenticated: true, expiresAt: Date.now() + 3_600_000 }, 'not-the-secret', 'not-the-fallback')
    const r = await call('POST', '/api/auth/ui-session', { cookie: `${APP_GATE_COOKIE}=${forged}`, body: {} })
    expect(r.status).toBe(401)
  })

  it('keeps the token broker behind the gate', async () => {
    const denied = await call('POST', '/api/v1/portal-auth/token', { body: { portalHostKey: 'gh' } })
    expect(denied.status).toBe(401)
    expect(denied.fellThrough).toBe(false)

    const allowed = await call('POST', '/api/v1/portal-auth/token', { cookie: liveGate().cookie, body: { portalHostKey: 'gh' } })
    expect(allowed.fellThrough).toBe(true)
  })

  it('leaves runtime config public', async () => {
    const r = await call('GET', '/api/v1/config/disaster-emergency-mapping')
    expect(r.fellThrough).toBe(true)
  })
})
