import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { RuntimeConfigProvider } from '../config/RuntimeConfigProvider'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import AppViewer from './AppViewer'
import { HomePage, WorkspaceNavProvider, WorkspaceSidebar } from '@ea/ui'
import AppShell from '../shell.jsx'
import { AuthProvider } from '../auth/AuthContext'
import { PortalAccessProvider } from '../auth/PortalAccessProvider'

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

const renderAt = (path) =>
  render(
    <RuntimeConfigProvider>
      <AuthProvider>
        <PortalAccessProvider>
          <AppShell>
          <MemoryRouter initialEntries={[path]}>
            <WorkspaceNavProvider>
              <WorkspaceSidebar />
            </WorkspaceNavProvider>
            <Where />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/module/:moduleId/app/:solutionId" element={<AppViewer />} />
            </Routes>
          </MemoryRouter>
          </AppShell>
        </PortalAccessProvider>
      </AuthProvider>
    </RuntimeConfigProvider>,
  )

describe('HomePage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ authenticated: false }) })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens the app at the top of the sidebar instead of asking the user to pick one', () => {
    const { container } = renderAt('/')
    const topApp = container.querySelector('a[href*="/app/"]').getAttribute('href')
    expect(screen.getByTestId('where').textContent).toBe(topApp)
    expect(screen.queryByLabelText('Workspace home')).toBeNull()
  })

  it('sends an unknown solution to the top app instead of a blank home', () => {
    const { container } = renderAt('/module/nope/app/nothing')
    const topApp = container.querySelector('a[href*="/app/"]').getAttribute('href')
    expect(screen.getByTestId('where').textContent).toBe(topApp)
  })
})
