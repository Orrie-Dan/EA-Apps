import { Navigate, useParams } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { appPath } from '../lib/appPath.js'

/**
 * Module landing: opens the module's first app (top of its sidebar section).
 * Only a module with no published apps stays on this screen.
 */
export default function ModulePage() {
  const { moduleId } = useParams()
  const { getModule } = useRuntimeConfig()
  const current = getModule(moduleId)

  if (!current) return <Navigate to="/" replace />

  const first = current.solutions[0]
  if (first) return <Navigate to={`/module/${current.id}/app/${first.id}`} replace />

  return (
    <div className="workspace-welcome" aria-label={current.name}>
      <img src={appPath(current.image)} alt="" />
      <div className="hero-scrim" />
      <div className="starfield" aria-hidden="true" />
      <div className="workspace-welcome-copy">
        <p className="eyebrow light">Module</p>
        <h1>{current.name}</h1>
        <p>{current.description}</p>
        <p className="workspace-welcome-hint">
          No applications are published for this module yet.
        </p>
      </div>
    </div>
  )
}
