import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RuntimeConfigProvider } from '../config/RuntimeConfigProvider'
import { AuthProvider } from '../auth/AuthContext'
import { PortalAccessProvider } from '../auth/PortalAccessProvider'
import AppViewer from './AppViewer'
import HomePage from './HomePage'
import { buildProxyEmbedUrl } from '../lib/access'
import { appPath } from '../lib/appPath.js'

vi.mock('../auth/PortalAccessProvider', async () => {
  const actual = await vi.importActual('../auth/PortalAccessProvider')
  return {
    ...actual,
    usePortalAccess: () => ({
      ensureToken: vi.fn(async () => ({
        status: 'ready',
        proxyReady: true,
        token: 'test-token',
        expiresAt: Date.now() + 60_000,
        error: null,
      })),
      refresh: vi.fn(),
      getHostState: () => ({
        status: 'ready',
        proxyReady: true,
        error: null,
      }),
    }),
  }
})

function renderAt(path) {
  return render(
    <RuntimeConfigProvider>
      <AuthProvider>
        <PortalAccessProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/module/:moduleId/app/:solutionId" element={<AppViewer />} />
            </Routes>
          </MemoryRouter>
        </PortalAccessProvider>
      </AuthProvider>
    </RuntimeConfigProvider>,
  )
}

describe('AppViewer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ authenticated: false }) })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('gives the frame the whole pane, with no title strip above it', async () => {
    const { container } = renderAt('/module/livestock/app/animal-resources-distribution')
    await waitFor(() => {
      expect(screen.getByTitle('Animal Resources Distribution Mapping')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Module$/)).toBeNull()
    expect(screen.queryByText(/solution$/)).toBeNull()
    expect(container.querySelector('.viewer--pane').children).toHaveLength(1)
  })

  it('frames the same-origin proxy path, never the GeoHub URL or a token', async () => {
    renderAt('/module/livestock/app/animal-resources-distribution')
    const expected = buildProxyEmbedUrl({
      kind: 'dashboard',
      portalItemId: '438e024e293142ca996a1e7ab3afa78c',
      portalHostKey: 'gh',
    })
    const frame = await screen.findByTitle('Animal Resources Distribution Mapping')
    // Framed under the base path the app is served from.
    expect(frame.getAttribute('src')).toBe(appPath(expected))
    expect(frame.getAttribute('src')).not.toContain('gh.space.gov.rw')
    expect(frame.getAttribute('src')).not.toContain('token=')
    expect(frame).toHaveClass('app-frame')
  })

  it('offers no breadcrumbs, no picker and no way back to the original', async () => {
    renderAt('/module/land-profiling/app/soil-information-mapping')
    expect(await screen.findByTitle('Soil Information Mapping')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText(/Open original/i)).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('sends an unknown module or solution to the first app', async () => {
    const { unmount } = renderAt('/module/advisory/app/anything')
    expect(await screen.findByTitle('Soil Information Mapping')).toBeInTheDocument()
    unmount()

    renderAt('/module/value-chain/app/export-crops-supply-chain')
    expect(screen.queryByTitle('Export Crops Supply Chain Mapping')).toBeNull()
    expect(await screen.findByTitle('Soil Information Mapping')).toBeInTheDocument()
  })
})
