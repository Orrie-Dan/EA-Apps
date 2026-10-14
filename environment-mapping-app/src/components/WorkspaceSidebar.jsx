import { NavLink, useLocation } from 'react-router-dom'
import IconMark from './IconMark'
import SidebarAccount from './SidebarAccount'
import { useWorkspaceNav } from './workspace-nav'
import { useRuntimeConfig } from '../config/RuntimeConfigProvider'
import { brand } from '../lib/brand'

/*
 * One sidebar for every split portal.
 *
 * The portals' catalogs come in three shapes — a flat list of solutions, named
 * groups of dashboards, and dashboards with a data collection form under each —
 * and one portal carries several modules. This walks all of them the same way,
 * so every portal draws the same header, headings, rows and account foot.
 */

/*
 * A module's groups, or its flat solution list as one group.
 *
 * On a single-module portal that flat group is headed by the module itself, so
 * a portal with no named groups still has a heading over its rows, the same as
 * one that has them. Under a multi-module portal it stays unnamed: the module
 * heading is already directly above it.
 */
const groupsOf = (mod, soleModule) =>
  mod.groups || [
    {
      name: soleModule ? mod.name : null,
      icon: mod.icon,
      solutions: mod.solutions.filter((s) => !s.isForm),
    },
  ]

export default function WorkspaceSidebar() {
  const { modules, portal } = useRuntimeConfig()
  const { pathname } = useLocation()
  const { toggle } = useWorkspaceNav()

  // Every heading is always open. The catalog is a handful of items, so nothing
  // is gained by hiding it behind a disclosure the user has to work through.
  const activeSolutionId = pathname.match(/^\/module\/[^/]+\/app\/([^/]+)/)?.[1]

  /*
   * A portal that IS its module gets no module heading: the brand above already
   * names it. Its named groups take the heading style instead. With several
   * modules, each module is the heading and its groups sit under it as labels —
   * except an `untitled` module, whose groups are headed like a sole module's.
   */
  const soleModule = modules.length === 1

  const renderRow = (mod, solution) => (
    <li key={solution.id}>
      <NavLink
        to={`/module/${mod.id}/app/${solution.id}`}
        className={`modlist__item ${activeSolutionId === solution.id ? 'is-active' : ''}`}
      >
        <IconMark name={solution.icon} size={18} />
        <span>{solution.name}</span>
      </NavLink>

      {/*
        The dashboard's data collection form, nested under it. The nesting is
        what says which dashboard it feeds, so the list is labelled by the
        dashboard's own name.
      */}
      {solution.form && (
        <ul className="modlist modlist--form" aria-label={`${solution.name} forms`}>
          <li>
            <NavLink
              to={`/module/${mod.id}/app/${solution.form.id}`}
              className={`modlist__item modlist__item--form ${
                activeSolutionId === solution.form.id ? 'is-active' : ''
              }`}
            >
              <IconMark name={solution.form.icon} size={15} />
              <span>{solution.form.name}</span>
            </NavLink>
          </li>
        </ul>
      )}
    </li>
  )

  return (
    <nav
      className="workspace-sidebar"
      aria-label="Modules"
      // One colour for the whole sidebar, the same one the login uses.
      style={{ '--brand-accent': brand.accent, '--brand-tint': brand.tint }}
    >
      <div className="sidebar__top">
        <NavLink to="/" className="sidebar__brand">
          <span className="sidebar__badge" aria-hidden="true">
            <IconMark name={brand.icon} size={22} />
          </span>
          <span className="sidebar__name">{portal.name}</span>
        </NavLink>
        <button
          type="button"
          className="sidebar__collapse"
          onClick={toggle}
          aria-label="Collapse modules menu"
        >
          <IconMark name="panelLeftClose" size={18} />
        </button>
      </div>

      <div className="sidebar__scroll">
        {modules.map((mod) => {
          const titled = !soleModule && !mod.untitled
          return (
            <section
              key={mod.id}
              className={`navsection ${titled ? '' : 'navsection--untitled'}`}
              aria-label={mod.name}
            >
              {titled && (
                <div className="navhead">
                  <span className="navhead__tile" aria-hidden="true">
                    <IconMark name={mod.icon} size={18} />
                  </span>
                  <span className="navhead__title">{mod.name}</span>
                </div>
              )}

              {groupsOf(mod, soleModule).map((group, i) => {
                const headingId = group.name ? `${mod.id}-group-${i}` : undefined
                return (
                  <div key={group.name || `solo-${i}`} className="navgroup">
                    {/* A group is a label, never a link or a disclosure. */}
                    {group.name &&
                      (!titled ? (
                        <div className="navhead" id={headingId}>
                          <span className="navhead__tile" aria-hidden="true">
                            <IconMark name={group.icon} size={18} />
                          </span>
                          <span className="navhead__title">{group.name}</span>
                        </div>
                      ) : (
                        <div className="navsub" id={headingId}>
                          <IconMark name={group.icon} size={15} />
                          <span>{group.name}</span>
                        </div>
                      ))}

                    <ul
                      className={`modlist ${group.name || !soleModule ? 'modlist--nested' : ''}`}
                      aria-labelledby={headingId}
                    >
                      {group.solutions.map((solution) => renderRow(mod, solution))}
                    </ul>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      <SidebarAccount />
    </nav>
  )
}
