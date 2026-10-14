import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RuntimeConfigProvider } from '../config/RuntimeConfigProvider'
import { describe, expect, it } from 'vitest'
import WorkspaceSidebar from './WorkspaceSidebar'
import { AuthProvider } from '../auth/AuthContext'
import { modules, portal } from '../data/config'
import { brand } from '../lib/brand'

// The sidebar now carries the account block in its foot, so it needs the auth
// provider standing behind it. The provider's session probe fails harmlessly
// under jsdom and settles on "signed out", which is all these tests need.
const renderAt = (path = '/') =>
  render(
    <RuntimeConfigProvider><AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <WorkspaceSidebar />
      </MemoryRouter>
    </AuthProvider></RuntimeConfigProvider>,
  )

// Each module is a labelled <section>, so it is addressable as a region. Queries
// are scoped through it because a label can legitimately repeat across levels —
// the water module and its first solution are both "Water Resources Mapping".
// For the same reason rows are found by their link role, not by their text: in
// that portal the group title and the row carry identical words.
const group = (mod) => within(screen.getByRole('region', { name: mod.name }))

/*
 * Rows are found by href, not by label.
 *
 * A label can legitimately repeat: the water portal's module and its first
 * solution are the same words, and here the group and the portal are both
 * "Parks Operations Mapping". The href is the one thing unique to a row, and
 * it is also what the row is FOR.
 */
const row = (mod, solution) =>
  group(mod).getByRole('link', {
    name: (name, el) => el.getAttribute('href') === `/module/${mod.id}/app/${solution.id}`,
  })

// Mirrors the component: a portal whose only module is the portal itself shows
// no module header, because the brand above it already carries that name.
const soleModule = modules.length === 1 && modules[0].name === portal.name

describe('WorkspaceSidebar', () => {
  it('publishes only solutions that have an embedUrl', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const mod of modules) {
      expect(mod.solutions.length).toBeGreaterThan(0)
      for (const solution of mod.solutions) {
        expect(solution.embedUrl).toBeTruthy()
        // Same-origin only — never an upstream URL, which would be
        // frame-refused, and could carry no session even if it were not.
        expect(solution.embedUrl.startsWith('/')).toBe(true)
      }
    }
  })

  it('carries the brand badge and portal name, and names each module region in full', () => {
    renderAt()
    const nav = screen.getByRole('navigation', { name: 'Modules' })
    expect(nav.querySelector('.sidebar__badge svg')).toBeTruthy()
    expect(nav.querySelector('.sidebar__name')).toHaveTextContent(portal.name)
    for (const mod of modules) {
      expect(screen.getByRole('region', { name: mod.name })).toBeInTheDocument()
    }
  })

  it('shows no solution counts, since every row is already on screen', () => {
    renderAt()
    expect(screen.queryByText(/^\d+ solutions?$/)).not.toBeInTheDocument()
  })

  it('shows every solution without any disclosure to open', () => {
    renderAt()
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        expect(row(mod, solution)).toBeInTheDocument()
      }
    }
    // No category disclosures: the only buttons are collapse and sign out.
    expect(
      screen.queryByRole('button', { name: /environmental|water|parks/i }),
    ).not.toBeInTheDocument()
  })

  it('labels items with the full catalog name, never an abbreviation', () => {
    renderAt()
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        const link = row(mod, solution)
        // The label is complete on screen, so there is nothing for a title
        // tooltip to reveal and no second copy for a screen reader to repeat.
        expect(link).not.toHaveAttribute('title')
        expect(link).toHaveTextContent(solution.name)
      }
    }
  })

  it('links items to /module/:moduleId/app/:solutionId', () => {
    renderAt()
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        expect(row(mod, solution)).toHaveAttribute(
          'href',
          `/module/${mod.id}/app/${solution.id}`,
        )
      }
    }
  })

  it('colours the whole sidebar with the same brand as the login', () => {
    renderAt()
    expect(screen.getByRole('navigation', { name: 'Modules' })).toHaveStyle({
      '--brand-accent': brand.accent,
      '--brand-tint': brand.tint,
    })
  })

  it('ends with a Logout button', () => {
    renderAt()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it('takes both accents straight from the guarded catalog', async () => {
    // check-data.mjs asserts every accentText clears 4.5:1 on the paper ground.
    // That guard is only worth anything if these are the values that render, so
    // the presentation layer must not substitute its own.
    const { modules: catalog } = await import('../data/modules.js')
    for (const mod of modules) {
      const source = catalog.find((m) => m.id === mod.id)
      expect(mod.accent).toBe(source.accent)
      expect(mod.accentText).toBe(source.accentText)
      // The rail, icon and active row all render --accent-dark. On the light
      // chrome that IS the guarded value, so the 4.5:1 check in check-data.mjs
      // now covers the pixels the user actually sees. While the chrome was
      // basalt this was a lifted derivative instead, and the guard only ever
      // applied indirectly.
      expect(mod.accentDark).toBe(source.accentText)
    }
  })
})

