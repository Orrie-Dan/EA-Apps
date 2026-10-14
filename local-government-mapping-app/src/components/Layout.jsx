import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, PanelLeft } from 'lucide-react'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { useAuth } from '../auth/AuthProvider'
import LogoMark from './LogoMark'
import SiteFooter from './SiteFooter'
import WorkspaceSidebar from './WorkspaceSidebar'
import { WorkspaceNavProvider } from './workspace-nav'

const DESKTOP_NAV = '(min-width: 961px)'

function isDesktopNav() {
  return window.matchMedia(DESKTOP_NAV).matches
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'U'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function Layout() {
  const { portal } = useRuntimeConfig()
  const location = useLocation()
  const { session, logout } = useAuth()
  const isLegal = location.pathname.startsWith('/legal')
  const [navOpen, setNavOpen] = useState(() => isDesktopNav())
  const user = session?.user?.fullName || session?.user?.username || ''
  const navValue = useMemo(
    () => ({
      open: navOpen,
      setOpen: setNavOpen,
      logout,
      closeIfMobile: () => {
        if (!isDesktopNav()) setNavOpen(false)
      },
    }),
    [navOpen, logout],
  )

  useEffect(() => {
    if (!isDesktopNav()) setNavOpen(false)
  }, [location.pathname])

  if (isLegal) {
    return (
      <div className="shell">
        <header className="topbar topbar--legal">
          <NavLink to="/" className="brand" aria-label="Go to home">
            <LogoMark size={32} />
            <span className="brand-text">
              <span className="brand-title">{portal.name}</span>
              {portal.description ? <span className="brand-desc">{portal.description}</span> : null}
            </span>
          </NavLink>
          <div className="topbar-actions">
            {user ? (
              <>
                <span className="user-avatar" aria-hidden="true">
                  {initials(user)}
                </span>
                <span className="user-pill">{user}</span>
              </>
            ) : null}
            <button type="button" className="text-btn" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <WorkspaceNavProvider value={navValue}>
      <div className={`shell shell--workspace ${navOpen ? 'is-nav-open' : 'is-nav-closed'}`}>
        <WorkspaceSidebar open={navOpen} />
        {navOpen ? (
          <button
            type="button"
            className="workspace-scrim"
            aria-label="Close modules menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <div className="workspace-stage">
          <header className="topbar topbar--workspace">
            <div className="topbar-start">
              <button
                type="button"
                className="nav-toggle"
                aria-label="Open modules menu"
                aria-expanded={navOpen}
                onClick={() => setNavOpen((value) => !value)}
              >
                <Menu size={18} strokeWidth={1.8} />
              </button>
            </div>
          </header>
          {!navOpen ? (
            <button
              type="button"
              className="sidebar-rail-toggle"
              aria-label="Open modules menu"
              aria-expanded={false}
              onClick={() => setNavOpen(true)}
            >
              <PanelLeft size={18} strokeWidth={1.8} />
            </button>
          ) : null}
          <main className="main">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceNavProvider>
  )
}
