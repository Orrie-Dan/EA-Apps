import { describe, expect, it } from 'vitest'
import {
  buildProxyEmbedUrl,
  inferPortalHostKey,
  sanitizePortalEmbedUrl,
} from './access.js'

describe('buildProxyEmbedUrl (AUTH-04 production)', () => {
  it('builds same-origin RBC dashboard proxy path without token', () => {
    const src = buildProxyEmbedUrl({
      kind: 'dashboard',
      portalItemId: '58672ddce9ee433ca4edde6d0f85c486',
      portalHostKey: 'rbc',
    })
    expect(src).toBe(
      '/api/portal/proxy/rbc/apps/dashboards/58672ddce9ee433ca4edde6d0f85c486',
    )
    expect(src).not.toContain('token=')
    expect(src).not.toContain('gis.rbc.gov.rw')
  })

  it('builds Esri Rwanda survey123 proxy path', () => {
    const src = buildProxyEmbedUrl({
      kind: 'survey123',
      portalItemId: '9ea5acc523984c45b2aae19a33c43796',
      host: 'esrirw',
    })
    expect(src).toContain('/api/portal/proxy/s123/share/')
    expect(src).toContain('9ea5acc523984c45b2aae19a33c43796')
    expect(src).toContain('/api/portal/proxy/esrirw')
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
  it('maps RBC and Esri Rwanda URLs to auth hosts', () => {
    expect(
      inferPortalHostKey(
        'https://gis.rbc.gov.rw/portal/apps/dashboards/58672ddce9ee433ca4edde6d0f85c486',
      ),
    ).toBe('rbc')
    expect(
      inferPortalHostKey(
        'https://esrirw.rw/portal/apps/dashboards/0853f19fe0a645008c0c95969855b1f2',
      ),
    ).toBe('esrirw')
  })

  it('redacts tokens when sanitizing', () => {
    expect(
      sanitizePortalEmbedUrl(
        '/api/portal/proxy/rbc/apps/dashboards/x?token=secret',
      ),
    ).not.toContain('secret')
  })
})
