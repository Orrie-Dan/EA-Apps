import { useAuth } from '../auth/AuthContext'
import IconMark from './IconMark'

/**
 * Who is signed in, and the way out. Pinned to the foot of the sidebar.
 *
 * Its own component so the sidebar's module list stays testable without an
 * auth provider standing behind it.
 */
export default function SidebarAccount() {
  const { user, signOut } = useAuth()
  const name = user?.fullName || user?.username || ''

  return (
    <div className="sidebar__foot">
      {name && (
        <div className="account">
          <span className="account__avatar" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="account__name" title={name}>
            {name}
          </span>
        </div>
      )}
      <button type="button" className="logout" onClick={signOut}>
        <IconMark name="logout" size={20} />
        <span>Logout</span>
      </button>
    </div>
  )
}
