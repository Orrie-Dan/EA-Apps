import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose } from 'lucide-react'
import IconMark from './IconMark.jsx'
import LogoMark from './LogoMark.jsx'
import { useShell } from './ShellProvider.jsx'
import { useWorkspaceNav } from './workspace-nav.jsx'

const ACTIVE_APP = /^\/module\/([^/]+)\/app\/([^/]+)/

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

/**
 * One labelled section per module.
 *
 * Catalogs come in three shapes: a module with a flat solution list, a module
 * with named groups, and dashboards carrying a data-collection `form`, listed right after them. A module
 * shows its own heading with its groups as sub-labels, unless it is `untitled`
 * or is the only module and has groups — then its groups take the heading
 * style instead (the brand above already names a sole module). A module
 * heading that would only repeat the portal name under the brand is dropped;
 * group names always show (they label which dashboards belong together).
 */
export function sidebarSections(modules, portalName) {
  const sole = modules.length === 1
  const heading = (text) => (text && text !== portalName ? text : null)
  return modules.map((mod) => {
    const groupsAreHeadings = Boolean(mod.groups) && (Boolean(mod.untitled) || sole)
    return {
      key: mod.id,
      mod,
      title: groupsAreHeadings || mod.untitled ? null : heading(mod.name),
      icon: mod.icon,
      groupsAreHeadings,
      groups: mod.groups
        ? mod.groups.map((g) => ({ name: g.name, icon: g.icon, solutions: g.solutions }))
        : [{ solutions: (mod.solutions || []).filter((s) => !s.isForm) }],
    }
  })
}

export default function WorkspaceSidebar() {
  const { config, auth } = useShell()
  const { portal, modules } = config
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { setOpen } = useWorkspaceNav()
  const [, activeModuleId, activeSolutionId] = pathname.match(ACTIVE_APP) || []
  const userName = auth.user?.name || ''

  const row = (mod, item, form = false) => {
    const isActive = activeModuleId === mod.id && activeSolutionId === item.id
    return (
      <NavLink
        to={`/module/${mod.id}/app/${item.id}`}
        className={`workspace-menu-child${form ? ' workspace-menu-child--form' : ''}${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="workspace-menu-child-icon">
          <IconMark name={item.icon} size={16} />
        </span>
        <span className="workspace-menu-child-label">{item.name}</span>
      </NavLink>
    )
  }

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
        {sidebarSections(modules, portal.name).map((section) => (
          <section key={section.key} className="workspace-menu-group" aria-label={section.mod.name}>
            {section.title ? (
              <div className="workspace-menu-parent">
                <span className="workspace-menu-parent-icon">
                  <IconMark name={section.icon} size={16} />
                </span>
                <span className="workspace-menu-parent-title">{section.title}</span>
              </div>
            ) : null}

            {section.groups.map((group, i) => (
              <div key={group.name || i} className="workspace-menu-branch">
                {group.name && section.groupsAreHeadings ? (
                  <div className="workspace-menu-parent">
                    <span className="workspace-menu-parent-icon">
                      <IconMark name={group.icon} size={16} />
                    </span>
                    <span className="workspace-menu-parent-title">{group.name}</span>
                  </div>
                ) : null}
                {group.name && !section.groupsAreHeadings ? (
                  <div className="workspace-menu-subhead">
                    <IconMark name={group.icon} size={14} />
                    <span>{group.name}</span>
                  </div>
                ) : null}
                <ul className="workspace-menu-children">
                  {group.solutions.filter((s) => !s.isForm).flatMap((item) => [
                    <li key={item.id}>{row(section.mod, item)}</li>,
                    // A dashboard's form follows it at the same level as the other apps.
                    item.form ? <li key={`${item.id}:form`}>{row(section.mod, item.form, true)}</li> : null,
                  ])}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </nav>

      <footer className="workspace-sidebar-footer">
        {userName ? (
          <div className="workspace-sidebar-account">
            <span className="workspace-sidebar-avatar" aria-hidden="true">
              {initials(userName)}
            </span>
            <span className="workspace-sidebar-account-name" title={userName}>
              {userName}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          className="workspace-sidebar-logout"
          onClick={async () => {
            // Leave for the login page even if the server-side sign-out fails.
            try {
              await auth.signOut()
            } finally {
              navigate('/login', { replace: true })
            }
          }}
        >
          <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
          Logout
        </button>
      </footer>
    </aside>
  )
}
