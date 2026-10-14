import crypto from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import {
  APP_EMBED_URL,
  APP_SOURCES,
  EWIS_ORIGIN,
  EWIS_PORTAL_URL,
  PORTAL_ORIGIN,
  PORTAL_URL,
  PROXY_HOSTS,
  RMB_ORIGIN,
  RMB_PORTAL_URL,
  proxyPathFor,
} from '../src/lib/access.js'
import {
  APP_GATE_COOKIE,
  PORTAL_AUTH_HOSTS,
  PORTAL_HOST_COOKIE,
  authHostForProxyKey,
  clearHostTokenMap,
  isAllowedProxyHostKey,
  parseCookies,
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

const COOKIE = 'derma_session'
const SESSION_FALLBACK = 'derma-dev-session-secret'
const SKIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  // The upstream portal's HSTS must not be forwarded: it would apply the
  // portal's transport policy to this origin and force https on our host.
  'strict-transport-security',
  'public-key-pins',
  'public-key-pins-report-only',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie',
])

function secret() {
  return process.env.SESSION_SECRET || SESSION_FALLBACK
}

function portalUrl() {
  return (process.env.PORTAL_URL || PORTAL_URL).replace(/\/$/, '')
}

function sign(payload) {
  return signPayload(payload, process.env.SESSION_SECRET, SESSION_FALLBACK)
}

function unsign(value) {
  if (!value || !value.includes('.')) return null
  const [body, sig] = value.split('.')
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (data.expiresAt && Date.now() > data.expiresAt) return null
    return data
  } catch {
    return null
  }
}

function readSession(req) {
  return unsign(parseCookies(req.headers.cookie)[COOKIE])
}

function cookieSecure() {
  return String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')
}

function cookieAttrs(maxAgeSec) {
  const secure = cookieSecure() ? '; Secure' : ''
  const age = maxAgeSec == null ? '0' : String(maxAgeSec)
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${secure}`
}

function appIsHttps(req) {
  if (String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')) return true
  return req?.headers['x-forwarded-proto'] === 'https'
}

function appendCookie(res, name, value, maxAgeSec) {
  const existing = res.getHeader('Set-Cookie')
  const next = `${name}=${value}; ${cookieAttrs(maxAgeSec)}`
  if (!existing) {
    res.setHeader('Set-Cookie', next)
    return
  }
  const list = Array.isArray(existing) ? existing : [existing]
  res.setHeader('Set-Cookie', [...list, next])
}

function setSessionCookie(res, payload, maxAgeSec) {
  appendCookie(res, COOKIE, sign(payload), maxAgeSec)
}

function clearSessionCookie(res) {
  appendCookie(res, COOKIE, '', 0)
}

function setAppGateCookie(res, expiresAt) {
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
  )
}

function clearAppGateCookie(res) {
  appendCookie(res, APP_GATE_COOKIE, '', 0)
}

function setPortalHostCookie(res, mapPayload, maxAgeSec) {
  appendCookie(
    res,
    PORTAL_HOST_COOKIE,
    signPayload(mapPayload, process.env.SESSION_SECRET, SESSION_FALLBACK),
    maxAgeSec,
  )
}

/** Lets the proxy renew an expiring broker token itself; see portal-token-renewal.js. */
const renewalOpts = (hostMap) => ({
  hostMap,
  sessionSecret: process.env.SESSION_SECRET,
  sessionFallback: SESSION_FALLBACK,
  setHostCookie: setPortalHostCookie,
})

function clearPortalHostCookie(res) {
  appendCookie(res, PORTAL_HOST_COOKIE, '', 0)
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
  res.end(JSON.stringify(data))
}

function redirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || (appIsHttps(req) ? 'https' : 'http')
  return `${proto}://${req.headers.host}`
}

