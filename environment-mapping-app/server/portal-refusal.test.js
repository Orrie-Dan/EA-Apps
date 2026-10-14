import { describe, expect, it } from 'vitest'
import { softenPermissionRefusal } from './portal-refusal.js'

const refused = JSON.stringify({
  error: {
    code: 403,
    messageCode: 'GWM_0003',
    message: 'You do not have permissions to access this resource or perform this operation.',
    details: [],
  },
})

describe('softenPermissionRefusal', () => {
  it('reports a 403 refusal of an authenticated request as 400, keeping the reason', () => {
    const out = JSON.parse(softenPermissionRefusal(refused, true))
    expect(out.error.code).toBe(400)
    expect(out.error.messageCode).toBe('GWM_0003')
    expect(out.error.message).toMatch(/do not have permissions/)
  })

  it('leaves a 403 alone when no token was attached, so sign-in can still be prompted', () => {
    expect(softenPermissionRefusal(refused, false)).toBe(refused)
  })

  it('leaves token errors alone so expired credentials are still renewed', () => {
    for (const code of [498, 499, 401]) {
      const body = JSON.stringify({ error: { code, message: 'Invalid token.' } })
      expect(softenPermissionRefusal(body, true)).toBe(body)
    }
  })

  it('leaves ordinary payloads, large bodies and non-JSON untouched', () => {
    const item = JSON.stringify({ id: 'abc', access: 'org', error: null })
    const big = `{"error":{"code":403},"pad":"${'x'.repeat(5000)}"}`
    for (const body of [item, big, '{"error":', 'not json', '']) {
      expect(softenPermissionRefusal(body, true)).toBe(body)
    }
  })
})
