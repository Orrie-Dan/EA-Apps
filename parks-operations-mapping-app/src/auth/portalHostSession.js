/**
 * Deposit broker tokens into same-origin HttpOnly cookies for the proxy.
 * Never logs tokens.
 */
import { appPath } from '../lib/appPath.js'
import { STATIC_BUILD } from '../config/deployMode.js'

export async function openAppGate({ expiresAt } = {}) {
  const response = await fetch(appPath('/api/auth/ui-session'), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiresAt: Number(expiresAt) || Date.now() + 20160 * 1000,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    const error = new Error('Unable to open application session')
    error.status = response.status
    throw error
  }
  return response.json()
}

export async function closeAppGate() {
  await fetch(appPath('/api/auth/ui-session'), {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }).catch(() => {})
}

export async function depositPortalHostSession({
  portalHostKey,
  token,
  expiresAt,
}) {
  const host = String(portalHostKey || '')
    .trim()
    .toLowerCase()
  if (!host || !token || !Number.isFinite(expiresAt)) {
    throw new Error('Invalid portal host session deposit')
  }

  const response = await fetch(appPath('/api/portal/host-session'), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      portalHostKey: host,
      token,
      expiresAt,
    }),
  })

  if (!response.ok) {
    throw new Error('Unable to prepare portal proxy access')
  }

  return response.json()
}

export async function clearPortalHostSessions() {
  // Static builds have no app server, so there is no host session to clear.
  if (STATIC_BUILD) return
  await fetch(appPath('/api/portal/host-session'), {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  }).catch(() => {})
}