async function generatePortalToken(username, password, req) {
  const clientId = process.env.PORTAL_CLIENT_ID || ''
  const clientSecret = process.env.PORTAL_CLIENT_SECRET || ''

  if (clientId && clientSecret) {
    const oauth = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      f: 'json',
    })
    const oauthRes = await fetch(`${portalUrl()}/sharing/rest/oauth2/token`, {
      signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: oauth,
    })
    const oauthData = await oauthRes.json()
    const token = oauthData.access_token || oauthData.token
    if (token) {
      return {
        token,
        expires: Date.now() + Number(oauthData.expires_in || 1800) * 1000,
      }
    }
  }

  const body = new URLSearchParams({
    username,
    password,
    client: 'requestip',
    expiration: '20160',
    f: 'json',
  })
  if (clientId) body.set('clientid', clientId)

  const response = await fetch(`${portalUrl()}/sharing/rest/generateToken`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (!data?.token) {
    throw new Error(data?.error?.message || 'Invalid username or password')
  }
  return data
}

const HTML_SSL_PATCH = `<script src="/dashboards/ssl-patch.js"></script>`

/** Absolute portal origins only. Root-relative paths stay untouched. */
const PORTAL_PROXY_SPECS = [
  [PORTAL_URL, '/api/portal/proxy/gh'],
  [PORTAL_ORIGIN, '/api/portal/proxy/ghw'],
  [RMB_PORTAL_URL, '/api/portal/proxy/rmb'],
  [RMB_ORIGIN, '/api/portal/proxy/rmbw'],
  [EWIS_PORTAL_URL, '/api/portal/proxy/ewis'],
  [EWIS_ORIGIN, '/api/portal/proxy/ewisw'],
]

function escapeSlashUrl(url) {
  return url.replaceAll('/', '\\/')
}

function portalKeys(hostKey) {
  if (hostKey === 'rmb' || hostKey === 'rmbw') return { portal: 'rmb', wide: 'rmbw' }
  if (hostKey === 'ewis' || hostKey === 'ewisw') return { portal: 'ewis', wide: 'ewisw' }
  if (hostKey === 'web') return { portal: 'web', wide: 'web' }
  return { portal: 'gh', wide: 'ghw' }
}

function collapseProxyPrefix(text) {
  return text.replace(
    /\/api\/portal\/proxy\/(?:gh|ghw|rmb|rmbw|ewis|ewisw|web)(?=\/api\/portal\/proxy\/)/g,
    '',
  )
}

function normalizeProxyRestPath(hostKey, restPath) {
  let path = String(restPath || '').replace(/^\/+/, '')
  path = path.replace(/^(?:api\/portal\/proxy\/(?:gh|ghw|rmb|rmbw|ewis|ewisw|web)\/)+/, '')
  return path || '.'
}

/**
 * Origin the browser actually used.
 * Prefer the request itself so a stale PUBLIC_ORIGIN cannot point rewritten
 * map URLs or the portal Referer at the wrong port.
 */
