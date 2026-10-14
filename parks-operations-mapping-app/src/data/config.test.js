import { describe, expect, it } from 'vitest'
import { modules, stats, getSolution, footer } from './config.js'
import { modules as catalog, totals } from './modules.js'

/*
 * The catalog gained a level: an entry under a module's `apps` may now carry
 * its own `apps` instead of a `url`, which makes it a GROUP — a label with
 * dashboards under it, not something you can open.
 *
 * Two views are derived from that one source and they must not drift:
 *   `mod.groups`    - what the sidebar draws, the tree.
 *   `mod.solutions` - what the router resolves, the flat leaves.
 * Everything downstream of `solutions` (AppViewer, getSolution, stats, the
 * footer links) predates groups and is untouched, so the flattening is the
 * thing holding the change together.
 */

// Mirrors the flattening in config.js: a dashboard's form is a routable leaf
// too, and follows immediately after the dashboard it belongs to.
const groupLeaves = (mod) =>
  mod.groups.flatMap((g) => g.solutions.flatMap((s) => (s.form ? [s, s.form] : [s])))

describe('catalog groups', () => {
  it('flattens every group back to exactly the routable solutions, in order', () => {
    for (const mod of modules) {
      expect(groupLeaves(mod).map((s) => s.id)).toEqual(mod.solutions.map((s) => s.id))
    }
  })

  it('counts dashboards, never group labels and never forms', () => {
    // A group is a label, and a form is another way into a dashboard. Counting
    // either as an application overstates the portal on every screen that
    // shows a total.
    const dashboards = modules.reduce(
      (n, m) => n + m.solutions.filter((s) => !s.isForm).length,
      0,
    )
    expect(stats.solutions).toBe(dashboards)
    expect(totals.apps).toBe(dashboards)
    expect(totals.apps).toBe(9)
    expect(stats.forms).toBe(9)
    expect(totals.forms).toBe(9)
  })

  it('gives a group a name and no url of its own', () => {
    for (const mod of catalog) {
      for (const app of mod.apps) {
        if (!app.apps) continue
        expect(app.name).toBeTruthy()
        expect(app.url).toBeUndefined()
        expect(app.apps.length).toBeGreaterThan(0)
      }
    }
  })

  const parksGroup = (name) =>
    modules.find((m) => m.id === 'parks').groups.find((g) => g.name === name)

  /*
   * Groups are pinned by route id, never by display name.
   *
   * A name is editorial and gets rewritten — these dashboards have already been
   * renamed once — and a test that fails on a rename is just noise. The id is
   * the part that must not move: it is the URL, so changing one silently breaks
   * every existing link to that dashboard.
   */
  it('puts the four park dashboards under one group', () => {
    const group = parksGroup('Parks Operations Mapping')
    expect(group).toBeDefined()
    expect(group.solutions.map((s) => s.id)).toEqual([
      'gorilla-health',
      'golden-monkey',
      'chimpanzee',
      'plant-monitoring',
    ])
  })

  it('puts the five conservation dashboards under their own group', () => {
    const group = parksGroup('Wildlife Conservation Mapping')
    expect(group).toBeDefined()
    expect(group.solutions.map((s) => s.id).sort()).toEqual([
      'gmn-park-conflict',
      'human-wildlife-conflict',
      'illegal-activities',
      'law-enforcement',
      'ranger-monitoring',
    ])
  })

  it('gives every dashboard a name to render', () => {
    // Names are not pinned above, so this is what keeps an empty or missing one
    // from reaching the sidebar as a blank row.
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        expect(solution.name.trim()).not.toBe('')
      }
    }
  })

  it('keeps the two groups apart and in catalog order', () => {
    const parks = modules.find((m) => m.id === 'parks')
    expect(parks.groups.map((g) => g.name)).toEqual([
      'Parks Operations Mapping',
      'Wildlife Conservation Mapping',
    ])
    // Every route id is unique across groups, or one dashboard would shadow
    // another on the same URL.
    const ids = parks.solutions.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every leaf resolvable by the route it is linked as', () => {
    for (const mod of modules) {
      for (const solution of groupLeaves(mod)) {
        expect(getSolution(mod, solution.id)).toBe(solution)
        // Same-origin, always — a dashboard through /api/portal/gh, a form
        // through /api/forms. Nothing is framed at its upstream directly.
        expect(solution.embedUrl.startsWith('/api/')).toBe(true)
      }
    }
  })

  it('no longer embeds the Experience Builder app the group was named after', () => {
    // It became the group's label. Leaving its URL in the catalog would put a
    // fifth row back in the sidebar carrying the page the split was undoing.
    const urls = catalog.flatMap((m) => m.apps.flatMap((a) => a.apps || [a])).map((a) => a.url)
    expect(urls.some((u) => u?.includes('13f0692d8992482fa9d516609f0bf4b3'))).toBe(false)
  })
})

