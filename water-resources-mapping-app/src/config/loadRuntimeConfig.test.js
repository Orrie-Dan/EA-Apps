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
    name: 'Remote Override',
    shortName: 'Remote',
    documentTitle: 'Remote Tab',
  },
  organization: {
    name: 'Remote Agency',
  },
  modules: [
    {
      id: 'sample-module',
      name: 'Sample Module',
      apps: [
        {
          id: 'sample-app',
          name: 'Sample App',
          kind: 'dashboard',
          portalItemId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          portalHostKey: Object.keys(
            DEFAULT_RUNTIME_CONFIG.modules[0]?.apps[0]?.portalHostKey
              ? { [DEFAULT_RUNTIME_CONFIG.modules[0].apps[0].portalHostKey]: 1 }
              : { gh: 1 },
          )[0],
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
  it(`is the permanent ${APPLICATION_KEY} key`, () => {
    expect(APPLICATION_KEY).toBeTruthy()
    expect(APPLICATION_KEY).not.toContain(' ')
  })
})

describe('resolveRuntimeConfigUrl', () => {
  it('builds the central service URL from a base URL', () => {
    expect(resolveRuntimeConfigUrl('http://localhost:3000')).toBe(
      `http://localhost:3000/api/v1/config/${APPLICATION_KEY}`,
    )
  })

  it('returns null for missing or blank base URLs', () => {
    expect(resolveRuntimeConfigUrl(undefined)).toBeNull()
    expect(resolveRuntimeConfigUrl('')).toBeNull()
  })
})

describe('validateRuntimeConfigDocument', () => {
  it('rejects invalid root', () => {
    expect(validateRuntimeConfigDocument(null).valid).toBe(false)
  })

  it('accepts a valid object', () => {
    expect(validateRuntimeConfigDocument(validRemoteConfig).valid).toBe(true)
  })
})

describe('mergeRuntimeConfig', () => {
  it('does not mutate defaults', () => {
    const snapshot = JSON.stringify(DEFAULT_RUNTIME_CONFIG)
    mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, { app: { name: 'Changed' } })
    expect(JSON.stringify(DEFAULT_RUNTIME_CONFIG)).toBe(snapshot)
  })

  it('replaces modules when remote provides them', () => {
    const remoteModules = [{ id: 'only', name: 'Only', apps: [] }]
    const merged = mergeRuntimeConfig(DEFAULT_RUNTIME_CONFIG, {
      modules: remoteModules,
    })
    expect(merged.modules).toEqual(remoteModules)
  })
})

describe('resolveDefaultRuntimeConfig', () => {
  it('publishes live modules with composed embed URLs', () => {
    const resolved = resolveDefaultRuntimeConfig()
    expect(resolved.portal.name).toBe(DEFAULT_RUNTIME_CONFIG.app.name)
    expect(resolved.modules.length).toBeGreaterThan(0)
    const first = resolved.modules[0].solutions.find((s) => !s.isForm)
    expect(first?.embedUrl).toBeTruthy()
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(0)
  })

  it('exposes getFirstSolutionPath for the home redirect', () => {
    const resolved = resolveDefaultRuntimeConfig()
    expect(resolved.getFirstSolutionPath()).toMatch(/^\/module\//)
  })
})

describe('loadRuntimeConfig', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('falls back to defaults when VITE_RUNTIME_CONFIG_URL is missing', async () => {
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', '')
    const result = await loadRuntimeConfig()
    expect(result.source).toBe('defaults')
    expect(result.config.portal.name).toBe(DEFAULT_RUNTIME_CONFIG.app.name)
  })

  it('uses remote config when fetch succeeds', async () => {
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', 'http://localhost:3000')
    globalThis.fetch = mockFetchResponse({ body: validRemoteConfig })
    const result = await loadRuntimeConfig()
    expect(result.source).toBe('remote')
    expect(result.config.portal.name).toBe('Remote Override')
  })

  it('falls back when HTTP fails', async () => {
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', 'http://localhost:3000')
    globalThis.fetch = mockFetchResponse({ ok: false, status: 503 })
    const result = await loadRuntimeConfig()
    expect(result.source).toBe('defaults')
    expect(result.error).toContain('503')
  })
})