function requestOrigin(req) {
  const forwarded = req?.headers?.['x-forwarded-proto']
  let proto
  if (forwarded) proto = String(forwarded).split(',')[0].trim()
  else if (req?.socket?.encrypted) proto = 'https'
  else if (String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')) proto = 'https'
  else proto = 'http'
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host
  if (!host) return (process.env.PUBLIC_ORIGIN || 'http://localhost:5180').replace(/\/$/, '')
  return `${proto}://${host}`
}

function portalRewritePairs(origin) {
  const originHost = origin.replace(/^https?:\/\//, '')
  const pairs = []
  for (const [from, proxyPath] of PORTAL_PROXY_SPECS) {
    const absolute = `${origin}${proxyPath}`
    const bareFrom = from.replace(/^https?:\/\//, '')
    const bareTo = `${originHost}${proxyPath}`
    pairs.push([from, absolute])
    pairs.push([encodeURIComponent(from), encodeURIComponent(absolute)])
    pairs.push([escapeSlashUrl(from), escapeSlashUrl(absolute)])
    pairs.push([bareFrom, bareTo])
    pairs.push([encodeURIComponent(bareFrom), encodeURIComponent(bareTo)])
    pairs.push([escapeSlashUrl(bareFrom), escapeSlashUrl(bareTo)])
  }
  pairs.sort((a, b) => b[0].length - a[0].length)
  return pairs
}

/**
 * Rewrite absolute portal addresses to this app's proxy.
 * Root-relative paths (/sharing/, /apps/, /portal/) are left as-is: ArcGIS
 * joins them to the iframe location, and rewriting them doubles the prefix.
 */
export function rewritePortalText(text, ...rest) {
  return keepStoryMapLinks(text, (t) => rewritePortalTextUnshielded(t, ...rest))
}

function rewritePortalTextUnshielded(text, req, hostKey = 'gh', restPath = '') {
  if (!text) return text
  const origin = requestOrigin(req)
  const { portal } = portalKeys(hostKey)
  let next = text
  for (const [from, to] of portalRewritePairs(origin)) {
    if (from && next.includes(from)) next = next.replaceAll(from, to)
  }

  if (next.includes('https://BASE_URL/') || next.includes('https:\\/\\/BASE_URL\\/')) {
    const experienceBase = `${origin}/api/portal/proxy/${portal}/apps/experiencebuilder/`
    next = next.replaceAll('https://BASE_URL/', experienceBase)
    next = next.replaceAll('https:\\/\\/BASE_URL\\/', escapeSlashUrl(experienceBase))
  }
  if (next.includes('https://API_URL')) {
    next = next.replaceAll(
      'https://API_URL',
      `${origin}/api/portal/proxy/${portal}/jsapi/jsapi4`,
    )
  }
  if (next.includes('https://amd-packages')) {
    next = next.replaceAll(
      'https://amd-packages',
      `${origin}/api/portal/proxy/${portal}/jsapi/jsapi4`,
    )
  }

  const host = req?.headers?.host || origin.replace(/^https?:\/\//, '')
  if (origin.startsWith('https://')) {
    next = next.replaceAll(`http://${host}`, `https://${host}`)
    next = next.replaceAll(`ws://${host}`, `wss://${host}`)
  } else {
    next = next.replaceAll(`https://${host}`, `http://${host}`)
    next = next.replaceAll(`wss://${host}`, `ws://${host}`)
    next = next.replaceAll('"ssl":true', '"ssl":false')
    next = next.replaceAll('"ssl": true', '"ssl": false')
    next = next.replaceAll('"allSSL":true', '"allSSL":false')
    next = next.replaceAll('"allSSL": true', '"allSSL": false')
  }

  return collapseProxyPrefix(next)
}

function injectSslPatch(html) {
  if (!html || !/<head[\s>]/i.test(html) || html.includes('/dashboards/ssl-patch.js')) {
    return html
  }
  return html.replace(/<head[^>]*>/i, (tag) => `${tag}${HTML_SSL_PATCH}`)
}

function rewriteLocation(location, hostKey, req) {
  if (!location) return location
  let next = rewritePortalText(location, req, hostKey, '')
  const { portal, wide } = portalKeys(hostKey)
  if (next.startsWith('/portal/')) next = `/api/portal/proxy/${portal}${next.slice('/portal'.length)}`
  else if (next.startsWith('/sharing/')) next = `/api/portal/proxy/${portal}${next}`
  else if (next.startsWith('/apps/') || next.startsWith('/jsapi/') || next.startsWith('/home/')) {
    next = `/api/portal/proxy/${portal}${next}`
  } else if (
    next.startsWith('/server/') ||
    next.startsWith('/arcgis/') ||
    next.startsWith('/cdn/') ||
    next.startsWith('/assets/')
  ) {
    next = `/api/portal/proxy/${wide}${next}`
  }
  return collapseProxyPrefix(next)
}

/** Vendor and JSAPI bundles stall Node if string-rewritten. */
const HEAVY_REWRITE_BYTES = 100_000
const REWRITE_HOLD = 256

function isScriptBundlePath(restPath = '') {
  const path = String(restPath || '')
  if (/(?:^|\/)jsapi(?:\/|$)/i.test(path)) return true
  if (/apps\/dashboards\/assets\//i.test(path)) return true
  if (/(?:^|\/)assets\/(?:vendor|chunk|nickel|before-amd|ckeditor)/i.test(path)) return true
  if (/jimu-(?:core|ui|arcgis|layouts|theme|for-builder)/i.test(path)) return true
  if (/\/(?:vendor|chunk|polyfill)[^/]*\.js(?:$|\?)/i.test(path)) return true
  return false
}

/**
 * JavaScript bundles are streamed unchanged.
 * HTML, JSON, CSS, and small Experience Builder config scripts are rewritten,
 * including large or chunked Floods JSON, so layer URLs stay on the proxy.
 */
export function shouldPassthroughBody(
  restPath,
  contentType = '',
  byteLength = 0,
  lengthKnown = true,
) {
  const script = /javascript|ecmascript/i.test(contentType)
  if (script || isScriptBundlePath(restPath)) {
    if (isScriptBundlePath(restPath)) return true
    if (!script) return false
    const experienceScript = /experiencebuilder/i.test(String(restPath || ''))
    if (!experienceScript) return true
    if (!lengthKnown || byteLength >= HEAVY_REWRITE_BYTES) return true
    return false
  }
  return false
}

function isRewritableType(contentType = '') {
  return /text\/html|javascript|ecmascript|json|css|text\/plain|xml/i.test(contentType)
}

function createPortalRewriteStream(req, hostKey, restPath, tokenAttached = false) {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  // A body that never outgrew the hold arrives whole in flush: that is where a
  // small portal error body can be inspected.
  let emitted = false
  return new Transform({
    transform(chunk, _encoding, callback) {
      pending += decoder.write(chunk)
      if (pending.length <= REWRITE_HOLD) {
        callback()
        return
      }
      // Cut at a delimiter URLs cannot contain, so no URL is split across two
      // chunks and missed by the rewrites (here and in base-path.js).
      let cut = pending.length - REWRITE_HOLD
      const safe = Math.max(...['"', "'", ',', ' ', '\n', '>', '<'].map((ch) => pending.lastIndexOf(ch, cut)))
      // Only look back a URL's length, so a delimiter-free run cannot pile up.
      if (safe > 0 && safe > cut - 4096) cut = safe
      const head = pending.slice(0, cut)
      pending = pending.slice(cut)
      emitted = true
      callback(null, rewritePortalText(head, req, hostKey, restPath))
    },
    flush(callback) {
      pending += decoder.end()
      if (!emitted) pending = softenPermissionRefusal(pending, tokenAttached)
      if (pending) this.push(rewritePortalText(pending, req, hostKey, restPath))
      callback()
    },
  })
}

/**
 * A timed-out portal body emits `error` on the Readable. With no listener,
 * Node treats that as fatal and the dev server exits, so later maps load
 * half-initialized (Experience Builder then reports missing functions).
 */
export function pipeUpstreamBody(body, res, transform) {
  const source = Readable.fromWeb(body)
  let settled = false
  const stop = () => {
    if (settled) return
    settled = true
    source.destroy()
    if (transform) transform.destroy()
    if (res.writableEnded) return
    if (!res.headersSent) {
      res.statusCode = 504
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Portal request timed out')
      return
    }
    res.end()
  }
  source.on('error', stop)
  if (transform) transform.on('error', stop)
  res.on('error', stop)
  res.on('close', () => source.destroy())
  const output = transform ? source.pipe(transform) : source
  output.pipe(res)
}

async function proxyRequest(req, res, hostKey, restPath, search) {
  if (!isAllowedProxyHostKey(hostKey, PROXY_HOSTS)) {
    sendJson(res, 404, { error: 'Unknown proxy host' })
    return
  }

  if (hostKey !== 'web' && !requireAppGate(req, res)) {
    return
  }

  const sourceBase = PROXY_HOSTS[hostKey]
  const hostMap = readHostTokenMap(
    req.headers.cookie,
    process.env.SESSION_SECRET,
    SESSION_FALLBACK,
  )
  const portalToken =
    hostKey === 'web' ? null : await hostTokenWithRenewal(req, res, hostKey, renewalOpts(hostMap))

  if (hostKey !== 'web' && !portalToken) {
    sendJson(res, 401, {
      error: 'Portal access is not ready for this host',
      portalHostKey: authHostForProxyKey(hostKey),
    })
    return
  }

  const target = new URL(
    normalizeProxyRestPath(hostKey, restPath),
    sourceBase.endsWith('/') ? sourceBase : `${sourceBase}/`,
  )
  new URLSearchParams(search).forEach((value, key) => {
    if (key !== 'token') target.searchParams.set(key, value)
  })

  const normalizedRestEarly = normalizeProxyRestPath(hostKey, restPath)
  const staticAsset = isScriptBundlePath(normalizedRestEarly)
  if (portalToken && !staticAsset) {
    target.searchParams.set('token', portalToken)
  }

  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'DERMA-Portal',
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (portalToken && !staticAsset) {
    headers.authorization = `Bearer ${portalToken}`
    headers.referer = requestOrigin(req)
  }

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req
    init.duplex = 'half'
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch {
    sendJson(res, 502, { error: 'Could not reach the portal' })
    return
  }

  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    const location = upstream.headers.get('location')
    if (location) {
      const rewritten = rewriteLocation(location, hostKey, req)
      redirect(res, rewritten)
      return
    }
  }

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (SKIP_HEADERS.has(key.toLowerCase())) return
    try {
      res.setHeader(key, value)
    } catch {
      // A single bad upstream header must not fail the whole asset.
    }
  })
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  const type = upstream.headers.get('content-type') || ''
  const normalizedRest = normalizeProxyRestPath(hostKey, restPath)
  const lengthHeader = upstream.headers.get('content-length')
  const lengthKnown = lengthHeader != null && String(lengthHeader).trim() !== ''
  const declaredLen = Number(lengthHeader || 0)
  const passThrough =
    !isRewritableType(type) ||
    shouldPassthroughBody(normalizedRest, type, declaredLen, lengthKnown)

  // Vendor and JSAPI bundles stay streamed. Rewriting them freezes Node.
  if (passThrough && upstream.body) {
    pipeUpstreamBody(upstream.body, res)
    return
  }

  res.removeHeader('ETag')
  res.removeHeader('etag')
  res.removeHeader('Last-Modified')
  res.removeHeader('last-modified')
  res.removeHeader('Content-Length')
  res.removeHeader('content-length')
  res.setHeader('Cache-Control', 'no-store')

  const bufferWhole = /text\/html|javascript|ecmascript/i.test(type)
  if (bufferWhole) {
    const buffer = Buffer.from(await upstream.arrayBuffer())
    let text = rewritePortalText(buffer.toString('utf8'), req, hostKey, normalizedRest)
    if (/text\/html/i.test(type)) text = injectSslPatch(text)
    res.setHeader('Content-Length', Buffer.byteLength(text))
    res.end(text)
    return
  }

  if (!upstream.body) {
    res.end()
    return
  }

  // Stream absolute-URL replacement so large Floods JSON cannot block the process.
  pipeUpstreamBody(upstream.body, res, createPortalRewriteStream(req, hostKey, normalizedRest, Boolean(portalToken)))
}

async function hydrateUser(token) {
  const url = `${portalUrl()}/sharing/rest/community/self?f=json&token=${encodeURIComponent(token)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS) })
  if (!response.ok) return { username: 'GeoHub user' }
  const data = await response.json()
  if (data.error) return { username: 'GeoHub user' }
  return {
    username: data.username || data.fullName || 'GeoHub user',
    fullName: data.fullName || data.username,
    email: data.email,
  }
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url

  // The broker mints portal tokens; only a signed-in session may ask.
  if (pathname.startsWith('/api/v1/portal-auth') && !requireAppGate(req, res)) {
    return true
  }

  if (pathname === '/api/auth/ui-session' && req.method === 'POST') {
    // A successful /api/auth/login opens the gate. This only re-affirms a
    // live gate, so it cannot open the gate on its own.
    const gate = readAppGate(req.headers.cookie, process.env.SESSION_SECRET, SESSION_FALLBACK)
    const expiresAt = gate ? gate.expiresAt || Date.now() + 20160 * 1000 : null
    if (!expiresAt) {
      sendJson(res, 401, { error: 'Application login required' })
      return true
    }
    sendJson(res, 200, { authenticated: true, expiresAt })
    return true
  }

  if (pathname === '/api/auth/ui-session' && req.method === 'DELETE') {
    clearAppGateCookie(res)
    clearPortalHostCookie(res)
    sendJson(res, 200, { authenticated: false })
    return true
  }

  // The browser cannot reach generateToken itself (no CORS for this origin), so
  // the login page posts here. Only the outcome is returned, never the token.
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody(req)
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    if (!username || !password) {
      sendJson(res, 400, { error: 'Enter a username and password' })
      return true
    }
    try {
      const tokenData = await generatePortalToken(username, password, req)
      setAppGateCookie(res, Number(tokenData.expires) || Date.now() + 20160 * 1000)
      sendJson(res, 200, {
        authenticated: true,
        user: { username },
        expiresAt: Number(tokenData.expires) || Date.now() + 20160 * 1000,
      })
    } catch (error) {
      sendJson(res, error?.name === 'TimeoutError' ? 504 : 401, {
        error: error?.name === 'TimeoutError' ? 'The mapping portal did not respond in time. Please try again.' : error.message || 'Invalid username or password',
      })
    }
    return true
  }

  if (pathname.startsWith('/api/auth/')) {
    sendJson(res, 404, { error: 'Authentication is disabled' })
    return true
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
      sendJson(res, 400, { error: 'Unsupported portalHostKey' })
      return true
    }
    if (!token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      sendJson(res, 400, { error: 'Invalid portal host session' })
      return true
    }

    const existing = readHostTokenMap(
      req.headers.cookie,
      process.env.SESSION_SECRET,
      SESSION_FALLBACK,
    )
    const next = writeHostTokenMap(existing, portalHostKey, token, expiresAt)
    const maxAgeSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
    setPortalHostCookie(res, next, maxAgeSec)
    sendJson(res, 200, {
      ready: true,
      portalHostKey,
      expiresAt,
    })
    return true
  }

  if (pathname === '/api/portal/host-session' && req.method === 'DELETE') {
    clearPortalHostCookie(res)
    sendJson(res, 200, { cleared: true })
    return true
  }

  if (pathname === '/api/portal/host-session' && req.method === 'GET') {
    if (!requireAppGate(req, res)) return true
    const hostMap = readHostTokenMap(
      req.headers.cookie,
      process.env.SESSION_SECRET,
      SESSION_FALLBACK,
    )
    const requested = String(searchParams.get('portalHostKey') || '')
      .trim()
      .toLowerCase()
    if (requested) {
      sendJson(res, 200, {
        portalHostKey: requested,
        ready: Boolean(hostMap[requested]),
      })
      return true
    }
    sendJson(res, 200, {
      hosts: Object.keys(hostMap),
    })
    return true
  }

  if (pathname === '/api/portal/dev-embed' && req.method === 'GET') {
    if (process.env.ALLOW_DEV_EMBED_BOOTSTRAP !== '1') {
      sendJson(res, 404, { error: 'Not found' })
      return true
    }
    const host = String(searchParams.get('host') || '')
      .trim()
      .toLowerCase()
    const item = String(searchParams.get('item') || '').trim()
    const kind =
      searchParams.get('kind') === 'experience' ? 'experience' : 'dashboard'
    if (!PORTAL_AUTH_HOSTS.has(host) || !item) {
      sendJson(res, 400, { error: 'host and item required' })
      return true
    }

    const origin = publicOrigin(req)
    const brokerRes = await fetch(
      `${(process.env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000').replace(/\/$/, '')}/api/v1/portal-auth/token`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          appKey: 'disaster-emergency-mapping',
          portalHostKey: host,
        }),
      },
    )
    const broker = await brokerRes.json()
    if (!brokerRes.ok || !broker?.token) {
      sendJson(res, 502, { error: 'Broker failed' })
      return true
    }

    setAppGateCookie(res, Number(broker.expiresAt) || Date.now() + 3_600_000)
    const next = writeHostTokenMap({}, host, broker.token, broker.expiresAt)
    setPortalHostCookie(
      res,
      next,
      Math.max(60, Math.floor((broker.expiresAt - Date.now()) / 1000)),
    )

    const path =
      kind === 'experience'
        ? `/api/portal/proxy/${host}/apps/experiencebuilder/experience/?id=${encodeURIComponent(item)}`
        : `/api/portal/proxy/${host}/apps/dashboards/${encodeURIComponent(item)}`
    redirect(res, path)
    return true
  }

  if (pathname === '/api/gis/token') {
    sendJson(res, 404, { error: 'Authentication is disabled' })
    return true
  }

  if (pathname === '/api/gis/bootstrap') {
    const appKey = searchParams.get('app')
    const source = APP_SOURCES[appKey]
    if (!source) {
      sendJson(res, 404, { error: 'Unknown app' })
      return true
    }
    sendJson(res, 200, {
      authenticated: true,
      proxyPath: proxyPathFor(appKey),
      embedUrl: APP_EMBED_URL[appKey],
    })
    return true
  }

  if (pathname === '/api/portal/embed') {
    const appKey = searchParams.get('app')
    const embedUrl = APP_EMBED_URL[appKey]
    if (!embedUrl) {
      sendJson(res, 404, { error: 'Unknown app' })
      return true
    }
    redirect(res, embedUrl)
    return true
  }

  if (pathname.startsWith('/api/portal/proxy/')) {
    const rest = pathname.slice('/api/portal/proxy/'.length)
    const [hostKey, ...parts] = rest.split('/')
    if (!PROXY_HOSTS[hostKey]) {
      sendJson(res, 404, { error: 'Unknown proxy host' })
      return true
    }
    await proxyRequest(req, res, hostKey, parts.join('/') || '.', url.search)
    return true
  }

  return false
}

