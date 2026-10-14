import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconMark from '../components/IconMark'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { brand } from '../lib/brand'
import { useAuth } from './AuthContext'
import { appPath } from '../lib/appPath.js'

/**
 * The gate: photograph on the left, a tinted panel with one credential card on
 * the right, in the portal's brand colour (see lib/brand.js).
 *
 * After sign-in the visitor lands on workspace home — never an embed deep link
 * that would auto-open a secured Portal iframe (AUTH-04).
 */
export default function LoginPage() {
  const { portal } = useRuntimeConfig()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Always land on workspace home after sign-in — never auto-open a secured
  // Portal iframe via ?next= deep links (AUTH-04).
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const result = await signIn(username, password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <main
      className="login"
      style={{ '--login-accent': brand.accent, '--login-tint': brand.tint }}
    >
      {/* Photograph only, shown as it is. The portal's name heads the card, so
          setting it over the photo as well would say it twice. */}
      <div
        className="login-visual"
        style={{ backgroundImage: `url(${appPath(portal.hero)})` }}
        aria-hidden="true"
      />

      <div className="login-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <span className="login-card__badge" aria-hidden="true">
            <IconMark name={brand.icon} size={32} />
          </span>
          <h1 className="login-card__title">{portal.name}</h1>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the card is
              // the only thing on the screen and typing is the only action.
              autoFocus
              required
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="login-card__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary login-card__submit" disabled={busy}>
            {busy && <span className="boot-spinner boot-spinner--sm" />}
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
