/**
 * Server-side renewal of the host-keyed broker tokens the proxy injects.
 *
 * The browser deposits a broker token when a map opens, and the cookie that
 * carries it expires with the token: about 20 minutes, and the broker hands out
 * a cached token with as little as a minute left. Nothing renewed it while a
 * dashboard stayed open or was still loading, so the proxy fell back to a stale
 * token (or none), the portal answered 498/401, and ArcGIS Dashboards retried
 * the same item every few milliseconds without end — a spinner that never
 * resolves and a frozen tab. The proxy now asks the broker itself, for the same
 * origin the browser would, whenever the token is missing or about to expire.
 *
 * Renewal only happens behind a valid application gate, so it never mints a
 * token the signed-in browser could not already have obtained.
 */
import { APPLICATION_KEY } from '../src/config/application.js'
import { authHostForProxyKey, readAppGate, writeHostTokenMap } from './portal-host-session.js'

// The broker reuses a cached token while it has more than this left, so
// renewing any earlier would just get the same token back.
const RENEW_SKEW_MS = 60_000
const BROKER_TIMEOUT_MS = 10_000
// After a failed renewal, wait before asking again rather than calling the
// broker once per proxied request.
const FAILURE_BACKOFF_MS = 10_000

const inFlight = new Map()
const failedUntil = new Map()

/**
 * The origin the browser is on, which is what the broker binds a token to when
 * the browser asks for it. HTTP/2 sends :authority/:scheme instead of `host`.
 */
export function browserOrigin(req) {
  const proto =
    req.headers['x-forwarded-proto'] ||
    req.headers[':scheme'] ||
    (req.socket && req.socket.encrypted ? 'https' : 'http')
  const host =
    req.headers['x-forwarded-host'] || req.headers.host || req.headers[':authority']
  return host ? `${proto}://${host}` : ''
}

async function requestBrokerToken(origin, authHost) {
  const base = (process.env.RUNTIME_CONFIG_PROXY_TARGET || 'http://localhost:3000').replace(/\/$/, '')
  const res = await fetch(`${base}/api/v1/portal-auth/token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', origin },
    body: JSON.stringify({ appKey: APPLICATION_KEY, portalHostKey: authHost }),
    signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Portal token broker answered ${res.status}`)
  const data = await res.json()
  const expiresAt = Number(data?.expiresAt)
  if (typeof data?.token !== 'string' || !data.token || !Number.isFinite(expiresAt)) {
    throw new Error('Portal token broker returned a malformed token')
  }
  return { token: data.token, expiresAt }
}

/**
 * The token to inject for `hostKey`, renewed from the broker when the one in
 * the host cookie is missing or within RENEW_SKEW_MS of expiring. A renewed
 * token is written back to the host cookie on `res`. `hostMap` is updated in
 * place so a second host renewed during the same request keeps the first.
 *
 * Returns the existing token (possibly null) when renewal is not possible.
 */
export async function hostTokenWithRenewal(req, res, hostKey, opts) {
  const { hostMap, sessionSecret, sessionFallback, setHostCookie } = opts
  const authHost = authHostForProxyKey(hostKey)
  if (!authHost) return null

  const current = hostMap[authHost]
  if (current?.token && current.expiresAt - Date.now() > RENEW_SKEW_MS) return current.token
  if (!readAppGate(req.headers.cookie, sessionSecret, sessionFallback)) return current?.token || null

  const origin = browserOrigin(req)
  if (!origin) return current?.token || null
  const key = `${origin}|${authHost}`
  if ((failedUntil.get(key) || 0) > Date.now()) return current?.token || null

  let pending = inFlight.get(key)
  if (!pending) {
    pending = requestBrokerToken(origin, authHost).finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }

  try {
    const fresh = await pending
    const next = writeHostTokenMap(hostMap, authHost, fresh.token, fresh.expiresAt)
    hostMap[authHost] = { token: fresh.token, expiresAt: fresh.expiresAt }
    const maxAgeSec = Math.max(60, Math.floor((fresh.expiresAt - Date.now()) / 1000))
    setHostCookie(res, next, maxAgeSec, req)
    return fresh.token
  } catch (err) {
    failedUntil.set(key, Date.now() + FAILURE_BACKOFF_MS)
    console.warn(`[portal] token renewal for ${authHost} failed: ${err?.message || err}`)
    return current?.token || null
  }
}
