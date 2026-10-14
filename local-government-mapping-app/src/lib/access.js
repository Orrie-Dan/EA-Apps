/**
 * Portal / infrastructure access helpers.
 * PORTAL_URL and PROXY_HOSTS stay deployment-owned.
 * ArcGIS / Survey123 item IDs live in Runtime Config.
 *
 * Imihigo apps embed infrastructure.space.gov.rw URLs directly (no GeoHub token).
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'

export const PORTAL_URL = 'https://gh.space.gov.rw/portal'
export const INFRA_PORTAL_URL = 'https://infrastructure.space.gov.rw/portal'
export const INFRA_ORIGIN = 'https://infrastructure.space.gov.rw'
export const SURVEY123_ORIGIN = 'https://survey123.arcgis.com'

export const PROXY_HOSTS = {
  gh: PORTAL_URL,
  ghw: 'https://gh.space.gov.rw',
  infra: INFRA_PORTAL_URL,
  // Wide origin for /server, /arcgis, etc. (rewrites use /api/portal/proxy/infraw/…)
  infraw: INFRA_ORIGIN,
}

/** Reserved for local shells; currently unused by published embeds. */
export const APP_EMBED_URL = {}

/**
 * @param {{ kind?: string, portalItemId?: string, host?: string, portalUrl?: string }} app
 */
export function buildAppSource(app) {
  const portalItemId = String(app?.portalItemId || '').trim()
  if (!portalItemId && app?.kind !== 'external') return null

  const portalRoot = String(app?.portalUrl || PORTAL_URL).replace(/\/$/, '')
  const host = app?.host || 'gh'
  const kind = app?.kind || 'dashboard'

  if (kind === 'survey123') {
    if (!portalItemId) return null
    return {
      host: 'survey123',
      path: `share/${portalItemId}`,
      portalUrl: `${SURVEY123_ORIGIN}/share/${portalItemId}?portalUrl=${portalRoot}`,
    }
  }

  if (kind === 'experience') {
    if (!portalItemId) return null
    return {
      host,
      path: 'apps/experiencebuilder/experience/',
      search: `id=${portalItemId}`,
      portalUrl: `${portalRoot}/apps/experiencebuilder/experience/?id=${portalItemId}`,
    }
  }

  if (kind === 'dashboard') {
    if (!portalItemId) return null
    return {
      host,
      path: `apps/dashboards/${portalItemId}`,
      portalUrl: `${portalRoot}/apps/dashboards/${portalItemId}`,
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
      const hostKey = app.portalHostKey || 'gh'
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
    DEFAULT_RUNTIME_CONFIG.extensions?.['local-government-mapping']
      ?.stagedApps || []
  for (const app of staged) {
    if (app.kind === 'external' && app.externalUrl) {
      sources[app.id] = {
        host: 'external',
        embedUrl: app.externalUrl,
        portalUrl: app.externalUrl,
      }
      continue
    }
    const hostKey = app.portalHostKey || 'gh'
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

export function proxyPathFor(appKey, sources = APP_SOURCES) {
  const source = sources[appKey]
  if (!source || source.host !== 'gh') return null
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