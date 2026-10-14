import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SiteFooter from './SiteFooter'
import { WorkspaceNavContext } from './workspace-nav'

const DESKTOP = '(min-width: 961px)'
const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches

/**
 * The shell has no header bar.
 *
 * The sidebar carries the portal's identity, its navigation and the signed-in
 * user, so a top bar repeating the name above it was a second row of chrome
 * earning nothing. Everything it held now lives in the sidebar, and the pane
 * starts at the top of the viewport.
 */
export default function Layout() {
  const { pathname } = useLocation()
  const isLegal = pathname.startsWith('/legal')

  // Open by default on desktop, closed on the narrow layout where the sidebar
  // is an overlay drawer.
  const [open, setOpen] = useState(isDesktop)

  useEffect(() => {
    // Only the overlay drawer closes on navigation. On desktop, picking a map
    // must leave the sidebar exactly as the user left it.
    if (!isDesktop()) setOpen(false)
  }, [pathname])

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const navValue = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])

  return (
    <WorkspaceNavContext.Provider value={navValue}>
      <div className={`shell ${isLegal ? 'shell--legal' : 'shell--workspace'}`}>
        <main className="main">
          <Outlet />
        </main>

        {isLegal && <SiteFooter />}
      </div>
    </WorkspaceNavContext.Provider>
  )
}
