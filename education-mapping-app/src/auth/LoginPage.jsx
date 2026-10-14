import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import LogoMark from '../components/LogoMark'
import { appPath } from '../lib/appPath.js'

export default function LoginPage() {
  const { session, loading, login } = useAuth()
  const { portal } = useRuntimeConfig()
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
    const isEmbedPath = Boolean(next && /\/module\/[^/]+\/app\//.test(next))
    const dest =
      next && !isEmbedPath && next !== '/' && !next.startsWith('/login')
        ? next
        : '/'
    return <Navigate to={dest} replace />
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <img src={appPath(portal.hero)} alt="" />
        <div className="hero-scrim" />
        <div className="starfield" aria-hidden="true" />
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <LogoMark size={52} />
        <h1>{portal.name}</h1>
        <label>
          Username
          <input
            autoComplete="username"
            autoFocus
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
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button className="btn btn-cosmic login-btn" type="submit" disabled={submitting}>
          {submitting ? <span className="boot-orbit" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
          {submitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
