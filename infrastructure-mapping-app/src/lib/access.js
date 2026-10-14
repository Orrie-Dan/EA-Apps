/**
 * Portal / infrastructure access helpers.
 * Multi-agency PROXY_HOSTS stay deployment-owned.
 * ArcGIS item IDs live in Runtime Config.
 */
import { DEFAULT_RUNTIME_CONFIG } from '../config/defaults.js'

export const PORTAL_URL = 'https://gh.space.gov.rw/portal'
export const PORTAL_ORIGIN = 'https://gh.space.gov.rw'
export const WASAC_PORTAL_URL = 'https://gis.wasac.rw/portal'
export const WASAC_ORIGIN = 'https://gis.wasac.rw'
export const RURA_PORTAL_URL = 'https://arcgis.rura.rw/portal'
export const RURA_ORIGIN = 'https://arcgis.rura.rw'
export const REG_PORTAL_URL = 'https://gisweb.reg.rw/portal'
export const REG_ORIGIN = 'https://gisweb.reg.rw'
export const COK_PORTAL_URL = 'https://inspection.kigalicity.gov.rw/portal'
export const COK_ORIGIN = 'https://inspection.kigalicity.gov.rw'

export const PROXY_HOSTS = {
  gh: PORTAL_URL,
  ghw: PORTAL_ORIGIN,
  // Same portal as gh, reached with the Runtime Config "geohub2" credential.
  // Listed after gh so a bare GeoHub URL still infers gh.
  gh2: PORTAL_URL,
  gh2w: PORTAL_ORIGIN,
  wasac: WASAC_PORTAL_URL,
  wasacw: WASAC_ORIGIN,
  rura: RURA_PORTAL_URL,
  ruraw: RURA_ORIGIN,
  reg: REG_PORTAL_URL,
  regw: REG_ORIGIN,
  cok: COK_PORTAL_URL,
  cokw: COK_ORIGIN,
  web: 'https://inspection.space.gov.rw/',
}

/** Deployment embed map retained for compatibility with server/mirror tooling. */
export const APP_EMBED_URL = {
  'water-network':
    '/portal/apps/experiencebuilder/experience/?id=5fc41bffcdcb458b90de05e1a6a05c30',
  'kigali-water-network-dashboard':
    'https://gis.wasac.rw/portal/apps/dashboards/753103c5542e4bcfb6522b24d645521c',
  'upcountry-water-network-dashboard':
    'https://gis.wasac.rw/portal/apps/dashboards/2d937ac2eaf1457f82682914e5ec1813',
  'delegated-water-network-dashboard':
    'https://gis.wasac.rw/portal/apps/dashboards/1d0d28f84bb64e55a5be670b6eef0bee',
  'water-sanitation':
    'https://arcgis.rura.rw/portal/apps/dashboards/769e3416151741baaf64351884cd04b1',
  telecommunication:
    'https://arcgis.rura.rw/portal/apps/dashboards/a40ef5ab66d3491da1a05fd3578d5b9f',
  'electricity-mapping':
    'https://gisweb.reg.rw/portal/apps/dashboards/ed7be680a68f4390995879f8f03ab0d9',
  'transport-accessibility':
    'https://gh.space.gov.rw/portal/apps/dashboards/0a331d36df3f4e30998b23a027454e5d',
  'electricity-accessibility':
    'https://gh.space.gov.rw/portal/apps/dashboards/cf44eb1a0b8d4e819fa963e5fbc013e4',
  'internet-accessibility':
    'https://gh.space.gov.rw/portal/apps/dashboards/f0a5095875564185a70eb06f352b8627',
  'water-accessibility':
    'https://gh.space.gov.rw/portal/apps/dashboards/4013dcf504ad450289a6a0570e89ceb9',
  'government-assets':
    'https://gh.space.gov.rw/portal/apps/dashboards/bcf0f52938b74b6b95c65b7411fc61e5',
  'informal-settlement':
    'https://gh.space.gov.rw/portal/apps/dashboards/7cc82c4014c4402c93bb3920e05f3d52',
  'rural-settlement':
    'https://gh.space.gov.rw/portal/apps/dashboards/e7e0645fff854cc9960c4fb26605f0b2',
  inspection: 'https://inspection.space.gov.rw/',
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
      if (key === 'wasacw') return 'wasac'
      if (key === 'ruraw') return 'rura'
      if (key === 'regw') return 'reg'
      if (key === 'cokw') return 'cok'
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
    DEFAULT_RUNTIME_CONFIG.extensions?.['infrastructure-mapping']?.stagedApps ||
    []
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