function hostKeyFromReferer(referer = '') {
  if (referer.includes('/api/portal/proxy/web') || referer.includes('/dashboards/citizen-reporting')) {
    return 'web'
  }
  if (referer.includes('/api/portal/proxy/ewisw')) return 'ewisw'
  if (referer.includes('/api/portal/proxy/ewis')) return 'ewis'
  if (referer.includes('/api/portal/proxy/rmbw')) return 'rmbw'
  if (referer.includes('/api/portal/proxy/rmb') || referer.includes('/dashboards/volcanic')) {
    return 'rmb'
  }
  if (referer.includes('/api/portal/proxy/ghw')) return 'ghw'
  if (referer.includes('/api/portal/proxy/gh') || referer.includes('/dashboards/')) {
    return 'gh'
  }
  return null
}

function isPortalReferer(referer = '') {
  return /\/api\/portal\/proxy\/|\/dashboards\//.test(referer)
}

async function proxyCatchAll(req, res, url) {
  const pathname = url.pathname
  const referer = req.headers.referer || ''
  let fromRef = hostKeyFromReferer(referer)

  if (!fromRef) {
    const hostMap = readHostTokenMap(
      req.headers.cookie,
      process.env.SESSION_SECRET,
      SESSION_FALLBACK,
    )
    const ready = Object.keys(hostMap)
    if (ready.length === 1) {
      fromRef = ready[0]
    }
  }

  let hostKey = null
  let restPath = null

  if (pathname.startsWith('/portal/')) {
    hostKey =
      fromRef === 'ewis' || fromRef === 'ewisw'
        ? 'ewis'
        : fromRef === 'rmb' || fromRef === 'rmbw'
          ? 'rmb'
          : 'gh'
    restPath = pathname.slice('/portal/'.length)
  } else if (pathname.startsWith('/sharing/')) {
    hostKey =
      fromRef === 'ewis' || fromRef === 'ewisw'
        ? 'ewis'
        : fromRef === 'rmb' || fromRef === 'rmbw'
          ? 'rmb'
          : fromRef === 'gh' || fromRef === 'ghw'
            ? 'gh'
            : null
    if (!hostKey) return false
    restPath = pathname.replace(/^\//, '')
  } else if (
    pathname.startsWith('/apps/dashboards') ||
    pathname.startsWith('/apps/experiencebuilder') ||
    pathname.startsWith('/apps/survey123') ||
    pathname.startsWith('/apps/sites') ||
    pathname.startsWith('/jsapi/') ||
    pathname.startsWith('/home/')
  ) {
    hostKey =
      fromRef === 'ewis' || fromRef === 'ewisw'
        ? 'ewis'
        : fromRef === 'rmb' || fromRef === 'rmbw'
          ? 'rmb'
          : 'gh'
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/server/') || pathname.startsWith('/arcgis/')) {
    hostKey =
      fromRef === 'ewis' || fromRef === 'ewisw'
        ? 'ewisw'
        : fromRef === 'rmb' || fromRef === 'rmbw'
          ? 'rmbw'
          : 'ghw'
    restPath = pathname.replace(/^\//, '')
  } else if (
    (pathname.startsWith('/assets/') || pathname.startsWith('/cdn/')) &&
    isPortalReferer(referer)
  ) {
    hostKey =
      fromRef === 'rmb' || fromRef === 'rmbw'
        ? 'rmbw'
        : fromRef === 'ewis' || fromRef === 'ewisw'
          ? 'ewisw'
          : fromRef === 'web'
            ? 'web'
            : 'ghw'
    restPath = pathname.replace(/^\//, '')
  }

  if (!hostKey) return false

  await proxyRequest(req, res, hostKey, restPath, url.search)
  return true
}

function repairMangledOauthRequest(req) {
  const raw = String(req.url || '')
  if (raw.startsWith('/api/portal/proxy/')) return null
  const at = raw.search(/\/sharing\/rest\/+oauth2\/authorize\?/)
  if (at < 0) return null
  return `/api/portal/proxy/gh${raw.slice(at).replace('/sharing/rest//oauth2/', '/sharing/rest/oauth2/')}`
}

function serveNoopServiceWorker(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Service-Worker-Allowed', '/')
  res.setHeader('Cache-Control', 'no-store')
  res.end(
    'self.addEventListener("install",function(){self.skipWaiting()});self.addEventListener("activate",function(){self.clients.claim()});',
  )
}

export function createAccessMiddleware() {
  return async function accessMiddleware(req, res, originalNext) {
    if (req.url === '/') {
      redirect(res, `${BASE_PATH}/`)
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
    try {
      const oauthFix = repairMangledOauthRequest(req)
      if (oauthFix) {
        redirect(res, oauthFix)
        return
      }
      const proto = appIsHttps(req) ? 'https' : 'http'
      const url = new URL(req.url, `${proto}://${req.headers.host || 'localhost'}`)
      if (url.pathname.includes('service-worker.js')) {
        serveNoopServiceWorker(res)
        return
      }
      if (url.pathname.startsWith('/api/')) {
        const handled = await handleApi(req, res, url)
        if (!handled) next()
        return
      }
      if (await proxyCatchAll(req, res, url)) return
      next()
    } catch (error) {
      if (res.headersSent) return void res.end()
      sendJson(res, error?.name === 'TimeoutError' ? 504 : 500, { error: error.message || 'Access server error' })
    }
  }
}
