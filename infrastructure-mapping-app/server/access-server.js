import {
  APP_EMBED_URL,
  APP_SOURCES,
  COK_ORIGIN,
  COK_PORTAL_URL,
  PORTAL_ORIGIN,
  PORTAL_URL,
  PROXY_HOSTS,
  REG_ORIGIN,
  REG_PORTAL_URL,
  RURA_ORIGIN,
  RURA_PORTAL_URL,
  WASAC_ORIGIN,
  WASAC_PORTAL_URL,
  proxyPathFor,
} from '../src/lib/access.js'
import {
  APP_GATE_COOKIE,
  PORTAL_AUTH_HOSTS,
  PORTAL_HOST_COOKIE,
  authHostForProxyKey,
  isAllowedProxyHostKey,
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
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const SESSION_FALLBACK = 'infra-dev-session-secret'
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

const PROXY_KEY_RE = 'gh2w|gh2|gh|ghw|wasacw|wasac|ruraw|rura|regw|reg|cokw|cok|web'

function appIsHttps(req) {
  if (String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')) return true
  return req?.headers['x-forwarded-proto'] === 'https'
}

function cookieSecure() {
  return String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')
}

function cookieAttrs(maxAgeSec) {
  const secure = cookieSecure() ? '; Secure' : ''
  const age = maxAgeSec == null ? '0' : String(maxAgeSec)
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${secure}`
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

const HTML_SSL_PATCH = `<script src="/dashboards/ssl-patch.js"></script>`

const ORIGIN_REWRITES = [
  [PORTAL_URL, '/api/portal/proxy/gh'],
  [WASAC_PORTAL_URL, '/api/portal/proxy/wasac'],
  [RURA_PORTAL_URL, '/api/portal/proxy/rura'],
  [REG_PORTAL_URL, '/api/portal/proxy/reg'],
  [COK_PORTAL_URL, '/api/portal/proxy/cok'],
  [PORTAL_ORIGIN, '/api/portal/proxy/ghw'],
  [WASAC_ORIGIN, '/api/portal/proxy/wasacw'],
  [RURA_ORIGIN, '/api/portal/proxy/ruraw'],
  [REG_ORIGIN, '/api/portal/proxy/regw'],
  [COK_ORIGIN, '/api/portal/proxy/cokw'],
]

/**
 * gh2 is GeoHub under the Runtime Config "geohub2" credential: same URLs as gh,
 * so a gh2 response must have GeoHub URLs pointed back at the gh2 proxy keys,
 * or its follow-up calls would carry the gh token and items shared only with
 * geohub2 would be refused.
 */
const GH2_ORIGIN_REWRITES = ORIGIN_REWRITES.map(([from, to]) => [
  from,
  to.replace(/\/api\/portal\/proxy\/gh(w?)$/, '/api/portal/proxy/gh2$1'),
])

function originRewritesFor(hostKey) {
  return portalKeys(hostKey).portal === 'gh2' ? GH2_ORIGIN_REWRITES : ORIGIN_REWRITES
}

function escapeSlashUrl(url) {
  return url.replaceAll('/', '\\/')
}

function portalKeys(hostKey) {
  if (hostKey === 'wasac' || hostKey === 'wasacw') return { portal: 'wasac', wide: 'wasacw' }
  if (hostKey === 'rura' || hostKey === 'ruraw') return { portal: 'rura', wide: 'ruraw' }
  if (hostKey === 'reg' || hostKey === 'regw') return { portal: 'reg', wide: 'regw' }
  if (hostKey === 'cok' || hostKey === 'cokw') return { portal: 'cok', wide: 'cokw' }
  if (hostKey === 'web') return { portal: 'web', wide: 'web' }
  if (hostKey === 'gh2' || hostKey === 'gh2w') return { portal: 'gh2', wide: 'gh2w' }
  return { portal: 'gh', wide: 'ghw' }
}

function collapseProxyPrefix(text) {
  return text.replace(
    new RegExp(`/api/portal/proxy/(?:${PROXY_KEY_RE})(?=/api/portal/proxy/)`, 'g'),
    '',
  )
}

function normalizeProxyRestPath(hostKey, restPath) {
  let path = String(restPath || '').replace(/^\/+/, '')
  path = path.replace(new RegExp(`^(?:api/portal/proxy/(?:${PROXY_KEY_RE})/)+`), '')
  return path || '.'
}

function rewriteQuotedPath(text, from, to) {
  return text
    .replaceAll(`"${from}`, `"${to}`)
    .replaceAll(`'${from}`, `'${to}`)
    .replaceAll(`\`${from}`, `\`${to}`)
    .replaceAll(`(${from}`, `(${to}`)
    .replaceAll(`url(${from}`, `url(${to}`)
    .replaceAll(`url("${from}`, `url("${to}`)
    .replaceAll(`url('${from}`, `url('${to}`)
}

function rewriteLocation(location, hostKey, req) {
  if (!location) return location
  const https = appIsHttps(req)
  const host = req.headers.host || 'localhost:5174'
  let next = location
  for (const [from, to] of originRewritesFor(hostKey)) {
    next = next.replaceAll(from, to)
  }
  const { portal, wide } = portalKeys(hostKey)
  if (next.startsWith('/portal/')) next = `/api/portal/proxy/${portal}${next.slice('/portal'.length)}`
  else if (next.startsWith('/sharing/')) next = `/api/portal/proxy/${portal}${next}`
  else if (next.startsWith('/apps/')) next = `/api/portal/proxy/${portal}${next}`
  else if (next.startsWith('/jsapi/') || next.startsWith('/home/')) {
    next = `/api/portal/proxy/${portal}${next}`
  }
  else if (next.startsWith('/server/') || next.startsWith('/arcgis/')) {
    next = `/api/portal/proxy/${wide}${next}`
  }
  if (https) {
    next = next.replaceAll(`http://${host}`, `https://${host}`)
  } else {
    next = next.replaceAll(`https://${host}`, `http://${host}`)
  }
  return collapseProxyPrefix(next)
}

const HEAVY_REWRITE_BYTES = 250_000

function rewritePayload(text, ...rest) {
  return keepStoryMapLinks(text, (t) => rewritePayloadUnshielded(t, ...rest))
}

function rewritePayloadUnshielded(text, hostKey, req, contentType = '', restPath = '') {
  const origin = PROXY_HOSTS[hostKey]
  if (!origin || !text) return text
  const host = req?.headers?.host || 'localhost:5174'
  const https = appIsHttps(req)
  const { portal, wide } = portalKeys(hostKey)
  const isJs = /javascript|ecmascript|application\/json/i.test(contentType)
  const isHtml = /text\/html/i.test(contentType)
  const isJsapiPath = /(?:^|\/)jsapi(?:\/|$)/i.test(String(restPath || ''))
  const lightOnly =
    !isHtml && (isJsapiPath || (isJs && text.length >= HEAVY_REWRITE_BYTES))

  let next = text
  for (const [from, to] of originRewritesFor(hostKey)) {
    next = next.replaceAll(from, to)
    next = next.replaceAll(encodeURIComponent(from), encodeURIComponent(to))
    next = next.replaceAll(escapeSlashUrl(from), escapeSlashUrl(to))
  }

  if (!lightOnly) {
    next = rewriteQuotedPath(next, '/portal/', `/api/portal/proxy/${portal}/`)
    next = rewriteQuotedPath(next, '/sharing/', `/api/portal/proxy/${portal}/sharing/`)
    next = rewriteQuotedPath(next, '/apps/', `/api/portal/proxy/${portal}/apps/`)
    next = rewriteQuotedPath(next, '/jsapi/', `/api/portal/proxy/${portal}/jsapi/`)
    next = rewriteQuotedPath(next, '/home/', `/api/portal/proxy/${portal}/home/`)
    next = rewriteQuotedPath(next, '/assets/', `/api/portal/proxy/${wide}/assets/`)
    next = rewriteQuotedPath(next, '/cdn/', `/api/portal/proxy/${wide}/cdn/`)
    next = rewriteQuotedPath(next, '/server/', `/api/portal/proxy/${wide}/server/`)
    next = rewriteQuotedPath(next, '/arcgis/', `/api/portal/proxy/${wide}/arcgis/`)
  }

  if (https) {
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

  next = collapseProxyPrefix(next)

  if (isHtml && /<head[\s>]/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (tag) => `${tag}${HTML_SSL_PATCH}`)
  }

  return next
}

function shouldRewrite(contentType = '') {
  return /text\/html|javascript|json|css|text\/plain|xml/.test(contentType)
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

  if (portalToken) {
    target.searchParams.set('token', portalToken)
  }

  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'Infrastructure-Mapping',
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (portalToken) {
    headers.authorization = `Bearer ${portalToken}`
    headers.referer = publicOrigin(req)
  }

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req
    init.duplex = 'half'
  }

  const upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })

  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    const location = upstream.headers.get('location')
    if (location) {
      redirect(res, rewriteLocation(location, hostKey, req))
      return
    }
  }

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value)
  })
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  const type = upstream.headers.get('content-type') || ''
  if (shouldRewrite(type)) {
    const text = rewritePayload(
      softenPermissionRefusal(await upstream.text(), Boolean(portalToken)),
      hostKey,
      req,
      type,
      normalizeProxyRestPath(hostKey, restPath),
    )
    res.end(text)
    return
  }

  res.end(Buffer.from(await upstream.arrayBuffer()))
}

