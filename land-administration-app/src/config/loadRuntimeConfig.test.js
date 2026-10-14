import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_KEY } from './application.js'
import { DEFAULT_RUNTIME_CONFIG } from './defaults.js'
import { loadRuntimeConfig } from './loadRuntimeConfig.js'
import {
  mergeRuntimeConfig,
  resolveDefaultRuntimeConfig,
  resolveRuntimeConfig,
} from './resolveRuntimeConfig.js'
import { resolveRuntimeConfigUrl } from './runtimeConfigUrl.js'
import { validateRuntimeConfigDocument } from './validateRuntimeConfigDocument.js'
import { APP_SOURCES, PORTAL_URL } from '../lib/access.js'

const validRemoteConfig = {
  app: {
    name: 'Remote Land Administration',
    shortName: 'Remote',
    documentTitle: 'Remote Land Tab',
  },
  organization: {
    name: 'Remote Agency',
  },
  modules: [
    {
      id: 'land-mapping',
      name: 'Land Mapping',
      apps: [
        {
          id: 'land-use-change',
          name: 'Land Use Change Remote',
          kind: 'dashboard',
          portalItemId: '1dbaae64924b4f7696272d9d503a94f1',
        },
      ],
    },
  ],
  customTopLevel: { keep: true },
}

function mockFetchResponse({ ok = true, status = 200, body, jsonError = false }) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: jsonError
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : vi.fn().mockResolvedValue(body),
  })
}

describe('APPLICATION_KEY', () => {
  it('is the permanent land-administration key', () => {
    expect(APPLICATION_KEY).toBe('land-administration')
  })
})

describe('resolveRuntimeConfigUrl', () => {
  it('builds the central service URL from a base URL', () => {
    expect(resolveRuntimeConfigUrl('http://localhost:3000')).toBe(
      `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    )
  })

  it('trims trailing slashes from the base URL', () => {
    expect(resolveRuntimeConfigUrl('http://localhost:3000/')).toBe(
      `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    )
  })

  it('returns null for missing or blank base URLs', () => {
    expect(resolveRuntimeConfigUrl(undefined)).toBeNull()
    expect(resolveRuntimeConfigUrl('')).toBeNull()
    expect(resolveRuntimeConfigUrl('   ')).toBeNull()
  })
})

describe('validateRuntimeConfigDocument', () => {
  it('rejects invalid root', () => {
    expect(validateRuntimeConfigDocument(null).valid).toBe(false)
    expect(validateRuntimeConfigDocument([]).valid).toBe(false)
  })

  it('accepts a valid object and optional sections', () => {
    expect(validateRuntimeConfigDocument({}).valid).toBe(true)
    expect(validateRuntimeConfigDocument(validRemoteConfig).valid).toBe(true)
  })

  it('rejects malformed modules', () => {
    expect(validateRuntimeConfigDocument({ modules: {} }).error).toContain(
      'modules',
    )
  })
})

describe('mergeRuntimeConfig', () => {
  it('does not mutate defaults', () => {
    const snapshot = JSON.stringify(DEFAULT_RUNTIME_CONFIG)
    mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      app: { name: 'Changed' },
    })
    expect(JSON.stringify(DEFAULT_RUNTIME_CONFIG)).toBe(snapshot)
  })

  it('merges partial app fields and preserves defaults', () => {
    const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      app: { name: 'Partial' },
    })
    expect(merged.app.name).toBe('Partial')
    expect(merged.app.hero).toBe(DEFAULT_RUNTIME_CONFIG.app.hero)
    expect(merged.modules).toEqual(DEFAULT_RUNTIME_CONFIG.modules)
  })

  it('replaces modules array when remote provides modules', () => {
    const remoteModules = [
      {
        id: 'only',
        name: 'Only',
        apps: [],
      },
    ]
    const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      modules: remoteModules,
    })
    expect(merged.modules).toEqual(remoteModules)
    expect(merged.modules).not.toBe(DEFAULT_RUNTIME_CONFIG.modules)
  })

  it('replaces footer.quickLinks when remote provides them', () => {
    const links = [{ label: 'X', to: '/x' }]
    const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      footer: { blurb: 'New', quickLinks: links },
    })
    expect(merged.footer.blurb).toBe('New')
    expect(merged.footer.quickLinks).toEqual(links)
  })

  it('preserves unknown optional top-level fields from remote', () => {
    const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      app: { name: 'X' },
      futureOptional: { note: 'keep' },
    })
    expect(merged.futureOptional).toEqual({ note: 'keep' })
  })

  it('preserves extensions when remote omits them and replaces when provided', () => {
    const kept = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      app: { name: 'X' },
    })
    expect(kept.extensions).toEqual(DEFAULT_RUNTIME_CONFIG.extensions)

    const replaced = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      extensions: { 'land-administration': { note: 'custom' } },
    })
    expect(replaced.extensions).toEqual({
      'land-administration': { note: 'custom' },
    })
  })
})

