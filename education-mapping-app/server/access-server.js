import crypto from 'node:crypto'
import {
  APP_EMBED_URL,
  APP_SOURCES,
  PORTAL_URL,
  PROXY_HOSTS,
  proxyPathFor,
} from '../src/lib/access.js'
import {
  fallbackProxyTarget,
  isPortalAuthUrl,
  publicOrigin,
  realPortalAuthUrl,
  rewriteLocation,
  rewritePayload,
} from './embed-proxy.js'
import {
  APP_GATE_COOKIE,
  PORTAL_AUTH_HOSTS,
  PORTAL_HOST_COOKIE,
  authHostForProxyKey,
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

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const COOKIE = 'pop_hub_session'
const SESSION_FALLBACK = 'demotrade-dev-session-secret'
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
  appendCookie(res, 'esri_auth', '', 0)
}

function clearSessionCookie(res) {
  appendCookie(res, COOKIE, '', 0)
  appendCookie(res, 'esri_auth', '', 0)
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

async function generatePortalToken(username, password, req) {
  const clientId = process.env.PORTAL_CLIENT_ID || ''
  const clientSecret = process.env.PORTAL_CLIENT_SECRET || ''
  const referer = publicOrigin(req)

  const body = new URLSearchParams({
    username,
    password,
    client: 'referer',
    referer,
    expiration: '20160',
    f: 'json',
  })

  const response = await fetch(`${portalUrl()}/sharing/rest/generateToken`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json()
  if (data?.token) return data

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

  throw new Error(data?.error?.message || 'Invalid username or password')
}

function shouldRewrite(contentType = '') {
  return /text\/html|javascript|json|css|text\/plain|xml/.test(contentType)
}

async function proxyRequest(req, res, hostKey, restPath, search) {
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    isPortalAuthUrl(`/${hostKey}/${restPath || ''}${search || ''}`)
  ) {
    redirect(res, realPortalAuthUrl(hostKey, restPath, search))
    return
  }

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

  const incoming = new URLSearchParams(search)
  const target = new URL(restPath || '.', sourceBase.endsWith('/') ? sourceBase : `${sourceBase}/`)
  incoming.forEach((value, key) => {
    if (key !== 'token') target.searchParams.set(key, value)
  })
  if (portalToken) target.searchParams.set('token', portalToken)

  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'Education-Portal',
    referer: publicOrigin(req),
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (portalToken) {
    headers.authorization = `Bearer ${portalToken}`
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
    const text = rewritePayload(softenPermissionRefusal(await upstream.text(), Boolean(portalToken)), hostKey, req, type)
    res.end(text)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.end(buffer)
}

async function hydrateUser(token) {
  const url = `${portalUrl()}/sharing/rest/community/self?f=json&token=${encodeURIComponent(token)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS) })
  if (!response.ok) return { username: 'User' }
  const data = await response.json()
  if (data.error) return { username: 'User' }
  return {
    username: data.username || data.fullName || 'User',
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
    // live gate, or reissues it for a live login session, so it cannot open
    // the gate on its own.
    const gate = readAppGate(req.headers.cookie, process.env.SESSION_SECRET, SESSION_FALLBACK)
    let expiresAt = gate ? gate.expiresAt || Date.now() + 20160 * 1000 : null
    const s = !gate && readSession(req)
    if (s?.token && !(s.expiresAt && s.expiresAt <= Date.now())) {
      expiresAt = Date.now() + 20160 * 1000
      setAppGateCookie(res, expiresAt)
    }
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
      const user = await hydrateUser(tokenData.token)
      const expiresAt = Number(tokenData.expires) || Date.now() + 20160 * 1000
      setSessionCookie(
        res,
        {
          token: tokenData.token,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          expiresAt,
        },
        Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
      )
      setAppGateCookie(res, Date.now() + 20160 * 1000)
      sendJson(res, 200, { authenticated: true, user })
    } catch (error) {
      sendJson(res, error?.name === 'TimeoutError' ? 504 : 401, {
        error: error?.name === 'TimeoutError' ? 'The mapping portal did not respond in time. Please try again.' : error.message || 'Invalid username or password',
      })
    }
    return true
  }

  if (pathname === '/api/auth/session' && req.method === 'GET') {
    const session = readSession(req)
    if (!session?.token) {
      sendJson(res, 200, { authenticated: false })
      return true
    }
    sendJson(res, 200, {
      authenticated: true,
      user: {
        username: session.username,
        fullName: session.fullName,
        email: session.email,
      },
    })
    return true
  }

  if (pathname === '/api/auth/logout') {
    clearSessionCookie(res)
    if (req.method === 'POST') {
      sendJson(res, 200, { authenticated: false })
      return true
    }
    redirect(res, '/login')
    return true
  }

  if (pathname === '/api/gis/bootstrap') {
    const appKey = searchParams.get('app')
    const session = readSession(req)
    const source = APP_SOURCES[appKey]
    if (!source) {
      sendJson(res, 404, { error: 'Unknown app' })
      return true
    }
    if (!source.public && !session?.token) {
      sendJson(res, 401, { authenticated: false })
      return true
    }
    if (session?.token) {
      const maxAge = Math.max(60, Math.floor(((session.expiresAt || Date.now()) - Date.now()) / 1000) || 20160)
      setSessionCookie(res, session, maxAge)
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
    const session = readSession(req)
    const embedUrl = APP_EMBED_URL[appKey]
    if (!embedUrl) {
      sendJson(res, 404, { error: 'Unknown app' })
      return true
    }
    if (!APP_SOURCES[appKey]?.public && !session?.token) {
      redirect(res, `/login?next=${encodeURIComponent(embedUrl)}`)
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
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const fallback = fallbackProxyTarget(url, req)
      if (fallback) {
        await proxyRequest(req, res, fallback.hostKey, fallback.path, url.search)
        return
      }
      if (!url.pathname.startsWith('/api/')) {
        next()
        return
      }
      const handled = await handleApi(req, res, url)
      if (!handled) next()
    } catch (error) {
      if (res.headersSent) return void res.end()
      sendJson(res, error?.name === 'TimeoutError' ? 504 : 500, { error: error.message || 'Access server error' })
    }
  }
}
