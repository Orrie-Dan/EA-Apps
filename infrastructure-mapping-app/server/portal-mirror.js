import { softenPermissionRefusal } from './portal-refusal.js'
import { BASE_PATH, rewriteResponsesUnderBasePath, stripBasePath } from './base-path.js'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const UPSTREAM = (process.env.WASAC_ORIGIN || 'https://gis.wasac.rw').replace(/\/$/, '')
const UPSTREAM_HOST = new URL(UPSTREAM).host
const MIRROR_PREFIXES = ['/portal/', '/server/', '/sharing/', '/arcgis/']

const NO_TOKEN = /\/oauth2\/authorize|\/oauth2\/token\b|\/oauth2\/registerApp|\/signin|oauth-callback/i
const SESSION_PATHS = /generateToken|\/oauth2\/platformSelf/i
const IDENTITY_PATHS = /\/(?:portals|community)\/self\b|\/community\/users\//i
const TOKEN_PATHS = [/^\/portal\/sharing\//, /^\/sharing\//, /^\/server\//, /^\/arcgis\//]

const DROP_REQ = new Set([
  'host',
  'connection',
  'keep-alive',
  'upgrade',
  'proxy-connection',
  'content-length',
  'transfer-encoding',
])
const DROP_RES = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'proxy-connection',
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  // The upstream portal's HSTS must not be forwarded: it would apply the
  // portal's transport policy to this origin and force https on our host.
  'strict-transport-security',
  'public-key-pins',
  'public-key-pins-report-only',
  'set-cookie',
])

const cache = { app: null, user: null }

function isMirrorPath(pathname) {
  return MIRROR_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  )
}

function tokenKind(pathname) {
  if (SESSION_PATHS.test(pathname)) return 'session'
  if (NO_TOKEN.test(pathname)) return null
  if (!TOKEN_PATHS.some((re) => re.test(pathname))) return null
  if (IDENTITY_PATHS.test(pathname)) {
    const { id, secret } = wasacAppCreds()
    return id && secret ? 'app' : 'user'
  }
  return 'user'
}

function requestOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '')
  const proto =
    req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')
  const host = String(req.headers[':authority'] || req.headers.host || 'localhost:5174')
  return `${proto}://${host}`
}

function rewriteText(text, origin) {
  const host = new URL(origin).host
  return text
    .replaceAll(UPSTREAM, origin)
    .replaceAll(`http://${UPSTREAM_HOST}`, origin)
    .replaceAll(`https:\\/\\/${UPSTREAM_HOST}`, origin.replaceAll('/', '\\/'))
    .replaceAll(encodeURIComponent(UPSTREAM), encodeURIComponent(origin))
    .replaceAll(UPSTREAM_HOST, host)
}

const EXB_BOOT =
  `<script>(function(){try{["esriJSAPIOAuth","esrijsapioauth","esriJSAPIOAuthInfo"].forEach(function(k){localStorage.removeItem(k);sessionStorage.removeItem(k)})}catch(e){}if(navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.resolve({installing:null,waiting:null,active:null,scope:location.origin+"${BASE_PATH}/portal/apps/experiencebuilder/",unregister:function(){return Promise.resolve(true)},update:function(){return Promise.resolve(this)},addEventListener:function(){},removeEventListener:function(){}})}}window.esriConfig=window.esriConfig||{};window.esriConfig.portalUrl=location.origin+"${BASE_PATH}/portal";})()</script>`

function injectExbBoot(html) {
  if (!/<head/i.test(html) || html.includes('esriJSAPIOAuthInfo')) return html
  return html.replace(/<head[^>]*>/i, (tag) => `${tag}${EXB_BOOT}`)
}

function rewriteLocation(location, origin) {
  if (!location) return location
  return rewriteText(location, origin)
}

function wasacAppCreds() {
  const wasacId = String(process.env.WASAC_CLIENT_ID || '').trim()
  const wasacSecret = String(process.env.WASAC_CLIENT_SECRET || '').trim()
  if (wasacId && wasacSecret) return { id: wasacId, secret: wasacSecret }

  const portalUrl = String(process.env.PORTAL_URL || '').toLowerCase()
  if (!portalUrl.includes('gis.wasac.rw')) return { id: '', secret: '' }

  return {
    id: String(process.env.PORTAL_CLIENT_ID || '').trim(),
    secret: String(process.env.PORTAL_CLIENT_SECRET || '').trim(),
  }
}

