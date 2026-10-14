import { describe, expect, it } from 'vitest'
import {
  EWIS_PORTAL_URL,
  buildAuthenticatedPortalUrl,
  buildProxyEmbedUrl,
  inferPortalAppKind,
  inferPortalHostKey,
  sanitizePortalEmbedUrl,
} from './access.js'

describe('portal host inference', () => {
  it('maps EWIS dashboard URLs to ewis, not gh', () => {
    expect(
      inferPortalHostKey(
        'https://ewis.minema.gov.rw/portal/apps/dashboards/7798e9db298d43608c0ce091dd87124d',
      ),
    ).toBe('ewis')
    expect(
      inferPortalHostKey(
        'https://gh.space.gov.rw/portal/apps/dashboards/abc',
      ),
    ).toBe('gh')
  })

  it('treats EWIS /portal/apps/dashboards URLs as dashboards', () => {
    expect(
      inferPortalAppKind({
        kind: 'external',
        externalUrl:
          'https://ewis.minema.gov.rw/portal/apps/dashboards/7798e9db298d43608c0ce091dd87124d',
      }),
    ).toBe('dashboard')
  })
})

describe('buildProxyEmbedUrl (AUTH-04 production)', () => {
  it('builds same-origin EWIS dashboard proxy path without token', () => {
    const src = buildProxyEmbedUrl({
      kind: 'dashboard',
      portalItemId: '7798e9db298d43608c0ce091dd87124d',
      portalHostKey: 'ewis',
    })
    expect(src).toBe(
      '/api/portal/proxy/ewis/apps/dashboards/7798e9db298d43608c0ce091dd87124d',
    )
    expect(src).not.toContain('token=')
    expect(src).not.toContain('ewis.minema.gov.rw')
  })

  it('builds same-origin GeoHub experience proxy path', () => {
    const src = buildProxyEmbedUrl({
      kind: 'experience',
      portalItemId: 'eb3b4f1694e44638b4547cc1e8a50847',
      host: 'gh',
    })
    expect(src).toContain('/api/portal/proxy/gh/apps/experiencebuilder/experience/')
    expect(src).toContain('id=eb3b4f1694e44638b4547cc1e8a50847')
    expect(src).not.toContain('token=')
  })

  it('rejects unknown hosts (no arbitrary proxying)', () => {
    expect(
      buildProxyEmbedUrl({
        kind: 'dashboard',
        portalItemId: 'abc',
        host: 'evil',
      }),
    ).toBeNull()
  })
})

describe('legacy tokenized URL helper (not production)', () => {
  it('still redacts tokens when sanitizing', () => {
    const src = buildAuthenticatedPortalUrl({
      kind: 'dashboard',
      portalItemId: '7798e9db298d43608c0ce091dd87124d',
      portalUrl: EWIS_PORTAL_URL,
      host: 'ewis',
      token: 'secret-broker-token',
    })
    expect(sanitizePortalEmbedUrl(src)).not.toContain('secret-broker-token')
  })
})
