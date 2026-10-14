import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { portal } from '../data/config'

export default function AuthGate({ children }) {
  const { user, checking } = useAuth()
  const location = useLocation()

  // The session lives in an HttpOnly cookie, so on a cold load we do not know
  // whether the user is signed in until the server answers. Redirecting during
  // that window would bounce an already-authenticated user to the login screen.
  if (checking) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <span className="spinner" />
        <span className="sr-only">Checking your {portal.identity.name} session</span>
      </div>
    )
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return children
}
