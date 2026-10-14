import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLICATION_KEY } from './application.js'
import { DEFAULT_RUNTIME_CONFIG } from './defaults.js'
import { loadRuntimeConfig } from './loadRuntimeConfig.js'
import {
  mergeRuntimeConfig,
  resolveDefaultRuntimeConfig,
} from './resolveRuntimeConfig.js'
import { resolveRuntimeConfigUrl } from './runtimeConfigUrl.js'
import { validateRuntimeConfigDocument } from './validateRuntimeConfigDocument.js'
import { APP_SOURCES } from '../lib/access.js'

const validRemoteConfig = {
  app: {
    name: 'Remote Health Mapping',
    shortName: 'Remote',
    documentTitle: 'Remote Health Mapping Tab',
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
  it('is the permanent health-mapping key', () => {
    expect(APPLICATION_KEY).toBe('health-mapping')
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
      extensions: { 'health-mapping': { note: 'custom' } },
    })
    expect(replaced.extensions).toEqual({
      'health-mapping': { note: 'custom' },
    })
  })
})

describe('resolveRuntimeConfig', () => {
  it('exposes helpers and document title', () => {
    const config = resolveDefaultRuntimeConfig()
    expect(config.portal.name).toBe('Health Mapping')
    expect(config.portal.documentTitle || config.portal.name).toBe('Health Mapping')
    expect(typeof config.getFirstSolutionPath()).toBe('string')
    expect(config.modules.length).toBeGreaterThan(0)
  })


  it('composes survey123, esrirw proxy, and rbc experience', () => {
    const config = resolveDefaultRuntimeConfig()
    const form = config.getSolution('disease-surveillance', 'confirmed-case-report-form').solution
    expect(form.kind).toBe('survey123')
    expect(form.embedUrl).toContain('survey123.arcgis.com')
    const emergency = config.getSolution('health-emergency-mapping', 'health-emergency-response').solution
    expect(emergency.embedUrl).toContain('/api/portal/proxy/esrirw/')
    const samu = config.getSolution('health-emergency-mapping', 'samu-reporting-form').solution
    expect(samu.embedUrl).toContain('/api/portal/proxy/s123/')
    const vax = config.getSolution('vaccination-distribution', 'vaccination').solution
    expect(vax.kind).toBe('experience')
    expect(vax.embedUrl).toContain('9d6b84d4e7b24d6aa379f0c221f4b264')
    expect(APP_SOURCES['provincial-to-referral-hospital'].portalUrl).toContain('bd50d196e7bb4e4ea474fff04c44303e')
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
    expect(result.config.portal.name).toBe('Remote Health Mapping')
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
