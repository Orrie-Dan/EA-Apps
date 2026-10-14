import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import IconMark from '../components/IconMark'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { brand } from '../lib/brand'
import { appPath } from '../lib/appPath.js'

export default function LoginPage() {
  const { portal } = useRuntimeConfig()
  const { user, checking, signIn } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (checking) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <span className="spinner" />
        <span className="sr-only">Checking your {portal.identity.name} session</span>
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const result = await signIn(username, password)
    setBusy(false)
if (!result.ok) setError(result.error)
  }

  return (
    <main
      className="login"
      style={{
        '--login-accent': brand.accent,
        '--login-tint': brand.tint,
      }}
    >
      {/* Photograph only, shown as it is. The portal's name is the card's
          heading, so setting it over the photo as well would say it twice. */}
      <div
        className="login-visual"
        style={{ backgroundImage: `url(${appPath(portal.hero)})` }}
        aria-hidden="true"
      />

      <div className="login-panel">
        <form className="login-card" onSubmit={onSubmit} noValidate>
          <span className="login-card__badge" aria-hidden="true">
            <IconMark name={brand.icon} size={32} />
          </span>
          <h1 className="login-card__title">{portal.name}</h1>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              disabled={busy}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={busy}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="login-card__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary login-card__submit" disabled={busy}>
            {busy ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Signing in</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
