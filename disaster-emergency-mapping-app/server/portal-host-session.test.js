import { describe, expect, it } from 'vitest'
import {
  APP_GATE_COOKIE,
  PORTAL_AUTH_HOSTS,
  PORTAL_HOST_COOKIE,
  authHostForProxyKey,
  clearHostTokenMap,
  isAllowedProxyHostKey,
  readHostTokenMap,
  resolveTokenForProxyHost,
  signPayload,
  writeHostTokenMap,
} from './portal-host-session.js'

const SECRET = 'test-secret'
const PROXY_HOSTS = {
  gh: 'https://gh.example/portal',
  ghw: 'https://gh.example',
  ewis: 'https://ewis.example/portal',
  ewisw: 'https://ewis.example',
  rmb: 'https://rmb.example/portal',
}

describe('portal-host-session', () => {
  it('allowlists only known proxy hosts', () => {
    expect(isAllowedProxyHostKey('ewis', PROXY_HOSTS)).toBe(true)
    expect(isAllowedProxyHostKey('evil', PROXY_HOSTS)).toBe(false)
    expect(isAllowedProxyHostKey('../etc', PROXY_HOSTS)).toBe(false)
  })

  it('maps wide aliases to auth hosts and isolates tokens', () => {
    expect(authHostForProxyKey('ewisw')).toBe('ewis')
    expect(authHostForProxyKey('rmbw')).toBe('rmb')
    expect(PORTAL_AUTH_HOSTS.has('ewis')).toBe(true)

    const map = writeHostTokenMap({}, 'ewis', 'ewis-token', Date.now() + 60_000).hosts
    expect(resolveTokenForProxyHost('ewis', map)).toBe('ewis-token')
    expect(resolveTokenForProxyHost('ewisw', map)).toBe('ewis-token')
    expect(resolveTokenForProxyHost('rmb', map)).toBeNull()
    expect(resolveTokenForProxyHost('gh', map)).toBeNull()
  })

  it('roundtrips host token cookie without exposing other hosts', () => {
    const payload = writeHostTokenMap({}, 'ewis', 'secret-ewis', Date.now() + 120_000)
    payload.hosts.rmb = { token: 'secret-rmb', expiresAt: Date.now() + 120_000 }
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    const map = readHostTokenMap(cookie, SECRET, SECRET)
    expect(map.ewis.token).toBe('secret-ewis')
    expect(map.rmb.token).toBe('secret-rmb')
    expect(clearHostTokenMap().hosts).toEqual({})
    expect(APP_GATE_COOKIE).toBe('derma_app_gate')
  })

  it('rejects expired host tokens', () => {
    const payload = writeHostTokenMap({}, 'ewis', 'old', Date.now() - 1000)
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    expect(readHostTokenMap(cookie, SECRET, SECRET)).toEqual({})
  })
})
