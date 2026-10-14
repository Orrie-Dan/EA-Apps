import {
  APP_EMBED_URL,
  APP_SOURCES,
  PORTAL_ORIGIN,
  PORTAL_URL,
  PROXY_HOSTS,
  RBC_ORIGIN,
  RBC_PORTAL_URL,
  RMB_ORIGIN,
  RMB_PORTAL_URL,
  ESRIRW_ORIGIN,
  ESRIRW_PORTAL_URL,
  proxyPathFor,
} from '../src/lib/access.js'
import { handleRbcProxy, isRbcMirrorRequest, isRbcProxyPath } from './rbc-proxy.js'
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
import { portalFetch } from './portal-fetch.js'
import { BASE_PATH, rewriteResponsesUnderBasePath, stripBasePath } from './base-path.js'
import { keepStoryMapLinks } from './storymap-links.js'

// Upstream time limits. Without them a slow or unreachable portal left the
// request — and the dashboard frame waiting on it — pending indefinitely.
const PORTAL_PROXY_TIMEOUT_MS = 120_000

const SESSION_FALLBACK = 'health-dev-session-secret'

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

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
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

const HTML_SSL_PATCH = `<script src="/dashboards/ssl-patch.js"></script>`
const HTML_ESRIRW_PATCH = `<script src="/dashboards/esrirw-patch.js"></script>`
const PROXY_KEY_RE = 'gh2w|gh2|gh|ghw|rmb|rmbw|rbc|rbcw|web|esrirw|esrirww|s123'

