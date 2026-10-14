/**
 * Portal / infrastructure access helpers.
 * PORTAL_URL and PROXY_HOSTS stay deployment-owned.
 * ArcGIS / Survey123 item IDs live in Runtime Config.
 *
 * Same-origin embeds use /api/portal/gh (deployment proxy path), matching
 * the portal.js rewrite these workspaces shipped with.
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'
import { APP_BASE_PATH } from '../config/application.js'

export const PORTAL_URL = 'https://gis.rdb.rw/portal'
export const SURVEY123_ORIGIN = 'https://survey123.arcgis.com'
export const FORMS_PROXY_BASE = '/api/forms'

export const PROXY_HOSTS = {
  rdb: 'https://gis.rdb.rw/portal',
}

/** Same-origin proxy base per host key. null = frame absolute portal URL. */
export const PROXY_PATHS = {
  rdb: '/api/portal/gh',
}

/** Reserved for local shells; currently unused by published embeds. */
export const APP_EMBED_URL = {}

function pageOrigin() {
  return typeof window !== 'undefined' && window.location ? window.location.origin : ''
}

function proxiedPortalUrl(hostKey, absolutePortalUrl) {
  const root = String(PROXY_HOSTS[hostKey] || PORTAL_URL).replace(/\/$/, '')
  const proxy = PROXY_PATHS[hostKey]
  if (!proxy) return absolutePortalUrl
  if (!absolutePortalUrl.startsWith(root)) return absolutePortalUrl
  return proxy + absolutePortalUrl.slice(root.length)
}

function formEmbedUrl(formId, portalHostKey = 'rdb') {
  const proxy = PROXY_PATHS[portalHostKey] || '/api/portal/gh'
  const portalUrl = `${pageOrigin()}${APP_BASE_PATH}${proxy}`
  return `${FORMS_PROXY_BASE}/share/${formId}?portalUrl=${encodeURIComponent(portalUrl)}`
}

/**
 * @param {{ kind?: string, portalItemId?: string, host?: string, portalUrl?: string, experienceSearch?: string, externalUrl?: string }} app
 */
export function buildAppSource(app) {
  const portalItemId = String(app?.portalItemId || '').trim()
  const host = app?.host || 'rdb'
  const kind = app?.kind || 'dashboard'
  const portalRoot = String(app?.portalUrl || PROXY_HOSTS[host] || PORTAL_URL).replace(/\/$/, '')

  if (kind === 'external' && app?.externalUrl) {
    return {
      host: host || 'external',
      portalUrl: app.externalUrl,
      embedUrl: app.externalUrl,
    }
  }

  if (!portalItemId) return null

  if (kind === 'survey123') {
    return {
      host: 'survey123',
      path: `share/${portalItemId}`,
      portalUrl: formEmbedUrl(portalItemId, host),
    }
  }

  if (kind === 'experience') {
    const search =
      app.experienceSearch || `id=${portalItemId}`
    const absolute = `${portalRoot}/apps/experiencebuilder/experience/?${search}`
    return {
      host,
      path: 'apps/experiencebuilder/experience/',
      search,
      portalUrl: proxiedPortalUrl(host, absolute),
    }
  }

  if (kind === 'dashboard') {
    const absolute = `${portalRoot}/apps/dashboards/${portalItemId}`
    return {
      host,
      path: `apps/dashboards/${portalItemId}`,
      portalUrl: proxiedPortalUrl(host, absolute),
    }
  }

  return null
}

export function buildAppSourcesFromModules(modules, portalUrl = PORTAL_URL) {
  const sources = {}
  for (const mod of modules || []) {
    for (const app of mod.apps || []) {
      if (app.kind === 'external' && app.externalUrl) {
        sources[app.id] = {
          host: app.portalHostKey || 'external',
          embedUrl: app.externalUrl,
          portalUrl: app.externalUrl,
        }
        continue
      }
      const hostKey = app.portalHostKey || 'rdb'
      const root =
        hostKey && PROXY_HOSTS[hostKey] ? PROXY_HOSTS[hostKey] : portalUrl
      const source = buildAppSource({
        ...app,
        host: hostKey,
        portalUrl: root,
      })
      if (source) sources[app.id] = source
    }
  }
  return sources
}

function buildDefaultAppSources() {
  const sources = buildAppSourcesFromModules(DEFAULT_RUNTIME_CONFIG.modules)
  const staged =
    DEFAULT_RUNTIME_CONFIG.extensions?.['parks-operations']?.stagedApps || []
  for (const app of staged) {
    if (app.kind === 'external' && app.externalUrl) {
      sources[app.id] = {
        host: 'external',
        embedUrl: app.externalUrl,
        portalUrl: app.externalUrl,
      }
      continue
    }
    const hostKey = app.portalHostKey || 'rdb'
    const root = PROXY_HOSTS[hostKey] || PORTAL_URL
    const source = buildAppSource({
      ...app,
      host: hostKey,
      portalUrl: root,
    })
    if (source) sources[app.id] = source
  }
  return sources
}

export const APP_SOURCES = buildDefaultAppSources()



/**
 * Same-origin proxy embed path for Dashboard / Experience content.
 * Portal tokens are attached server-side - never in this URL.
 */
export function buildProxyEmbedUrl(input) {
  const portalItemId = String(input?.portalItemId || '').trim()
  const host = String(input?.host || input?.portalHostKey || '')
    .trim()
    .toLowerCase()
  if (!portalItemId || !host) return null
  if (!PROXY_HOSTS[host]) return null

  const proxyBase = PROXY_PATHS[host]
  if (!proxyBase) return null

  const kind =
    input?.kind === 'experience' || input?.authKind === 'experience'
      ? 'experience'
      : 'dashboard'

  if (kind === 'experience') {
    return proxyBase + '/apps/experiencebuilder/experience/?id=' + encodeURIComponent(portalItemId)
  }

  return proxyBase + '/apps/dashboards/' + encodeURIComponent(portalItemId)
}

export function sanitizePortalEmbedUrl(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://example.invalid')
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '<REDACTED>')
    }
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return ''
  }
}
