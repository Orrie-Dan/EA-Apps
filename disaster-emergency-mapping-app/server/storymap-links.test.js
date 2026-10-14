import { describe, expect, it } from 'vitest'
import { keepStoryMapLinks } from './storymap-links.js'

// A stand-in for a proxy's body rewrite: every portal URL onto the proxy.
const toProxy = (text) =>
  text
    .replaceAll('https://gh.space.gov.rw/portal', 'https://localhost:5175/app/api/portal/gh')
    .replaceAll(encodeURIComponent('https://gh.space.gov.rw/portal'), encodeURIComponent('https://localhost:5175/app/api/portal/gh'))
    .replaceAll('https:\\/\\/gh.space.gov.rw\\/portal', 'https:\\/\\/localhost:5175\\/app\\/api\\/portal\\/gh')
    .replaceAll('gh.space.gov.rw/portal', 'localhost:5175/app/api/portal/gh')

describe('keepStoryMapLinks', () => {
  const story = 'https://gh.space.gov.rw/portal/apps/storymaps/stories/0ad919ea544d408da446c518ab8da0e8'

  it('leaves story links on their portal in every form', () => {
    const body = JSON.stringify({ staticUrl: story, html: `<p>${story}</p>`, encoded: encodeURIComponent(story), bare: 'gh.space.gov.rw/portal/apps/storymaps' })
    const json = JSON.parse(keepStoryMapLinks(body, toProxy))
    expect(json.staticUrl).toBe(story)
    expect(json.html).toBe(`<p>${story}</p>`)
    expect(json.encoded).toBe(encodeURIComponent(story))
    expect(json.bare).toBe('gh.space.gov.rw/portal/apps/storymaps')
  })

  it('leaves JSON-escaped story links alone', () => {
    const escaped = story.replaceAll('/', '\\/')
    expect(keepStoryMapLinks(`{"u":"${escaped}"}`, toProxy)).toBe(`{"u":"${escaped}"}`)
  })

  it('still rewrites every other portal link in the same body', () => {
    const out = keepStoryMapLinks(`${story} https://gh.space.gov.rw/portal/apps/dashboards/abc`, toProxy)
    expect(out).toBe(`${story} https://localhost:5175/app/api/portal/gh/apps/dashboards/abc`)
  })

  it('does not hold back links that are already on this app', () => {
    const own = 'https://localhost:5175/app/api/portal/gh/apps/storymaps/stories/x'
    expect(keepStoryMapLinks(own, (t) => t.replace('localhost:5175', 'example'))).toBe(own.replace('localhost:5175', 'example'))
  })

  it('does not match a longer word that only starts with storymaps', () => {
    const other = 'https://gh.space.gov.rw/portal/apps/storymapsbuilder/x'
    expect(keepStoryMapLinks(other, toProxy)).toBe('https://localhost:5175/app/api/portal/gh/apps/storymapsbuilder/x')
  })

  it('passes non-strings and story-free text straight through', () => {
    expect(keepStoryMapLinks(undefined, (t) => t)).toBeUndefined()
    expect(keepStoryMapLinks('https://gh.space.gov.rw/portal/x', toProxy)).toBe('https://localhost:5175/app/api/portal/gh/x')
  })
})
