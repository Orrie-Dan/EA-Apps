import { PORTAL_URL, PROXY_HOSTS, buildAppSource } from '../lib/access.js'
import { DEFAULT_RUNTIME_CONFIG } from './defaults.js'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

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

function softAccent(hex, alpha) {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) {
    return undefined
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildQuickLinksFromModules(modules) {
  const links = [{ label: 'Home', to: '/' }]
  for (const mod of modules) {
    for (const app of mod.solutions) {
      if (app.isForm) continue
      links.push({
        label: app.footerLabel || app.name,
        to: `/module/${mod.id}/app/${app.id}`,
      })
    }
  }
  return links
}

function attachFormsAndGroups(solutions) {
  const byId = new Map(solutions.map((s) => [s.id, s]))
  for (const s of solutions) {
    if (s.isForm && s.formParentId && byId.has(s.formParentId)) {
      const parent = byId.get(s.formParentId)
      parent.form = s
    }
  }

  const groupOrder = []
  const groupMap = new Map()
  for (const s of solutions) {
    if (s.isForm) continue
    const key = s.group || '__flat__'
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        name: s.group || null,
        icon: s.groupIcon || null,
        solutions: [],
      })
      groupOrder.push(key)
    }
    groupMap.get(key).solutions.push(s)
  }

  const hasNamedGroups = solutions.some((s) => s.group)
  const groups = hasNamedGroups
    ? groupOrder.map((k) => groupMap.get(k))
    : undefined

  return { solutions, groups }
}

function publishedModules(catalog) {
  return catalog
    .filter((mod) => !mod.hidden)
    .map((mod) => {
      const liveSolutions = mod.solutions.filter(
        (app) => Boolean(app.embedUrl) && app.published !== false,
      )
      const { solutions, groups } = attachFormsAndGroups(liveSolutions)
      const liveGroups = groups
        ? groups
            .map((g) => ({
              ...g,
              solutions: g.solutions.filter((s) => Boolean(s.embedUrl)),
            }))
            .filter((g) => g.solutions.length > 0)
        : undefined
      return {
        ...mod,
        groups: liveGroups,
        solutions,
      }
    })
    .filter((mod) => mod.solutions.length > 0)
}

/**
 * Turn a raw Runtime Config document into the shape this workspace UI consumes.
 * ArcGIS URLs are composed from deployment PORTAL_URL / PROXY_HOSTS + kind + portalItemId.
 */
export function resolveRuntimeConfig(raw, options = {}) {
  const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, raw)
  const appSources = {}

  const catalog = (merged.modules || []).map((mod) => ({
    id: mod.id,
    name: mod.name,
    shortName: mod.shortName || mod.name,
    icon: mod.icon,
    description: mod.description,
    image: mod.image,
    hidden: Boolean(mod.hidden),
    untitled: Boolean(mod.untitled),
    accent: mod.accent,
    accentText: mod.accentText || mod.accent,
    accentDark: mod.accentText || mod.accent,
    accentSoft: softAccent(mod.accent, 0.12),
    solutions: (mod.apps || []).map((app) => {
      const portalRoot = resolvePortalRoot(app.portalHostKey, options.portalUrl)
      let embedUrl = ''
      let source = null

      if (app.kind === 'external' && app.externalUrl) {
        embedUrl = app.externalUrl
      } else if (app.localShellPath) {
        embedUrl = app.localShellPath
      } else {
        source = buildAppSource({
          kind: app.kind,
          portalItemId: app.portalItemId,
          portalUrl: portalRoot,
          host: app.portalHostKey || Object.keys(PROXY_HOSTS)[0],
          experienceSearch: app.experienceSearch,
          externalUrl: app.externalUrl,
        })
        if (source) appSources[app.id] = source
        embedUrl = source?.portalUrl || ''
      }

      return {
        id: app.id,
        name: app.name,
        shortName: app.shortName || app.name,
        footerLabel: app.footerLabel,
        description: app.description,
        type: app.type,
        image: app.image,
        icon: app.icon,
        year: app.year,
        kind: app.kind,
        portalItemId: app.portalItemId,
        portalHostKey: app.portalHostKey,
        externalUrl: app.externalUrl,
        localShellPath: app.localShellPath,
        published: app.published,
        isForm: Boolean(app.isForm),
        formParentId: app.formParentId,
        group: app.group,
        groupIcon: app.groupIcon,
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
    brandBlurb: merged.footer.brandBlurb || merged.footer.blurb,
    agency: merged.contact?.agency || '',
    quickLinks,
    contact: { ...merged.contact },
    legalLinks: Array.isArray(merged.footer.legalLinks)
      ? merged.footer.legalLinks
      : [
          { label: 'Data Disclaimer', to: '/legal/disclaimer' },
          { label: 'Privacy', to: '/legal/privacy' },
          { label: 'Terms of Use', to: '/legal/terms' },
          { label: 'Accessibility', to: '/legal/accessibility' },
        ],
    updatedNote:
      merged.footer.updatedNote ||
      'Last updated: each mapping application shows its own data refresh time.',
    copyright:
      merged.footer.copyright ||
      `© ${merged.organization?.copyrightYear || 2026} ${merged.organization?.name || 'Rwanda Space Agency'}`,
  }

  function getModule(moduleId) {
    return modules.find((mod) => mod.id === moduleId) ?? null
  }

  function getSolution(moduleIdOrMod, solutionId) {
    const mod =
      typeof moduleIdOrMod === 'string'
        ? getModule(moduleIdOrMod)
        : moduleIdOrMod
    if (!mod) {
      if (typeof moduleIdOrMod === 'string') {
        return { module: null, solution: null }
      }
      return undefined
    }
    const solution = mod.solutions.find((app) => app.id === solutionId) ?? null
    if (typeof moduleIdOrMod === 'string') {
      return { module: mod, solution }
    }
    return solution || undefined
  }

  function getFirstSolutionPath() {
    for (const mod of modules) {
      const solutions = mod.groups
        ? mod.groups.flatMap((g) => g.solutions)
        : mod.solutions
      const first = solutions.find((s) => !s.isForm && s.embedUrl)
      if (first) return `/module/${mod.id}/app/${first.id}`
    }
    return null
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
      solutions: modules.reduce(
        (sum, mod) => sum + mod.solutions.filter((s) => !s.isForm).length,
        0,
      ),
      forms: modules.reduce(
        (sum, mod) => sum + mod.solutions.filter((s) => s.isForm).length,
        0,
      ),
    },
    getModule,
    getSolution,
    getFirstSolutionPath,
    getDefaultWorkspacePath: getFirstSolutionPath,
    raw: merged,
  }
}

export function resolveDefaultRuntimeConfig(options) {
  return resolveRuntimeConfig(DEFAULT_RUNTIME_CONFIG, options)
}
