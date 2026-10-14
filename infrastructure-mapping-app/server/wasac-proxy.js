import { softenPermissionRefusal } from './portal-refusal.js'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const WASAC_ORIGIN = 'https://gis.wasac.rw'
const PREFIX = '/wasac'
const ENTRY_PATH = '/portal/apps/experiencebuilder/experience/'
const ENTRY_SEARCH = '?id=5fc41bffcdcb458b90de05e1a6a05c30&page=Kigali-Network'
const PATCH_TAG = '<script src="/wasac-patch.js"></script>'
const EXB_MOUNT = `${PREFIX}/portal/apps/experiencebuilder/`

const DROP_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  // The upstream portal's HSTS must not be forwarded: it would apply the
  // portal's transport policy to this origin and force https on our host.
  'strict-transport-security',
  'public-key-pins',
  'public-key-pins-report-only',
])

function logError(...args) {
  console.error('[wasac-proxy]', ...args)
}

function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '')
  const proto =
    req.headers['x-forwarded-proto'] ||
    (String(process.env.PUBLIC_ORIGIN || '').startsWith('https:') || req.socket?.encrypted
      ? 'https'
      : 'http')
  return `${proto}://${req.headers.host || 'localhost:5174'}`
}

function appIsHttps(req) {
  if (String(process.env.PUBLIC_ORIGIN || '').startsWith('https:')) return true
  if (req.headers['x-forwarded-proto'] === 'https') return true
  return Boolean(req.socket?.encrypted)
}

function escapeSlashUrl(url) {
  return url.replaceAll('/', '\\/')
}

