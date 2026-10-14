import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { pipeUpstreamBody, rewritePortalText, shouldPassthroughBody } from './access-server.js'

const req = {
  headers: { host: 'localhost:5180', 'x-forwarded-proto': 'https' },
}

describe('shouldPassthroughBody', () => {
  it('rewrites dashboard HTML shells', () => {
    expect(
      shouldPassthroughBody(
        'apps/dashboards/902b4a62d0f4420ab66be44e5ad8d40c',
        'text/html',
        1589,
        true,
      ),
    ).toBe(false)
  })

  it('rewrites large and chunked JSON so flood layer URLs stay on the proxy', () => {
    expect(
      shouldPassthroughBody(
        'sharing/rest/content/items/902b4a62d0f4420ab66be44e5ad8d40c/data',
        'application/json',
        2_000_000,
        true,
      ),
    ).toBe(false)
    expect(
      shouldPassthroughBody('server/rest/services/Floods/query', 'application/json', 0, false),
    ).toBe(false)
  })

  it('still rewrites small JSON portal responses', () => {
    expect(
      shouldPassthroughBody('sharing/rest/portals/self', 'application/json', 4000, true),
    ).toBe(false)
  })

  it('streams JavaScript bundles without rewriting them', () => {
    expect(
      shouldPassthroughBody(
        'apps/dashboards/assets/chunk.31296.2f37e67a45e33ef5a97f.js',
        'application/javascript',
        2_000_000,
        true,
      ),
    ).toBe(true)
    expect(
      shouldPassthroughBody('apps/dashboards/assets/vendor.js', 'application/javascript', 2_000_000, true),
    ).toBe(true)
    expect(
      shouldPassthroughBody('jsapi/jsapi4/init.js', 'application/javascript', 50_000, true),
    ).toBe(true)
    expect(
      shouldPassthroughBody(
        'apps/experiencebuilder/jimu-core/index.js',
        'application/javascript',
        80_000,
        true,
      ),
    ).toBe(true)
  })

  it('rewrites a small Experience Builder config script', () => {
    expect(
      shouldPassthroughBody(
        'apps/experiencebuilder/experience/config.js',
        'application/javascript',
        4000,
        true,
      ),
    ).toBe(false)
  })
})

describe('rewritePortalText', () => {
  it('rewrites absolute GeoHub URLs and leaves root-relative paths alone', () => {
    const input = [
      'https://gh.space.gov.rw/portal/sharing/rest/portals/self',
      '"/sharing/rest/portals/self"',
      '"portalHostname":"gh.space.gov.rw/portal"',
    ].join('\n')
    const out = rewritePortalText(input, req, 'gh', 'sharing/rest/portals/self')
    expect(out).toContain(
      'https://localhost:5180/api/portal/proxy/gh/sharing/rest/portals/self',
    )
    expect(out).toContain('"/sharing/rest/portals/self"')
    expect(out).toContain('"portalHostname":"localhost:5180/api/portal/proxy/gh"')
    expect(out).not.toContain('/api/portal/proxy/gh/api/portal/proxy')
    expect(out).not.toContain('gh.space.gov.rw')
  })

  it('rewrites EWIS and RMB portals onto their own proxy hosts', () => {
    const out = rewritePortalText(
      [
        'https://ewis.minema.gov.rw/portal/apps/dashboards/7798e9db298d43608c0ce091dd87124d',
        'https://gis.rmb.gov.rw/portal/sharing/rest',
      ].join('\n'),
      req,
      'ewis',
      'apps/dashboards/7798e9db298d43608c0ce091dd87124d',
    )
    expect(out).toContain('https://localhost:5180/api/portal/proxy/ewis/apps/dashboards/')
    expect(out).toContain('https://localhost:5180/api/portal/proxy/rmb/sharing/rest')
  })

  it('replaces Experience Builder BASE_URL and does not inject a base tag', () => {
    const html = `<!DOCTYPE html><html><head><script>var x="https://BASE_URL/jimu-core/"</script></head><body></body></html>`
    const out = rewritePortalText(
      html,
      req,
      'gh',
      'apps/experiencebuilder/experience/',
    )
    expect(out).toContain(
      'https://localhost:5180/api/portal/proxy/gh/apps/experiencebuilder/jimu-core/',
    )
    expect(out).not.toContain('<base ')
    expect(out).not.toContain('https://BASE_URL/')
  })
})

describe('pipeUpstreamBody', () => {
  it('ends the response when the portal body times out', async () => {
    const res = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    res.headersSent = false
    res.statusCode = 200
    res.setHeader = () => {}
    const body = new ReadableStream({
      start(controller) {
        controller.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      },
    })

    pipeUpstreamBody(body, res)
    await new Promise((resolve, reject) => {
      res.on('finish', resolve)
      res.on('error', reject)
    })
    expect(res.statusCode).toBe(504)
  })
})
