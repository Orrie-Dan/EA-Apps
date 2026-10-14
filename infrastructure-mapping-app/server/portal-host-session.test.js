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
  wasac: 'https://wasac.example/portal',
  wasacw: 'https://wasac.example',
  rura: 'https://rura.example/portal',
  ruraw: 'https://rura.example',
  reg: 'https://reg.example/portal',
  regw: 'https://reg.example',
}

describe('portal-host-session', () => {
  it('allowlists only known proxy hosts', () => {
    expect(isAllowedProxyHostKey('wasac', PROXY_HOSTS)).toBe(true)
    expect(isAllowedProxyHostKey('evil', PROXY_HOSTS)).toBe(false)
    expect(isAllowedProxyHostKey('../etc', PROXY_HOSTS)).toBe(false)
  })

  it('maps wide aliases to auth hosts and isolates tokens', () => {
    expect(authHostForProxyKey('ghw')).toBe('gh')
    expect(authHostForProxyKey('wasacw')).toBe('wasac')
    expect(authHostForProxyKey('ruraw')).toBe('rura')
    expect(authHostForProxyKey('regw')).toBe('reg')
    expect(authHostForProxyKey('cokw')).toBe('cok')
    expect(authHostForProxyKey('wasac')).toBe('wasac')
    expect(PORTAL_AUTH_HOSTS.has('wasac')).toBe(true)
    expect(PORTAL_AUTH_HOSTS.has('rura')).toBe(true)
    expect(PORTAL_AUTH_HOSTS.has('reg')).toBe(true)
    expect(PORTAL_AUTH_HOSTS.has('cok')).toBe(true)

    const map = writeHostTokenMap({}, 'wasac', 'wasac-token', Date.now() + 60_000).hosts
    expect(resolveTokenForProxyHost('wasac', map)).toBe('wasac-token')
    expect(resolveTokenForProxyHost('wasacw', map)).toBe('wasac-token')
    expect(resolveTokenForProxyHost('rura', map)).toBeNull()
    expect(resolveTokenForProxyHost('gh', map)).toBeNull()
  })

  it('roundtrips host token cookie without exposing other hosts', () => {
    const payload = writeHostTokenMap({}, 'wasac', 'secret-wasac', Date.now() + 120_000)
    payload.hosts.rura = { token: 'secret-rura', expiresAt: Date.now() + 120_000 }
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    const map = readHostTokenMap(cookie, SECRET, SECRET)
    expect(map.wasac.token).toBe('secret-wasac')
    expect(map.rura.token).toBe('secret-rura')
    expect(clearHostTokenMap().hosts).toEqual({})
    expect(APP_GATE_COOKIE).toBe('infra_app_gate')
    expect(PORTAL_HOST_COOKIE).toBe('infra_portal_hosts')
  })

  it('rejects expired host tokens', () => {
    const payload = writeHostTokenMap({}, 'wasac', 'old', Date.now() - 1000)
    const cookie = `${PORTAL_HOST_COOKIE}=${signPayload(payload, SECRET, SECRET)}`
    expect(readHostTokenMap(cookie, SECRET, SECRET)).toEqual({})
  })
})
