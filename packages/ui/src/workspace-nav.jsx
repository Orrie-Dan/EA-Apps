import { createContext, useContext, useState } from 'react'

const DESKTOP = '(min-width: 961px)'

export const isDesktopNav = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DESKTOP).matches

const WorkspaceNavContext = createContext(null)

/** Sidebar open state: open on desktop, a closed overlay drawer on narrow screens. */
export function WorkspaceNavProvider({ children }) {
  const [open, setOpen] = useState(isDesktopNav)
  return (
    <WorkspaceNavContext.Provider value={{ open, setOpen }}>{children}</WorkspaceNavContext.Provider>
  )
}

export function useWorkspaceNav() {
  const value = useContext(WorkspaceNavContext)
  if (!value) throw new Error('useWorkspaceNav must be used within WorkspaceNavProvider')
  return value
}
