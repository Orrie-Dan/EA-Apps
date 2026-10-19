import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route } from 'react-router-dom'
import LoginPage, { safeNext } from './LoginPage.jsx'
import { makeAuth, renderShell } from '../../test/renderShell.jsx'

const signedOut = (extra) => makeAuth({ authenticated: false, user: null, ...extra })

function fill(user, pass) {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: user } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: pass } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('safeNext', () => {
  it.each([
    ['/module/a/app/b', '/module/a/app/b'],
    [null, '/'],
    ['', '/'],
    ['https://evil.example/', '/'],
    ['//evil.example/x', '/'],
    ['/\\evil.example', '/'],
    ['/login?next=/x', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})

describe('LoginPage', () => {
  it('shows the portal name, hint and hero under the app base path', () => {
    renderShell(<LoginPage />, { path: '/login', auth: signedOut() })
    expect(screen.getByRole('heading', { name: 'Test Mapping' })).toBeInTheDocument()
    expect(screen.getByText(/open Test Mapping/)).toBeInTheDocument()
    expect(document.querySelector('.landing-photo')).toHaveAttribute('src', '/base/hero.png')
  })

  it('signs in with a trimmed username', async () => {
    const signIn = vi.fn(async () => {})
    renderShell(<LoginPage />, { path: '/login', auth: signedOut({ signIn }) })
    fill('  ada  ', 'pw')
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ada', 'pw'))
  })

  it('shows the error from a failed sign-in and clears the password', async () => {
    const signIn = vi.fn(async () => {
      throw new Error('Invalid username or password.')
    })
    renderShell(<LoginPage />, { path: '/login', auth: signedOut({ signIn }) })
    fill('ada', 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('shows a spinner while the session is being checked', () => {
    renderShell(<LoginPage />, { path: '/login', auth: signedOut({ checking: true }) })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  })

  it('sends a signed-in user to a safe next path only', () => {
    renderShell(<LoginPage />, {
      path: '/login?next=//evil.example',
      routes: <Route path="/" element={<p>home</p>} />,
    })
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
