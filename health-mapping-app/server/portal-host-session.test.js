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
  rbc: 'https://rbc.example/portal',
  rbcw: 'https://rbc.example',
  esrirw: 'https://esrirw.example/portal',
  esrirww: 'https://esrirw.example',
}

describe('portal-host-session', () => {
  it('allowlists only known proxy hosts', () => {
    expect(isAllowedProxyHostKey('rbc', PROXY_HOSTS)).toBe(true)
    expect(isAllowedProxyHostKey('evil', PROXY_HOSTS)).toBe(false)
    expect(isAllowedProxyHostKey('../etc', PROXY_HOSTS)).toBe(false)
  })

  it('maps wide aliases to auth hosts and isolates tokens', () => {
    expect(authHostForProxyKey('rbcw')).toBe('rbc')
    expect(authHostForProxyKey('esrirww')).toBe('esrirw')
    expect(authHostForProxyKey('ghw')).toBe('gh')
    expect(PORTAL_AUTH_HOSTS.has('rbc')).toBe(true)
    expect(PORTAL_AUTH_HOSTS.has('esrirw')).toBe(true)

    const map = writeHostTokenMap({}, 'rbc', 'rbc-token', Date.now() + 60_000).hosts
    expect(resolveTokenForProxyHost('rbc', map)).toBe('rbc-token')
    expect(resolveTokenForProxyHost('rbcw', map)).toBe('rbc-token')
    expect(resolveTokenForProxyHost('esrirw', map)).toBeNull()
    expect(resolveTokenForProxyHost('gh', map)).toBeNull()
  })

  it('roundtrips host token cookie without exposing other hosts', () => {
    const payload = writeHostTokenMap({}, 'rbc', 'secret-rbc', Date.now() + 120_000)
    payload.hosts.esrirw = { token: 'secret-esri', expiresAt: Date.now() + 120_000 }
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    const map = readHostTokenMap(cookie, SECRET, SECRET)
    expect(map.rbc.token).toBe('secret-rbc')
    expect(map.esrirw.token).toBe('secret-esri')
    expect(clearHostTokenMap().hosts).toEqual({})
    expect(APP_GATE_COOKIE).toBe('health_app_gate')
    expect(PORTAL_HOST_COOKIE).toBe('health_portal_hosts')
  })

  it('rejects expired host tokens', () => {
    const payload = writeHostTokenMap({}, 'rbc', 'old', Date.now() - 1000)
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    expect(readHostTokenMap(cookie, SECRET, SECRET)).toEqual({})
  })
})
