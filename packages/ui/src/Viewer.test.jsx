import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { ViewerError, ViewerFrame, ViewerLoading, ViewerMessage } from './Viewer.jsx'
import LogoMark from './LogoMark.jsx'
import ModulePage from './pages/ModulePage.jsx'
import { Route } from 'react-router-dom'
import { makeConfig, renderShell } from '../test/renderShell.jsx'

describe('viewer states', () => {
  it('frames the app under the base path', () => {
    renderShell(<ViewerFrame title="Roads" src="/api/portal/gh/apps/x" />)
    expect(screen.getByTitle('Roads')).toHaveAttribute('src', '/base/api/portal/gh/apps/x')
  })

  it('shows loading and alert messages', () => {
    renderShell(
      <>
        <ViewerLoading />
        <ViewerMessage alert>Missing config</ViewerMessage>
      </>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the mapping portal')
    expect(screen.getByRole('alert')).toHaveTextContent('Missing config')
  })

  it('retries from the error state', () => {
    const onRetry = vi.fn()
    renderShell(<ViewerError onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('LogoMark', () => {
  it('uses the logo image when the app has one', () => {
    renderShell(<LogoMark size={40} />, { shell: { logo: '/logo.png' } })
    expect(document.querySelector('img.logo-mark')).toHaveAttribute('src', '/logo.png')
  })

  it('falls back to the brand icon tile', () => {
    renderShell(<LogoMark />, { shell: { brandIcon: 'leaf' } })
    expect(document.querySelector('.logo-mark--tile svg')).toBeInTheDocument()
  })
})

describe('ModulePage', () => {
  const modules = [
    { id: 'm', name: 'M', solutions: [{ id: 'f', isForm: true }, { id: 'first' }] },
    { id: 'empty', name: 'Empty Module', solutions: [] },
  ]
  const routes = <Route path="/module/:moduleId/app/:solutionId" element={<p>opened app</p>} />

  it("opens the module's first non-form app", () => {
    renderShell(<ModulePage />, { path: '/module/m', config: makeConfig({ modules }), routes: [
      <Route key="m" path="/module/:moduleId" element={<ModulePage />} />,
      <Route key="a" path="/module/:moduleId/app/:solutionId" element={<p>opened app</p>} />,
    ] })
    expect(screen.getByText('opened app')).toBeInTheDocument()
  })

  it('uses the app rule when given one', () => {
    renderShell(null, {
      path: '/module/m',
      config: makeConfig({ modules }),
      shell: { firstSolutionOf: () => undefined },
      routes: [<Route key="m" path="/module/:moduleId" element={<ModulePage />} />, routes],
    })
    expect(screen.getByText('No applications are published for this module yet.')).toBeInTheDocument()
  })
})
