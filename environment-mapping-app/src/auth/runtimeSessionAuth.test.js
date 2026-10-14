import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readRuntimeSession,
  runtimeProxyFrameUrl,
  signInWithRuntimeSession,
  signOutOfRuntimeSession,
} from './runtimeSessionAuth.js'
import { appPath } from '../lib/appPath.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtimeProxyFrameUrl', () => {
  it('frames the portal path through the app-scoped runtime proxy', () => {
    expect(
      runtimeProxyFrameUrl('https://gh.space.gov.rw/portal/apps/dashboards/abc', 'gh'),
    ).toBe(location.origin + '/api/v1/portal-proxy/environment-mapping/gh/portal/apps/dashboards/abc')
    expect(
      runtimeProxyFrameUrl(
        'https://gis.wasac.rw/portal/apps/experiencebuilder/experience/?id=1',
        'wasac',
      ),
    ).toBe(
      location.origin + '/api/v1/portal-proxy/environment-mapping/wasac/portal/apps/experiencebuilder/experience/?id=1',
    )
  })

  it('returns null without a portal URL or host', () => {
    expect(runtimeProxyFrameUrl(null, 'gh')).toBeNull()
    expect(runtimeProxyFrameUrl('https://gh.space.gov.rw/portal', '')).toBeNull()
  })

  it('is absolute in the browser so the app base path is not prefixed', () => {
    vi.stubGlobal('location', { origin: 'https://gh.space.gov.rw' })
    try {
      const src = runtimeProxyFrameUrl('https://gh.space.gov.rw/portal/apps/dashboards/abc', 'reg')
      expect(src).toBe(
        'https://gh.space.gov.rw/api/v1/portal-proxy/environment-mapping/reg/portal/apps/dashboards/abc',
      )
      expect(appPath(src)).toBe(src)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('runtime session calls', () => {
  it('posts credentials same-origin with the app key and returns no token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ authenticated: true, user: { username: 'alice' }, expiresAt: 5 }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const session = await signInWithRuntimeSession('alice', 'pw')
    expect(session).toEqual({ authenticated: true, user: { username: 'alice' }, expiresAt: 5 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/app-auth/login')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(init.body)).toEqual({
      appKey: 'environment-mapping',
      username: 'alice',
      password: 'pw',
    })
  })

  it('reports invalid credentials on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    await expect(signInWithRuntimeSession('alice', 'bad')).rejects.toThrow(
      'Invalid username or password',
    )
  })

  it('signs out of this app only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await signOutOfRuntimeSession()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/app-auth/logout?appKey=environment-mapping')
    expect(init.method).toBe('POST')
  })

  it('treats a 401 session check as signed out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    await expect(readRuntimeSession()).resolves.toEqual({ authenticated: false })
  })
})
