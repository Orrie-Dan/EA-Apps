import { ShellProvider } from '@ea/ui'
import { useAuth } from './auth/AuthContext'
import { useRuntimeConfig } from './config/RuntimeConfigProvider'
import { appPath } from './lib/appPath.js'
import { brand } from './lib/brand'

/** This app's colour (guarded at 4.5:1 by check-data.mjs); shades derive from it. */
const theme = { accent: brand.accent }

/** Same rule as getFirstSolutionPath: first non-form app with an embed URL, in sidebar order. */
function firstSolutionOf(mod) {
  const solutions = mod.groups ? mod.groups.flatMap((g) => g.solutions) : mod.solutions
  return solutions.find((s) => !s.isForm && s.embedUrl)
}

/** Connects this app's runtime config and auth to the shared @ea/ui shell. */
export default function AppShell({ children }) {
  const config = useRuntimeConfig()
  const { user, checking, signIn, signOut } = useAuth()
  const auth = {
    checking,
    authenticated: Boolean(user),
    user: user ? { name: user.fullName || user.username || '' } : null,
    // This app's signIn reports failure as { ok: false, error }; the shell expects a rejection.
    async signIn(username, password) {
      const result = await signIn(username, password)
      if (!result?.ok) throw new Error(result?.error || 'Invalid username or password.')
    },
    signOut,
  }

  return (
    <ShellProvider
      config={config}
      auth={auth}
      appPath={appPath}
      brandIcon={brand.icon}
      theme={theme}
      firstSolutionOf={firstSolutionOf}
    >
      {children}
    </ShellProvider>
  )
}
