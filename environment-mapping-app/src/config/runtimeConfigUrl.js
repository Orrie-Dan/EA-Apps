import { APPLICATION_KEY } from './application.js'
import { STATIC_BUILD } from './deployMode.js'

/**
 * Build the runtime config service URL for this application.
 * Returns null when the base URL is missing or blank.
 */
export function resolveRuntimeConfigUrl(baseUrl) {
  if (typeof baseUrl !== 'string') {
    return null
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return null
  }

  return `${trimmed}/api/v1/config/${APPLICATION_KEY}`
}

/**
 * Resolve the fetch URL from Vite env unless overridden in options.
 */
export function getRuntimeConfigFetchUrl(options = {}) {
  if (options.url) {
    return options.url
  }

  // Static hosting runs ON the portal web server: Runtime Config is same-origin
  // (https://<host>/api/v1/config/<key>), so derive the base from the page.
  if (STATIC_BUILD && typeof window !== 'undefined') {
    return resolveRuntimeConfigUrl(window.location.origin)
  }

  return resolveRuntimeConfigUrl(import.meta.env.VITE_RUNTIME_CONFIG_URL)
}
