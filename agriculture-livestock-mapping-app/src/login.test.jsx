import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '@ea/ui'
import { RuntimeConfigProvider } from './config/RuntimeConfigProvider'
import { AuthProvider } from './auth/AuthContext'
import AppShell from './shell.jsx'
import { portal } from './data/config'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ authenticated: false }) })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  function renderLogin() {
    return render(
      <RuntimeConfigProvider><AuthProvider><AppShell>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AppShell></AuthProvider></RuntimeConfigProvider>,
    )
  }

  it('shows the photograph as decoration only, with no text over it', async () => {
    const { container } = renderLogin()
    await screen.findByRole('heading', { name: portal.name })
    const photo = container.querySelector('.landing-photo')
    expect(photo).toHaveAttribute('alt', '')
    expect(photo.textContent).toBe('')
  })

  it('heads the card with the brand badge and the full portal name, and no agency logo image', async () => {
    const { container } = renderLogin()
    await screen.findByRole('heading', { name: portal.name })
    const card = container.querySelector('.login-card')
    expect(card.querySelector('.logo-mark--tile svg')).toBeTruthy()
    expect(card.querySelector('img')).toBeNull()
    expect(card.querySelector('h1').textContent).toBe(portal.name)
    expect(card.querySelector('h1').textContent).not.toBe(portal.shortName)
  })

  it('asks for a username and a password, and submits with Sign in', async () => {
    renderLogin()
    expect(await screen.findByLabelText('Username')).toHaveAttribute('placeholder', 'Username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
  })
})
