import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPortalAuthTokenUrl,
  requestPortalToken,
  resolvePortalAuthTokenUrl,
  PortalTokenError,
} from './portalToken.js'

describe('portalToken client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves broker URL from the same Runtime Config base', () => {
    expect(resolvePortalAuthTokenUrl('https://localhost:5180')).toBe(
      'https://localhost:5180/api/v1/portal-auth/token',
    )
    expect(resolvePortalAuthTokenUrl('http://localhost:3000/')).toBe(
      'http://localhost:3000/api/v1/portal-auth/token',
    )
    expect(resolvePortalAuthTokenUrl('')).toBeNull()
    expect(getPortalAuthTokenUrl({ url: 'https://x/test' })).toBe('https://x/test')
  })

  it('requests a token with appKey + portalHostKey without logging the token', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'secret-arcgis-token',
        expiresAt: Date.now() + 60_000,
        referer: 'https://localhost:5180',
        portalUrl: 'https://gis.rbc.gov.rw/portal',
        portalHostKey: 'rbc',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestPortalToken({
      url: 'https://localhost:5180/api/v1/portal-auth/token',
      portalHostKey: 'rbc',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://localhost:5180/api/v1/portal-auth/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          appKey: 'health-mapping',
          portalHostKey: 'rbc',
        }),
      }),
    )
    expect(result.token).toBe('secret-arcgis-token')
    expect(result.portalHostKey).toBe('rbc')
    expect(Number.isFinite(result.expiresAt)).toBe(true)

    for (const call of info.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('secret-arcgis-token')
    }
  })

  it('rejects missing portalHostKey without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestPortalToken({
        url: 'https://localhost:5180/api/v1/portal-auth/token',
      }),
    ).rejects.toMatchObject({ code: 'missing_portal_host_key' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send a different host than the requested portalHostKey', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 't',
        expiresAt: Date.now() + 60_000,
        referer: 'https://localhost:5180',
        portalUrl: 'https://ewis.minema.gov.rw/portal',
        portalHostKey: 'ewis',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await requestPortalToken({
      url: 'https://localhost:5180/api/v1/portal-auth/token',
      portalHostKey: 'ewis',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.portalHostKey).toBe('ewis')
    expect(body.portalHostKey).not.toBe('gh')
    expect(body.portalHostKey).not.toBe('rmb')
  })

  it('maps broker failures to safe messages without leaking tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ token: 'should-not-leak' }),
      }),
    )

    await expect(
      requestPortalToken({
        url: 'https://localhost:5180/api/v1/portal-auth/token',
        portalHostKey: 'ewis',
      }),
    ).rejects.toBeInstanceOf(PortalTokenError)
  })
})
