import { appPath } from '../lib/appPath.js'

/**
 * Authenticates the human user through this app's own server.
 *
 * The browser must not call the portal's generateToken directly: the portal
 * sends no CORS header for this origin, so the POST is blocked, and the JSONP
 * fallback is a GET that generateToken rejects with 405 "Method not supported".
 * The server checks the credentials against the portal instead.
 * Portal embeds use the Runtime Config broker, not this login.
 */
export async function signInToGeoHub(username, password) {
  let response
  try {
    response = await fetch(appPath('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new Error('Unable to reach GeoHub')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.authenticated) {
    throw new Error(data?.error || 'Invalid username or password')
  }
  return { expires: Number(data.expiresAt) || undefined }
}
