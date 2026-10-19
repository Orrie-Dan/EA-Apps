import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuntimeConfigProvider } from './config/RuntimeConfigProvider'
import { WorkspaceNavProvider, WorkspaceSidebar } from '@ea/ui'
import AppShell from './shell.jsx'
import { AuthProvider } from './auth/AuthContext'
import { modules } from './data/config'

const sidebar = (
  <WorkspaceNavProvider>
    <WorkspaceSidebar />
  </WorkspaceNavProvider>
)

function renderAt(path = '/') {
  return render(
    <RuntimeConfigProvider><AuthProvider><AppShell>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={sidebar} />
          <Route path="/module/:moduleId/app/:solutionId" element={sidebar} />
        </Routes>
      </MemoryRouter>
    </AppShell></AuthProvider></RuntimeConfigProvider>,
  )
}

describe('WorkspaceSidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          authenticated: true,
          user: { username: 'agri', fullName: 'Agri User' },
        }),
      })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('heads each module with its icon and name', () => {
    renderAt()
    for (const mod of modules) {
      const section = screen.getByRole('region', { name: mod.name })
      expect(section.querySelector('.workspace-menu-parent-icon svg')).toBeTruthy()
      expect(section.querySelector('.workspace-menu-parent-title').textContent).toBe(mod.name)
    }
  })

  it('labels every solution with its full catalog name', () => {
    renderAt()
    for (const mod of modules) {
      for (const solution of mod.solutions) {
        const link = screen.getByRole('link', { name: solution.name })
        // The whole name is on screen, so there is no tooltip copy of it.
        expect(link).not.toHaveAttribute('title')
      }
    }
  })

  it('shows no solution counts, since every row is already on screen', () => {
    renderAt()
    expect(screen.queryByText(/^\d+ solutions?$/)).toBeNull()
  })

  it('shows every solution at once, with no disclosure to work through', () => {
    const { container } = renderAt()
    const total = modules.reduce((n, m) => n + m.solutions.length, 0)
    // Scoped to the catalog: the portal name at the top is a link as well.
    expect(container.querySelectorAll('.workspace-menu-child')).toHaveLength(total)
    // The collapse and sign-out buttons are the only ones here; nothing in the
    // catalog expands or hides.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-expanded')
    }
  })

  it('routes each link at its own solution', () => {
    renderAt()
    const link = screen.getByRole('link', { name: 'Soil Information Mapping' })
    expect(link).toHaveAttribute('href', '/module/land-profiling/app/soil-information-mapping')
  })

  it('marks only the solution the URL is on', () => {
    const { container } = renderAt('/module/livestock/app/animal-resources-distribution')
    const current = container.querySelectorAll('.workspace-menu-child.is-active')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Animal Resources Distribution Mapping')
    expect(current[0]).toHaveAttribute('aria-current', 'page')
  })

  it('gives every module a distinct accent', () => {
    const accents = modules.map((m) => m.accent)
    expect(new Set(accents).size).toBe(accents.length)
    for (const accent of accents) expect(accent).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('never lists a module whose application is not live', () => {
    renderAt()
    expect(screen.queryByText(/Farmer Advisory/)).toBeNull()
    expect(screen.queryByText(/Coming soon/i)).toBeNull()
  })
})
