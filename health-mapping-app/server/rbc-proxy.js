import { BASE_PATH } from './base-path.js'
import { portalFetch } from './portal-fetch.js'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_AUTH_TIMEOUT_MS = 20_000
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const RBC_ORIGIN = (process.env.RBC_ORIGIN || 'https://gis.rbc.gov.rw').replace(/\/$/, '')
const RBC_HOST = new URL(RBC_ORIGIN).host
const ENTRY = '/portal/apps/experiencebuilder/experience/?id=9d6b84d4e7b24d6aa379f0c221f4b264'
const PATCH_TAG = '<script src="/rbc-patch.js"></script>'

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

const MIRROR_PREFIXES = ['/portal/', '/server/', '/sharing/', '/arcgis/']

const cache = { app: null, user: null }
let missingCredsWarned = false

const EXB_BOOT =
  `<script>(function(){try{["esriJSAPIOAuth","esrijsapioauth","esriJSAPIOAuthInfo"].forEach(function(k){localStorage.removeItem(k);sessionStorage.removeItem(k)})}catch(e){}if(navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.resolve({installing:null,waiting:null,active:null,scope:location.origin+"${BASE_PATH}/portal/apps/experiencebuilder/",unregister:function(){return Promise.resolve(true)},update:function(){return Promise.resolve(this)},addEventListener:function(){},removeEventListener:function(){}})}}window.esriConfig=window.esriConfig||{};window.esriConfig.portalUrl=location.origin+"${BASE_PATH}/portal";})()</script>`

function log(...args) {
  console.info('[rbc-proxy]', ...args)
}

function logError(...args) {
  console.error('[rbc-proxy]', ...args)
}

function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '')
  const proto =
    req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')
  return `${proto}://${req.headers.host || 'localhost:5175'}`
}

function isExperienceReferer(referer = '') {
  return /\/portal\/apps\/experiencebuilder|\/rbc\/|\/dashboards\/vaccination/.test(referer)
}

function isMirrorPath(pathname = '') {
  return MIRROR_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  )
}

export function isRbcProxyPath(pathname = '') {
  return pathname === '/rbc' || pathname.startsWith('/rbc/')
}

/**
 * Vaccine Distribution Planning is the only same-origin /portal consumer on
 * Health Mapping (other apps use absolute URLs or /api/portal/proxy/…). Mirror
 * all portal paths unconditionally so EXB fetches without a Referer still hit
 * MoH Enterprise instead of GeoHub.
 */
export function isRbcMirrorRequest(pathname = '', referer = '') {
  if (isRbcProxyPath(pathname)) return true
  if (isMirrorPath(pathname)) return true
  if (!isExperienceReferer(referer)) return false
  return (
    pathname.startsWith('/jsapi/') ||
    pathname.startsWith('/home/') ||
    pathname.startsWith('/apps/') ||
    pathname.startsWith('/cdn/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/jimu-') ||
    pathname.startsWith('/experience/')
  )
}

export function leakedRbcPath(pathname = '', referer = '') {
  return isRbcMirrorRequest(pathname, referer) && !isRbcProxyPath(pathname)
}

function normalizeUpstreamPath(pathname) {
  let rest = pathname
  if (rest === '/rbc' || rest === '/rbc/') return ENTRY.split('?')[0]
  if (rest.startsWith('/rbc/')) rest = rest.slice('/rbc'.length) || '/'
  rest = rest.replace(/^\/+(https?:\/\/[^/]+)/i, '')
  if (!rest.startsWith('/')) rest = `/${rest}`
  if (rest.startsWith('/apps/') || rest.startsWith('/sharing/') || rest.startsWith('/home/')) {
    rest = `/portal${rest}`
  }
  if (rest.startsWith('/jimu-') || rest.startsWith('/experience/') || rest.startsWith('/widgets/')) {
    rest = `/portal/apps/experiencebuilder${rest}`
  }
  return rest.replace(/\/{2,}/g, '/')
}

function tokenKind(pathname) {
  if (SESSION_PATHS.test(pathname)) return 'session'
  if (NO_TOKEN.test(pathname)) return null
  if (!TOKEN_PATHS.some((re) => re.test(pathname))) return null
  if (IDENTITY_PATHS.test(pathname)) {
    const { id, secret } = rbcAppCreds()
    return id && secret ? 'app' : 'user'
  }
  return 'user'
}

function rbcAppCreds() {
  return {
    id: String(process.env.RBC_CLIENT_ID || '').trim(),
    secret: String(process.env.RBC_CLIENT_SECRET || '').trim(),
  }
}

