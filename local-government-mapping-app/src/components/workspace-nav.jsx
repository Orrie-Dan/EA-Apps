import { createContext, useContext } from 'react'

const WorkspaceNavContext = createContext({
  open: false,
  setOpen: () => {},
})

export function WorkspaceNavProvider({ value, children }) {
  return (
    <WorkspaceNavContext.Provider value={value}>
      {children}
    </WorkspaceNavContext.Provider>
  )
}

export function useWorkspaceNav() {
  return useContext(WorkspaceNavContext)
}
