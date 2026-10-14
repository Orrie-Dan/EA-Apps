import { describe, expect, it } from 'vitest'
import { rewritePayload } from './embed-proxy.js'

/**
 * A StoryMap cannot run under a proxy base (its router only accepts
 * /portal/apps/storymaps/...), so an Experience's links to one must reach the
 * browser untouched while every other portal link is still proxied.
 */
describe('StoryMap links in proxied payloads', () => {
  const story = 'https://gh.space.gov.rw/portal/apps/storymaps/stories/0ad919ea544d408da446c518ab8da0e8'
  const dashboard = 'https://gh.space.gov.rw/portal/apps/dashboards/0057b13db2d04c46b85c90189dbba5ca'
  const req = { headers: { host: 'localhost:4173' } }

  it('leaves story links on the portal and still proxies the rest', () => {
    const body = JSON.stringify({ staticUrl: story, expression: `<p>${story}</p>`, encoded: encodeURIComponent(story), dashboard })
    const json = JSON.parse(rewritePayload(body, 'gh', req, 'application/json'))
    expect(json.staticUrl).toBe(story)
    expect(json.expression).toBe(`<p>${story}</p>`)
    expect(json.encoded).toBe(encodeURIComponent(story))
    expect(json.dashboard).not.toBe(dashboard)
    expect(json.dashboard).toContain('/api/portal/proxy/gh/apps/dashboards/0057b13db2d04c46b85c90189dbba5ca')
  })
})