async function mintAppToken(origin) {
  const { id, secret } = wasacAppCreds()
  if (!id || !secret) return null
  const res = await fetch(`${UPSTREAM}/portal/sharing/rest/oauth2/token`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${origin}/`,
      origin,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
      f: 'json',
    }),
  })
  const json = await res.json().catch(() => ({}))
  const token = json.access_token || json.token
  if (!token) {
    console.error('[mirror] app token failed', json.error || json)
    return null
  }
  const expiresIn = Number(json.expires_in || 1800) * 1000
  return { token, expiresAt: Date.now() + expiresIn }
}

async function mintUserToken(origin) {
  const username = String(process.env.INFRA_USERNAME || process.env.WASAC_USERNAME || '').trim()
  const password = String(process.env.INFRA_PASSWORD || process.env.WASAC_PASSWORD || '').trim()
  if (!username || !password) return null
  const res = await fetch(`${UPSTREAM}/portal/sharing/rest/generateToken`, {
    signal: AbortSignal.timeout(PORTAL_AUTH_TIMEOUT_MS),
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${origin}/`,
      origin,
    },
    body: new URLSearchParams({
      username,
      password,
      client: 'referer',
      referer: `${origin}/`,
      expiration: '60',
      f: 'json',
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.token) {
    console.error('[mirror] user token failed', json.error || json)
    return null
  }
  const expiresAt = Number(json.expires) || Date.now() + 60 * 60 * 1000
  return { token: json.token, expiresAt }
}

async function portalToken(kind, origin) {
  const hit = cache[kind]
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token
  cache[kind] =
    kind === 'app' ? await mintAppToken(origin) : (await mintUserToken(origin)) || (await mintAppToken(origin))
  return cache[kind]?.token || ''
}

function copyRequestHeaders(req, origin) {
  const headers = {
    accept: req.headers.accept || '*/*',
    'accept-encoding': 'identity',
    'user-agent': req.headers['user-agent'] || 'Infrastructure-Portal-Mirror',
    referer: `${origin}/`,
    origin,
  }
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || key.startsWith(':')) continue
    const name = key.toLowerCase()
    if (
      DROP_REQ.has(name) ||
      name === 'cookie' ||
      name === 'referer' ||
      name === 'origin' ||
      name === 'authorization'
    ) {
      continue
    }
    headers[name] = value
  }
  return headers
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
}

function shouldRewrite(contentType = '') {
  return /text\/html|javascript|json|css|text\/plain|xml|ecmascript/.test(contentType)
}

function applyTokenToBody(body, contentType, token) {
  if (!body?.length || !token) return body
  const type = String(contentType || '')
  if (type.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body.toString('utf8'))
    params.set('token', token)
    return Buffer.from(params.toString())
  }
  if (type.includes('application/json')) {
    try {
      const json = JSON.parse(body.toString('utf8'))
      if (json && typeof json === 'object' && !Array.isArray(json)) json.token = token
      return Buffer.from(JSON.stringify(json))
    } catch {
      return body
    }
  }
  return body
}

async function writeSession(res, origin, url) {
  const token = await portalToken('user', origin)
  const username = String(process.env.INFRA_USERNAME || process.env.WASAC_USERNAME || '').trim()
  if (!token) return false
  const expires = cache.user?.expiresAt || Date.now() + 60 * 60 * 1000
  const payload = /platformSelf/i.test(url.pathname)
    ? { username, token, ssl: true }
    : { token, expires, ssl: true }
  console.log('[mirror]', 'session', url.pathname, 'token?', true)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
  return true
}

async function forward(req, origin, url, kind, body, retry) {
  const target = new URL(url.pathname + url.search, `${UPSTREAM}/`)
  const token = kind && kind !== 'session' ? await portalToken(kind, origin) : ''
  if (kind && kind !== 'session' && token) target.searchParams.set('token', token)
  if (kind && kind !== 'session' && token) {
    body = applyTokenToBody(body, req.headers['content-type'], token)
  }
  console.log('[mirror]', kind, url.pathname, 'token?', Boolean(token))

  const headers = copyRequestHeaders(req, origin)
  if (body && req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (body?.length) headers['content-length'] = String(body.length)

  const init = { method: req.method, headers, redirect: 'manual' }
  if (body && req.method !== 'GET' && req.method !== 'HEAD') init.body = body

  const upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })
  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (
    !retry &&
    kind &&
    cache[kind] &&
    /"code"\s*:\s*(?:498|499)/.test(buffer.toString('utf8', 0, 256))
  ) {
    cache[kind] = null
    return forward(req, origin, url, kind, body, true)
  }
  return { upstream, buffer, tokenAttached: target.searchParams.has('token') }
}

export function createPortalMirror() {
  return async function portalMirror(req, res, next) {
    try {
      const origin = requestOrigin(req)
      // Mirror paths arrive under the app's base; match and forward them without it.
      const raw = req.originalUrl || req.url
      const url = new URL(stripBasePath(raw) ?? raw, `${origin}/`)
      if (!isMirrorPath(url.pathname)) {
        next()
        return
      }
      rewriteResponsesUnderBasePath(req, res)

      const kind = tokenKind(url.pathname)
      const body = await readBody(req)
      if (kind === 'session' && (await writeSession(res, origin, url))) return

      const { upstream, buffer, tokenAttached } = await forward(req, origin, url, kind, body, false)

      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        const location = upstream.headers.get('location')
        res.statusCode = upstream.status
        if (location) {
          try {
            res.setHeader('Location', rewriteLocation(location, origin))
          } catch {
            /* ignore */
          }
        }
        res.end()
        return
      }

      res.statusCode = upstream.status
      upstream.headers.forEach((value, key) => {
        const name = key.toLowerCase()
        if (DROP_RES.has(name)) return
        try {
          res.setHeader(key, name === 'location' ? rewriteLocation(value, origin) : value)
        } catch {
          /* HTTP/2 forbids some hop-by-hop headers */
        }
      })

      const type = upstream.headers.get('content-type') || ''
      if (shouldRewrite(type)) {
        let text = rewriteText(softenPermissionRefusal(buffer.toString('utf8'), tokenAttached), origin)
        if (/text\/html/i.test(type)) text = injectExbBoot(text)
        res.end(text)
        return
      }
      res.end(buffer)
    } catch (error) {
      if (res.headersSent) return void res.end()
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: error.message || 'portal mirror failed' }))
    }
  }
}
