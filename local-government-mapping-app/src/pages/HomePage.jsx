import { Navigate } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { appPath } from '../lib/appPath.js'

/**
 * Workspace home after login: opens the app at the top of the sidebar.
 * Only a portal with no published apps stays on this screen.
 */
export default function HomePage() {
  const { portal, getFirstSolutionPath } = useRuntimeConfig()
  const first = getFirstSolutionPath()

  if (first) return <Navigate to={first} replace />

  return (
    <div className="workspace-welcome" aria-label="Workspace home">
      <img src={appPath(portal.hero)} alt="" />
      <div className="hero-scrim" />
      <div className="starfield" aria-hidden="true" />
      <div className="workspace-welcome-copy">
        <p className="eyebrow light">{portal.eyebrow}</p>
        <h1>{portal.homeTitle}</h1>
        <p>{portal.tagline}</p>
        <p className="workspace-welcome-hint">
          No applications are published for this portal yet.
        </p>
      </div>
    </div>
  )
}
