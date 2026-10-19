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

  it('frames MoE through the Runtime Config proxy with its own moe host key', () => {
    if (!PROXY_HOSTS.moe) return
    expect(
      staticFrameSrc({ kind: 'dashboard', portalItemId: 'm1', portalHostKey: 'moe' }, 'moe'),
    ).toBe(`${location.origin}/api/v1/portal-proxy/${APPLICATION_KEY}/moe/portal/apps/dashboards/m1`)
  })

  it('frames gh2 items through the Runtime Config proxy with the gh2 host key', () => {
    if (!PROXY_HOSTS.gh2) return
    const gh2Root = `${location.origin}/api/v1/portal-proxy/${APPLICATION_KEY}/gh2/portal`
    expect(
      staticFrameSrc({ kind: 'experience', portalItemId: 'g1', portalHostKey: 'gh2' }, 'gh2'),
    ).toBe(`${gh2Root}/apps/experiencebuilder/experience/?id=g1`)
    const shell = `${PROXY_HOSTS.gh2.replace(/\/$/, '')}/apps/experiencebuilder/experience/?id=s2`
    expect(
      staticFrameSrc({ kind: 'localShell', localShellPath: shell, portalItemId: 's2', portalHostKey: 'gh2' }, 'gh2'),
    ).toBe(`${gh2Root}/apps/experiencebuilder/experience/?id=s2`)
  })

  it('frames a local shell on a proxied portal through the Runtime Config proxy', () => {
    const shell = `${root}/apps/experiencebuilder/experience/?id=s1`
    expect(
      staticFrameSrc({ kind: 'localShell', localShellPath: shell, portalItemId: 's1', portalHostKey: 'other' }, 'other'),
    ).toBe(`${proxyRoot}/apps/experiencebuilder/experience/?id=s1`)
    expect(
      staticFrameSrc({ kind: 'localShell', localShellPath: '/air-quality', embedUrl: '/air-quality' }, ''),
    ).toBe('/air-quality')
  })

  it('uses the external URL as is and refuses unknown hosts', () => {
    expect(
      staticFrameSrc({ kind: 'external', externalUrl: 'https://example.org/', embedUrl: 'https://example.org/' }, ''),
    ).toBe('https://example.org/')
    expect(
      staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc', portalHostKey: 'nope' }, 'nope'),
    ).toBeNull()
  })

  it('prefers the external URL over a leftover root-relative shell path', () => {
    // Live air-quality item: framing "/air-quality" under the app base loaded
    // index.html, which framed the app inside itself without end.
    expect(
      staticFrameSrc(
        {
          kind: 'external',
          externalUrl: 'https://gh.space.gov.rw/air-quality',
          localShellPath: '/air-quality',
          portalItemId: '75c503067fd2423391d0789c7a4f6f8a',
          portalHostKey: host,
        },
        host,
      ),
    ).toBe('https://gh.space.gov.rw/air-quality')
  })
})
