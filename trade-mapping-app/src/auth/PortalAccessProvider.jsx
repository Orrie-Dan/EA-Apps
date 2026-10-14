import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthProvider'
import { PortalTokenError, requestPortalToken } from './portalToken.js'
import {
  clearPortalHostSessions,
  depositPortalHostSession,
} from './portalHostSession.js'

const PortalAccessContext = createContext(null)

const REFRESH_SKEW_MS = 60_000

const IDLE_HOST = Object.freeze({
  status: 'idle',
  token: null,
  expiresAt: null,
  portalUrl: null,
  referer: null,
  portalHostKey: null,
  proxyReady: false,
  error: null,
})

function normalizeHostKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Lazy, host-keyed Portal broker tokens.
 *
 * - Never fetches on mount
 * - Never fetches while the mapping user is unauthenticated
 * - Tokens live in memory only, keyed by portalHostKey
 * - Cleared on logout / session loss
 */
export function PortalAccessProvider({ children }) {
  const { session } = useAuth()
  const authenticated = Boolean(session?.authenticated)

  const cacheRef = useRef(new Map())
  const inFlightRef = useRef(new Map())
  const [hosts, setHosts] = useState(() => ({}))
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const publishHost = useCallback((hostKey, entry) => {
    cacheRef.current.set(hostKey, entry)
    if (!mounted.current) return
    setHosts((prev) => ({ ...prev, [hostKey]: entry }))
  }, [])

  const clearTokens = useCallback(() => {
    cacheRef.current.clear()
    inFlightRef.current.clear()
    void clearPortalHostSessions()
    if (mounted.current) {
      setHosts({})
    }
  }, [])

  useEffect(() => {
    if (!authenticated) {
      clearTokens()
    }
  }, [authenticated, clearTokens])

  const getHostState = useCallback(
    (portalHostKey) => {
      const hostKey = normalizeHostKey(portalHostKey)
      if (!hostKey) return IDLE_HOST
      return hosts[hostKey] || cacheRef.current.get(hostKey) || IDLE_HOST
    },
    [hosts],
  )

  const ensureToken = useCallback(
    async (portalHostKey, { force = false } = {}) => {
      const hostKey = normalizeHostKey(portalHostKey)
      if (!hostKey) {
        throw new PortalTokenError(
          'Unable to connect to the mapping portal. Please try again.',
          { code: 'missing_portal_host_key' },
        )
      }

      if (!authenticated) {
        throw new PortalTokenError(
          'Sign in to Trade Mapping before opening secured maps.',
          { code: 'unauthenticated' },
        )
      }

      const cached = cacheRef.current.get(hostKey)
      if (
        !force &&
        cached?.token &&
        cached.expiresAt &&
        cached.expiresAt - Date.now() > REFRESH_SKEW_MS
      ) {
        await depositPortalHostSession({
          portalHostKey: hostKey,
          token: cached.token,
          expiresAt: cached.expiresAt,
        })
        const ready = { ...cached, status: 'ready', proxyReady: true, error: null }
        publishHost(hostKey, ready)
        return ready
      }

      const existing = inFlightRef.current.get(hostKey)
      if (existing) {
        return existing
      }

      publishHost(hostKey, {
        status: 'loading',
        token: force ? null : cached?.token ?? null,
        expiresAt: force ? null : cached?.expiresAt ?? null,
        portalUrl: force ? null : cached?.portalUrl ?? null,
        referer: force ? null : cached?.referer ?? null,
        portalHostKey: hostKey,
        error: null,
      })

      const promise = requestPortalToken({ portalHostKey: hostKey })
        .then(async (result) => {
          await depositPortalHostSession({
            portalHostKey: result.portalHostKey || hostKey,
            token: result.token,
            expiresAt: result.expiresAt,
          })
          const entry = {
            status: 'ready',
            token: result.token,
            expiresAt: result.expiresAt,
            portalUrl: result.portalUrl,
            referer: result.referer,
            portalHostKey: result.portalHostKey || hostKey,
            error: null,
            proxyReady: true,
          }
          publishHost(hostKey, entry)
          return entry
        })
        .catch((err) => {
          const entry = {
            status: 'error',
            token: null,
            expiresAt: null,
            portalUrl: null,
            referer: null,
            portalHostKey: hostKey,
            proxyReady: false,
            error:
              err?.message ||
              'Unable to connect to the mapping portal. Please try again.',
          }
          publishHost(hostKey, entry)
          throw err
        })
        .finally(() => {
          inFlightRef.current.delete(hostKey)
        })

      inFlightRef.current.set(hostKey, promise)
      return promise
    },
    [authenticated, publishHost],
  )

  const refresh = useCallback(
    (portalHostKey) => ensureToken(portalHostKey, { force: true }),
    [ensureToken],
  )

  const value = useMemo(
    () => ({
      authenticated,
      hosts,
      getHostState,
      ensureToken,
      refresh,
      clearTokens,
    }),
    [authenticated, hosts, getHostState, ensureToken, refresh, clearTokens],
  )

  return (
    <PortalAccessContext.Provider value={value}>
      {children}
    </PortalAccessContext.Provider>
  )
}

export function usePortalAccess() {
  const value = useContext(PortalAccessContext)
  if (!value) {
    throw new Error('usePortalAccess must be used within PortalAccessProvider')
  }
  return value
}
