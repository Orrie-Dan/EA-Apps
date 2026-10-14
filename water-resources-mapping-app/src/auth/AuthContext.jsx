import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearPortalHostSessions,
  closeAppGate,
  openAppGate,
} from './portalHostSession.js'
import { appPath } from '../lib/appPath.js'
import { STATIC_BUILD } from '../config/deployMode.js'
import {
  readRuntimeSession,
  signInWithRuntimeSession,
  signOutOfRuntimeSession,
} from './runtimeSessionAuth.js'

/**
 * Authentication against GeoHub, brokered by this portal's own server.
 *
 * Credentials are posted to /api/auth/login on this origin. The server
 * exchanges them with gh.space.gov.rw for a portal token, keeps that token in a
 * signed HttpOnly cookie, and attaches it to every proxied request. The token
 * is never sent to the browser, so nothing here can leak it — this context only
 * ever sees who the user is, never their credentials or token.
 */
const AuthContext = createContext(null)

const GATE_TTL_MS = 20160 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // Ask the server who we are. The session lives in an HttpOnly cookie, so this
  // is the only way the client can find out.
  const refresh = useCallback(async () => {
    try {
      // Static hosting: the Runtime Config service holds the session.
      if (STATIC_BUILD) {
        const data = await readRuntimeSession()
        setUser(data.authenticated ? data.user : null)
        return
      }
      const res = await fetch(appPath('/api/auth/session'), { credentials: 'include' })
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)
        void openAppGate({ expiresAt: Date.now() + GATE_TTL_MS }).catch(() => {})
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      user,
      checking,
      async signIn(username, password) {
        if (!String(username || '').trim() || !String(password || '')) {
          return { ok: false, error: 'Enter your GeoHub username and password.' }
        }
        // Static hosting: the Runtime Config service checks the GeoHub account
        // and holds the session (HttpOnly cookie) used by its portal proxy.
        if (STATIC_BUILD) {
          try {
            const data = await signInWithRuntimeSession(username, password)
            setUser(data.user)
            return { ok: true }
          } catch (err) {
            return { ok: false, error: err?.message || 'Unable to sign in. Please try again.' }
          }
        }
        try {
          const res = await fetch(appPath('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.authenticated) {
            return { ok: false, error: data.error || 'Invalid username or password.' }
          }
          setUser(data.user)
          await openAppGate({ expiresAt: Date.now() + GATE_TTL_MS })
          return { ok: true }
        } catch {
          return { ok: false, error: 'Could not reach the portal server. Is it running?' }
        }
      },
      async signOut() {
        if (STATIC_BUILD) {
          await signOutOfRuntimeSession()
          setUser(null)
          return
        }
        try {
          await clearPortalHostSessions()
          await closeAppGate()
          await fetch(appPath('/api/auth/logout'), { method: 'POST', credentials: 'include' })
        } finally {
          setUser(null)
        }
      },
    }),
    [user, checking],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
