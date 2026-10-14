import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * Application authentication gate only.
 * Portal broker tokens are requested later in AppViewer, after this login.
 */
export default function AuthGate({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-orbit" aria-label="Loading" />
      </div>
    )
  }

  if (session?.authenticated) {
    return children
  }

  const next = `${location.pathname}${location.search}`
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
}
