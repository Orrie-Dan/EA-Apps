/**
 * Portal / infrastructure access helpers.
 * Multi-host map + Survey123 stay deployment-owned.
 * ArcGIS / form item IDs live in Runtime Config.
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'
import { APP_BASE_PATH } from '../config/application.js'

export const PORTAL_URL = 'https://gh.space.gov.rw/portal'
export const PORTAL_ORIGIN = 'https://gh.space.gov.rw'
export const RMB_PORTAL_URL = 'https://gis.rmb.gov.rw/portal'
export const RMB_ORIGIN = 'https://gis.rmb.gov.rw'
export const RBC_PORTAL_URL = 'https://gis.rbc.gov.rw/portal'
export const RBC_ORIGIN = 'https://gis.rbc.gov.rw'
export const ESRIRW_PORTAL_URL = 'https://esrirw.rw/portal'
export const ESRIRW_ORIGIN = 'https://esrirw.rw'
export const SURVEY123_ORIGIN = 'https://survey123.arcgis.com'

export const PROXY_HOSTS = {
  gh: PORTAL_URL,
  ghw: PORTAL_ORIGIN,
  // GeoHub under the Runtime Config "geohub2" credential (same portal as gh).
  gh2: PORTAL_URL,
  gh2w: PORTAL_ORIGIN,
  rmb: RMB_PORTAL_URL,
  rmbw: RMB_ORIGIN,
  rbc: RBC_PORTAL_URL,
  rbcw: RBC_ORIGIN,
  esrirw: ESRIRW_PORTAL_URL,
  esrirww: ESRIRW_ORIGIN,
  s123: SURVEY123_ORIGIN,
  web: 'https://citizensemergencyreportingapp.netlify.app/',
}

function survey123ProxyUrl(formId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `/api/portal/proxy/s123/share/${formId}?portalUrl=${origin}${APP_BASE_PATH}/api/portal/proxy/esrirw`
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
      if (key === 'gh2w') return 'gh2'
      if (key === 'rmbw') return 'rmb'
      if (key === 'rbcw') return 'rbc'
      if (key === 'esrirww') return 'esrirw'
      return key
    }
  } catch {
    return ''
  }
  return ''
}

export function inferPortalAppKind(app) {
  if (
    app?.kind === 'experience' ||
    app?.kind === 'dashboard' ||
    app?.kind === 'survey123'
  ) {
    return app.kind
  }
  const url = String(app?.externalUrl || app?.embedUrl || '')
  if (url.includes('survey123') || url.includes('/share/')) return 'survey123'
  if (url.includes('experiencebuilder')) return 'experience'
  if (url.includes('/apps/dashboards/')) return 'dashboard'
  return app?.kind || ''
}

/**
 * Same-origin proxy embed path for Dashboard / Experience / Survey123 content.
 * Portal tokens are attached server-side — never in this URL.
 */
