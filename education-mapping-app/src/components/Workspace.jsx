import { Outlet } from 'react-router-dom'
import WorkspaceSidebar from './WorkspaceSidebar'
import { useWorkspaceNav } from './workspace-nav'

export default function Workspace() {
  const { open, setOpen } = useWorkspaceNav()

  return (
    <div className={`workspace ${open ? 'is-nav-open' : 'is-nav-closed'}`}>
      <WorkspaceSidebar open={open} />
      {open ? (
        <button
          type="button"
          className="workspace-scrim"
          aria-label="Close modules menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="workspace-pane">
        <Outlet />
      </div>
    </div>
  )
}