/*
 * Grouped solutions.
 *
 * A group is a LABEL, not a destination: the Experience Builder app it is named
 * after is no longer embedded anywhere, so the head must not be a link, and it
 * must not be a disclosure either — this sidebar has never hidden anything
 * behind one and the four dashboards are always on screen.
 */
describe('WorkspaceSidebar grouping', () => {
  const named = modules.flatMap((mod) => mod.groups.filter((g) => g.name).map((g) => [mod, g]))

  it('has a group to test', () => {
    expect(named.length).toBeGreaterThan(0)
  })

  it('shows each group name, as text rather than something to click', () => {
    renderAt()
    for (const [mod, g] of named) {
      const scope = group(mod)
      expect(scope.getByText(g.name)).toBeInTheDocument()
      expect(scope.queryByRole('link', { name: g.name })).not.toBeInTheDocument()
      expect(scope.queryByRole('button', { name: g.name })).not.toBeInTheDocument()
    }
  })

  it('links every dashboard in a group to its own route', () => {
    renderAt()
    for (const [mod, g] of named) {
      for (const solution of g.solutions) {
        expect(row(mod, solution)).toHaveAttribute(
          'href',
          `/module/${mod.id}/app/${solution.id}`,
        )
      }
    }
  })

  it('marks only the open dashboard active, never its group', () => {
    const [mod, g] = named[0]
    const open = g.solutions[1]
    renderAt(`/module/${mod.id}/app/${open.id}`)
    expect(row(mod, open)).toHaveClass('is-active')
    for (const other of g.solutions.filter((s) => s.id !== open.id)) {
      expect(row(mod, other)).not.toHaveClass('is-active')
    }
  })
})

/*
 * A form is nested inside its dashboard's <li>, not listed beside it. That
 * containment is what ties a form to its dashboard, whatever the form's name.
 */
describe('WorkspaceSidebar forms', () => {
  const paired = modules.flatMap((mod) =>
    (mod.groups || []).flatMap((g) => g.solutions.filter((s) => s.form).map((s) => [mod, s])),
  )

  it('has a form under every dashboard', () => {
    expect(paired.length).toBe(9)
  })

  it('nests each form inside the row of the dashboard it feeds', () => {
    renderAt()
    for (const [mod, dashboard] of paired) {
      const parentRow = row(mod, dashboard).closest('li')
      const formLink = within(parentRow).getByRole('link', {
        name: (name, el) =>
          el.getAttribute('href') === `/module/${mod.id}/app/${dashboard.form.id}`,
      })
      expect(formLink).toHaveTextContent(dashboard.form.name)
    }
  })

  it('opens a form without marking its dashboard active', () => {
    const [mod, dashboard] = paired[0]
    renderAt(`/module/${mod.id}/app/${dashboard.form.id}`)
    expect(row(mod, dashboard.form)).toHaveClass('is-active')
    expect(row(mod, dashboard)).not.toHaveClass('is-active')
  })
})
