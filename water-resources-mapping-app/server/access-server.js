/**
 * Backend-for-frontend for the RSA Environmental and Natural Resource portal.
 *
 * Why this exists: the ArcGIS dashboards live on gh.space.gov.rw and are all
 * privately shared. A browser cannot authenticate a cross-origin iframe — the
 * frame is sealed — so a sign-in form on a static site could never make them
 * load. This server closes that gap by becoming the origin the browser talks to:
 *
 *   1. The user posts their GeoHub username and password to THIS server.
 *   2. This server exchanges them with the portal for a token, and keeps that
 *      token server-side. The browser never sees it.
 *   3. Dashboards are framed through /api/portal/gh/..., which proxies to the
 *      portal, injects the token, and strips the headers that block framing.
 *
 * Everything the browser loads is therefore same-origin: no X-Frame-Options
 * block, no third-party cookie, one sign-in for all dashboards.
 */
import crypto from 'node:crypto'
import {
  APP_GATE_COOKIE,
  PORTAL_AUTH_HOSTS,
  PORTAL_HOST_COOKIE,
  readAppGate,
  readHostTokenMap,
  signPayload,
  writeHostTokenMap,
} from './portal-host-session.js'
import { hostTokenWithRenewal } from './portal-token-renewal.js'
import { softenPermissionRefusal } from './portal-refusal.js'
import { BASE_PATH, rewriteResponsesUnderBasePath, stripBasePath } from './base-path.js'
import { keepStoryMapLinks } from './storymap-links.js'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000
const PORTAL_PROXY_TIMEOUT_MS = 120_000

export const PORTAL_URL = (process.env.PORTAL_URL || 'https://gh.space.gov.rw/portal').replace(/\/$/, '')
export const PROXY_BASE = '/api/portal/gh'

/**
 * The ArcGIS Server behind the portal, proxied separately.
 *
 * Dashboards and Experience Builder apps fetch their map layers, feature
 * services and helper services from /server, not /portal. Proxying only the
 * portal left every one of those calls going straight to gh.space.gov.rw, where
 * the browser has no session — so the ArcGIS Identity Manager popped its own
 * "Please sign in to access the item" dialog for each application in turn.
 * That is the repeated-login symptom: the portal was authenticated, the data
 * behind it was not.
 */
export const SERVER_URL = (
  process.env.SERVER_URL || PORTAL_URL.replace(/\/portal$/, '/server')
).replace(/\/$/, '')
export const SERVER_PROXY_BASE = '/api/portal/srv'

/*
 * The path each upstream lives under, e.g. '/portal' and '/server'.
 *
 * Framed apps ask for plenty of things root-relative — `/portal/apps/...`,
 * `/server/rest/...` — because rewriteBody deliberately leaves root-relative
 * references alone (rewriting them made the proxy prefix compound on itself).
 * Routing those back upstream means stripping this prefix and re-adding the
 * upstream base, so it is derived from the URL rather than written twice.
 */
const PORTAL_PREFIX = new URL(PORTAL_URL).pathname.replace(/\/$/, '')
const SERVER_PREFIX = new URL(SERVER_URL).pathname.replace(/\/$/, '')

const COOKIE = 'water_portal_session'

// Response headers we must not forward. The first two are the ones that would
// otherwise stop the portal being framed; the rest would corrupt the response
// because we may rewrite and re-encode the body.
const SKIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  // Critical: the portal is HTTPS and sends HSTS. Forwarding it would apply the
  // portal's transport policy to THIS origin, so the browser would force
  // https:// on our own host. In development that upgrades http://localhost to
  // https://localhost and every request dies with ERR_SSL_PROTOCOL_ERROR; in
  // production it silently imposes someone else's policy on our domain. This
  // origin must declare its own transport security, not inherit the upstream's.
  'strict-transport-security',
  'public-key-pins',
  'public-key-pins-report-only',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
])

const isProd = () => process.env.NODE_ENV === 'production'