function rbcUserCreds() {
  return {
    username: String(process.env.RBC_USERNAME || process.env.HEALTH_USERNAME || '').trim(),
    password: String(process.env.RBC_PASSWORD || process.env.HEALTH_PASSWORD || '').trim(),
  }
}

function rewriteText(text, origin) {
  const host = new URL(origin).host
  return text
    .replaceAll(RBC_ORIGIN, origin)
    .replaceAll(`http://${RBC_HOST}`, origin)
    .replaceAll(`https:\\/\\/${RBC_HOST}`, origin.replaceAll('/', '\\/'))
    .replaceAll(encodeURIComponent(RBC_ORIGIN), encodeURIComponent(origin))
    .replaceAll(RBC_HOST, host)
    .replace(/https:\/\/BASE_URL/g, `${origin}/portal/apps/experiencebuilder`)
    .replace(/https:\/\/API_URL/g, `${origin}/portal/jsapi/jsapi4`)
    .replace(/https:\/\/amd-packages/g, `${origin}/portal/jsapi/jsapi4`)
}

function rewriteLocation(location, origin) {
  if (!location) return location
  let next = rewriteText(location, origin)
  if (next.startsWith('/rbc/')) next = next.slice('/rbc'.length) || '/'
  if (next === '/rbc') next = ENTRY
  log('rewritten URL', location, '→', next)
  return next
}

function rewriteSetCookie(raw, origin) {
  const https = origin.startsWith('https:')
  return String(raw)
    .split(/,(?=[^;]+=)/)
    .map((cookie) => {
      let next = cookie.trim().replace(/;\s*Domain=[^;]*/gi, '')
      if (/;\s*Path=/i.test(next)) {
        next = next.replace(/;\s*Path=[^;]*/gi, '; Path=/')
      } else {
        next += '; Path=/'
      }
      if (https && !/;\s*Secure/i.test(next)) next += '; Secure'
      if (!https) next = next.replace(/;\s*Secure/gi, '')
      if (!/;\s*SameSite=/i.test(next)) next += '; SameSite=Lax'
      return next
    })
    .join(', ')
}

function injectPatch(html) {
  if (!/<head[\s>]/i.test(html)) return html
  return html.replace(/<head[^>]*>/i, (tag) => `${tag}${PATCH_TAG}${EXB_BOOT}`)
}

