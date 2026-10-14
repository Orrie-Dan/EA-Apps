/**
 * Portal / infrastructure access helpers.
 * PORTAL_URL and PROXY_HOSTS stay deployment-owned.
 * ArcGIS item IDs live in Runtime Config (kind + portalItemId).
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'

export const PORTAL_URL = 'https://gh.space.gov.rw/portal'
export const PORTAL_ORIGIN = 'https://gh.space.gov.rw'
export const RMB_PORTAL_URL = 'https://gis.rmb.gov.rw/portal'
export const RMB_ORIGIN = 'https://gis.rmb.gov.rw'
export const EWIS_PORTAL_URL = 'https://ewis.minema.gov.rw/portal'
export const EWIS_ORIGIN = 'https://ewis.minema.gov.rw'

export const PROXY_HOSTS = {
  gh: PORTAL_URL,
  ghw: PORTAL_ORIGIN,
  rmb: RMB_PORTAL_URL,
  rmbw: RMB_ORIGIN,
  ewis: EWIS_PORTAL_URL,
  ewisw: EWIS_ORIGIN,
  web: 'https://citizensemergencyreportingapp.netlify.app/',
}

/** Deployment embed map (local shells + absolute URLs still used by server/shells). */
export const APP_EMBED_URL = {
  floods:
    'https://gh.space.gov.rw/portal/apps/dashboards/902b4a62d0f4420ab66be44e5ad8d40c',
  landslides:
    'https://gh.space.gov.rw/portal/apps/dashboards/bfc8d4a4492b4ad29f845edb2e41f6cb',
  earthquakes:
    'https://gis.rmb.gov.rw/portal/apps/dashboards/f5182d0f80d641aba56b607b5b4700ff',
  storms:
    'https://gh.space.gov.rw/portal/apps/dashboards/e89c802794114d7d97e4731351de612c',
  lightning: '/dashboards/lightning/index.html',
  volcanic: '/dashboards/volcanic/index.html',
  fire: '/dashboards/fire-outbreaks/index.html',
  'citizen-reporting': '/dashboards/citizen-reporting/index.html',
  'emergency-reporting-forms':
    'https://gh.space.gov.rw/portal/apps/experiencebuilder/experience/?id=eb3b4f1694e44638b4547cc1e8a50847',
  'response-operations':
    'https://gh.space.gov.rw/portal/apps/experiencebuilder/experience/?id=eb3b4f1694e44638b4547cc1e8a50847',
  'disaster-effects':
    `${EWIS_PORTAL_URL}/apps/dashboards/7798e9db298d43608c0ce091dd87124d`,
  'recovery-reporting':
    `${EWIS_PORTAL_URL}/apps/dashboards/b5dccb753e63444eabb2edaab494ac43`,
  'volunteer-coordination':
    `${EWIS_PORTAL_URL}/apps/dashboards/1802df7212f14aa699e250672425bfca`,
  firefighting: '/dashboards/firefighting/index.html',
}

export function inferPortalHostKey(url) {
  try {
    const origin = new URL(String(url || '')).origin
    for (const [key, base] of Object.entries(PROXY_HOSTS)) {
      if (!base) continue
      let hostOrigin
      try {
        hostOrigin = new URL(base).origin
      } catch {
        continue
      }
      if (hostOrigin !== origin) continue
      if (key === 'ghw') return 'gh'
      if (key === 'rmbw') return 'rmb'
      if (key === 'ewisw') return 'ewis'
      return key
    }
  } catch {
    return ''
  }
  return ''
}

export function inferPortalAppKind(app) {
  if (app?.kind === 'experience' || app?.kind === 'dashboard') return app.kind
  const url = String(app?.externalUrl || app?.embedUrl || '')
  if (url.includes('experiencebuilder')) return 'experience'
  if (url.includes('/apps/dashboards/')) return 'dashboard'
  return app?.kind || ''
}

/**
 * Append a short-lived ArcGIS token to a Portal app URL at open time.
 * AUTH-04: obsolete for production embeds — use buildProxyEmbedUrl instead.
 * Kept only for unit coverage of sanitization helpers.
 */
export function buildAuthenticatedPortalUrl(input) {
  const token = String(input?.token || '').trim()
  const base = buildAppSource({
    kind: input?.kind,
    portalItemId: input?.portalItemId,
    portalUrl: input?.portalUrl,
    host: input?.host,
  })
  if (!base?.portalUrl) return null
  if (!token) return base.portalUrl

  const url = new URL(base.portalUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

/**
 * Same-origin proxy embed path for Dashboard / Experience content.
 * Portal tokens are attached server-side — never in this URL.
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

export function buildAppSourcesFromModules(modules, portalUrl = PORTAL_URL) {
  const sources = {}
  for (const mod of modules || []) {
    for (const app of mod.apps || []) {
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
    DEFAULT_RUNTIME_CONFIG.extensions?.['disaster-emergency-mapping']
      ?.stagedApps || []
  for (const app of staged) {
    if (app.externalUrl && !app.portalItemId) {
      sources[app.id] = {
        host: app.portalHostKey || 'web',
        path: '',
        portalUrl: app.externalUrl,
        public: true,
      }
      continue
    }
    const hostKey = app.portalHostKey || 'gh'
    const root = PROXY_HOSTS[hostKey] || PORTAL_URL
    const source = buildAppSource({
      kind: app.kind === 'localShell' ? 'dashboard' : app.kind,
      portalItemId: app.portalItemId,
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
  if (!source) return null
  const path = source.path ? `/${source.path}`.replace(/\/{2,}/g, '/') : '/'
  const search = source.search ? `?${source.search}` : ''
  const hash = source.hash ? `#${source.hash.replace(/^#/, '')}` : ''
  return `/api/portal/proxy/${source.host}${path}${search}${hash}`
}