/*
 * Diagnostics for "it asks me to sign in again". Opt-in: PORTAL_DEBUG=1.
 *
 * Three signals, because the interesting failures are all invisible to a plain
 * status check:
 *
 *  1. ArcGIS answers HTTP 200 and puts the failure in the BODY — code 499
 *     "Token Required", 498 "Invalid token", 403 no-permission. That 200 is why
 *     a proxy that only watches status codes sees a healthy response while the
 *     Identity Manager is popping its own login dialog inside the frame.
 *  2. A request from inside the frame that this middleware does not recognise
 *     falls through to the static handler, which answers EVERY unknown path
 *     with index.html. The app then parses the portal SPA as its own payload.
 *  3. A host in the payload that is neither the portal nor its ArcGIS Server is
 *     never rewritten, so the browser goes there directly with no session.
 */
const DEBUG = process.env.PORTAL_DEBUG === '1'
const seenForeignHosts = new Set()
const dbg = (...a) => { if (DEBUG) console.warn('[portal-debug]', ...a) }

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s === 'change-this-in-production') {
    if (isProd()) {
      throw new Error('SESSION_SECRET must be set to a real value in production')
    }
    return 'rsa-portal-dev-secret'
  }
  return s
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf('=')
      return i === -1 ? [p, ''] : [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]
    }),
  )
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

function unsign(value) {
  if (!value || !value.includes('.')) return null
  const [body, sig] = value.split('.')
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // Constant-time compare: a length check first, since timingSafeEqual throws
  // on mismatched lengths.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (data.expiresAt && Date.now() > data.expiresAt) return null
    return data
  } catch {
    return null
  }
}

const readSession = (req) => unsign(parseCookies(req.headers.cookie)[COOKIE])

/**
 * Whether to mark the session cookie Secure.
 *
 * Not simply `NODE_ENV === production`. Local development runs over TLS with a
 * self-signed certificate, and Chrome refuses to store Secure cookies for an
 * origin whose certificate it does not trust. The cookie was silently dropped,
 * so every proxied request reached GeoHub with no token and came back 401 —
 * which surfaced as dashboards failing with "Unauthorized" even though sign-in
 * had clearly succeeded.
 *
 * Localhost is already treated as a secure context by browsers, so the flag
 * buys nothing there. Everywhere else it stays on.
 */
function wantSecureCookie(req) {
  const host = String(req?.headers?.host || '').split(':')[0]
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  return isProd() && !isLocal
}

function setSessionCookie(res, payload, maxAgeSec, req) {
  appendCookie(res, COOKIE, sign(payload), maxAgeSec, req)
}

function clearSessionCookie(res, req) {
  appendCookie(res, COOKIE, '', 0, req)
}

const SESSION_FALLBACK = 'rsa-portal-dev-secret'