function copyRequestHeaders(req, origin) {
  const headers = {
    accept: req.headers.accept || '*/*',
    'accept-encoding': 'identity',
    'user-agent': req.headers['user-agent'] || 'Health-Mapping-RBC-Proxy',
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

function warnMissingCreds() {
  if (missingCredsWarned) return
  missingCredsWarned = true
  logError(
    'Vaccine Distribution Planning needs RBC credentials in .env:',
    'set RBC_USERNAME + RBC_PASSWORD (MoH Enterprise), or RBC_TOKEN.',
    'Without them Experience Builder cannot open the private item and throws an empty promise.',
  )
}

function missingCredsHtml(origin) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Vaccine Distribution Planning</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Segoe UI,system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
  main{max-width:34rem;padding:1.5rem 1.75rem;border:1px solid #334155;border-radius:12px;background:#111827}
  h1{margin:0 0 .5rem;font-size:1.15rem}
  p{margin:.4rem 0;line-height:1.45;color:#cbd5e1}
  code{font-size:.9em;color:#93c5fd}
</style>
</head>
<body>
<main>
  <h1>MoH Enterprise sign-in required</h1>
  <p>Vaccine Distribution Planning is a private Experience Builder app on <code>gis.rbc.gov.rw</code>.</p>
  <p>Add <code>RBC_USERNAME</code> and <code>RBC_PASSWORD</code> (or <code>RBC_TOKEN</code>) to Health Mapping <code>.env</code>, then restart <code>npm run dev</code>.</p>
  <p>Public origin for the token referer must be <code>${origin}</code>.</p>
</main>
</body>
</html>`
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
}

function rewriteOutboundBody(body, origin) {
  if (!body?.length) return body
  const text = body.toString('utf8')
  const next = rewriteText(text, origin)
  return next === text ? body : Buffer.from(next)
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

async function mintAppToken(origin) {
  const { id, secret } = rbcAppCreds()
  if (!id || !secret) return null
  const res = await portalFetch(`${RBC_ORIGIN}/portal/sharing/rest/oauth2/token`, {
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
    logError('app token failed', json.error || json)
    return null
  }
  const expiresIn = Number(json.expires_in || 1800) * 1000
  return { token, expiresAt: Date.now() + expiresIn }
}

async function mintUserToken(origin) {
  const staticToken = String(process.env.RBC_TOKEN || '').trim()
  if (staticToken) {
    const expiresAt =
      Number(process.env.RBC_TOKEN_EXPIRES || '') || Date.now() + 14 * 24 * 60 * 60 * 1000
    return { token: staticToken, expiresAt }
  }

  const { username, password } = rbcUserCreds()
  if (!username || !password) {
    warnMissingCreds()
    return null
  }
  const res = await portalFetch(`${RBC_ORIGIN}/portal/sharing/rest/generateToken`, {
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
    logError('user token failed', json.error || json)
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

async function writeSession(res, origin, url) {
  const token = await portalToken('user', origin)
  const { username } = rbcUserCreds()
  if (!token) return false
  const expires = cache.user?.expiresAt || Date.now() + 60 * 60 * 1000
  const payload = /platformSelf/i.test(url.pathname)
    ? { username, token, ssl: true }
    : { token, expires, ssl: true }
  log('session', url.pathname, 'token?', true)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
  return true
}

function shouldRewrite(contentType = '') {
  return /text\/html|javascript|json|css|text\/plain|xml|ecmascript/.test(contentType)
}

async function forward(req, origin, url, kind, body, retry) {
  const target = new URL(url.pathname + url.search, `${RBC_ORIGIN}/`)
  const token = kind && kind !== 'session' ? await portalToken(kind, origin) : ''
  if (kind && kind !== 'session' && token) target.searchParams.set('token', token)
  if (kind && kind !== 'session' && token) {
    body = applyTokenToBody(body, req.headers['content-type'], token)
  }
  log(kind || 'pass', url.pathname, '→', target.pathname, 'token?', Boolean(token))

  const headers = copyRequestHeaders(req, origin)
  if (body && req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (body?.length) headers['content-length'] = String(body.length)

  const init = { method: req.method, headers, redirect: 'manual' }
  if (body && req.method !== 'GET' && req.method !== 'HEAD') init.body = body

  const upstream = await portalFetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })
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
  return { upstream, buffer }
}

export async function handleRbcProxy(req, res, url) {
  const origin = publicOrigin(req)
  if (url.pathname === '/rbc' || url.pathname === '/rbc/') {
    log('rewritten URL', req.url, '→', ENTRY)
    res.statusCode = 302
    res.setHeader('Location', ENTRY)
    res.end()
    return
  }

  if (url.pathname.startsWith('/rbc/')) {
    const rest = normalizeUpstreamPath(url.pathname)
    const dest = `${rest}${url.search || ''}`
    log('rewritten URL', req.url, '→', dest)
    res.statusCode = 302
    res.setHeader('Location', dest)
    res.end()
    return
  }

  const rest = normalizeUpstreamPath(url.pathname)
  const mirrored = new URL(rest + (url.search || ''), `${origin}/`)
  const kind = tokenKind(mirrored.pathname)
  const body = rewriteOutboundBody(await readBody(req), origin)
  const isExperienceEntry =
    mirrored.pathname.startsWith('/portal/apps/experiencebuilder/experience') &&
    (req.method === 'GET' || req.method === 'HEAD')

  try {
    if (isExperienceEntry) {
      const token = await portalToken('user', origin)
      if (!token) {
        res.statusCode = 503
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
        res.end(missingCredsHtml(origin))
        return
      }
    }

    if (kind === 'session' && (await writeSession(res, origin, mirrored))) return

    const { upstream, buffer } = await forward(req, origin, mirrored, kind, body, false)

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location')
      res.statusCode = upstream.status
      if (location) res.setHeader('Location', rewriteLocation(location, origin))
      res.end()
      return
    }

    res.statusCode = upstream.status
    const setCookies = []
    upstream.headers.forEach((value, key) => {
      const name = key.toLowerCase()
      if (DROP_RES.has(name)) return
      if (name === 'set-cookie') {
        setCookies.push(rewriteSetCookie(value, origin))
        return
      }
      try {
        res.setHeader(key, name === 'location' ? rewriteLocation(value, origin) : value)
      } catch {
        /* HTTP/2 hop-by-hop headers */
      }
    })
    if (setCookies.length) res.setHeader('Set-Cookie', setCookies)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')

    const type = upstream.headers.get('content-type') || ''
    if (shouldRewrite(type)) {
      let text = rewriteText(buffer.toString('utf8'), origin)
      if (/text\/html/i.test(type)) text = injectPatch(text)
      res.end(text)
      return
    }
    if (!buffer.length && upstream.status >= 400) {
      logError('failed resource', mirrored.pathname, 'status', upstream.status)
    }
    res.end(buffer)
  } catch (error) {
    logError('failed resource', rest, error.message)
    if (res.headersSent) return void res.end()
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'RBC proxy upstream failed', target: rest }))
  }
}
