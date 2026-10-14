import { describe, expect, it } from 'vitest'
import { PROXY_HOSTS, PROXY_PATHS, portalHostForUrl, proxiedEmbedUrl } from './access.js'
import { resolveRuntimeConfig } from '../config/resolveRuntimeConfig.js'

/*
 * Catalog "localShell" apps can carry an absolute portal URL. Framed as is, the
 * portal asks for a sign-in inside the frame; through the proxy the server
 * attaches that portal's token.
 */
describe('proxiedEmbedUrl', () => {
  it('maps every proxied portal URL onto its proxy path', () => {
    for (const [key, root] of Object.entries(PROXY_HOSTS)) {
      if (!PROXY_PATHS[key]) continue
      const base = root.replace(/\/$/, '')
      expect(portalHostForUrl(`${base}/apps/dashboards/abc`, key)).toBe(key)
      expect(proxiedEmbedUrl(`${base}/apps/experiencebuilder/experience/?id=x`, key))
        .toBe(`${PROXY_PATHS[key]}/apps/experiencebuilder/experience/?id=x`)
    }
  })

  it('tells gh and gh2 apart only by the item host key', () => {
    const url = 'https://gh.space.gov.rw/portal/apps/dashboards/abc'
    expect(portalHostForUrl(url)).toBe('gh')
    expect(portalHostForUrl(url, 'gh2')).toBe('gh2')
    expect(portalHostForUrl(url, 'moe')).toBe('gh')
  })

  it('leaves other URLs alone', () => {
    expect(proxiedEmbedUrl('/air-quality')).toBe('/air-quality')
    expect(proxiedEmbedUrl('https://example.org/x')).toBe('https://example.org/x')
    expect(portalHostForUrl('https://gh.space.gov.rw.evil.example/portal/x')).toBeNull()
  })
})

describe('resolveRuntimeConfig localShell', () => {
  it('frames an absolute portal shell through the proxy', () => {
    const shell = 'https://gh.space.gov.rw/portal/apps/experiencebuilder/experience/?id=3ab8'
    const resolved = resolveRuntimeConfig({
      modules: [{ id: 'm', name: 'M', apps: [{ id: 'a', name: 'A', kind: 'localShell', portalHostKey: 'gh2', portalItemId: '3ab8', localShellPath: shell }] }],
    })
    const json = JSON.stringify(resolved)
    expect(json).toContain('"embedUrl":"/api/portal/gh2/apps/experiencebuilder/experience/?id=3ab8"')
  })
})