const ORIGIN_REWRITES = [
  [PORTAL_URL, '/api/portal/proxy/gh'],
  [PORTAL_ORIGIN, '/api/portal/proxy/ghw'],
  [RMB_PORTAL_URL, '/api/portal/proxy/rmb'],
  [RMB_ORIGIN, '/api/portal/proxy/rmbw'],
  [RBC_PORTAL_URL, '/api/portal/proxy/rbc'],
  [RBC_ORIGIN, '/api/portal/proxy/rbcw'],
  [ESRIRW_PORTAL_URL, '/api/portal/proxy/esrirw'],
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
  if (hostKey === 'rmb' || hostKey === 'rmbw') return { portal: 'rmb', wide: 'rmbw' }
  if (hostKey === 'rbc' || hostKey === 'rbcw') return { portal: 'rbc', wide: 'rbcw' }
  if (hostKey === 'esrirw' || hostKey === 'esrirww') return { portal: 'esrirw', wide: 'esrirww' }
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

function requestOrigin(req) {
  const host = req?.headers?.host || 'localhost:5175'
  return `${appIsHttps(req) ? 'https' : 'http'}://${host}`
}

function absolutizeProxyUrls(text, req) {
  const origin = requestOrigin(req)
  let next = String(text || '')
  next = next.replaceAll(`${origin}/https://`, 'https://')
  next = next.replaceAll(`${origin}/http://`, 'http://')
  next = next.replaceAll(`${origin}/${origin}`, origin)
  next = next.replaceAll(`${origin}/api/portal/proxy/`, '/api/portal/proxy/')
  // Drop hostKey glued onto absolute URLs before absolutizing.
  next = next.replace(
    new RegExp(`/api/portal/proxy/(?:${PROXY_KEY_RE})(?=https?:)`, 'gi'),
    '',
  )
  next = next.replaceAll('/api/portal/proxy/', `${origin}/api/portal/proxy/`)
  next = next.replaceAll(`${origin}/${origin}`, origin)
  next = next.replaceAll(`${origin}/https://`, 'https://')
  next = next.replace(
    new RegExp(
      `${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/portal/proxy/(?:${PROXY_KEY_RE})(?=https?:)`,
      'gi',
    ),
    '',
  )
  return next
}

function rewriteLocation(location, hostKey, req) {
  if (!location) return location
  const https = appIsHttps(req)
  const host = req.headers.host || 'localhost:5175'
  let next = location
  for (const [from, to] of originRewritesFor(hostKey)) {
    next = next.replaceAll(from, to)
  }
  next = next.replace(/https:\/\/esrirw\.rw(?!:)/g, '/api/portal/proxy/esrirww')
  const { portal, wide } = portalKeys(hostKey)
  if (next.startsWith('/portal/')) next = `/api/portal/proxy/${portal}${next.slice('/portal'.length)}`
  else if (next.startsWith('/sharing/')) next = `/api/portal/proxy/${portal}${next}`
  else if (next.startsWith('/apps/')) next = `/api/portal/proxy/${portal}${next}`
  else if (next.startsWith('/server/') || next.startsWith('/arcgis/') || next.startsWith('/missionserver/')) {
    next = `/api/portal/proxy/${wide}${next}`
  }
  if (https) {
    next = next.replaceAll(`http://${host}`, `https://${host}`)
  } else {
    next = next.replaceAll(`https://${host}`, `http://${host}`)
  }
  return absolutizeProxyUrls(collapseProxyPrefix(next), req)
}

function rewritePayload(text, ...rest) {
  return keepStoryMapLinks(text, (t) => rewritePayloadUnshielded(t, ...rest))
}

function rewritePayloadUnshielded(text, hostKey, req, contentType = '') {
  const origin = PROXY_HOSTS[hostKey]
  if (!origin || !text) return text
  // Survey123 serves relative assets and takes its portal from ?portalUrl=,
  // so the portal-path rewrites below would only corrupt it.
  if (hostKey === 's123') return text
  const host = req?.headers?.host || 'localhost:5175'
  const https = appIsHttps(req)
  const { portal, wide } = portalKeys(hostKey)

  let next = text
  for (const [from, to] of originRewritesFor(hostKey)) {
    next = next.replaceAll(from, to)
    next = next.replaceAll(encodeURIComponent(from), encodeURIComponent(to))
    next = next.replaceAll(escapeSlashUrl(from), escapeSlashUrl(to))
  }
  next = next.replace(/https:\/\/esrirw\.rw(?!:)/g, '/api/portal/proxy/esrirww')
  next = next.replaceAll(encodeURIComponent('https://esrirw.rw/'), encodeURIComponent('/api/portal/proxy/esrirww/'))
  next = next.replaceAll('https:\\/\\/esrirw.rw\\/', '\\/api\\/portal\\/proxy\\/esrirww\\/')

  next = rewriteQuotedPath(next, '/portal/', `/api/portal/proxy/${portal}/`)
  next = rewriteQuotedPath(next, '/sharing/', `/api/portal/proxy/${portal}/sharing/`)
  if (!/javascript|ecmascript/i.test(contentType)) {
    next = rewriteQuotedPath(next, '/apps/', `/api/portal/proxy/${portal}/apps/`)
    next = rewriteQuotedPath(next, '/assets/', `/api/portal/proxy/${wide}/assets/`)
    next = rewriteQuotedPath(next, '/cdn/', `/api/portal/proxy/${wide}/cdn/`)
  }
  next = rewriteQuotedPath(next, '/server/', `/api/portal/proxy/${wide}/server/`)
  next = rewriteQuotedPath(next, '/arcgis/', `/api/portal/proxy/${wide}/arcgis/`)

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
  next = collapseGluedProxyUrls(next, req, contentType)
  next = next.replace(
    /\/api\/portal\/proxy\/esrirww\/assets\//g,
    '/api/portal/proxy/esrirw/apps/dashboards/assets/',
  )
  next = absolutizeProxyUrls(next, req)
  // Absolutizing can leave hostKey glued onto an absolute URL (rbchttps://…).
  next = collapseGluedProxyUrls(next, req, contentType)

  if (/text\/html/i.test(contentType) && /apps\/dashboards/i.test(String(req?.url || ''))) {
    const assetBase = `${requestOrigin(req)}/api/portal/proxy/esrirw/apps/dashboards/assets/`
    next = next.replace(
      /__webpack_public_path__\s*=\s*['"]assets\/['"]/g,
      `__webpack_public_path__ = ${JSON.stringify(assetBase)}`,
    )
  }

  if (
    (hostKey === 'esrirw' || hostKey === 'esrirww') &&
    next.includes('esriGeowConfig') &&
    next.includes('pathParts[0] !== "home"')
  ) {
    next = next.replace(
      /var context = pathParts && pathParts\.length && pathParts\[0\] !== "home" \? pathParts\[0\] : "\/";\s*if \(context !== "\/"\) \{\s*context = "\/" \+ context \+ "\/";\s*\}/,
      'var context = "/api/portal/proxy/esrirw/";',
    )
  }

  if (/javascript|ecmascript/i.test(contentType) && /apps\/mission/i.test(String(req?.url || ''))) {
    next = patchMissionJs(next)
  }

  if (/<head[\s>]/i.test(next)) {
    const authPage = /signin\.html|oauth2\/authorize|oauth2\/approval/i.test(String(req?.url || ''))
    const patch = authPage
      ? ''
      : hostKey === 'esrirw' || hostKey === 'esrirww'
        ? esrirwHeadPatch(req)
        : HTML_SSL_PATCH
    if (patch) next = next.replace(/<head[^>]*>/i, (tag) => `${tag}${patch}`)
  }

  return next
}

function rewriteSetCookie(value, req) {
  let next = String(value || '')
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Path=[^;]*/gi, '; Path=/')
    .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
    .replace(/;\s*Secure/gi, '')
  if (appIsHttps(req) && !/;\s*Secure/i.test(next)) next += '; Secure'
  return next
}

function proxyReferer(hostKey) {
  if (hostKey.startsWith('rbc')) return 'https://gis.rbc.gov.rw/portal'
  if (hostKey.startsWith('rmb')) return 'https://gis.rmb.gov.rw/portal'
  if (hostKey.startsWith('esrirw')) return 'https://esrirw.rw/portal'
  return 'https://gh.space.gov.rw/portal'
}

function esrirwPortalToken() {
  return String(process.env.ESRIRW_TOKEN || '').trim()
}

function attachEsriRwToken(target, hostKey) {
  if (!hostKey.startsWith('esrirw')) return
  const token = esrirwPortalToken()
  if (!token) return
  if (/generateToken|oauth2/i.test(target.pathname + target.search)) return
  if (!target.searchParams.get('token')) target.searchParams.set('token', token)
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || '')
  if (!origin) return
  try {
    const host = new URL(origin).hostname
    if (origin === 'https://survey123.arcgis.com' || /\.arcgis\.com$/i.test(host)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Vary', 'Origin')
    }
  } catch {
    /* ignore invalid Origin */
  }
}

