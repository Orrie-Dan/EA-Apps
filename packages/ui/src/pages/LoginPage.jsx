import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import LogoMark from '../LogoMark.jsx'
import { useShell } from '../ShellProvider.jsx'

/** Only same-app paths are followed after sign-in (no protocol-relative or absolute URLs). */
export function safeNext(next) {
  if (!next || typeof next !== 'string') return '/'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (next.startsWith('/login')) return '/'
  return next
}

export default function LoginPage() {
  const { config, auth, appPath, loginHint } = useShell()
  const { portal } = config
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (auth.checking) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <div className="boot-orbit" aria-hidden="true" />
        <span className="sr-only">Checking your session</span>
      </div>
    )
  }

  if (auth.authenticated) return <Navigate to={safeNext(params.get('next'))} replace />

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await auth.signIn(username.trim(), password)
    } catch (err) {
      setError(err?.message || 'Invalid username or password.')
    } finally {
      setSubmitting(false)
      setPassword('')
    }
  }

  return (
    <div className="landing-page">
      {portal.hero ? (
        <img className="landing-photo" src={appPath(portal.hero)} alt="" />
      ) : (
        <div className="landing-photo landing-photo--empty" aria-hidden="true" />
      )}
      <div className="landing-overlay">
        <form className="login-card" onSubmit={onSubmit}>
          <LogoMark size={72} />
          <h1>{portal.name}</h1>
          <p className="login-hint">
            {loginHint || `Sign in with your authorised account to open ${portal.name}.`}
          </p>
          <label>
            Username
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary login-btn" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
