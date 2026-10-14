import { APPLICATION_KEY } from '../config/application.js'

/**
 * Resolve the Portal token broker URL from the same base as Runtime Config.
 * Returns null when VITE_RUNTIME_CONFIG_URL is missing.
 */
export function resolvePortalAuthTokenUrl(baseUrl) {
  if (typeof baseUrl !== 'string') {
    return null
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return null
  }

  return `${trimmed}/api/v1/portal-auth/token`
}

export function getPortalAuthTokenUrl(options = {}) {
  if (options.url) {
    return options.url
  }

  return resolvePortalAuthTokenUrl(import.meta.env.VITE_RUNTIME_CONFIG_URL)
}

export class PortalTokenError extends Error {
  constructor(message, { status = 0, code = 'portal_token_error' } = {}) {
    super(message)
    this.name = 'PortalTokenError'
    this.status = status
    this.code = code
  }
}

/**
 * Request a short-lived ArcGIS Portal token from Runtime Config Backend.
 * Never logs the token. Does not accept or send Portal passwords.
 *
 * Callers must only invoke this after application authentication.
 *
 * @returns {Promise<{ token: string, expiresAt: number, referer: string, portalUrl: string, portalHostKey: string }>}
 */
export async function requestPortalToken(options = {}) {
  const portalHostKey =
    typeof options.portalHostKey === 'string'
      ? options.portalHostKey.trim().toLowerCase()
      : ''

  if (!portalHostKey) {
    throw new PortalTokenError(
      'Unable to connect to the mapping portal. Please try again.',
      { code: 'missing_portal_host_key' },
    )
  }

  const url = getPortalAuthTokenUrl(options)
  if (!url) {
    throw new PortalTokenError(
      'Unable to connect to the mapping portal. Please try again.',
      { code: 'missing_config_url' },
    )
  }

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appKey: APPLICATION_KEY,
        portalHostKey,
      }),
      signal: options.signal ?? AbortSignal.timeout(15_000),
    })
  } catch {
    throw new PortalTokenError(
      'Unable to connect to the mapping portal. Please try again.',
      { code: 'network' },
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new PortalTokenError(friendlyBrokerMessage(response.status), {
      status: response.status,
      code: `http_${response.status}`,
    })
  }

  const token = typeof data?.token === 'string' ? data.token : ''
  const expiresAt = Number(data?.expiresAt)
  const referer = typeof data?.referer === 'string' ? data.referer : ''
  const portalUrl = typeof data?.portalUrl === 'string' ? data.portalUrl : ''
  const responseHostKey =
    typeof data?.portalHostKey === 'string'
      ? data.portalHostKey.trim().toLowerCase()
      : portalHostKey

  if (!token || !Number.isFinite(expiresAt)) {
    throw new PortalTokenError(
      'Unable to connect to the mapping portal. Please try again.',
      { status: response.status, code: 'malformed_response' },
    )
  }

  if (import.meta.env.DEV) {
    console.info('Portal access acquired')
  }

  return {
    token,
    expiresAt,
    referer,
    portalUrl,
    portalHostKey: responseHostKey,
  }
}

function friendlyBrokerMessage(status) {
  if (status === 429) {
    return 'Too many portal access requests. Please wait a moment and try again.'
  }
  return 'Unable to connect to the mapping portal. Please try again.'
}
