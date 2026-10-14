import { describe, it, expect } from 'vitest'
import { modules, stats, footer, portal, getSolution } from './config'
import { PROXY_PATHS } from '../lib/access'

describe('workspace config (runtime-config defaults)', () => {
  it('publishes only live agriculture modules', () => {
    expect(modules.map((m) => m.id)).toEqual(['land-profiling', 'livestock'])
  })

  it('keeps withdrawn apps out of the published catalog', () => {
    const live = modules.flatMap((m) => m.solutions.map((s) => s.id))
    for (const id of [
      'farming-inputs-distribution',
      'crops-health-monitoring',
      'export-crops-supply-chain',
    ]) {
      expect(live).not.toContain(id)
    }
    expect(getSolution('inputs', 'farming-inputs-distribution').solution).toBeNull()
  })

  it('hides any solution that cannot be embedded', () => {
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        expect(solution.embedUrl).toBeTruthy()
      }
    }
  })

  it('counts published solutions only', () => {
    expect(stats.modules).toBe(2)
    expect(stats.solutions).toBe(3)
  })

  it('embeds every solution same-origin via the portal proxy', () => {
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        expect(solution.embedUrl.startsWith(PROXY_PATHS.gh)).toBe(true)
        expect(solution.embedUrl).not.toContain('gh.space.gov.rw')
      }
    }
  })

  it('gives every solution a stable id the sidebar can route to', () => {
    const ids = modules.flatMap((m) => m.solutions.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(getSolution('livestock', 'animal-resources-distribution').solution).toBeTruthy()
    expect(getSolution('advisory', 'anything').solution).toBeNull()
  })

  it('uses the full portal name, with no subtitle behind it', () => {
    expect(portal.name).toBe('Agriculture and Livestock Management')
    expect(portal.name).not.toBe(portal.shortName)
  })

  it('quick-links home plus live applications only', () => {
    expect(footer.quickLinks[0]).toEqual({ label: 'Home', to: '/' })
    const routes = footer.quickLinks.slice(1).map((l) => l.to)
    expect(routes).toHaveLength(3)
    for (const route of routes) {
      const [, , moduleId, , solutionId] = route.split('/')
      expect(getSolution(moduleId, solutionId).solution).toBeTruthy()
    }
    expect(routes.some((r) => r.includes('advisory'))).toBe(false)
  })

  it('leaves contact email and phone empty', () => {
    expect(footer.contact.email).toBe('')
    expect(footer.contact.phone).toBe('')
  })
})
