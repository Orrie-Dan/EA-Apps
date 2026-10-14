import { createContext, useContext } from 'react'

/**
 * Sidebar open/closed state, shared between the sidebar's own collapse button,
 * the opener that appears in its place, and the scrim behind the mobile drawer.
 */
export const WorkspaceNavContext = createContext({
  open: true,
  setOpen: () => {},
  toggle: () => {},
})

export function useWorkspaceNav() {
  return useContext(WorkspaceNavContext)
}
