import { NavLink, useMatch } from 'react-router-dom'
import { LogOut, PanelLeftClose } from 'lucide-react'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import IconMark from './IconMark'
import LogoMark from './LogoMark'
import { useWorkspaceNav } from './workspace-nav'

export default function WorkspaceSidebar({ open }) {
  const appMatch = useMatch('/module/:moduleId/app/:solutionId')
  const moduleMatch = useMatch('/module/:moduleId')
  const moduleId = appMatch?.params.moduleId || moduleMatch?.params.moduleId
  const solutionId = appMatch?.params.solutionId
  const { modules, portal } = useRuntimeConfig()
  const { setOpen, logout, closeIfMobile } = useWorkspaceNav()
  const dismiss = closeIfMobile || (() => setOpen(false))

  return (
    <aside className={`workspace-sidebar ${open ? 'is-open' : ''}`} aria-label="Modules">
      <div className="sidebar-brand-row">
        <NavLink to="/" className="sidebar-brand" onClick={dismiss}>
          <LogoMark size={32} />
          <span>
            <strong>{portal.name}</strong>
          </span>
        </NavLink>
        <button
          type="button"
          className="sidebar-collapse"
          aria-label="Collapse modules menu"
          aria-expanded={open}
          onClick={() => setOpen(false)}
        >
          <PanelLeftClose size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="sidebar-scroll">
        {modules.map((mod) => {
          return (
            <div key={mod.id} className={`sidebar-group ${moduleId === mod.id ? 'is-active' : ''}`}>
              <div className="sidebar-group-toggle">
                <IconMark name={mod.icon} size={16} />
                <span className="sidebar-group-copy">
                  <strong>{mod.name}</strong>
                </span>
              </div>
              <ul className="sidebar-list">
                {mod.solutions.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={`/module/${mod.id}/app/${item.id}`}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive || solutionId === item.id ? 'is-on' : ''}`
                      }
                      onClick={dismiss}
                    >
                      <IconMark name={item.icon} size={16} />
                      <span>{item.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={logout}>
          <LogOut size={16} strokeWidth={1.8} />
          Logout
        </button>
      </div>
    </aside>
  )
}