/*
 * Survey123 data collection forms.
 *
 * A form hangs off the dashboard it feeds. It is framed through its own proxy
 * base, /api/forms, rather than the portal's: the form lives on Survey123, not
 * on RDB's Enterprise, but the layer it submits to is not public, so a direct
 * cross-origin frame would prompt for a sign-in inside the iframe.
 */
describe('data collection forms', () => {
  const parks = () => modules.find((m) => m.id === 'parks')
  const forms = () => parks().solutions.filter((s) => s.isForm)

  it('hangs a form under every dashboard', () => {
    const withForms = parks()
      .groups.flatMap((g) => g.solutions)
      .filter((s) => s.form)
    expect(withForms.map((s) => s.id).sort()).toEqual([
      'chimpanzee',
      'gmn-park-conflict',
      'golden-monkey',
      'gorilla-health',
      'human-wildlife-conflict',
      'illegal-activities',
      'law-enforcement',
      'plant-monitoring',
      'ranger-monitoring',
    ])
  })

  it('gives each form its own route, derived from its dashboard', () => {
    for (const solution of parks().groups.flatMap((g) => g.solutions)) {
      if (!solution.form) continue
      expect(solution.form.id).toBe(`${solution.id}-form`)
      expect(getSolution(parks(), solution.form.id)).toBe(solution.form)
    }
  })

  it('frames a form through its own proxy base, never at Survey123', () => {
    for (const solution of parks().solutions) {
      if (!solution.isForm) {
        expect(solution.embedUrl.startsWith('/api/portal/gh/')).toBe(true)
        continue
      }
      expect(solution.embedUrl.startsWith('/api/forms/share/')).toBe(true)
      expect(solution.embedUrl).not.toContain('survey123.arcgis.com')
    }
  })

  /*
   * portalUrl must name THIS origin's portal proxy.
   *
   * Survey123 reads it from its own query string and addresses the portal with
   * it. Left pointing at gis.rdb.rw the form's portal calls go there directly,
   * carrying no session, and Identity Manager prompts inside the frame.
   */
  it('points each form at this portal\'s proxy, absolutely', () => {
    for (const form of forms()) {
      const portalUrl = decodeURIComponent(
        new URLSearchParams(form.embedUrl.split('?')[1]).get('portalUrl'),
      )
      expect(portalUrl).toMatch(/^https?:\/\//)
      expect(portalUrl.endsWith('/api/portal/gh')).toBe(true)
      expect(portalUrl).not.toContain('gis.rdb.rw')
    }
  })

  it('counts nine forms, and does not count them as dashboards', () => {
    expect(forms()).toHaveLength(9)
    expect(totals.apps).toBe(9)
  })

  it('keeps forms out of the footer, which lists dashboards', () => {
    // Checked by ROUTE, not by label: a form may share its dashboard's name —
    // "Illegal Activities" is both — so only the href tells the two apart.
    const formRoutes = forms().map((f) => `/module/parks/app/${f.id}`)
    const links = footer.quickLinks.map((l) => l.to)
    for (const route of formRoutes) expect(links).not.toContain(route)
    expect(links).toContain('/module/parks/app/illegal-activities')
  })

  /*
   * Each form carries its own name, taken from the form itself.
   *
   * They were all labelled "Data collection form" once, on the reasoning that
   * the dashboard above named them — but four identical rows read as a bug
   * rather than as a pattern.
   */
  it('names every form distinctly', () => {
    const names = forms().map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name.trim()).not.toBe('')
  })

  it('names every form after its dashboard, as a Reporting Form', () => {
    for (const solution of parks().groups.flatMap((g) => g.solutions)) {
      if (!solution.form) continue
      expect(solution.form.name).toBe(`${solution.name} Reporting Form`)
    }
  })
})