export function buildProxyEmbedUrl(input) {
  const portalItemId = String(input?.portalItemId || '').trim()
  const host = String(input?.host || input?.portalHostKey || '')
    .trim()
    .toLowerCase()
  if (!portalItemId || !host) return null

  const kind =
    input?.kind === 'experience' || input?.authKind === 'experience'
      ? 'experience'
      : input?.kind === 'survey123' || input?.authKind === 'survey123'
        ? 'survey123'
        : 'dashboard'

  if (kind === 'survey123') {
    if (host === 'esrirw') {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      return `/api/portal/proxy/s123/share/${encodeURIComponent(portalItemId)}?portalUrl=${origin}${APP_BASE_PATH}/api/portal/proxy/esrirw`
    }
    if (!PROXY_HOSTS[host]) return null
    return `/api/portal/proxy/${host}/share/${encodeURIComponent(portalItemId)}`
  }

  if (!PROXY_HOSTS[host]) return null

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

/** Deployment embed map retained for server/shell compatibility. */
export const APP_EMBED_URL = {
  'primary-healthcare-access':
    'https://gh.space.gov.rw/portal/apps/dashboards/27973ee1a8e247d7b44a98479eec71f3',
  'health-centre-to-district-hospital':
    'https://gh.space.gov.rw/portal/apps/dashboards/626b6461ae4948788b2c6b9b9231ecec',
  'district-to-provincial-hospital':
    'https://gh.space.gov.rw/portal/apps/dashboards/b874415d6ebb4bf4b428189d5fef85be',
  'provincial-to-referral-hospital':
    'https://gh.space.gov.rw/portal/apps/dashboards/bd50d196e7bb4e4ea474fff04c44303e',
  'sector-to-referral-hospital':
    'https://gh.space.gov.rw/portal/apps/dashboards/7bcfb3bfcd114ef487fc3cb0c86204ad',
  'health-emergency-response':
    '/api/portal/proxy/esrirw/apps/dashboards/0853f19fe0a645008c0c95969855b1f2',
  'emergency-medical-service':
    '/api/portal/proxy/esrirw/apps/dashboards/fac586ef13be4c84856f66d0b5de0034',
  'samu-reporting-form': survey123ProxyUrl('9ea5acc523984c45b2aae19a33c43796'),
  'confirmed-case-dashboard':
    'https://gis.rbc.gov.rw/portal/apps/dashboards/58672ddce9ee433ca4edde6d0f85c486',
  'contact-tracing-dashboard':
    'https://gis.rbc.gov.rw/portal/apps/dashboards/2189cc6c7f0a431ab6db31476aaf17c1',
  'confirmed-case-report-form':
    'https://survey123.arcgis.com/share/d0ccb11cd8424ee39114c2a986cd04c2?portalUrl=https://gis.rbc.gov.rw/portal',
  'contact-report-form':
    'https://survey123.arcgis.com/share/93a5a69aeccf4903b6bc94e2a3021539?portalUrl=https://gis.rbc.gov.rw/portal',
  vaccination:
    'https://gis.rbc.gov.rw/portal/apps/experiencebuilder/experience/?id=9d6b84d4e7b24d6aa379f0c221f4b264',
  'national-vaccination-dashboard':
    'https://gis.rbc.gov.rw/portal/apps/dashboards/e20ff598d2cc493ca909e7cc12ee78e8',
  'medical-supply-routing':
    'https://gis.rbc.gov.rw/portal/apps/dashboards/f50838e3c7b74912963d6f4da4248723',
}

/**
 * @param {{ kind?: string, portalItemId?: string, host?: string, portalUrl?: string }} app
 */
export function buildAppSource(app) {
  const portalItemId = String(app?.portalItemId || '').trim()
  if (!portalItemId) return null

  const portalRoot = String(app?.portalUrl || PORTAL_URL).replace(/\/$/, '')
  const host = app?.host || 'gh'
  const kind = app?.kind || 'dashboard'

  if (kind === 'survey123') {
    if (host === 'esrirw') {
      return {
        host: 's123',
        path: `share/${portalItemId}`,
        portalUrl: survey123ProxyUrl(portalItemId),
        public: false,
      }
    }
    return {
      host,
      path: `share/${portalItemId}`,
      portalUrl: `${SURVEY123_ORIGIN}/share/${portalItemId}?portalUrl=${portalRoot}`,
      public: true,
    }
  }

  if (kind === 'experience') {
    if (host === 'esrirw') {
      return {
        host,
        path: 'apps/experiencebuilder/experience/',
        search: `id=${portalItemId}`,
        portalUrl: `/api/portal/proxy/esrirw/apps/experiencebuilder/experience/?id=${portalItemId}`,
        public: false,
      }
    }
    return {
      host,
      path: 'apps/experiencebuilder/experience/',
      search: `id=${portalItemId}`,
      portalUrl: `${portalRoot}/apps/experiencebuilder/experience/?id=${portalItemId}`,
      public: host !== 'esrirw',
    }
  }

  // dashboard (default)
  if (host === 'esrirw') {
    return {
      host,
      path: `apps/dashboards/${portalItemId}`,
      portalUrl: `/api/portal/proxy/esrirw/apps/dashboards/${portalItemId}`,
      public: false,
    }
  }

  return {
    host,
    path: `apps/dashboards/${portalItemId}`,
    portalUrl: `${portalRoot}/apps/dashboards/${portalItemId}`,
    public: true,
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
    DEFAULT_RUNTIME_CONFIG.extensions?.['health-mapping']?.stagedApps || []
  for (const app of staged) {
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
  if (!source) return null
  const path = source.path ? `/${source.path}`.replace(/\/{2,}/g, '/') : '/'
  const search = source.search ? `?${source.search}` : ''
  const hash = source.hash ? `#${source.hash.replace(/^#/, '')}` : ''
  return `/api/portal/proxy/${source.host}${path}${search}${hash}`
}
