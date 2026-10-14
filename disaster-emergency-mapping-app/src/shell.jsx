import { ShellProvider } from '@ea/ui'
import { useAuth } from './auth/AuthProvider'
import { useRuntimeConfig } from './config/RuntimeConfigProvider'
import { appPath } from './lib/appPath.js'
import appIcon from './assets/app-icon.png'

/** This app's colours. */
const theme = {
  accent: '#0b57b5',
  mid: '#3b82f6',
  soft: '#bfdbfe',
  tint: '#eff6ff',
  activeFill: '#dbeafe',
  activeText: '#0b57b5',
}

/** Connects this app's runtime config and auth to the shared @ea/ui shell. */
export default function AppShell({ children }) {
  const config = useRuntimeConfig()
  const { session, loading, login, logout } = useAuth()
  const user = session?.user
  const auth = {
    checking: loading,
    authenticated: Boolean(session?.authenticated),
    user: user ? { name: user.fullName || user.username || '' } : null,
    signIn: login,
    signOut: logout,
  }

  return (
    <ShellProvider config={config} auth={auth} appPath={appPath} logo={appIcon} theme={theme}>
      {children}
    </ShellProvider>
  )
}