function appendCookie(res, name, value, maxAgeSec, req) {
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSec}`]
  if (wantSecureCookie(req)) flags.push('Secure')
  const next = `${name}=${value}; ${flags.join('; ')}`
  const existing = res.getHeader('Set-Cookie')
  if (!existing) {
    res.setHeader('Set-Cookie', next)
    return
  }
  const list = Array.isArray(existing) ? existing : [existing]
  res.setHeader('Set-Cookie', [...list, next])
}

function setAppGateCookie(res, expiresAt, req) {
  const maxAgeSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
  appendCookie(
    res,
    APP_GATE_COOKIE,
    signPayload(
      { authenticated: true, expiresAt },
      process.env.SESSION_SECRET,
      SESSION_FALLBACK,
    ),
    maxAgeSec,
    req,
  )
}

function clearAppGateCookie(res, req) {
  appendCookie(res, APP_GATE_COOKIE, '', 0, req)
}

function setPortalHostCookie(res, mapPayload, maxAgeSec, req) {
  appendCookie(
    res,
    PORTAL_HOST_COOKIE,
    signPayload(mapPayload, process.env.SESSION_SECRET, SESSION_FALLBACK),
    maxAgeSec,
    req,
  )
}

/** Lets the proxy renew an expiring broker token itself; see portal-token-renewal.js. */
const renewalOpts = (hostMap) => ({
  hostMap,
  sessionSecret: process.env.SESSION_SECRET,
  sessionFallback: SESSION_FALLBACK,
  setHostCookie: setPortalHostCookie,
})

function clearPortalHostCookie(res, req) {
  appendCookie(res, PORTAL_HOST_COOKIE, '', 0, req)
}

function requireAppGate(req, res) {
  const gate = readAppGate(
    req.headers.cookie,
    process.env.SESSION_SECRET,
    SESSION_FALLBACK,
  )
  if (!gate) {
    sendJson(res, 401, { error: 'Application login required' })
    return false
  }
  return true
}


function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

/** Exchange GeoHub credentials for a portal token. Runs server-side only. */
async function generatePortalToken(username, password, refererOrigin) {
  const clientId = process.env.PORTAL_CLIENT_ID || ''
  const clientSecret = process.env.PORTAL_CLIENT_SECRET || ''

  // Preferred when the portal has a registered app: OAuth password grant.
  if (clientId && clientSecret) {
    const res = await fetch(`${PORTAL_URL}/sharing/rest/oauth2/token`, {
      signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        f: 'json',
      }),
    })
    const data = await res.json().catch(() => ({}))
    const token = data.access_token || data.token
    if (token) {
      return { token, expiresAt: Date.now() + Number(data.expires_in || 1800) * 1000 }
    }
  }

  // Fallback that works without a registered app.
  const body = new URLSearchParams({
    username,
    password,
    client: 'referer',
    referer: refererOrigin,
    expiration: '1440',
    f: 'json',
  })
  const res = await fetch(`${PORTAL_URL}/sharing/rest/generateToken`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!data?.token) {
    // The portal puts the useful part in `details` — for example
    // "Too many invalid logins. Please try again later." after its lockout
    // trips. Surfacing only `message` ("Unable to generate token.") would leave
    // the user retyping a password that was never wrong.
    const err = data?.error || {}
    const detail = Array.isArray(err.details) ? err.details.filter(Boolean).join(' ') : ''
    throw new Error(detail || err.message || 'Invalid username or password.')
  }
  return { token: data.token, expiresAt: data.expires || Date.now() + 1440 * 60 * 1000 }
}

/** Look up who the token belongs to, so the portal can greet the real user. */
async function hydrateUser(token) {
  try {
    const res = await fetch(`${PORTAL_URL}/sharing/rest/community/self?f=json&token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS) })
    const d = await res.json()
    return { username: d.username || '', fullName: d.fullName || d.username || '', email: d.email || '' }
  } catch {
    return { username: '', fullName: '', email: '' }
  }
}

const REWRITABLE = /text\/html|javascript|json|css|text\/plain|xml/i

/**
 * Rewrite absolute portal references so the framed app keeps talking to us
 * rather than escaping to gh.space.gov.rw, which would reintroduce the
 * cross-origin problem this proxy exists to remove.
 */
/**
 * The origin this request actually arrived on.
 *
 * Derived per request rather than from PUBLIC_ORIGIN, because the same code
 * serves `npm run dev` (http://localhost:5173), `npm start`
 * (https://localhost:4173) and production (https://<host>). Pinning it to a
 * single configured value rewrote dev traffic to point at the production port,
 * where nothing was listening — the browser reported "refused to connect".
 */
function requestOrigin(req) {
  const proto =
    req.headers['x-forwarded-proto'] ||
    req.headers[':scheme'] ||
    (req.socket && req.socket.encrypted ? 'https' : 'http')
  // HTTP/2 carries the host in the :authority pseudo-header and sends no
  // `host` at all. Vite serves the dev site over h2 whenever a certificate is
  // present, so without this the origin fell back to PUBLIC_ORIGIN and the
  // proxy presented the portal token with a referer it was not bound to: every
  // proxied portal call came back 498 "Invalid token".
  const host =
    req.headers['x-forwarded-host'] || req.headers.host || req.headers[':authority']
  if (!host) return (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '')
  return `${proto}://${host}`
}

function rewriteBody(text, ...rest) {
  return keepStoryMapLinks(text, (t) => rewriteBodyUnshielded(t, ...rest))
}

