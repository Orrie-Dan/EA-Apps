/**
 * Production server: serves the built `dist/` and mounts the access server in
 * front of it.
 *
 * This exists because a static deploy cannot work. The portal's API routes
 * (/api/auth/*, /api/portal/gh/*) are what authenticate the user and proxy the
 * dashboards; drop `dist/` on a static host without this process and every one
 * of those routes 404s, taking sign-in and dashboard embedding with it.
 *
 * Run:  npm start   (or: node server/index.js [--http-only])
 */
import './load-env.js'
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAccessMiddleware } from './access-server.js'
import { stripBasePath } from './base-path.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const DIST = path.resolve(ROOT, 'dist')
const PORT = Number(process.env.PORT || 4184)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

if (!fs.existsSync(DIST)) {
  console.error(`No build found at ${DIST}. Run "npm run build" first.`)
  process.exit(1)
}

const middleware = createAccessMiddleware()

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  // Built files are referenced under the base (Vite `base`); serve them from dist/.
  let rel = decodeURIComponent(stripBasePath(url.pathname) ?? url.pathname)
  if (rel.endsWith('/')) rel += 'index.html'

  // Never SPA-fallback under /api/. That namespace is proxy and auth routes,
  // handled earlier in the middleware chain — reaching here means every rule
  // this server knows about missed it. A real 404 makes that failure visible
  // (a script tag error, a failed fetch) instead of the caller silently
  // receiving index.html with a 200 where it expected JSON, a script, or a
  // redirect — which is exactly how an unrecognised embedded-app request
  // once hung the page instead of erroring.
  if (rel.startsWith('/api/')) {
    res.statusCode = 404
    return res.end('Not found')
  }

  // Resolve inside DIST and reject anything that escapes it.
  const filePath = path.resolve(DIST, '.' + rel)
  if (!filePath.startsWith(DIST)) {
    res.statusCode = 403
    return res.end('Forbidden')
  }

  // The app uses HashRouter, so any unknown path falls back to index.html.
  const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(DIST, 'index.html')

  const ext = path.extname(target)
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream')
  /*
   * Only Vite's hashed build output under dist/assets is immutable: a changed
   * file gets a new name. Everything copied from public/ — the photographs, the
   * fonts — keeps its name when its content changes, so marking it immutable
   * left browsers showing a replaced hero photo for up to a year. Those, and
   * the entry HTML, revalidate instead; an unchanged file costs a bodiless 304.
   */
  if (target.startsWith(path.join(DIST, 'assets') + path.sep)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    const modified = fs.statSync(target).mtime
    modified.setMilliseconds(0) // HTTP dates carry whole seconds only
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Last-Modified', modified.toUTCString())
    const since = Date.parse(req.headers['if-modified-since'] || '')
    if (!Number.isNaN(since) && modified.getTime() <= since) {
      res.statusCode = 304
      return res.end()
    }
  }
  fs.createReadStream(target).pipe(res)
}

/*
 * Same-origin forwarding to the Runtime Config backend.
 *
 * VITE_RUNTIME_CONFIG_URL points the browser at THIS server, and Vite proxies
 * these paths in dev and preview. Without the same forwarding here, a
 * production build sent them to the SPA fallback: runtime config silently fell
 * back to bundled defaults and the portal token broker answered with HTML.
 */
const RUNTIME_CONFIG_TARGET = (
  process.env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000'
).replace(/\/$/, '')
const RUNTIME_CONFIG_PATHS = ['/api/v1/config', '/api/v1/portal-auth']
const RUNTIME_CONFIG_TIMEOUT_MS = 20_000
const MAX_FORWARD_BODY = 64 * 1024

function isRuntimeConfigPath(pathname) {
  return RUNTIME_CONFIG_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

function sendForwardError(res, status, message) {
  if (res.headersSent) return res.end()
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: message }))
}

async function forwardRuntimeConfig(req, res, targetPath) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_FORWARD_BODY) return sendForwardError(res, 413, 'Request body too large')
    chunks.push(chunk)
  }

  // Origin is forwarded because the broker binds each token to it.
  const headers = {}
  for (const name of ['accept', 'content-type', 'origin', 'user-agent']) {
    if (req.headers[name]) headers[name] = req.headers[name]
  }

  try {
    const upstream = await fetch(`${RUNTIME_CONFIG_TARGET}${targetPath}`, {
      method: req.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      signal: AbortSignal.timeout(RUNTIME_CONFIG_TIMEOUT_MS),
    })
    const body = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = upstream.status
    for (const name of ['content-type', 'cache-control', 'retry-after']) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    res.end(body)
  } catch (err) {
    sendForwardError(
      res,
      err?.name === 'TimeoutError' ? 504 : 502,
      'Runtime Config service is unavailable',
    )
  }
}

