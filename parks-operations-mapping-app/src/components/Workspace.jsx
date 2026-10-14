import { Outlet } from 'react-router-dom'
import IconMark from './IconMark'
import WorkspaceSidebar from './WorkspaceSidebar'
import { useWorkspaceNav } from './workspace-nav'

/**
 * Pathless layout: the sidebar plus the pane its routes render into.
 *
 * Legal pages are a sibling of this route, not a child, so they get the footer
 * without a sidebar.
 */
export default function Workspace() {
  const { open, setOpen, toggle } = useWorkspaceNav()

  return (
    <div className={`workspace ${open ? 'is-nav-open' : 'is-nav-closed'}`}>
      <WorkspaceSidebar />

      {/* Overlay drawer only; inert on desktop, where the sidebar is in flow. */}
      <button
        type="button"
        className="workspace-scrim"
        aria-label="Close modules menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      {/*
        The only way back once the sidebar is closed. The collapse control used
        to live in the header bar; with that gone, closing the sidebar would
        otherwise be a one-way trip — and on the narrow layout, where the
        sidebar is an overlay, there would be no way to open it at all.
      */}
      {!open && (
        <button
          type="button"
          className="workspace-opener"
          onClick={toggle}
          aria-label="Open modules menu"
        >
          <IconMark name="panelLeft" size={18} />
        </button>
      )}

      <div className="workspace-pane">
        <Outlet />
      </div>
    </div>
  )
}