function rewriteBodyUnshielded(text, req) {
  if (!text) return text

  // Absolute proxy base, e.g. https://localhost:4173/api/portal/gh
  //
  // It must stay ABSOLUTE. Substituting a root-relative "/api/portal/gh" would
  // be resolved by the app against its own location — which already sits under
  // the proxy — producing /api/portal/gh/apps/dashboards/api/portal/gh/...
  const origin = requestOrigin(req)
  const absoluteProxy = origin ? `${origin}${PROXY_BASE}` : PROXY_BASE
  const servingInsecurely = !origin.startsWith('https://')

  // ONLY absolute portal URLs are rewritten.
  //
  // Root-relative paths ("/portal/...", "/sharing/...") are deliberately left
  // alone. The ArcGIS app derives its portal base from window.location, which is
  // already /api/portal/gh/..., then appends the path itself. Rewriting those
  // too made it prepend the base to an already-prefixed path, and the prefix
  // compounded on every request:
  //   /api/portal/gh/api/portal/gh/api/portal/gh/sharing/rest/portals/self
  // which 500s and kills the dashboard with DASH_0004.
  let out = text
    .replaceAll(PORTAL_URL, absoluteProxy)
    .replaceAll(encodeURIComponent(PORTAL_URL), encodeURIComponent(absoluteProxy))

  // The scheme-less host form must be rewritten too.
  //
  // portals/self returns `portalHostname: "gh.space.gov.rw/portal"`, and the
  // ArcGIS API treats that as the portal's canonical address — so it rebuilds
  // requests against GeoHub directly, leaving this proxy behind. On an http
  // page it then targets http://gh.space.gov.rw/portal, which is HTTPS-only,
  // and the app dies with "Only HTTPS is supported".
  //
  // Runs after the full-URL replacement above, so anything still matching here
  // genuinely had no scheme.
  const absoluteServerProxy = origin ? `${origin}${SERVER_PROXY_BASE}` : SERVER_PROXY_BASE
  out = out
    .replaceAll(SERVER_URL, absoluteServerProxy)
    .replaceAll(encodeURIComponent(SERVER_URL), encodeURIComponent(absoluteServerProxy))

  const portalHost = PORTAL_URL.replace(/^https?:\/\//, '')
  const serverHost = SERVER_URL.replace(/^https?:\/\//, '')
  const originHost = origin.replace(/^https?:\/\//, '')
  if (originHost) {
    // Longest first: gh.space.gov.rw/server and .../portal share a prefix.
    if (serverHost) out = out.replaceAll(serverHost, `${originHost}${SERVER_PROXY_BASE}`)
    if (portalHost) out = out.replaceAll(portalHost, `${originHost}${PROXY_BASE}`)
  }

  // DEVELOPMENT ONLY, and deliberately narrow.
  //
  // GeoHub reports `allSSL: true`, and the ArcGIS JS API honours it by forcing
  // the hosting page to https. Over http://localhost that redirects to
  // https://localhost, which nothing is listening on, so the dashboard frame
  // dies with ERR_SSL_PROTOCOL_ERROR and renders empty.
  //
  // Clearing the flag lets the API stay on the scheme we are actually serving.
  // It NEVER runs in production: there PUBLIC_ORIGIN is https, the condition is
  // false, and the portal's real SSL policy is left untouched. Downgrading
  // transport security on a live government deployment would be indefensible,
  // so the guard is the origin's own scheme rather than a NODE_ENV flag someone
  // could forget to set.
  if (servingInsecurely) {
    out = out
      .replaceAll('"allSSL":true', '"allSSL":false')
      .replaceAll('"allSSL": true', '"allSSL": false')
      .replaceAll('"ssl":true', '"ssl":false')
      .replaceAll('"ssl": true', '"ssl": false')
  }

  if (DEBUG) {
    // Anything still absolute after rewriting is a host we do not proxy.
    for (const m of out.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
      const host = m[1]
      if (host === originHost.split('/')[0] || seenForeignHosts.has(host)) continue
      seenForeignHosts.add(host)
      dbg('FOREIGN HOST in payload (not proxied, browser goes there unauthenticated):', host)
    }
  }

  return out
}

async function proxyRequest(req, res, restPath, search, base = PORTAL_URL) {
  const session = readSession(req)
  const hostMap = readHostTokenMap(
    req.headers.cookie,
    process.env.SESSION_SECRET,
    SESSION_FALLBACK,
  )
  // Prefer AUTH-04 host-session broker token; fall back to login cookie
  // for host `gh` only (keeps pre-AUTH-04 behaviour as a safety net).
  let portalToken = await hostTokenWithRenewal(req, res, 'gh', renewalOpts(hostMap))
  if (!portalToken && session?.token) {
    portalToken = session.token
  }

  const target = new URL(restPath.replace(/^\//, ''), `${base}/`)
  // Never let a caller pin their own token; the session's token is authoritative.
  new URLSearchParams(search).forEach((v, k) => {
    if (k !== 'token') target.searchParams.set(k, v)
  })
  if (portalToken) target.searchParams.set('token', portalToken)

  // Deliberately do NOT forward If-None-Match / If-Modified-Since: we rewrite
  // bodies, so a 304 from the portal would describe content we never sent.
  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'RSA-Portal',
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (portalToken) {
    headers.authorization = `Bearer ${portalToken}`
    // The token is minted with client=referer, so it is only valid for requests
    // carrying the SAME referer it was bound to. That binding is made from
    // requestOrigin(req) at sign-in, so it must be read the same way here.
    // Using a configured PUBLIC_ORIGIN instead meant a token bound to
    // :4174 was presented with a :4173 referer, and the portal rejected every
    // proxied call with 401 despite a perfectly valid session.
    headers.referer = requestOrigin(req) || `http://${req.headers.host}`
  }

  const init = { method: req.method, headers, redirect: 'manual' }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req
    init.duplex = 'half'
  }

  let upstream
  try {
    upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })
  } catch (err) {
    sendJson(res, err?.name === 'TimeoutError' ? 504 : 502, { error: `Could not reach the portal: ${err.message}` })
    return
  }

  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    const location = upstream.headers.get('location')
    if (location) {
      res.statusCode = 302
      res.setHeader(
        'Location',
        location.replace(SERVER_URL, SERVER_PROXY_BASE).replace(PORTAL_URL, PROXY_BASE),
      )
      res.end()
      return
    }
  }

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value)
  })
  // The portal's framing headers were dropped so this portal can embed its own
  // dashboards. Re-assert the protection scoped to our origin so the proxy does
  // not become an open framing bypass for anyone else.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  const type = upstream.headers.get('content-type') || ''
  if (REWRITABLE.test(type)) {
    // We rewrite this body, so the upstream's validators no longer describe what
    // we return. Forwarding them lets the browser revalidate against the portal
    // and accept a bodyless 304 for content that has actually changed — which
    // shows up as a frame that never loads. Drop them and forbid caching.
    res.removeHeader('ETag')
    res.removeHeader('etag')
    res.removeHeader('Last-Modified')
    res.removeHeader('last-modified')
    res.setHeader('Cache-Control', 'no-store')
    const raw = softenPermissionRefusal(await upstream.text(), Boolean(portalToken))
    if (DEBUG) {
      // The body carries the real verdict even when the status says 200.
      const e = raw.match(/"error"\s*:\s*\{[^}]*"code"\s*:\s*(\d+)[^}]*"message"\s*:\s*"([^"]*)"/)
      if (e) dbg(`ARCGIS ERROR code=${e[1]} http=${upstream.status} "${e[2]}"  <- ${target.pathname}`)
    }
    const out = rewriteBody(raw, req)
    res.setHeader('Content-Length', Buffer.byteLength(out))
    res.end(out)
  } else {
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Length', buf.length)
    res.end(buf)
  }
}