describe('resolveRuntimeConfig', () => {
  it('composes ArcGIS dashboard URLs from portalItemId + kind', () => {
    const config = resolveRuntimeConfig({
      modules: [
        {
          id: 'land-mapping',
          name: 'Land Mapping',
          apps: [
            {
              id: 'land-use-change',
              name: 'Land Use Change',
              kind: 'dashboard',
              portalItemId: '1dbaae64924b4f7696272d9d503a94f1',
            },
          ],
        },
      ],
    })
    const portalRoot = PORTAL_URL.replace(/\/$/, '')
    expect(config.appSources['land-use-change'].portalUrl).toBe(
      `${portalRoot}/apps/dashboards/1dbaae64924b4f7696272d9d503a94f1`,
    )
    expect(config.modules[0].solutions[0].embedUrl).toBe(
      `${portalRoot}/apps/dashboards/1dbaae64924b4f7696272d9d503a94f1`,
    )
  })

  it('composes Experience Builder URLs from kind experience + portalItemId', () => {
    const config = resolveRuntimeConfig({
      modules: [
        {
          id: 'land-mapping',
          name: 'Land Mapping',
          apps: [
            {
              id: 'parcels-surveying',
              name: 'Parcels Surveying',
              kind: 'experience',
              portalItemId: '164589648e2c4e198c40ff1c462bf6e5',
            },
          ],
        },
      ],
    })
    const portalRoot = PORTAL_URL.replace(/\/$/, '')
    expect(config.appSources['parcels-surveying'].portalUrl).toBe(
      `${portalRoot}/apps/experiencebuilder/experience/?id=164589648e2c4e198c40ff1c462bf6e5`,
    )
    expect(config.appSources['parcels-surveying'].search).toBe(
      'id=164589648e2c4e198c40ff1c462bf6e5',
    )
    expect(config.modules[0].solutions[0].kind).toBe('experience')
    expect(config.modules[0].solutions[0].embedUrl).toBe(
      `${portalRoot}/apps/experiencebuilder/experience/?id=164589648e2c4e198c40ff1c462bf6e5`,
    )
  })

  it('filters hidden modules and unpublished apps', () => {
    const config = resolveRuntimeConfig({
      modules: [
        {
          id: 'hidden-mod',
          name: 'Hidden',
          hidden: true,
          apps: [
            {
              id: 'hidden-app',
              name: 'Hidden App',
              kind: 'dashboard',
              portalItemId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          ],
        },
        {
          id: 'visible',
          name: 'Visible',
          apps: [
            {
              id: 'draft',
              name: 'Draft',
              kind: 'dashboard',
              portalItemId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              published: false,
            },
            {
              id: 'live',
              name: 'Live',
              kind: 'dashboard',
              portalItemId: 'cccccccccccccccccccccccccccccccc',
            },
          ],
        },
      ],
    })
    expect(config.modules.map((mod) => mod.id)).toEqual(['visible'])
    expect(config.modules[0].solutions.map((app) => app.id)).toEqual(['live'])
  })

  it('preserves portalItemId on resolved solutions', () => {
    const config = resolveDefaultRuntimeConfig()
    const parcels = config
      .getSolution('land-mapping', 'parcels-surveying')
      .solution
    expect(parcels.portalItemId).toBe('164589648e2c4e198c40ff1c462bf6e5')
    expect(parcels.kind).toBe('experience')
  })

  it('exposes helpers used by the UI', () => {
    const config = resolveDefaultRuntimeConfig()
    expect(config.portal.name).toBe('Land Administration Mapping')
    expect(config.getFirstSolutionPath()).toBe(
      '/module/land-mapping/app/land-use-change',
    )
    expect(config.getModule('land-mapping')?.name).toBe('Land Mapping')
    expect(
      config.getSolution('immovable-property', 'property-location').solution
        ?.id,
    ).toBe('property-location')
    expect(config.stats.modules).toBe(2)
    expect(config.stats.solutions).toBe(3)
  })

  it('resolves documentTitle with name fallback semantics', () => {
    const withTitle = resolveRuntimeConfig({
      app: { documentTitle: 'Custom Tab', name: 'Name Only' },
    })
    expect(withTitle.portal.documentTitle).toBe('Custom Tab')
    expect(withTitle.portal.name).toBe('Name Only')

    const defaults = resolveDefaultRuntimeConfig()
    expect(defaults.portal.documentTitle || defaults.portal.name).toBe(
      'Land Administration Mapping',
    )
  })

  it('seeds deployment APP_SOURCES from defaults including Experience', () => {
    expect(APP_SOURCES['parcels-surveying'].portalUrl).toContain(
      '164589648e2c4e198c40ff1c462bf6e5',
    )
    expect(APP_SOURCES['parcels-surveying'].search).toBe(
      'id=164589648e2c4e198c40ff1c462bf6e5',
    )
    expect(APP_SOURCES['property-location'].portalUrl).toContain(
      'bc2cbc30989c44dda9a8d27660c3a36f',
    )
    expect(APP_SOURCES['land-use-change'].portalUrl).toContain(
      '1dbaae64924b4f7696272d9d503a94f1',
    )
  })
})

describe('loadRuntimeConfig', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads config successfully from the central service', async () => {
    fetch.mockImplementation(mockFetchResponse({ body: validRemoteConfig }))

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    )
    expect(result.source).toBe('remote')
    expect(result.error).toBeNull()
    expect(result.config.portal.name).toBe('Remote Land Administration')
    expect(result.config.raw.customTopLevel).toEqual({ keep: true })
  })

  it('falls back to defaults when the service is unavailable', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(result.source).toBe('defaults')
    expect(result.error).toBe('Failed to fetch')
    expect(result.config.portal.name).toBe(
      resolveDefaultRuntimeConfig().portal.name,
    )
  })

  it('falls back to defaults on HTTP 404', async () => {
    fetch.mockImplementation(mockFetchResponse({ ok: false, status: 404 }))

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(result.source).toBe('defaults')
    expect(result.error).toBe('Runtime config HTTP 404')
  })

  it('falls back to defaults on HTTP 500', async () => {
    fetch.mockImplementation(mockFetchResponse({ ok: false, status: 500 }))

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(result.source).toBe('defaults')
    expect(result.error).toBe('Runtime config HTTP 500')
  })

  it('falls back to defaults when the response is malformed JSON', async () => {
    fetch.mockImplementation(mockFetchResponse({ jsonError: true }))

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(result.source).toBe('defaults')
    expect(result.error).toBe('Runtime config response is not valid JSON')
  })

  it('falls back to defaults when the config document is invalid', async () => {
    fetch.mockImplementation(
      mockFetchResponse({ body: { modules: 'not-an-array' } }),
    )

    const result = await loadRuntimeConfig({
      url: `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    })

    expect(result.source).toBe('defaults')
    expect(result.error).toBe('Runtime config modules must be an array')
  })

  it('uses defaults without fetching when VITE_RUNTIME_CONFIG_URL is missing', async () => {
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', '')
    vi.resetModules()

    const { loadRuntimeConfig: loadWithoutEnv } = await import(
      './loadRuntimeConfig.js'
    )

    const result = await loadWithoutEnv()

    expect(fetch).not.toHaveBeenCalled()
    expect(result.source).toBe('defaults')
    expect(result.error).toBe('VITE_RUNTIME_CONFIG_URL is not configured')
  })
})
