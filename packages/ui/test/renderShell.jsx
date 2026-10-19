import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShellProvider } from '../src/ShellProvider.jsx'

export function makeConfig(overrides = {}) {
  const modules = overrides.modules || [
    {
      id: 'roads',
      name: 'Roads',
      icon: 'route',
      solutions: [
        { id: 'network', name: 'Road Network', icon: 'route' },
        { id: 'traffic', name: 'Traffic', icon: 'car' },
      ],
    },
  ]
  return {
    portal: { name: 'Test Mapping', hero: '/hero.png' },
    footer: { quickLinks: [] },
    legal: { privacy: { title: 'Privacy', body: ['We keep little.'] } },
    organization: { name: 'Org', copyrightYear: 2026 },
    modules,
    getModule: (id) => modules.find((m) => m.id === id),
    getFirstSolutionPath: () => null,
    ...overrides,
  }
}

export function makeAuth(overrides = {}) {
  return {
    checking: false,
    authenticated: true,
    user: { name: 'Ada Lovelace' },
    signIn: async () => {},
    signOut: async () => {},
    ...overrides,
  }
}

/** Renders `element` at `path` inside a ShellProvider; `routes` adds extra routes. */
export function renderShell(element, { path = '/', config, auth, shell = {}, routes = null } = {}) {
  return render(
    <ShellProvider config={config || makeConfig()} auth={auth || makeAuth()} appPath={(p) => `/base${p}`} {...shell}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
          {routes}
        </Routes>
      </MemoryRouter>
    </ShellProvider>,
  )
}