function rewriteBody(text, origin) {
  if (!text) return text
  const local = `${origin}${PREFIX}`
  const hostLocal = `${new URL(origin).host}${PREFIX}`
  const exbRoot = `${PREFIX}/portal/apps/experiencebuilder`
  const exbAbs = `${origin}${exbRoot}`
  let next = text
  const pairs = [
    [WASAC_ORIGIN, local],
    ['http://gis.wasac.rw', local],
    ['//gis.wasac.rw', local],
    ['wss://gis.wasac.rw', `${appWs(origin)}${PREFIX}`],
    ['ws://gis.wasac.rw', `${appWs(origin)}${PREFIX}`],
    ['gis.wasac.rw', hostLocal],
    ['https://BASE_URL', exbAbs],
    ['https://API_URL', `${origin}${PREFIX}/portal/jsapi/jsapi4`],
    ['https://amd-packages', `${origin}${PREFIX}/portal/jsapi/jsapi4`],
  ]
  for (const [from, to] of pairs) {
    next = next.replaceAll(from, to)
    next = next.replaceAll(encodeURIComponent(from), encodeURIComponent(to))
    next = next.replaceAll(escapeSlashUrl(from), escapeSlashUrl(to))
  }
  next = next.replace(/"mountPath"\s*:\s*"\/"/g, `"mountPath": "${EXB_MOUNT}"`)
  next = next.replace(/https:\/\/localhost:5174\/https:\/\//g, 'https://')
  next = next.replaceAll(`${origin}/${origin}`, origin)
  next = next.replace(
    /var context = pathParts && pathParts\.length && pathParts\[0\] !== "home" \? pathParts\[0\] : "\/";\s*if \(context !== "\/"\) \{\s*context = "\/" \+ context \+ "\/";\s*\}/,
    'var context = "/wasac/portal/";',
  )
  next = next.replaceAll('"/portal/', `"${PREFIX}/portal/`)
  next = next.replaceAll("'/portal/", `'${PREFIX}/portal/`)
  next = next.replaceAll('"/apps/', `"${PREFIX}/portal/apps/`)
  next = next.replaceAll("'/apps/", `'${PREFIX}/portal/apps/`)
  next = next.replaceAll('"/sharing/', `"${PREFIX}/portal/sharing/`)
  next = next.replaceAll("'/sharing/", `'${PREFIX}/portal/sharing/`)
  next = next.replaceAll('"/home/', `"${PREFIX}/portal/home/`)
  next = next.replaceAll("'/home/", `'${PREFIX}/portal/home/`)
  next = next.replaceAll('"/server/', `"${PREFIX}/server/`)
  next = next.replaceAll("'/server/", `'${PREFIX}/server/`)
  next = next.replaceAll('"/arcgis/', `"${PREFIX}/arcgis/`)
  next = next.replaceAll("'/arcgis/", `'${PREFIX}/arcgis/`)
  next = next.replaceAll('"/cdn/', `"${PREFIX}/cdn/`)
  next = next.replaceAll("'/cdn/", `'${PREFIX}/cdn/`)
  next = next.replaceAll('"/assets/', `"${PREFIX}/assets/`)
  next = next.replaceAll("'/assets/", `'${PREFIX}/assets/`)
  next = next.replaceAll(`${PREFIX}${PREFIX}/`, `${PREFIX}/`)
  next = next.replaceAll(`${PREFIX}/portal${PREFIX}/portal/`, `${PREFIX}/portal/`)
  return next
}

function appWs(origin) {
  return origin.startsWith('https:') ? origin.replace(/^https:/, 'wss:') : origin.replace(/^http:/, 'ws:')
}

function injectPatch(html) {
  if (!/<head[\s>]/i.test(html)) return html
  if (html.includes(PATCH_TAG)) return html
  return html.replace(/<head[^>]*>/i, (tag) => `${tag}${PATCH_TAG}`)
}

function rewriteLocation(location, origin) {
  if (!location) return location
  let next = location
  next = next.replaceAll(WASAC_ORIGIN, `${origin}${PREFIX}`)
  next = next.replaceAll('http://gis.wasac.rw', `${origin}${PREFIX}`)
  if (next.startsWith('/') && !next.startsWith(`${PREFIX}/`) && next !== PREFIX) {
    if (next.startsWith('/apps/') || next.startsWith('/sharing/') || next.startsWith('/home/')) {
      next = `${PREFIX}/portal${next}`
    } else {
      next = `${PREFIX}${next}`
    }
  }
  next = next.replace(`${PREFIX}${PREFIX}/`, `${PREFIX}/`)
  return next
}

function rewriteCsp(value, origin) {
  if (!value) return value
  let next = value.replaceAll(WASAC_ORIGIN, origin)
  if (/frame-ancestors/i.test(next)) {
    next = next.replace(/frame-ancestors[^;]*/gi, "frame-ancestors 'self'")
  } else {
    next = `${next}; frame-ancestors 'self'`
  }
  return next
}

function rewriteSetCookie(raw, req) {
  const https = appIsHttps(req)
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

function shouldRewriteBody(contentType = '') {
  return /text\/html|javascript|json|css|text\/plain|xml|ecmascript/.test(contentType)
}

function upstreamHeaders(req, origin) {
  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'Infrastructure-WASAC-Proxy',
    'accept-language': req.headers['accept-language'] || 'en',
  }
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (req.headers.cookie) headers.cookie = req.headers.cookie
  if (req.headers.authorization) headers.authorization = req.headers.authorization
  else if (wasacPortalToken() && !/generateToken|oauth2/i.test(req.url || '')) {
    headers.authorization = `Bearer ${wasacPortalToken()}`
  }
  if (req.headers.range) headers.range = req.headers.range

  const referer = req.headers.referer
  if (referer) {
    headers.referer = referer.replaceAll(origin + PREFIX, WASAC_ORIGIN).replaceAll(origin, WASAC_ORIGIN)
  } else {
    headers.referer = `${WASAC_ORIGIN}/portal`
  }
  return headers
}

export function isWasacProxyPath(pathname = '') {
  return pathname === PREFIX || pathname.startsWith(`${PREFIX}/`)
}

export function leakedWasacPath(pathname = '', referer = '') {
  if (!referer.includes(`${PREFIX}/`) && !referer.endsWith(PREFIX) && !referer.includes(`${PREFIX}?`)) {
    return false
  }
  return (
    pathname.startsWith('/portal/') ||
    pathname.startsWith('/sharing/') ||
    pathname.startsWith('/apps/') ||
    pathname.startsWith('/home/') ||
    pathname.startsWith('/server/') ||
    pathname.startsWith('/arcgis/') ||
    pathname.startsWith('/cdn/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/arcgisportal/') ||
    pathname.startsWith('/jimu-') ||
    pathname.startsWith('/experience/') ||
    pathname.startsWith('/widgets/') ||
    pathname.startsWith('/themes/')
  )
}

function normalizeUpstreamPath(pathname) {
  let rest = pathname.slice(PREFIX.length) || '/'
  rest = rest.replace(/^\/+(https?:\/\/[^/]+)/i, '')
  if (!rest.startsWith('/')) rest = `/${rest}`
  while (rest.includes('/wasac/portal/')) rest = rest.replace('/wasac/portal/', '/')
  while (rest.includes('/portal/wasac/portal/')) rest = rest.replace('/portal/wasac/portal/', '/portal/')
  if (rest.startsWith('/apps/') || rest.startsWith('/sharing/') || rest.startsWith('/home/')) {
    rest = `/portal${rest}`
  }
  return rest
}

async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
}

