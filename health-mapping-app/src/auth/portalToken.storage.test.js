import { afterEach, describe, expect, it, vi } from 'vitest'

describe('Portal token storage contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('never writes broker token fields to sessionStorage or localStorage', async () => {
    const sessionSet = vi.fn()
    const localSet = vi.fn()
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(),
      setItem: sessionSet,
      removeItem: vi.fn(),
    })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: localSet,
      removeItem: vi.fn(),
    })

    const { requestPortalToken } = await import('./portalToken.js')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: 'memory-only-token',
          expiresAt: Date.now() + 120_000,
          referer: 'https://localhost:5180',
          portalUrl: 'https://ewis.minema.gov.rw/portal',
          portalHostKey: 'ewis',
        }),
      }),
    )

    const result = await requestPortalToken({
      url: 'https://localhost:5180/api/v1/portal-auth/token',
      portalHostKey: 'ewis',
    })
    expect(result.token).toBe('memory-only-token')

    for (const call of [...sessionSet.mock.calls, ...localSet.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain('memory-only-token')
    }
  })
})
