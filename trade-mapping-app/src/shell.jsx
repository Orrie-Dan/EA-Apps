import { ShellProvider } from '@ea/ui'
import { useAuth } from './auth/AuthProvider'
import { useRuntimeConfig } from './config/RuntimeConfigProvider'
import { appPath } from './lib/appPath.js'

/** This app's colour; the shared styles derive the other shades from it. */
const theme = { accent: '#2563eb' }

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
    <ShellProvider config={config} auth={auth} appPath={appPath} brandIcon="store" theme={theme}>
      {children}
    </ShellProvider>
  )
}
