import { PORTAL_URL, PROXY_HOSTS, buildAppSource } from '../lib/access.js'
import { DEFAULT_RUNTIME_CONFIG } from './defaults.js'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Merge remote Runtime Config onto bundled defaults.
 *
 * - Objects: shallow-merge per known section; preserve unknown top-level keys from remote.
 * - modules: when remote.modules is an array, REPLACE entirely (no index merge).
 * - footer.quickLinks: when remote provides an array, REPLACE; else keep defaults.
 * - extensions: when remote provides an object, REPLACE; else keep defaults.
 * - Defaults object is never mutated.
 */
export function mergeRuntimeConfig(defaults, remote) {
  if (!isPlainObject(remote)) {
    return structuredClone(defaults)
  }

  const base = structuredClone(defaults)
  const merged = {
    ...base,
    ...remote,
    app: { ...base.app, ...(isPlainObject(remote.app) ? remote.app : {}) },
    branding: {
      ...base.branding,
      ...(isPlainObject(remote.branding) ? remote.branding : {}),
    },
    organization: {
      ...base.organization,
      ...(isPlainObject(remote.organization) ? remote.organization : {}),
    },
    contact: {
      ...base.contact,
      ...(isPlainObject(remote.contact) ? remote.contact : {}),
    },
    footer: {
      ...base.footer,
      ...(isPlainObject(remote.footer) ? remote.footer : {}),
    },
    legal: {
      ...base.legal,
      ...(isPlainObject(remote.legal) ? remote.legal : {}),
    },
    modules: Array.isArray(remote.modules) ? remote.modules : base.modules,
    extensions: isPlainObject(remote.extensions)
      ? remote.extensions
      : base.extensions,
  }

  if (isPlainObject(remote.footer) && Array.isArray(remote.footer.quickLinks)) {
    merged.footer.quickLinks = remote.footer.quickLinks
  } else {
    merged.footer.quickLinks = base.footer.quickLinks
  }

  return merged
}

function interpolate(text, vars) {
  if (typeof text !== 'string') return text
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], vars)
    return value == null ? '' : String(value)
  })
}

function resolveLegal(legal, vars) {
  const pages = {}
  for (const [key, page] of Object.entries(legal || {})) {
    if (!isPlainObject(page)) continue
    pages[key] = {
      title: page.title,
      body: (page.body || []).map((paragraph) => interpolate(paragraph, vars)),
    }
  }
  return pages
}

function resolvePortalRoot(portalHostKey, optionsPortalUrl) {
  if (optionsPortalUrl) {
    return String(optionsPortalUrl).replace(/\/$/, '')
  }
  if (portalHostKey && PROXY_HOSTS[portalHostKey]) {
    return String(PROXY_HOSTS[portalHostKey]).replace(/\/$/, '')
  }
  return String(PORTAL_URL).replace(/\/$/, '')
}

function publishedModules(catalog) {
  return catalog
    .filter((mod) => !mod.hidden)
    .map((mod) => ({
      ...mod,
      solutions: mod.solutions.filter(
        (app) => Boolean(app.embedUrl) && app.published !== false,
      ),
    }))
    .filter((mod) => mod.solutions.length > 0)
}

function buildQuickLinksFromModules(modules) {
  const links = [{ label: 'Home', to: '/' }]
  for (const mod of modules) {
    for (const app of mod.solutions) {
      links.push({
        label: app.footerLabel || app.name,
        to: `/module/${mod.id}/app/${app.id}`,
      })
    }
  }
  return links
}

/**
 * Turn a raw Runtime Config document into the shape the Education Mapping UI consumes.
 * ArcGIS URLs are composed from deployment PORTAL_URL / PROXY_HOSTS + kind + portalItemId.
 */
export function resolveRuntimeConfig(raw, options = {}) {
  const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, raw)
  const appSources = {}

  const catalog = (merged.modules || []).map((mod) => ({
    id: mod.id,
    name: mod.name,
    icon: mod.icon,
    description: mod.description,
    image: mod.image,
    hidden: Boolean(mod.hidden),
    solutions: (mod.apps || []).map((app) => {
      const portalRoot = resolvePortalRoot(app.portalHostKey, options.portalUrl)
      let embedUrl = ''
      let source = null

      if (app.kind === 'external' && app.externalUrl) {
        embedUrl = app.externalUrl
      } else if (app.kind === 'localShell' && app.localShellPath) {
        embedUrl = app.localShellPath
      } else {
        source = buildAppSource({
          kind: app.kind,
          portalItemId: app.portalItemId,
          portalUrl: portalRoot,
          host: app.portalHostKey || 'gh',
        })
        if (source) appSources[app.id] = source
        embedUrl = source?.portalUrl || ''
      }

      return {
        id: app.id,
        name: app.name,
        footerLabel: app.footerLabel,
        description: app.description,
        type: app.type,
        image: app.image,
        icon: app.icon,
        kind: app.kind,
        portalItemId: app.portalItemId,
        portalHostKey: app.portalHostKey,
        externalUrl: app.externalUrl,
        localShellPath: app.localShellPath,
        published: app.published,
        embedUrl,
        url: embedUrl,
      }
    }),
  }))

  const modules = publishedModules(catalog)
  const vars = {
    app: merged.app,
    organization: merged.organization,
  }

  const portal = { ...merged.app }
  const quickLinks =
    Array.isArray(merged.footer?.quickLinks) && merged.footer.quickLinks.length > 0
      ? merged.footer.quickLinks
      : buildQuickLinksFromModules(modules)

  const footer = {
    blurb: merged.footer.blurb,
    quickLinks,
    contact: { ...merged.contact },
  }

  function getModule(moduleId) {
    return modules.find((mod) => mod.id === moduleId) ?? null
  }

  function getSolution(moduleId, solutionId) {
    const mod = getModule(moduleId)
    if (!mod) return { module: null, solution: null }
    return {
      module: mod,
      solution: mod.solutions.find((app) => app.id === solutionId) ?? null,
    }
  }

  function getFirstSolutionPath() {
    const first = modules[0]
    const solution = first?.solutions[0]
    if (!first || !solution) return null
    return `/module/${first.id}/app/${solution.id}`
  }

  return {
    portal,
    branding: { ...merged.branding },
    organization: { ...merged.organization },
    contact: { ...merged.contact },
    footer,
    legal: resolveLegal(merged.legal, vars),
    modules,
    extensions: isPlainObject(merged.extensions) ? { ...merged.extensions } : {},
    appSources,
    stats: {
      modules: modules.length,
      solutions: modules.reduce((sum, mod) => sum + mod.solutions.length, 0),
    },
    getModule,
    getSolution,
    getFirstSolutionPath,
    raw: merged,
  }
}

export function resolveDefaultRuntimeConfig(options) {
  return resolveRuntimeConfig(DEFAULT_RUNTIME_CONFIG, options)
}
