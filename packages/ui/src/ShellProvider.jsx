import { createContext, useContext, useLayoutEffect } from 'react'
import { applyTheme } from './theme.js'

/**
 * Everything the shared shell needs from the app it runs in.
 *
 * Each app renders this once (from its own src/shell.jsx), mapping its own
 * runtime-config and auth hooks onto one contract, so no shared component
 * imports app code and every app's auth/proxy logic stays where it is.
 *
 * @typedef {object} ShellAuth
 * @property {boolean} checking        Session restore still running.
 * @property {boolean} authenticated
 * @property {{ name?: string } | null} [user]
 * @property {(username: string, password: string) => Promise<void>} signIn
 *   Rejects with an Error whose message is shown on the login card.
 * @property {() => Promise<void> | void} signOut
 *
 * @typedef {object} ShellValue
 * @property {object} config   The app's resolved runtime config (portal, modules, footer, legal, organization, getModule, getFirstSolutionPath).
 * @property {ShellAuth} auth
 * @property {(path: string) => string} appPath  Prefixes the app base path.
 * @property {string} [logo]   Image URL for the app mark; without it the brand icon tile is drawn.
 * @property {string} [brandIcon]  Icon name for the tile when there is no logo.
 * @property {Record<string, import('react').ComponentType>} [icons]  Extra/override icons by name.
 * @property {import('./theme.js').ShellTheme} [theme]
 * @property {(mod: object) => object | undefined} [firstSolutionOf]  Which app a module opens on.
 * @property {string} [loginHint]
 */

const ShellContext = createContext(null)

export function ShellProvider({ children, ...value }) {
  const { theme } = value

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined
    return applyTheme(document.documentElement, theme)
  }, [theme])

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

/** @returns {ShellValue} */
export function useShell() {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell must be used within ShellProvider')
  return value
}

/** First app of a module in sidebar order, skipping data-collection forms. */
export function defaultFirstSolution(mod) {
  const solutions = mod.groups ? mod.groups.flatMap((g) => g.solutions) : mod.solutions
  return (solutions || []).find((s) => !s.isForm)
}