// Upstream time limit for the login check.
const PORTAL_AUTH_TIMEOUT_MS = 20_000

/**
 * Checks GeoHub credentials from the server, where the portal's missing CORS
 * header does not apply. The token only proves the login and is discarded.
 */
async function verifyPortalCredentials(username, password, req) {
  const body = new URLSearchParams({
    username,
    password,
    client: 'referer',
    referer: publicOrigin(req),
    expiration: '20160',
    f: 'json',
  })
  const response = await fetch(`${PORTAL_URL.replace(/\/$/, '')}/sharing/rest/generateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
  })
  const data = await response.json()
  if (!data?.token) {
    throw new Error(data?.error?.message || data?.error?.details?.[0] || 'Invalid username or password')
  }
  return data
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
      const tokenData = await verifyPortalCredentials(username, password, req)
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
  if (referer.includes('/api/portal/proxy/web')) return 'web'
  if (referer.includes('/api/portal/proxy/wasacw')) return 'wasacw'
  if (referer.includes('/api/portal/proxy/wasac')) return 'wasac'
  if (referer.includes('/api/portal/proxy/ruraw')) return 'ruraw'
  if (referer.includes('/api/portal/proxy/rura')) return 'rura'
  if (referer.includes('/api/portal/proxy/regw')) return 'regw'
  if (referer.includes('/api/portal/proxy/reg')) return 'reg'
  if (referer.includes('/api/portal/proxy/cokw')) return 'cokw'
  if (referer.includes('/api/portal/proxy/cok')) return 'cok'
  // gh2 before gh: '/api/portal/proxy/gh2' also contains '/api/portal/proxy/gh'.
  if (referer.includes('/api/portal/proxy/gh2w')) return 'gh2w'
  if (referer.includes('/api/portal/proxy/gh2')) return 'gh2'
  if (referer.includes('/api/portal/proxy/ghw')) return 'ghw'
  if (referer.includes('/api/portal/proxy/gh')) return 'gh'
  return null
}

function isPortalReferer(referer = '') {
  return /\/api\/portal\/proxy\//.test(referer)
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

  if (pathname.startsWith('/sharing/') || pathname.startsWith('/apps/') || pathname.startsWith('/jsapi/') || pathname.startsWith('/home/')) {
    hostKey =
      fromRef === 'wasac' || fromRef === 'wasacw'
        ? 'wasac'
        : fromRef === 'rura' || fromRef === 'ruraw'
          ? 'rura'
          : fromRef === 'reg' || fromRef === 'regw'
            ? 'reg'
            : fromRef === 'cok' || fromRef === 'cokw'
              ? 'cok'
              : fromRef === 'gh2' || fromRef === 'gh2w'
                ? 'gh2'
                : fromRef === 'gh' || fromRef === 'ghw'
                  ? 'gh'
                  : null
    if (!hostKey) return false
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/server/') || pathname.startsWith('/arcgis/')) {
    hostKey =
      fromRef === 'wasac' || fromRef === 'wasacw'
        ? 'wasacw'
        : fromRef === 'rura' || fromRef === 'ruraw'
          ? 'ruraw'
          : fromRef === 'reg' || fromRef === 'regw'
            ? 'regw'
            : fromRef === 'cok' || fromRef === 'cokw'
              ? 'cokw'
              : fromRef === 'gh2' || fromRef === 'gh2w'
                ? 'gh2w'
                : 'ghw'
    restPath = pathname.replace(/^\//, '')
  } else if (
    (pathname.startsWith('/assets/') || pathname.startsWith('/cdn/')) &&
    isPortalReferer(referer)
  ) {
    const keys = portalKeys(fromRef || 'ghw')
    hostKey = keys.wide
    restPath = pathname.replace(/^\//, '')
  }

  if (!hostKey) return false

  await proxyRequest(req, res, hostKey, restPath, url.search)
  return true
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
      const proto = appIsHttps(req) ? 'https' : 'http'
      const url = new URL(req.url, `${proto}://${req.headers.host || 'localhost'}`)
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
