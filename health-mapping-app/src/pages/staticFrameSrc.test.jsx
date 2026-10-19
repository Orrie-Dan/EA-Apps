import { describe, expect, it } from 'vitest'
import { staticFrameSrc } from './AppViewer.jsx'
import { APPLICATION_KEY } from '../config/application.js'
import { SURVEY123_ORIGIN } from '../lib/access.js'

const origin = globalThis.location?.origin || ''
const proxy = (host) => `${origin}/api/v1/portal-proxy/${APPLICATION_KEY}/${host}`

describe('staticFrameSrc', () => {
  it('frames dashboards and experiences through the Runtime Config proxy', () => {
    expect(staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc' }, 'rbc')).toBe(
      `${proxy('rbc')}/portal/apps/dashboards/abc`,
    )
    expect(staticFrameSrc({ kind: 'experience', portalItemId: 'x1' }, 'gh')).toBe(
      `${proxy('gh')}/portal/apps/experiencebuilder/experience/?id=x1`,
    )
  })

  it('frames Survey123 through the proxy, reading its portal through the proxy too', () => {
    const src = staticFrameSrc({ kind: 'survey123', portalItemId: 'f1' }, 'rbc1')
    const portalUrl = encodeURIComponent(`${proxy('rbc1')}/portal`)
    expect(src).toBe(`${proxy('s123')}/share/f1?portalUrl=${portalUrl}`)
    expect(src).not.toContain(SURVEY123_ORIGIN)
  })

  it('frames nothing without an item or a host', () => {
    expect(staticFrameSrc({ kind: 'survey123' }, 'rbc1')).toBeNull()
    expect(staticFrameSrc({ kind: 'dashboard', portalItemId: 'abc' }, '')).toBeNull()
  })
})
