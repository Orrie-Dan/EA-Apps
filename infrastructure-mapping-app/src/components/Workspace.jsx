import { Outlet } from 'react-router-dom'
import { Menu, PanelLeft } from 'lucide-react'
import WorkspaceSidebar from './WorkspaceSidebar'
import { useWorkspaceNav } from './workspace-nav'

export default function Workspace() {
  const { open, setOpen } = useWorkspaceNav()

  return (
    <div className={`workspace ${open ? 'is-nav-open' : 'is-nav-closed'}`}>
      <WorkspaceSidebar />
      {open ? (
        <button
          type="button"
          className="workspace-scrim"
          aria-label="Close modules menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {!open ? (
        <>
          <button
            type="button"
            className="nav-toggle nav-toggle--float nav-toggle--reopen"
            aria-label="Open modules menu"
            onClick={() => setOpen(true)}
          >
            <PanelLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="nav-toggle nav-toggle--float nav-toggle--menu"
            aria-label="Open modules menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </>
      ) : null}
      <div className="workspace-pane">
        <Outlet />
      </div>
    </div>
  )
}