export function createAccessMiddleware() {
  return async function accessMiddleware(req, res, originalNext) {
    if (req.url === '/') {
      res.statusCode = 302
      res.setHeader('Location', `${BASE_PATH}/`)
      res.end()
      return
    }
    // Route on the path inside the base; put it back for the next middleware,
    // which serves the app itself under the base.
    const originalUrl = req.url
    const inner = stripBasePath(req.url)
    if (inner !== null) req.url = inner
    const restoreResponse = rewriteResponsesUnderBasePath(req, res)
    const next = (...args) => {
      req.url = originalUrl
      restoreResponse()
      originalNext(...args)
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const { pathname } = url

    try {
      // The broker mints portal tokens; only a signed-in session may ask.
      if (pathname.startsWith('/api/v1/portal-auth') && !requireAppGate(req, res)) return

      if (pathname === '/api/auth/ui-session' && req.method === 'POST') {
        // A successful /api/auth/login opens the gate. This only re-affirms a
        // live gate, or reissues it for a live login session, so it cannot open
        // the gate on its own.
        const gate = readAppGate(req.headers.cookie, process.env.SESSION_SECRET, SESSION_FALLBACK)
        let expiresAt = gate ? gate.expiresAt || Date.now() + 20160 * 1000 : null
        const s = !gate && readSession(req)
        if (s?.token && !(s.expiresAt && s.expiresAt <= Date.now())) {
          expiresAt = Date.now() + 20160 * 1000
          setAppGateCookie(res, expiresAt, req)
        }
        if (!expiresAt) return sendJson(res, 401, { error: 'Application login required' })
        return sendJson(res, 200, { authenticated: true, expiresAt })
      }

      if (pathname === '/api/auth/ui-session' && req.method === 'DELETE') {
        clearAppGateCookie(res, req)
        clearPortalHostCookie(res, req)
        return sendJson(res, 200, { authenticated: false })
      }

      if (pathname === '/api/portal/host-session' && req.method === 'POST') {
        if (!requireAppGate(req, res)) return true
        const body = await readJsonBody(req)
        const portalHostKey = String(body.portalHostKey || '')
          .trim()
          .toLowerCase()
        const token = String(body.token || '').trim()
        const expiresAt = Number(body.expiresAt)

        if (!PORTAL_AUTH_HOSTS.has(portalHostKey)) {
          return sendJson(res, 400, { error: 'Unsupported portalHostKey' })
        }
        if (!token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          return sendJson(res, 400, { error: 'Invalid portal host session' })
        }

        const existing = readHostTokenMap(
          req.headers.cookie,
          process.env.SESSION_SECRET,
          SESSION_FALLBACK,
        )
        const nextMap = writeHostTokenMap(existing, portalHostKey, token, expiresAt)
        const maxAgeSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
        setPortalHostCookie(res, nextMap, maxAgeSec, req)
        return sendJson(res, 200, {
          ready: true,
          portalHostKey,
          expiresAt,
        })
      }

      if (pathname === '/api/portal/host-session' && req.method === 'DELETE') {
        clearPortalHostCookie(res, req)
        return sendJson(res, 200, { cleared: true })
      }

      if (pathname === '/api/portal/host-session' && req.method === 'GET') {
        if (!requireAppGate(req, res)) return true
        const hostMapGet = readHostTokenMap(
          req.headers.cookie,
          process.env.SESSION_SECRET,
          SESSION_FALLBACK,
        )
        const requested = String(url.searchParams.get('portalHostKey') || '')
          .trim()
          .toLowerCase()
        if (requested) {
          return sendJson(res, 200, {
            portalHostKey: requested,
            ready: Boolean(hostMapGet[requested]),
          })
        }
        return sendJson(res, 200, {
          hosts: Object.keys(hostMapGet),
        })
      }

      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await readJsonBody(req)
        const username = String(body.username || '').trim()
        const password = String(body.password || '')
        if (!username || !password) {
          return sendJson(res, 400, { error: 'Enter your GeoHub username and password.' })
        }
        try {
          const { token, expiresAt } = await generatePortalToken(
            username,
            password,
            requestOrigin(req) || 'http://localhost:5173',
          )
          const user = await hydrateUser(token)
          setSessionCookie(
            res,
            { token, ...user, expiresAt },
            Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
            req,
          )
          setAppGateCookie(res, Date.now() + 20160 * 1000, req)
          return sendJson(res, 200, { authenticated: true, user })
        } catch (err) {
          return sendJson(res, err?.name === 'TimeoutError' ? 504 : 401, {
            error: err?.name === 'TimeoutError' ? 'The mapping portal did not respond in time. Please try again.' : err.message || 'Invalid username or password.',
          })
        }
      }

      if (pathname === '/api/auth/session' && req.method === 'GET') {
        const s = readSession(req)
        if (!s?.token) return sendJson(res, 200, { authenticated: false })
        return sendJson(res, 200, {
          authenticated: true,
          user: { username: s.username, fullName: s.fullName, email: s.email },
        })
      }

      if (pathname === '/api/auth/logout') {
        clearSessionCookie(res, req)
        clearAppGateCookie(res, req)
        clearPortalHostCookie(res, req)
        return sendJson(res, 200, { authenticated: false })
      }

      if (pathname === SERVER_PROXY_BASE || pathname.startsWith(`${SERVER_PROXY_BASE}/`)) {
        let rest = pathname
        while (rest === SERVER_PROXY_BASE || rest.startsWith(`${SERVER_PROXY_BASE}/`)) {
          rest = rest.slice(SERVER_PROXY_BASE.length)
        }
        return await proxyRequest(
          req,
          res,
          (rest || '/').replace(/\/{2,}/g, '/'),
          url.search,
          SERVER_URL,
        )
      }

      if (pathname === PROXY_BASE || pathname.startsWith(`${PROXY_BASE}/`)) {
        // Collapse an accidentally repeated prefix rather than 500.
        // /api/portal/gh/api/portal/gh/sharing/... -> /sharing/...
        let rest = pathname
        while (rest === PROXY_BASE || rest.startsWith(`${PROXY_BASE}/`)) {
          rest = rest.slice(PROXY_BASE.length)
        }
        return await proxyRequest(req, res, (rest || '/').replace(/\/{2,}/g, '/'), url.search)
      }

      /*
       * Root-relative requests from inside a framed app.
       *
       * These are NOT optional extras. The static handler below answers every
       * unknown path with index.html, so anything not routed here comes back to
       * the ArcGIS app as this portal's React SPA — a Next.js chunk request is
       * served HTML, and the app dies and falls back to asking the user to sign
       * in. That is the whole "it makes me log in again" symptom for the Hub
       * Site, whose Ember shell requests /portal/... and /api/sharing/...,
       * neither of which the old assets-only allowlist matched.
       *
       * Gated on the referer pointing into one of our proxy bases, so this
       * cannot be used to make the portal a general-purpose open proxy, and it
       * only ever forwards to the two configured upstreams.
       */
      const referer = req.headers.referer || ''
      const fromFrame = referer.includes(PROXY_BASE) || referer.includes(SERVER_PROXY_BASE)

      if (fromFrame) {
        const under = (prefix) =>
          prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))

        // Longest/most specific first: '/server' and '/portal' are distinct, but
        // the ArcGIS Server must never be answered from the portal base.
        if (under(SERVER_PREFIX)) {
          return await proxyRequest(
            req, res, pathname.slice(SERVER_PREFIX.length) || '/', url.search, SERVER_URL,
          )
        }
        if (under(PORTAL_PREFIX)) {
          return await proxyRequest(req, res, pathname.slice(PORTAL_PREFIX.length) || '/', url.search)
        }
        // The Hub Site's Ember shell addresses the sharing API as /api/sharing.
        // Our own /api/auth and /api/portal routes are matched earlier and have
        // already returned, so this cannot shadow them.
        if (pathname.startsWith('/api/sharing/')) {
          return await proxyRequest(req, res, pathname.slice('/api'.length), url.search)
        }
        if (/^\/(assets|jsapi|home|sharing|apps)\//.test(pathname)) {
          return await proxyRequest(req, res, pathname, url.search)
        }
      }
    } catch (err) {
      return sendJson(res, err?.name === 'TimeoutError' ? 504 : 500, { error: err.message })
    }

    if (DEBUG) {
      const ref = req.headers.referer || ''
      if (ref.includes(PROXY_BASE) || ref.includes(SERVER_PROXY_BASE)) {
        dbg(`UNPROXIED ${req.method} ${pathname} — from inside the frame, but no proxy`,
            'rule matched, so the static handler will answer it with index.html')
      }
    }

    if (typeof next === 'function') return next()
    res.statusCode = 404
    res.end('Not found')
  }
}
