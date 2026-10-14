/**
 * Host-keyed Portal broker tokens stored in a signed HttpOnly cookie.
 * Tokens never appear in iframe URLs or React routes.
 */
import crypto from 'node:crypto'

export const PORTAL_HOST_COOKIE = 'health_portal_hosts'
export const APP_GATE_COOKIE = 'health_app_gate'

/** Portal credential hosts only — wide aliases map to these. */
export const PORTAL_AUTH_HOSTS = new Set(['gh', 'gh2', 'rmb', 'rbc', 'esrirw'])

export function authHostForProxyKey(hostKey) {
  if (hostKey === 'ghw') return 'gh'
  if (hostKey === 'gh2w') return 'gh2'
  if (hostKey === 'rmbw') return 'rmb'
  if (hostKey === 'rbcw') return 'rbc'
  if (hostKey === 'esrirww') return 'esrirw'
  if (PORTAL_AUTH_HOSTS.has(hostKey)) return hostKey
  return null
}

export function isAllowedProxyHostKey(hostKey, proxyHosts) {
  return Boolean(hostKey && proxyHosts && proxyHosts[hostKey])
}

function secret(envSecret, fallback) {
  return envSecret || fallback || 'health-dev-session-secret'
}

export function signPayload(payload, envSecret, fallback) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', secret(envSecret, fallback))
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

export function unsignPayload(value, envSecret, fallback) {
  if (!value || !value.includes('.')) return null
  const [body, sig] = value.split('.')
  const expected = crypto
    .createHmac('sha256', secret(envSecret, fallback))
    .update(body)
    .digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString())
  } catch {
    return null
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      }),
  )
}

/**
 * @returns {Record<string, { token: string, expiresAt: number }>}
 */
export function readHostTokenMap(cookieHeader, envSecret, fallback) {
  const raw = parseCookies(cookieHeader)[PORTAL_HOST_COOKIE]
  const data = unsignPayload(raw, envSecret, fallback)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const hosts = data.hosts
  if (!hosts || typeof hosts !== 'object') return {}
  const now = Date.now()
  const out = {}
  for (const [key, entry] of Object.entries(hosts)) {
    if (!PORTAL_AUTH_HOSTS.has(key)) continue
    if (!entry?.token || !Number.isFinite(entry.expiresAt)) continue
    if (entry.expiresAt <= now) continue
    out[key] = { token: entry.token, expiresAt: entry.expiresAt }
  }
  return out
}

export function writeHostTokenMap(existing, portalHostKey, token, expiresAt) {
  const hosts = { ...existing }
  hosts[portalHostKey] = { token, expiresAt }
  return { hosts, updatedAt: Date.now() }
}

export function clearHostTokenMap() {
  return { hosts: {}, updatedAt: Date.now() }
}

export function readAppGate(cookieHeader, envSecret, fallback) {
  const raw = parseCookies(cookieHeader)[APP_GATE_COOKIE]
  const data = unsignPayload(raw, envSecret, fallback)
  if (!data?.authenticated) return null
  if (data.expiresAt && Date.now() > data.expiresAt) return null
  return data
}

export function resolveTokenForProxyHost(hostKey, hostMap) {
  const authHost = authHostForProxyKey(hostKey)
  if (!authHost) return null
  return hostMap[authHost]?.token || null
}
