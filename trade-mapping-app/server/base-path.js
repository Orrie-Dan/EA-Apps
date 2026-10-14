/**
 * The app is served under /<APPLICATION_KEY>/ so several apps can share one
 * host behind a path-routing proxy.
 *
 * Routing inside this server stays root-relative: the base is stripped from
 * each request on the way in, and put back on every URL for this origin on
 * the way out — redirect targets and the text bodies the proxies rewrite
 * (portal HTML/JS/JSON, which by then point at `${origin}/api/portal/…`).
 * Doing it at the response, rather than at each of the many places that build
 * a URL, keeps the proxies' rewrite rules unchanged and catches every one.
 *
 * Root-relative requests that framed ArcGIS apps compute for themselves
 * (/sharing/…, /apps/…, /assets/…) still arrive without the base. They are
 * served as before when this server owns the whole origin; behind a shared
 * host, the proxy in front has to route them here (see docs/base-path.md).
 */
import { APP_BASE_PATH } from '../src/config/application.js'

export const BASE_PATH = APP_BASE_PATH

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const BASE_NAME = BASE_PATH.slice(1)

/** The request URL without BASE_PATH, or null when it is outside the base. */
export function stripBasePath(rawUrl) {
  const url = String(rawUrl || '/')
  if (url === BASE_PATH) return '/'
  if (url.startsWith(`${BASE_PATH}?`)) return `/${url.slice(BASE_PATH.length)}`
  if (url.startsWith(`${BASE_PATH}/`)) return url.slice(BASE_PATH.length)
  return null
}

/** Puts BASE_PATH on a redirect target for this origin. */
export function withBasePathLocation(location, hosts) {
  const value = String(location || '')
  if (value.startsWith('/') && !value.startsWith('//')) {
    return stripBasePath(value) === null ? `${BASE_PATH}${value}` : value
  }
  return withBasePathText(value, hosts)
}

// This server's own root-relative routes. Upstream portal code uses plenty of
// other root-relative strings; only these are ours to move under the base.
const OWN_ROUTE = String.raw`(?:api\/(?:portal|gis|auth|forms|sharing|home|jsapi|portaladmin|v1)(?=[\/?])|dashboards\/|[a-z0-9-]+-patch\.js)`
const OWN_ROUTE_ESCAPED = OWN_ROUTE.replaceAll(String.raw`\/`, String.raw`\\\/`)

/**
 * Puts BASE_PATH on every URL for this origin in a text body: absolute URLs
 * for any of `hosts` (plain, JSON-escaped and percent-encoded) and quoted
 * root-relative URLs for this server's own routes. Idempotent.
 */
export function withBasePathText(text, hosts) {
  let next = String(text ?? '')
  for (const host of hosts) {
    if (!host) continue
    const h = escapeRe(host)
    next = next
      .replace(
        new RegExp(String.raw`((?:https?|wss?):\/\/${h})(?=\/)(?!\/${escapeRe(BASE_NAME)}(?:[\/?#"'\\\s]|$))`, 'gi'),
        `$1${BASE_PATH}`,
      )
      .replace(
        new RegExp(String.raw`((?:https?|wss?):\\\/\\\/${h})(?=\\\/)(?!\\\/${escapeRe(BASE_NAME)}(?:\\\/|["'?#]))`, 'gi'),
        `$1${BASE_PATH.replaceAll('/', '\\/')}`,
      )
      .replace(
        new RegExp(String.raw`((?:https?|wss?)%3A%2F%2F${escapeRe(encodeURIComponent(host))})(?=%2F)(?!%2F${escapeRe(BASE_NAME)}(?:%2F|%3F|%23|[&"']|$))`, 'gi'),
        `$1${encodeURIComponent(BASE_PATH)}`,
      )
  }
  return next
    .replace(new RegExp(String.raw`(^|["'\x60(=,\s])\/${OWN_ROUTE}`, 'g'), (m, lead) => `${lead}${BASE_PATH}${m.slice(lead.length)}`)
    .replace(new RegExp(String.raw`(["'])\\\/${OWN_ROUTE_ESCAPED}`, 'g'), (m, lead) => `${lead}${BASE_PATH.replaceAll('/', '\\/')}${m.slice(lead.length)}`)
    .replace(new RegExp(String.raw`(=)%2F(?=(?:api%2F(?:portal|gis|forms|sharing)|dashboards)%2F)`, 'gi'), `$1${encodeURIComponent(BASE_PATH)}%2F`)
}

const TEXT_TYPE = /text\/|javascript|ecmascript|json|xml/i

/**
 * Wraps `res` so redirects and text bodies sent through it carry BASE_PATH.
 * Returns a function that undoes the wrapping, for requests handed on to the
 * next middleware (Vite, the static server), which already serve the base.
 */
export function rewriteResponsesUnderBasePath(req, res) {
  const hosts = [req.headers.host, req.headers[':authority'], req.headers['x-forwarded-host']]
  if (process.env.PUBLIC_ORIGIN) {
    try {
      hosts.push(new URL(process.env.PUBLIC_ORIGIN).host)
    } catch {
      /* ignore a malformed PUBLIC_ORIGIN */
    }
  }
  const uniqueHosts = [...new Set(hosts.filter(Boolean))]

  const { setHeader, writeHead, end, write } = res
  const fixLocation = (value) =>
    Array.isArray(value) ? value.map((v) => withBasePathLocation(v, uniqueHosts)) : withBasePathLocation(value, uniqueHosts)

  res.setHeader = function (name, value) {
    if (String(name).toLowerCase() === 'location') value = fixLocation(value)
    return setHeader.call(this, name, value)
  }
  res.writeHead = function (status, ...rest) {
    const headers = rest.find((r) => r && typeof r === 'object')
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'location') headers[key] = fixLocation(headers[key])
      }
    }
    return writeHead.call(this, status, ...rest)
  }

  const header = (name) => (typeof res.getHeader === 'function' ? res.getHeader(name) : undefined)
  const isText = () => TEXT_TYPE.test(String(header('content-type') || ''))
  const rewriteChunk = (chunk, encoding) => {
    if (chunk == null || !isText()) return chunk
    const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : typeof chunk === 'string' ? chunk : null
    if (str === null) return chunk
    const next = withBasePathText(str, uniqueHosts)
    if (next === str) return chunk
    return typeof chunk === 'string' && (!encoding || encoding === 'utf8' || encoding === 'utf-8') ? next : Buffer.from(next, 'utf8')
  }

  let streamed = false
  res.write = function (chunk, encoding, cb) {
    // Streamed bodies are rewritten per chunk; the proxies that stream keep
    // their own URLs whole within a chunk (see each rewrite stream).
    streamed = true
    return write.call(this, rewriteChunk(chunk, encoding), encoding, cb)
  }
  res.end = function (chunk, encoding, cb) {
    if (typeof chunk === 'function') return end.call(this, chunk)
    const next = rewriteChunk(chunk, typeof encoding === 'string' ? encoding : undefined)
    if (next !== chunk && !streamed && !res.headersSent && header('content-length') != null) {
      setHeader.call(res, 'Content-Length', Buffer.byteLength(next))
    }
    return end.call(this, next, encoding, cb)
  }

  return function restore() {
    res.setHeader = setHeader
    res.writeHead = writeHead
    res.end = end
    res.write = write
  }
}