/**
 * Fix /api/portal/proxy/{host}https://… glue (no slash between host key and URL).
 * Seen when dashboard JS prefixes a proxy base onto an already-absolute URL.
 */
function collapseGluedProxyUrls(text, req, contentType = '') {
  const origin = requestOrigin(req)
  let next = String(text || '')
  const hostAlt = PROXY_KEY_RE
  next = next.replace(
    new RegExp(`/api/portal/proxy/(?:${hostAlt})(?=https?:)`, 'gi'),
    '',
  )
  next = next.replace(
    new RegExp(
      `${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/portal/proxy/(?:${hostAlt})(?=https?:)`,
      'gi',
    ),
    '',
  )
  next = next.replaceAll(`${origin}${origin}`, origin)
  next = next.replace(
    new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=https?:)`, 'g'),
    '',
  )
  // Legacy Esri Rwanda-only path rewrite (non-JS payloads).
  if (!/javascript|ecmascript/i.test(contentType)) {
    next = next.replace(/\/api\/portal\/(?!proxy\/)/g, '/api/portal/proxy/esrirw/')
  }
  return next
}

function esrirwHeadPatch(req) {
  const token = esrirwPortalToken()
  const expires = Number(process.env.ESRIRW_TOKEN_EXPIRES || '') || Date.now() + 14 * 24 * 60 * 60 * 1000
  const server = `${requestOrigin(req)}/api/portal/proxy/esrirw/sharing/rest`
  const session = token
    ? `<script>window.__ESRIRW_SESSION__=${JSON.stringify({
        token,
        ssl: true,
        expires,
        server,
      })}</script>`
    : ''
  return `${session}${HTML_ESRIRW_PATCH}`
}

function patchMissionJs(text) {
  let next = String(text || '')
  if (!next.includes('token-not-available') && !next.includes('function oAuthLogIn')) return next
  next = next.replaceAll(
    'return modules_StateModule/* default */.A.getInstance().authToken;',
    'return modules_StateModule/* default */.A.getInstance().authToken||(window.__ESRIRW_SESSION__&&window.__ESRIRW_SESSION__.token);',
  )
  next = next.replaceAll(
    'const token = state.authToken;\n    if (!token) {\n      throw new Error("token-not-available");\n    }',
    'const token = state.authToken||(window.__ESRIRW_SESSION__&&window.__ESRIRW_SESSION__.token);\n    if (!token) {\n      throw new Error("token-not-available");\n    }',
  )
  next = next.replaceAll(
    'const authToken = this._getAuthToken();\n      if (!authToken) {\n        throw new Error("token-not-available");\n      }',
    'const authToken = this._getAuthToken()||(window.__ESRIRW_SESSION__&&window.__ESRIRW_SESSION__.token);\n      if (!authToken) {\n        throw new Error("token-not-available");\n      }',
  )
  next = next.replaceAll(
    'loadIndex(config.portalUrl);',
    'if(window.__ESRIRW_SESSION__&&window.__ESRIRW_SESSION__.token){loadApp();}else loadIndex(config.portalUrl);',
  )
  next = next.replace(
    'IdentityManager["default"].checkSignInStatus(`${config.portalUrl}/sharing/rest`).then((r) => {',
    `(window.__ESRIRW_SESSION__&&window.__ESRIRW_SESSION__.token&&IdentityManager["default"].registerToken({server:config.portalUrl+"/sharing/rest",token:window.__ESRIRW_SESSION__.token,ssl:true,expires:window.__ESRIRW_SESSION__.expires}),IdentityManager["default"].checkSignInStatus(config.portalUrl+"/sharing/rest").then((r) => {`,
  )
  next = next.replace(
    'function registerOAuthInfos(config) {',
    `function registerOAuthInfos(config) {
  if (window.__ESRIRW_SESSION__ && window.__ESRIRW_SESSION__.token && IdentityManager["default"] && IdentityManager["default"].registerToken) {
    IdentityManager["default"].registerToken({
      server: config.portalUrl + "/sharing/rest",
      token: window.__ESRIRW_SESSION__.token,
      ssl: true,
      expires: window.__ESRIRW_SESSION__.expires
    });
  }`,
  )
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

  const sourceBase = PROXY_HOSTS[hostKey]
  const publicHosts = new Set(['web', 's123'])
  if (!publicHosts.has(hostKey) && !requireAppGate(req, res)) {
    return
  }

  const hostMap = readHostTokenMap(
    req.headers.cookie,
    process.env.SESSION_SECRET,
    SESSION_FALLBACK,
  )
  let portalToken = publicHosts.has(hostKey)
    ? null
    : await hostTokenWithRenewal(req, res, hostKey, renewalOpts(hostMap))

  // Preserve Esri Rwanda env-token fallback when broker session is not ready.
  if (!portalToken && hostKey.startsWith('esrirw')) {
    portalToken = esrirwPortalToken() || null
  }

  if (!publicHosts.has(hostKey) && !portalToken && !hostKey.startsWith('esrirw')) {
    sendJson(res, 401, {
      error: 'Portal access is not ready for this host',
      portalHostKey: authHostForProxyKey(hostKey),
    })
    return
  }

  const cleanedRest = String(restPath || '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
  const target = new URL(
    normalizeProxyRestPath(hostKey, cleanedRest),
    sourceBase.endsWith('/') ? sourceBase : `${sourceBase}/`,
  )
  new URLSearchParams(search).forEach((value, key) => {
    if (key === 'token') return
    target.searchParams.set(key, value)
  })
  if (portalToken && hostKey.startsWith('esrirw')) {
    if (!/generateToken|oauth2/i.test(target.pathname + target.search)) {
      if (!target.searchParams.get('token')) {
        target.searchParams.set('token', portalToken)
      }
    }
  } else if (portalToken) {
    target.searchParams.set('token', portalToken)
  } else {
    attachEsriRwToken(target, hostKey)
  }

  if (
    hostKey.startsWith('esrirw') &&
    /home\/(index|signin)\.html/i.test(cleanedRest) &&
    (portalToken || esrirwPortalToken()) &&
    /\/apps\/mission\//i.test(req.headers.referer || '')
  ) {
    redirect(res, req.headers.referer)
    return
  }

  if (
    hostKey.startsWith('esrirw') &&
    /oauth2\/authorize/i.test(target.pathname) &&
    !target.searchParams.get('client_id')
  ) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    applyCors(req, res)
    res.end('<!doctype html><title></title><script>window.close()</script>')
    return
  }

  const headers = {
    accept: req.headers.accept || '*/*',
    'user-agent': req.headers['user-agent'] || 'Health-Mapping',
  }
  if (!hostKey.startsWith('esrirw')) headers.referer = proxyReferer(hostKey)
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (req.headers.cookie) headers.cookie = req.headers.cookie
  if (req.headers.authorization) headers.authorization = req.headers.authorization
  else if (portalToken) {
    headers.authorization = `Bearer ${portalToken}`
    if (!hostKey.startsWith('esrirw')) {
      headers.referer = requestOrigin(req)
    }
  } else if (hostKey.startsWith('esrirw') && esrirwPortalToken()) {
    headers.authorization = `Bearer ${esrirwPortalToken()}`
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

  let upstream
  try {
    upstream = await portalFetch(target, { ...init, signal: AbortSignal.timeout(PORTAL_PROXY_TIMEOUT_MS) })
  } catch (error) {
    if (error?.name === 'TimeoutError') throw error
    // Network/TLS failure reaching the portal: report it as a gateway error
    // rather than a generic 500 so the cause is visible in the browser.
    const reason = error?.cause?.code || error?.cause?.message || error?.message || 'unknown error'
    console.error('[portal-proxy]', hostKey, target.hostname, reason)
    sendJson(res, 502, { error: `Could not reach portal host ${target.hostname}`, reason })
    return
  }

  if (
    upstream.status === 404 &&
    hostKey.startsWith('esrirw') &&
    /apps\/mission\/config\/config\.json$/i.test(cleanedRest)
  ) {
    sendJson(res, 200, {
      portalUrl: `${requestOrigin(req)}/api/portal/proxy/esrirw`,
      locale: 'en',
    })
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
    if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value)
  })
  const setCookies =
    typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : []
  if (setCookies.length) {
    res.setHeader(
      'Set-Cookie',
      setCookies.map((cookie) => rewriteSetCookie(cookie, req)),
    )
  }
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  applyCors(req, res)

  const type = upstream.headers.get('content-type') || ''
  if (shouldRewrite(type)) {
    const text = rewritePayload(softenPermissionRefusal(await upstream.text(), Boolean(portalToken)), hostKey, req, type)
    res.end(text)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.end(buffer)
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
    referer: requestOrigin(req),
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

  if (
    req.method === 'OPTIONS' &&
    (pathname.startsWith('/api/portal/proxy/') ||
      pathname.startsWith('/api/sharing/') ||
      pathname.startsWith('/api/gis/'))
  ) {
    applyCors(req, res)
    res.statusCode = 204
    res.end()
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

  if (pathname === '/api/gis/esrirw-session') {
    const token = esrirwPortalToken()
    if (!token) {
      sendJson(res, 404, { error: 'Esri Rwanda token is not configured' })
      return true
    }
    sendJson(res, 200, {
      token,
      ssl: true,
      expires: Number(process.env.ESRIRW_TOKEN_EXPIRES || '') || undefined,
      server: `${requestOrigin(req)}/api/portal/proxy/esrirw/sharing/rest`,
    })
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

  if (
    pathname.startsWith('/api/sharing/') ||
    pathname.startsWith('/api/home/') ||
    pathname.startsWith('/api/jsapi/') ||
    pathname.startsWith('/api/portaladmin')
  ) {
    await proxyRequest(req, res, 'esrirw', pathname.replace(/^\/api\//, ''), url.search)
    return true
  }

  if (pathname.startsWith('/api/portal/proxy/')) {
    // /api/portal/proxy/rbchttps://localhost:5175/api/portal/proxy/rbc/...
    const glued = pathname.match(
      new RegExp(`^/api/portal/proxy/(?:${PROXY_KEY_RE})(https?:/.*)`, 'i'),
    )
    if (glued) {
      let dest = glued[1]
      // Normalize https:/host → https://host (single-slash glue artifact)
      dest = dest.replace(/^(https?:)\/(?!\/)/i, '$1//')
      dest = dest.replace(
        /^https?:\/\/[^/]+\/api\/portal\/(?!proxy\/)/i,
        `${requestOrigin(req)}/api/portal/proxy/esrirw/`,
      )
      redirect(res, `${dest}${url.search}`)
      return true
    }
    const rest = pathname.slice('/api/portal/proxy/'.length)
    let [hostKey, ...parts] = rest.split('/')
    let restPath = parts.join('/') || '.'
    if (hostKey === 'esrirww' && restPath.startsWith('assets/')) {
      hostKey = 'esrirw'
      const referer = req.headers.referer || ''
      const app = /\/apps\/mission\//i.test(referer) ? 'apps/mission' : 'apps/dashboards'
      restPath = `${app}/${restPath}`
    }
    if (!PROXY_HOSTS[hostKey]) {
      sendJson(res, 404, { error: 'Unknown proxy host' })
      return true
    }
    await proxyRequest(req, res, hostKey, restPath, url.search)
    return true
  }

  return false
}

function hostKeyFromReferer(referer = '') {
  if (referer.includes('/api/portal/proxy/web') || referer.includes('/dashboards/citizen-reporting')) {
    return 'web'
  }
  if (referer.includes('/api/portal/proxy/esrirww')) return 'esrirww'
  if (referer.includes('/api/portal/proxy/esrirw')) return 'esrirw'
  if (referer.includes('/api/portal/proxy/rbcw')) return 'rbcw'
  if (
    referer.includes('/api/portal/proxy/rbc') ||
    referer.includes('/dashboards/vaccination') ||
    referer.includes('/portal/apps/experiencebuilder')
  ) {
    return 'rbc'
  }
  if (referer.includes('/api/portal/proxy/rmbw')) return 'rmbw'
  if (referer.includes('/api/portal/proxy/rmb') || referer.includes('/dashboards/volcanic')) {
    return 'rmb'
  }
  // gh2 before gh: '/api/portal/proxy/gh2' also contains '/api/portal/proxy/gh'.
  if (referer.includes('/api/portal/proxy/gh2w')) return 'gh2w'
  if (referer.includes('/api/portal/proxy/gh2')) return 'gh2'
  if (referer.includes('/api/portal/proxy/ghw')) return 'ghw'
  if (referer.includes('/api/portal/proxy/gh') || referer.includes('/dashboards/')) {
    return 'gh'
  }
  return null
}

function isPortalReferer(referer = '') {
  return /\/api\/portal\/proxy\/|\/dashboards\/|\/portal\/apps\/experiencebuilder/.test(referer)
}

async function proxyCatchAll(req, res, url) {
  const pathname = url.pathname
  const referer = req.headers.referer || ''
  const rbc = /\/api\/portal\/proxy\/rbc|\/dashboards\/vaccination|\/portal\/apps\/experiencebuilder/.test(
    referer,
  )
  const rmb = /\/api\/portal\/proxy\/rmb|\/dashboards\/volcanic/.test(referer)
  const esrirw = /\/api\/portal\/proxy\/esrirw/.test(referer)
  const gh2 = /\/api\/portal\/proxy\/gh2/.test(referer)
  const catchAll = rbc
    ? { portal: 'rbc', wide: 'rbcw' }
    : rmb
      ? { portal: 'rmb', wide: 'rmbw' }
      : esrirw
        ? { portal: 'esrirw', wide: 'esrirww' }
        : gh2
          ? { portal: 'gh2', wide: 'gh2w' }
          : { portal: 'gh', wide: 'ghw' }

  let hostKey = null
  let restPath = null

  if (pathname.startsWith('/portal/')) {
    hostKey = catchAll.portal
    restPath = pathname.slice('/portal/'.length)
  } else if (pathname.startsWith('/home/')) {
    hostKey = esrirw || referer.includes('/home/signin') ? 'esrirw' : catchAll.portal
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/jsapi/')) {
    hostKey = esrirw ? 'esrirw' : catchAll.portal
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/sharing/')) {
    hostKey = catchAll.portal
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/apps/experiencebuilder') || pathname.startsWith('/apps/mission')) {
    hostKey = 'esrirw'
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/apps/dashboards') || pathname.startsWith('/apps/sites')) {
    hostKey = esrirw ? 'esrirw' : catchAll.portal
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/missionserver/')) {
    hostKey = 'esrirww'
    restPath = pathname.replace(/^\//, '')
  } else if (pathname.startsWith('/server/') || pathname.startsWith('/arcgis/')) {
    hostKey = esrirw ? 'esrirww' : catchAll.wide
    restPath = pathname.replace(/^\//, '')
  } else if (
    (pathname.startsWith('/assets/') || pathname.startsWith('/cdn/')) &&
    isPortalReferer(referer)
  ) {
    const fromRef = hostKeyFromReferer(referer)
    hostKey =
      fromRef === 'rmb' || fromRef === 'rmbw'
        ? 'rmbw'
        : fromRef === 'rbc' || fromRef === 'rbcw'
          ? 'rbcw'
          : fromRef === 'esrirw' || fromRef === 'esrirww'
            ? /\/apps\/dashboards|\/apps\/mission|chunk\./i.test(referer + pathname)
              ? 'esrirw'
              : 'esrirww'
          : fromRef === 'web'
            ? 'web'
            : fromRef === 'gh2' || fromRef === 'gh2w'
              ? 'gh2w'
              : 'ghw'
    restPath = pathname.replace(/^\//, '')
    if (hostKey === 'esrirw' && pathname.startsWith('/assets/')) {
      const app = /\/apps\/mission\//i.test(referer) ? 'apps/mission' : 'apps/dashboards'
      restPath = `${app}/${restPath}`
    }
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
      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
      if (/^\/https?:/.test(url.pathname)) {
        let recovered = url.pathname
        while (/^\/https?:/.test(recovered)) {
          recovered = recovered.replace(/^\/https?:\/\/[^/]+/i, '') || '/'
        }
        recovered = recovered.replace(/^\/+/, '/')
        if (!recovered.startsWith('/')) recovered = `/${recovered}`
        const esriAsset =
          recovered.startsWith('/apps/mission') ||
          recovered.startsWith('/apps/dashboards') ||
          recovered.startsWith('/api/portal/proxy/esrirw')
        const dest = esriAsset
          ? recovered.startsWith('/api/portal/proxy/')
            ? recovered
            : `/api/portal/proxy/esrirw${recovered}`
          : recovered.startsWith('/apps/') ||
              recovered.startsWith('/sharing/') ||
              recovered.startsWith('/home/')
            ? `/portal${recovered}`
            : recovered.startsWith('/portal/')
              ? recovered
              : `/portal${recovered}`
        redirect(res, `${dest}${url.search}`)
        return
      }
      if (isRbcProxyPath(url.pathname) || isRbcMirrorRequest(url.pathname, req.headers.referer || '')) {
        await handleRbcProxy(req, res, url)
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
