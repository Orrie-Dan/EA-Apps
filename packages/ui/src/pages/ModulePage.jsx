import { Navigate, useParams } from 'react-router-dom'
import { ViewerMessage } from '../Viewer.jsx'
import { defaultFirstSolution, useShell } from '../ShellProvider.jsx'

/**
 * Module landing: opens the module's first app (top of its sidebar section).
 * Only a module with no published apps stays on this screen.
 */
export default function ModulePage() {
  const { config, firstSolutionOf = defaultFirstSolution } = useShell()
  const { moduleId } = useParams()
  const current = config.getModule(moduleId)

  if (!current) return <Navigate to="/" replace />

  const first = firstSolutionOf(current)
  if (first) return <Navigate to={`/module/${current.id}/app/${first.id}`} replace />

  return (
    <ViewerMessage title={current.name}>
      No applications are published for this module yet.
    </ViewerMessage>
  )
}
