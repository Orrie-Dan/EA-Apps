import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import LogoMark from './LogoMark'
import SiteFooter from './SiteFooter'
import { useWorkspaceNav, WorkspaceNavProvider } from './workspace-nav'

function LayoutInner() {
  const { portal } = useRuntimeConfig()
  const location = useLocation()
  const { setOpen } = useWorkspaceNav()
  const isLegal = location.pathname.startsWith('/legal')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 960px)').matches) {
      setOpen(false)
    }
  }, [location.pathname, setOpen])

  return (
    <div className={`shell ${isLegal ? 'shell--legal' : 'shell--workspace'}`}>
      {isLegal ? (
        <header className="topbar">
          <div className="topbar-left">
            <NavLink to="/" className="brand" aria-label="Go to home">
              <LogoMark size={32} />
              <span className="brand-copy">
                <span className="brand-title">{portal.name}</span>
              </span>
            </NavLink>
          </div>
        </header>
      ) : null}

      <main className="main">
        <Outlet />
      </main>

      {isLegal ? <SiteFooter /> : null}
    </div>
  )
}

export default function Layout() {
  return (
    <WorkspaceNavProvider>
      <LayoutInner />
    </WorkspaceNavProvider>
  )
}