function wasacPortalToken() {
  return String(process.env.WASAC_TOKEN || process.env.WASAC_PORTAL_TOKEN || '').trim()
}

function attachWasacToken(target) {
  const token = wasacPortalToken()
  if (!token) return
  if (/generateToken|oauth2/i.test(target.pathname + target.search)) return
  if (!/\/sharing\//i.test(target.pathname) && !/\/rest\/services\//i.test(target.pathname)) return
  if (!target.searchParams.get('token')) target.searchParams.set('token', token)
}

function toWasacUrl(value, origin) {
  if (!value) return value
  const local = `${origin}${PREFIX}`
  return String(value).replaceAll(local, WASAC_ORIGIN).replaceAll(origin, WASAC_ORIGIN)
}

function rewriteOauthParams(target, origin, body, contentType) {
  const keys = ['redirect_uri', 'redirectUri', 'returnUrl', 'return_url', 'redirect_url']
  for (const key of keys) {
    const val = target.searchParams.get(key)
    if (val) target.searchParams.set(key, toWasacUrl(val, origin))
  }
  if (!body?.length || !/x-www-form-urlencoded/i.test(contentType)) return body
  const params = new URLSearchParams(body.toString('utf8'))
  let changed = false
  for (const key of keys) {
    const val = params.get(key)
    if (!val) continue
    params.set(key, toWasacUrl(val, origin))
    changed = true
  }
  return changed ? Buffer.from(params.toString()) : body
}

function rewriteGenerateTokenBody(buffer, contentType = '') {
  if (!buffer?.length || !/x-www-form-urlencoded/i.test(contentType)) return buffer
  const params = new URLSearchParams(buffer.toString('utf8'))
  params.set('client', 'referer')
  params.set('referer', `${WASAC_ORIGIN}/portal`)
  if (!params.get('expiration')) params.set('expiration', '20160')
  if (!params.get('f')) params.set('f', 'json')
  return Buffer.from(params.toString())
}

export async function handleWasacProxy(req, res, url) {
  const origin = publicOrigin(req)
  if (url.pathname === PREFIX || url.pathname === `${PREFIX}/`) {
    const entry = `${PREFIX}${ENTRY_PATH}${url.search || ENTRY_SEARCH}`
    res.statusCode = 302
    res.setHeader('Location', entry)
    res.end()
    return
  }

  const rest = normalizeUpstreamPath(url.pathname)
  const target = new URL(rest + (url.search || ''), `${WASAC_ORIGIN}/`)
  attachWasacToken(target)
  const contentType = req.headers['content-type'] || ''
  let body = await readRequestBody(req)
  body = rewriteOauthParams(target, origin, body, contentType)
  if (body && /generateToken/i.test(target.pathname)) {
    body = rewriteGenerateTokenBody(body, contentType)
  }

  const init = {
    method: req.method,
    headers: {
      ...upstreamHeaders(req, origin),
      ...(contentType ? { 'content-type': contentType } : {}),
      ...(body && body.length ? { 'content-length': String(body.length) } : {}),
    },
    redirect: 'manual',
  }
  if (body) init.body = body

  let upstream
  try {
    upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })
  } catch (error) {
    logError('failed resource', target.href, error.message)
    res.statusCode = error?.name === 'TimeoutError' ? 504 : 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'WASAC proxy upstream failed', target: target.href }))
    return
  }

  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    const location = upstream.headers.get('location')
    if (location) {
      res.statusCode = upstream.status
      res.setHeader('Location', rewriteLocation(location, origin))
      res.end()
      return
    }
  }

  res.statusCode = upstream.status
  const setCookies = []
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase()
    if (DROP_HEADERS.has(name)) return
    if (name === 'x-frame-options') return
    if (name === 'content-security-policy' || name === 'content-security-policy-report-only') {
      res.setHeader(key, rewriteCsp(value, origin))
      return
    }
    if (name === 'set-cookie') {
      setCookies.push(rewriteSetCookie(value, req))
      return
    }
    if (name === 'location') {
      res.setHeader(key, rewriteLocation(value, origin))
      return
    }
    res.setHeader(key, value)
  })
  if (setCookies.length) res.setHeader('Set-Cookie', setCookies)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (!res.getHeader('content-security-policy')) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
  }

  const type = upstream.headers.get('content-type') || ''
  if (shouldRewriteBody(type)) {
    let text = rewriteBody(
      softenPermissionRefusal(await upstream.text(), target.searchParams.has('token')),
      origin,
    )
    if (/text\/html/i.test(type)) text = injectPatch(text)
    res.end(text)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (!buffer.length && upstream.status >= 400) {
    logError('failed resource', target.href, 'status', upstream.status)
  }
  res.end(buffer)
}
