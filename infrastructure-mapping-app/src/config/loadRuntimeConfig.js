import { DEFAULT_RUNTIME_CONFIG } from './defaults.js'
import { getRuntimeConfigFetchUrl } from './runtimeConfigUrl.js'
import { resolveRuntimeConfig } from './resolveRuntimeConfig.js'
import { validateRuntimeConfigDocument } from './validateRuntimeConfigDocument.js'

const RUNTIME_CONFIG_TIMEOUT_MS = 10_000

function fallbackResult(options, error) {
  return {
    config: resolveRuntimeConfig(DEFAULT_RUNTIME_CONFIG, options),
    source: 'defaults',
    error,
  }
}

/**
 * Load Runtime Config from the central service, falling back to bundled defaults.
 * Never throws for network/HTTP/JSON/validation failures.
 */
export async function loadRuntimeConfig(options = {}) {
  const url = getRuntimeConfigFetchUrl(options)

  if (!url) {
    return fallbackResult(
      options,
      'VITE_RUNTIME_CONFIG_URL is not configured',
    )
  }

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(RUNTIME_CONFIG_TIMEOUT_MS),
    })

    if (!response.ok) {
      return fallbackResult(options, `Runtime config HTTP ${response.status}`)
    }

    let remote
    try {
      remote = await response.json()
    } catch {
      return fallbackResult(options, 'Runtime config response is not valid JSON')
    }

    const validation = validateRuntimeConfigDocument(remote)
    if (!validation.valid) {
      return fallbackResult(options, validation.error)
    }

    return {
      config: resolveRuntimeConfig(remote, options),
      source: 'remote',
      error: null,
    }
  } catch (error) {
    const message =
      error?.name === 'TimeoutError'
        ? 'Runtime config request timed out'
        : error?.message || 'Failed to load runtime config'

    return fallbackResult(options, message)
  }
}
