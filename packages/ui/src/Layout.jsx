import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoMark from './LogoMark.jsx'
import SiteFooter from './SiteFooter.jsx'
import { useShell } from './ShellProvider.jsx'
import { isDesktopNav, useWorkspaceNav, WorkspaceNavProvider } from './workspace-nav.jsx'

function LayoutInner() {
  const { config } = useShell()
  const { pathname } = useLocation()
  const { setOpen } = useWorkspaceNav()
  const isLegal = pathname.startsWith('/legal')

  // Only the narrow-screen drawer closes on navigation; on desktop the sidebar
  // stays as the user left it.
  useEffect(() => {
    if (!isDesktopNav()) setOpen(false)
  }, [pathname, setOpen])

  return (
    <div className={`shell ${isLegal ? 'shell--legal' : 'shell--workspace'}`}>
      {isLegal ? (
        <header className="topbar">
          <NavLink to="/" className="brand" aria-label="Go to home">
            <LogoMark size={32} />
            <span className="brand-title">{config.portal.name}</span>
          </NavLink>
        </header>
      ) : null}

      <main className="main">
        <Outlet />
      </main>

      {isLegal ? <SiteFooter /> : null}
    </div>
  )
}

/** Signed-in frame: the workspace (sidebar + pane) or, under /legal, a page with header and footer. */
export default function Layout() {
  return (
    <WorkspaceNavProvider>
      <LayoutInner />
    </WorkspaceNavProvider>
  )
}
