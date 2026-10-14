import { Navigate } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

/**
 * Workspace home after login: opens the app at the top of the sidebar.
 * Only a portal with no published apps stays on this screen.
 */
export default function HomePage() {
  const { portal, getFirstSolutionPath } = useRuntimeConfig()
  const first = getFirstSolutionPath()

  if (first) return <Navigate to={first} replace />

  return (
    <div className="viewer viewer--pane viewer--status" aria-label="Workspace home">
      <h1 className="workspace-home-title">{portal.name}</h1>
      <p>No applications are published for this portal yet.</p>
    </div>
  )
}
