import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { LogOut, PanelLeftClose } from 'lucide-react'
import IconMark from './IconMark'
import LogoMark from './LogoMark'
import { useAuth } from '../auth/AuthProvider'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { useWorkspaceNav } from './workspace-nav'

export default function WorkspaceSidebar() {
  const { portal, modules } = useRuntimeConfig()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { moduleId, solutionId } = useParams()
  const { setOpen } = useWorkspaceNav()

  return (
    <aside className="workspace-sidebar" aria-label="Modules">
      <div className="workspace-sidebar-brand">
        <NavLink to="/" className="workspace-sidebar-brand-link" aria-label="Go to home">
          <LogoMark size={32} />
          <span className="workspace-sidebar-brand-title">{portal.name}</span>
        </NavLink>
        <button
          type="button"
          className="nav-toggle nav-toggle--sidebar"
          aria-label="Collapse modules menu"
          onClick={() => setOpen(false)}
        >
          <PanelLeftClose size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <nav className="workspace-menu" aria-label="Module applications">
        {modules.map((mod) => (
          <section key={mod.id} className="workspace-menu-group">
            <div className="workspace-menu-parent">
              <span className="workspace-menu-parent-icon" aria-hidden="true">
                <IconMark name={mod.icon} size={16} />
              </span>
              <span className="workspace-menu-parent-title">{mod.name}</span>
            </div>

            <div className="workspace-menu-branch">
              <ul className="workspace-menu-children">
                {mod.solutions.map((item) => {
                  const to = `/module/${mod.id}/app/${item.id}`
                  const isActive = moduleId === mod.id && solutionId === item.id
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={to}
                        className={`workspace-menu-child${isActive ? ' is-active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="workspace-menu-child-icon" aria-hidden="true">
                          <IconMark name={item.icon} size={16} />
                        </span>
                        <span className="workspace-menu-child-label">{item.name}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ))}
      </nav>

      <footer className="workspace-sidebar-footer">
        <button
          type="button"
          className="workspace-sidebar-logout"
          aria-label="Log out"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
          Logout
        </button>
      </footer>
    </aside>
  )
}
