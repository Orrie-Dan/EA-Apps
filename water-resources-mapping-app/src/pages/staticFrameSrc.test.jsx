import { describe, expect, it } from 'vitest'
import { staticFrameSrc } from './AppViewer.jsx'
import { APPLICATION_KEY } from '../config/application.js'
import { PROXY_HOSTS, PROXY_PATHS, SURVEY123_ORIGIN } from '../lib/access.js'

// The portal host this app proxies (gh, or rdb for parks).
const host = Object.keys(PROXY_HOSTS).find((key) => PROXY_PATHS[key])
const root = PROXY_HOSTS[host].replace(/\/$/, '')
const proxyRoot = `${location.origin}/api/v1/portal-proxy/${APPLICATION_KEY}/${host}${new URL(root).pathname}`

describe('staticFrameSrc', () => {
  it('frames dashboards and experiences through the Runtime Config proxy', () => {
    expect(
      staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc', portalHostKey: host }, host),
    ).toBe(`${proxyRoot}/apps/dashboards/abc`)
    expect(
      staticFrameSrc({ kind: 'experience', portalItemId: 'x1', portalHostKey: host }, host),
    ).toBe(`${proxyRoot}/apps/experiencebuilder/experience/?id=x1`)
  })

  it('never frames through the app server, which a static host does not have', () => {
    const src = staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc', portalHostKey: host }, host)
    expect(src).not.toContain('/api/portal/')
    expect(src).not.toContain(`/${APPLICATION_KEY}/api/`)
  })

  it('frames Survey123 forms from survey123.arcgis.com, not /api/forms', () => {
    expect(
      staticFrameSrc({ kind: 'survey123', portalItemId: 'f1', portalHostKey: host }, host),
    ).toBe(`${SURVEY123_ORIGIN}/share/f1?portalUrl=${encodeURIComponent(root)}`)
  })

  it('frames hosts with no proxy path at their portal URL', () => {
    const direct = Object.keys(PROXY_PATHS).find((key) => PROXY_PATHS[key] === null)
    if (!direct) return
    const directRoot = PROXY_HOSTS[direct].replace(/\/$/, '')
    expect(
      staticFrameSrc({ kind: 'dashboard', portalItemId: 'm1', portalHostKey: direct }, direct),
    ).toBe(`${directRoot}/apps/dashboards/m1`)
  })

  it('uses the external URL as is and refuses unknown hosts', () => {
    expect(
      staticFrameSrc({ kind: 'external', externalUrl: 'https://example.org/', embedUrl: 'https://example.org/' }, ''),
    ).toBe('https://example.org/')
    expect(
      staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc', portalHostKey: 'nope' }, 'nope'),
    ).toBeNull()
  })
})
