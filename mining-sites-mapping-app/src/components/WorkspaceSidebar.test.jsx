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
const row = (mod, solution) => group(mod).getByRole('link', { name: solution.name })

describe('WorkspaceSidebar', () => {
  it('publishes only solutions that have an embedUrl', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const mod of modules) {
      expect(mod.solutions.length).toBeGreaterThan(0)
      for (const solution of mod.solutions) {
        expect(solution.embedUrl).toBeTruthy()
        // Same-origin only — never a Portal URL, which would be frame-refused.
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

  it('does not repeat the portal name as a heading under the brand', () => {
    renderAt()
    const nav = screen.getByRole('navigation', { name: 'Modules' })
    expect(within(nav).getAllByText(portal.name)).toHaveLength(1)
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
