import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { applyTypography } from './applyTypography.js'
import { loadRuntimeConfig } from './loadRuntimeConfig.js'
import { resolveDefaultRuntimeConfig } from './resolveRuntimeConfig.js'

const RuntimeConfigContext = createContext(null)

export function RuntimeConfigProvider({ children }) {
  const [state, setState] = useState({
    loading: false,
    config: resolveDefaultRuntimeConfig(),
    source: 'defaults',
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    loadRuntimeConfig().then((result) => {
      if (cancelled) return
      // DEV-only connection diagnostic (not shown in UI).
      if (import.meta.env.DEV) {
        console.info('[runtime-config]', {
          source: result.source,
          error: result.error,
          name: result.config?.portal?.name,
          homeTitle: result.config?.portal?.homeTitle,
          documentTitle: result.config?.portal?.documentTitle,
        })
      }
      setState({
        loading: false,
        config: result.config,
        source: result.source,
        error: result.error,
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const title =
      state.config?.portal?.documentTitle || state.config?.portal?.name
    if (!title) return
    document.title = title
  }, [state.config?.portal?.documentTitle, state.config?.portal?.name])

  // Before paint, so the shared text styles never flash in after the content.
  const typography = state.config?.branding?.typography
  useLayoutEffect(() => {
    applyTypography(typography)
  }, [typography])

  if (state.loading) {
    return (
      <div className="boot-screen" role="status" aria-live="polite"><span className="spinner" /><span className="sr-only">Loading configuration</span></div>
    )
  }

  return (
    <RuntimeConfigContext.Provider value={state}>
      {children}
    </RuntimeConfigContext.Provider>
  )
}

/** Resolved UI config (portal, modules, footer, helpers, …). */
export function useRuntimeConfig() {
  const value = useContext(RuntimeConfigContext)
  if (!value) {
    throw new Error('useRuntimeConfig must be used within RuntimeConfigProvider')
  }
  return value.config
}

/** Loading / source / error metadata (for debugging; not shown to end users). */
export function useRuntimeConfigMeta() {
  const value = useContext(RuntimeConfigContext)
  if (!value) {
    throw new Error(
      'useRuntimeConfigMeta must be used within RuntimeConfigProvider',
    )
  }
  return { source: value.source, error: value.error, loading: value.loading }
}