const handler = (req, res) => {
  // Forward the same normalised path that was checked, never the raw URL.
  const { pathname, search } = new URL(req.url, 'http://localhost')
  if (isRuntimeConfigPath(pathname)) {
    forwardRuntimeConfig(req, res, pathname + search).catch(() => sendForwardError(res, 502, 'Runtime Config forwarding failed'))
    return
  }
  middleware(req, res, () => serveStatic(req, res))
}

/*
 * Serve over TLS whenever a certificate is available.
 *
 * This is not belt-and-braces: GeoHub reports `allSSL: true`, and the ArcGIS
 * JS API honours that by forcing its hosting page to https. Served over plain
 * http, an embedded dashboard redirects itself to https://<our-host>, finds
 * nothing listening, and dies with ERR_SSL_PROTOCOL_ERROR — an empty frame.
 *
 * Running dev over TLS matches production and removes that entire failure mode,
 * rather than rewriting the portal's own SSL flags out of its payloads.
 * `npm run cert` generates the local pair. Prefer mkcert, which signs with a
 * CA in your own trust store, so the browser shows no warning:
 *   mkcert -install
 *   mkcert -key-file .certs/dev-key.pem -cert-file .certs/dev-cert.pem \
 *          localhost 127.0.0.1 ::1
 * A bare `openssl` self-signed pair also works, but every browser will warn,
 * and Chrome will refuse to register a service worker against it — see below.
 */
const KEY = process.env.SSL_KEY || path.resolve(ROOT, '.certs', 'dev-key.pem')
const CERT = process.env.SSL_CERT || path.resolve(ROOT, '.certs', 'dev-cert.pem')

/*
 * HTTP_ONLY=1 (or --http-only) forces plain HTTP. Use it for local development.
 *
 * A self-signed certificate is worse than no certificate on localhost:
 * Chrome refuses to register a service worker on an origin whose certificate it
 * does not trust, and Experience Builder registers one — so the app fails with
 * "An SSL certificate error occurred when fetching the script".
 *
 * Plain http://localhost avoids that entirely: browsers treat localhost as a
 * trusted origin whatever the scheme, so service workers are allowed. The
 * portal's allSSL flag, which would otherwise force the page to https, is
 * rewritten away for insecure origins in access-server.js.
 *
 * Production is different and must use real TLS — there localhost's exemption
 * does not apply and the allSSL rewrite is correctly disabled.
 */
const httpOnly = process.env.HTTP_ONLY === '1' || process.argv.includes('--http-only')
const haveTls = !httpOnly && fs.existsSync(KEY) && fs.existsSync(CERT)

/** Turn the common startup failures into something a human can act on. */
function onListenError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use — something else is running there.\n\n` +
        `  Find it :  ss -lptn 'sport = :${PORT}'\n` +
        `  Stop it :  kill <pid>\n` +
        `  Or use another port:  PORT=${PORT + 100} npm start\n`,
    )
  } else if (err.code === 'EACCES') {
    console.error(`\nNot allowed to bind port ${PORT}. Ports below 1024 need elevated rights.\n`)
  } else {
    console.error('\nServer failed to start:', err.message, '\n')
  }
  process.exit(1)
}

const server = haveTls
  ? https.createServer({ key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }, handler)
  : http.createServer(handler)

server.on('error', onListenError)

server.listen(PORT, () => {
  if (haveTls) {
    console.log(`RSA portal listening on https://localhost:${PORT}`)
    console.log('TLS certificate: .certs/dev-cert.pem')
  } else {
    console.log(`RSA portal listening on http://localhost:${PORT}`)
    if (httpOnly) {
      console.log('HTTP_ONLY=1 — correct for local development; service workers work on localhost.')
    } else {
      console.warn('No TLS certificate found. Fine on localhost; production needs real TLS.')
    }
  }
})

if (process.env.NODE_ENV !== 'production') {
  console.warn('NODE_ENV is not "production": session cookies will not be marked Secure.')
}
