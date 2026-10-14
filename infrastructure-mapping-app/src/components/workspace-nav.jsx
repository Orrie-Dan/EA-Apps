import { createContext, useContext, useState } from 'react'

const WorkspaceNavContext = createContext(null)

export function WorkspaceNavProvider({ children }) {
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 961px)').matches : true,
  )

  return (
    <WorkspaceNavContext.Provider value={{ open, setOpen }}>
      {children}
    </WorkspaceNavContext.Provider>
  )
}

export function useWorkspaceNav() {
  const value = useContext(WorkspaceNavContext)
  if (!value) throw new Error('useWorkspaceNav must be used within WorkspaceNavProvider')
  return value
}
