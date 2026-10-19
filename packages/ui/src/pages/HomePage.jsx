import { Navigate } from 'react-router-dom'
import { ViewerMessage } from '../Viewer.jsx'
import { useShell } from '../ShellProvider.jsx'

/**
 * Workspace home after login: opens the app at the top of the sidebar.
 * Only a portal with no published apps stays on this screen.
 */
export default function HomePage() {
  const { config } = useShell()
  const first = config.getFirstSolutionPath?.()

  if (first) return <Navigate to={first} replace />

  return (
    <ViewerMessage title={config.portal.name}>
      No applications are published for this portal yet.
    </ViewerMessage>
  )
}
