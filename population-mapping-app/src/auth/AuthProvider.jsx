import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { signInToGeoHub } from './geoHubAuth'
import { closeAppGate, openAppGate } from './portalHostSession.js'
import { clearPortalHostSessions } from './portalHostSession.js'
import { STATIC_BUILD } from '../config/deployMode.js'
import {
  readRuntimeSession,
  signInWithRuntimeSession,
  signOutOfRuntimeSession,
} from './runtimeSessionAuth.js'

const STORAGE_KEY = 'demotrade_ui_session'
const AuthContext = createContext(null)

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { authenticated: false }
    const data = JSON.parse(raw)
    if (!data?.authenticated || (data.expiresAt && Date.now() > data.expiresAt)) {
      sessionStorage.removeItem(STORAGE_KEY)
      return { authenticated: false }
    }
    return data
  } catch {
    return { authenticated: false }
  }
}

function writeStoredSession(data) {
  if (!data?.authenticated) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    const data = readStoredSession()
    setSession(data)
    return data
  }

  async function login(username, password) {
    // Static hosting: the Runtime Config service checks the GeoHub account
    // and holds the session (HttpOnly cookie) used by its portal proxy.
    if (STATIC_BUILD) {
      const data = await signInWithRuntimeSession(username, password)
      writeStoredSession(data)
      setSession(data)
      return data
    }

    const tokenData = await signInToGeoHub(username, password)
    const data = {
      authenticated: true,
      user: { username },
      expiresAt: Number(tokenData.expires) || Date.now() + 20160 * 1000,
    }
    writeStoredSession(data)
    await openAppGate({ expiresAt: data.expiresAt })
    setSession(data)
    return data
  }

  async function logout() {
    writeStoredSession({ authenticated: false })
    if (STATIC_BUILD) {
      await signOutOfRuntimeSession()
      setSession({ authenticated: false })
      return
    }
    await clearPortalHostSessions()
    await closeAppGate()
    setSession({ authenticated: false })
  }

  useEffect(() => {
    if (STATIC_BUILD) {
      // The server-side session is the source of truth; the stored copy only
      // avoids a flash of the login page.
      refresh()
      void readRuntimeSession()
        .catch(() => ({ authenticated: false }))
        .then((data) => {
          writeStoredSession(data)
          setSession(data)
        })
        .finally(() => setLoading(false))
      return
    }

    const data = refresh()
    if (data?.authenticated) {
      // The server refuses to reopen a gate that has expired; the stored
      // session is stale then, so sign out rather than look signed in.
      void openAppGate({ expiresAt: data.expiresAt }).catch((error) => {
        if (error?.status !== 401) return
        writeStoredSession({ authenticated: false })
        setSession({ authenticated: false })
      })
    }
    setLoading(false)
  }, [])

  const value = useMemo(
    () => ({ session, loading, refresh, login, logout }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
