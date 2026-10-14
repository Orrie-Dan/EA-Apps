import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { appPath } from '../lib/appPath.js'
import { useAuth } from '../auth/AuthProvider'
import LogoMark from '../components/LogoMark'

/**
 * Health Mapping application login.
 * Must never call the Portal token broker.
 */
export default function LandingPage() {
  const { portal } = useRuntimeConfig()
  const { session, loading, login } = useAuth()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-orbit" aria-label="Loading" />
      </div>
    )
  }

  if (session?.authenticated) {
    const next = params.get('next')
    // Default to workspace home — never auto-open a secured Portal iframe.
    const dest =
      next && next !== '/' && !next.startsWith('/login') ? next : '/'
    return <Navigate to={dest} replace />
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.message || 'Invalid username or password.')
    } finally {
      setSubmitting(false)
      setPassword('')
    }
  }

  return (
    <div className="landing-page">
      <img className="landing-photo" src={appPath(portal.hero)} alt="" />
      <div className="landing-overlay">
        <form className="login-card" onSubmit={onSubmit}>
          <LogoMark size={72} />
          <h1>{portal.name}</h1>
          <p className="login-hint">
            Sign in with your authorised account to open Health Mapping.
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
          <button
            className="btn btn-cosmic login-btn"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
