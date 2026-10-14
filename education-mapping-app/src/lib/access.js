/**
 * Portal / infrastructure access helpers.
 * PORTAL_URL and PROXY_HOSTS stay deployment-owned.
 * ArcGIS item IDs live in Runtime Config (kind + portalItemId).
 *
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'

export const PORTAL_URL = 'https://gh.space.gov.rw/portal'
export const INFRA_PORTAL_URL = 'https://infrastructure.space.gov.rw/portal'
export const INFRA_ORIGIN = 'https://infrastructure.space.gov.rw'

export const PROXY_HOSTS = {
  gh: PORTAL_URL,
  ghw: 'https://gh.space.gov.rw',
  infra: INFRA_PORTAL_URL,
  // Wide origin for /server, /arcgis, etc. (rewrites use /api/portal/proxy/infraw/…)
  infraw: INFRA_ORIGIN,
}

/** Same-origin local dashboard shells (static public files; deployment artifacts). */
export const APP_EMBED_URL = {}

/**
 * Build an ArcGIS app source from kind + portal item id.
 * @param {{ kind?: string, portalItemId?: string, host?: string, portalUrl?: string }} app
 */
export function buildAppSource(app) {
  const portalItemId = String(app?.portalItemId || '').trim()
  if (!portalItemId) return null

  const portalRoot = String(app?.portalUrl || PORTAL_URL).replace(/\/$/, '')
  const host = app?.host || 'gh'
  const kind = app?.kind === 'experience' ? 'experience' : 'dashboard'

  if (kind === 'experience') {
    return {
      host,
      path: 'apps/experiencebuilder/experience/',
      search: `id=${portalItemId}`,
      portalUrl: `${portalRoot}/apps/experiencebuilder/experience/?id=${portalItemId}`,
    }
  }

  return {
    host,
    path: `apps/dashboards/${portalItemId}`,
    portalUrl: `${portalRoot}/apps/dashboards/${portalItemId}`,
  }
}

/**
 * Build APP_SOURCES map from Runtime Config module apps.
 */
export function buildAppSourcesFromModules(modules, portalUrl = PORTAL_URL) {
  const sources = {}
  for (const mod of modules || []) {
    for (const app of mod.apps || []) {
      const hostKey = app.portalHostKey || 'gh'
      const root =
        hostKey && PROXY_HOSTS[hostKey]
          ? PROXY_HOSTS[hostKey]
          : portalUrl
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

/** Default sources for unused server/proxy code paths (seeded from bundled defaults). */
export const APP_SOURCES = buildAppSourcesFromModules(DEFAULT_RUNTIME_CONFIG.modules)

export function proxyPathFor(appKey, sources = APP_SOURCES) {
  const source = sources[appKey]
  if (!source) return null
  const path = source.path ? `/${source.path}`.replace(/\/{2,}/g, '/') : '/'
  const search = source.search ? `?${source.search}` : ''
  const hash = source.hash ? `#${source.hash.replace(/^#/, '')}` : ''
  return `/api/portal/proxy/${source.host}${path}${search}${hash}`
}

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

  const kind =
    input?.kind === 'experience' || input?.authKind === 'experience'
      ? 'experience'
      : 'dashboard'

  if (kind === 'experience') {
    return `/api/portal/proxy/${host}/apps/experiencebuilder/experience/?id=${encodeURIComponent(portalItemId)}`
  }

  return `/api/portal/proxy/${host}/apps/dashboards/${encodeURIComponent(portalItemId)}`
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