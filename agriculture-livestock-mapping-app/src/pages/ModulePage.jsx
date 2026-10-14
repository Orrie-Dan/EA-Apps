import { Navigate, useParams } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'

/**
 * Module landing: opens the module's first app (top of its sidebar section).
 * Only a module with no published apps stays on this screen.
 */
export default function ModulePage() {
  const { getModule } = useRuntimeConfig()
  const { moduleId } = useParams()
  const current = getModule(moduleId)

  if (!current) return <Navigate to="/" replace />

  // Same rule as getFirstSolutionPath: first non-form app, in sidebar order.
  const first = (current.groups ? current.groups.flatMap((g) => g.solutions) : current.solutions).find(
    (s) => !s.isForm && s.embedUrl,
  )
  if (first) return <Navigate to={`/module/${current.id}/app/${first.id}`} replace />

  return (
    <div className="viewer viewer--pane viewer--status" aria-label={current.name}>
      <h1 className="workspace-home-title">{current.name}</h1>
      <p>No applications are published for this module yet.</p>
    </div>
  )
}
