import { describe, expect, it } from 'vitest'
import {
  buildProxyEmbedUrl,
  inferPortalHostKey,
  sanitizePortalEmbedUrl,
} from './access.js'

describe('buildProxyEmbedUrl (AUTH-04 production)', () => {
  it('builds same-origin WASAC dashboard proxy path without token', () => {
    const src = buildProxyEmbedUrl({
      kind: 'dashboard',
      portalItemId: '753103c5542e4bcfb6522b24d645521c',
      portalHostKey: 'wasac',
    })
    expect(src).toBe(
      '/api/portal/proxy/wasac/apps/dashboards/753103c5542e4bcfb6522b24d645521c',
    )
    expect(src).not.toContain('token=')
    expect(src).not.toContain('gis.wasac.rw')
  })

  it('builds same-origin GeoHub experience proxy path', () => {
    const src = buildProxyEmbedUrl({
      kind: 'experience',
      portalItemId: '5fc41bffcdcb458b90de05e1a6a05c30',
      host: 'wasac',
    })
    expect(src).toContain('/api/portal/proxy/wasac/apps/experiencebuilder/experience/')
    expect(src).toContain('id=5fc41bffcdcb458b90de05e1a6a05c30')
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

describe('portal host inference', () => {
  it('maps partner portal URLs to auth hosts', () => {
    expect(
      inferPortalHostKey(
        'https://gis.wasac.rw/portal/apps/dashboards/753103c5542e4bcfb6522b24d645521c',
      ),
    ).toBe('wasac')
    expect(
      inferPortalHostKey(
        'https://arcgis.rura.rw/portal/apps/dashboards/a40ef5ab66d3491da1a05fd3578d5b9f',
      ),
    ).toBe('rura')
    expect(
      inferPortalHostKey(
        'https://gisweb.reg.rw/portal/apps/dashboards/ed7be680a68f4390995879f8f03ab0d9',
      ),
    ).toBe('reg')
  })

  it('redacts tokens when sanitizing', () => {
    expect(
      sanitizePortalEmbedUrl(
        '/api/portal/proxy/wasac/apps/dashboards/x?token=secret',
      ),
    ).not.toContain('secret')
  })
})
