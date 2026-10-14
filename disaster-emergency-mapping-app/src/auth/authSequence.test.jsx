/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { createElement, useEffect, useState } from 'react'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

const { AuthProvider, useAuth } = await import('./AuthProvider.jsx')
const { PortalAccessProvider, usePortalAccess } =
  await import('./PortalAccessProvider.jsx')
const AuthGate = (await import('./AuthGate.jsx')).default
const LandingPage = (await import('../pages/LandingPage.jsx')).default

vi.mock('../config/RuntimeConfigProvider', () => ({
  useRuntimeConfig: () => ({
    portal: {
      name: 'Disaster and Emergency Mapping',
      hero: '/Login-disaster.jpeg',
    },
  }),
}))

vi.mock('./geoHubAuth', () => ({
  signInToGeoHub: vi.fn(async (username, password) => {
    if (username === 'good' && password === 'secret') {
      return { expires: Date.now() + 3_600_000 }
    }
    throw new Error('Invalid username or password.')
  }),
}))

vi.mock('./portalHostSession.js', () => ({
  openAppGate: vi.fn(async () => ({ authenticated: true })),
  closeAppGate: vi.fn(async () => {}),
  depositPortalHostSession: vi.fn(async () => ({ ready: true })),
  clearPortalHostSessions: vi.fn(async () => {}),
}))

function brokerCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/portal-auth/token'),
  )
}

function renderAuthApp(initialPath) {
  return render(
    createElement(
      AuthProvider,
      null,
      createElement(
        PortalAccessProvider,
        null,
        createElement(
          MemoryRouter,
          { initialEntries: [initialPath] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/login',
              element: createElement(LandingPage),
            }),
            createElement(
              Route,
              {
                element: createElement(AuthGate, null, createElement(Outlet)),
              },
              createElement(Route, {
                path: '/module/:moduleId/app/:solutionId',
                element: createElement(AppViewerProbe),
              }),
              createElement(Route, {
                path: '/',
                element: createElement('div', null, 'Home'),
              }),
            ),
          ),
        ),
      ),
    ),
  )
}

function AppViewerProbe() {
  const { ensureToken, getHostState, clearTokens } = usePortalAccess()
  const { logout } = useAuth()
  const [host] = useState('ewis')
  const state = getHostState(host)

  useEffect(() => {
    void ensureToken(host).catch(() => {})
  }, [ensureToken, host])

  return createElement(
    'div',
    null,
    createElement('span', null, `viewer-status:${state.status}`),
    createElement(
      'button',
      { type: 'button', onClick: () => logout() },
      'Logout',
    ),
    createElement(
      'button',
      { type: 'button', onClick: () => clearTokens() },
      'Clear tokens',
    ),
  )
}

describe('login-first broker sequencing', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/portal-auth/token')) {
        return {
          ok: true,
          json: async () => ({
            token: 'broker-token',
            expiresAt: Date.now() + 120_000,
            referer: 'https://localhost:5180',
            portalUrl: 'https://ewis.minema.gov.rw/portal',
            portalHostKey: 'ewis',
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', 'https://localhost:5180')
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllEnvs()
  })

  it('unauthenticated login page does not call the broker', async () => {
    renderAuthApp('/login')
    expect(
      await screen.findByRole('heading', {
        name: 'Disaster and Emergency Mapping',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(brokerCalls()).toHaveLength(0)
  })

  it('unauthenticated secured route redirects to login and does not call broker', async () => {
    renderAuthApp('/module/disaster-mapping/app/disaster-effects')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Disaster and Emergency Mapping' }),
      ).toBeTruthy()
    })
    expect(brokerCalls()).toHaveLength(0)
  })

  it('failed application login stays on login and does not call broker', async () => {
    const user = userEvent.setup()
    renderAuthApp('/login')
    await user.type(screen.getByPlaceholderText('Username'), 'bad')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(
      await screen.findByText(/Invalid username or password/i),
    ).toBeTruthy()
    expect(brokerCalls()).toHaveLength(0)
  })

  it('after login without next, lands on home and does not call the broker', async () => {
    const user = userEvent.setup()
    renderAuthApp('/login')
    await user.type(screen.getByPlaceholderText('Username'), 'good')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Home')).toBeTruthy()
    expect(brokerCalls()).toHaveLength(0)
  })

  it('after login, secured item requests ewis — not gh — and consumes the token', async () => {
    const user = userEvent.setup()
    renderAuthApp(
      '/login?next=%2Fmodule%2Fdisaster-mapping%2Fapp%2Fdisaster-effects',
    )

    await user.type(screen.getByPlaceholderText('Username'), 'good')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByText('viewer-status:ready')).toBeTruthy()
    })

    expect(brokerCalls().length).toBeGreaterThanOrEqual(1)
    const body = JSON.parse(brokerCalls()[0][1].body)
    expect(body).toEqual({
      appKey: 'disaster-emergency-mapping',
      portalHostKey: 'ewis',
    })
    expect(body.portalHostKey).not.toBe('gh')
  })

  it('logout clears in-memory Portal tokens and does not call the broker again', async () => {
    const user = userEvent.setup()
    renderAuthApp(
      '/login?next=%2Fmodule%2Fdisaster-mapping%2Fapp%2Fdisaster-effects',
    )
    await user.type(screen.getByPlaceholderText('Username'), 'good')
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByText('viewer-status:ready')).toBeTruthy()
    })

    const callsBeforeLogout = brokerCalls().length
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Disaster and Emergency Mapping',
      }),
    ).toBeTruthy()
    expect(brokerCalls().length).toBe(callsBeforeLogout)
  })
})

describe('PortalAccessProvider auth guard', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    vi.stubEnv('VITE_RUNTIME_CONFIG_URL', 'https://localhost:5180')
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
  })

  it('fails closed when ensureToken is called while unauthenticated', async () => {
    let api
    function Probe() {
      api = usePortalAccess()
      return createElement('div', null, 'probe')
    }

    render(
      createElement(
        AuthProvider,
        null,
        createElement(PortalAccessProvider, null, createElement(Probe)),
      ),
    )

    await waitFor(() => expect(api).toBeTruthy())
    await expect(api.ensureToken('ewis')).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    expect(brokerCalls()).toHaveLength(0)
  })
})
