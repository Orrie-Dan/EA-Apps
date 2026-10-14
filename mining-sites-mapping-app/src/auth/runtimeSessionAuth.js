/**
 * Static-build authentication through the Runtime Config service.
 *
 * Used only when STATIC_BUILD is true (static hosting on gh.space.gov.rw, where
 * ARR forwards /api/* to the Runtime Config service). The user signs in once
 * with their GeoHub account; the service keeps the session in an HttpOnly
 * cookie and serves protected dashboards through its session-gated portal
 * proxy, attaching the service-account token server-side. The browser never
 * sees a portal token.
 */
import { APPLICATION_KEY } from '../config/application.js'

const AUTH_ROOT = '/api/v1/app-auth'
const PROXY_ROOT = '/api/v1/portal-proxy'

async function readError(response, fallback) {
  try {
    const data = await response.json()
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    return message || data?.error || fallback
  } catch {
    return fallback
  }
}

function toSession(data) {
  return {
    authenticated: true,
    user: { username: data?.user?.username || '' },
    expiresAt: Number(data?.expiresAt) || null,
  }
}

export async function signInWithRuntimeSession(username, password) {
  const response = await fetch(`${AUTH_ROOT}/login`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey: APPLICATION_KEY, username, password }),
  })
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Invalid username or password'
        : await readError(response, 'Unable to sign in. Please try again.'),
    )
  }
  return toSession(await response.json())
}

/** The live session, or { authenticated: false } when signed out/expired. */
export async function readRuntimeSession() {
  const params = new URLSearchParams({ appKey: APPLICATION_KEY })
  const response = await fetch(`${AUTH_ROOT}/session?${params}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) return { authenticated: false }
  return toSession(await response.json())
}

export async function signOutOfRuntimeSession() {
  // Each app has its own session cookie; sign out of this app only.
  const params = new URLSearchParams({ appKey: APPLICATION_KEY })
  await fetch(`${AUTH_ROOT}/logout?${params}`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => {})
}

/**
 * Frame URL for a protected portal page: the same path on the portal, served
 * through the Runtime Config proxy for this app and portal host.
 *
 * Absolute (page origin) in the browser: the proxy lives at the site root, not
 * under APP_BASE_PATH, and appPath() would otherwise prefix a root-relative
 * path — the static host then answers with this app's index.html and the
 * frame recursively embeds the app.
 */
export function runtimeProxyFrameUrl(portalUrl, portalHostKey) {
  if (!portalUrl || !portalHostKey) return null
  let url
  try {
    url = new URL(portalUrl)
  } catch {
    return null
  }
  const origin = globalThis.location?.origin || ''
  return `${origin}${PROXY_ROOT}/${APPLICATION_KEY}/${portalHostKey}${url.pathname}${url.search}`
}
